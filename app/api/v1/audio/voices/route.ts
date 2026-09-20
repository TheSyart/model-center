import { NextRequest, NextResponse } from 'next/server';
import { checkGatewayAuth } from '@/lib/gateway/auth';
import { openaiErrorResponse } from '@/lib/gateway/errors';
import { runModalityRequest } from '@/lib/gateway/modality-pipeline';
import { withRawCapture } from '@/lib/raw-capture/capture';
import { normalizeRequestSource } from '@/lib/services/usage-metrics';
import { UpstreamError } from '@/lib/upstream-error';
import { acceptsBailianVoiceCustomization, bailianVoiceRejectMessage } from '@/lib/vendors/bailian/audio';
import {
  createBailianVoice,
  getBailianUploadPolicy,
  listBailianVoices,
  needsOssUpload,
  uploadBailianSample,
  type BailianVoice,
} from '@/lib/vendors/bailian/voices';

/**
 * 自定义音色（声音复刻 / 声音设计）。
 *
 * OpenAI 没有对应接口，这一组是本网关自己定的，形状照 /v1/audio/voices 的惯例。
 * 每个请求都带 `model` = **目标合成模型**（如 `bailian/cosyvoice-v3-flash`）：
 * 音色绑定 target_model，且上游有两套字段名完全不同的 API，靠它来分流；
 * 同时它也是解析服务商的依据，于是鉴权、服务商守卫、限额、日志全都复用
 * runModalityRequest，与其它语音接口一致。
 *
 * **不落库**：上游支持分页列举，本地再存一份只会漂移。
 */

const MAX_SAMPLE_BYTES = 25 * 1024 * 1024;

/** 上游对名字格式有要求，先在本地挡掉，免得拿一个看不懂的上游错误回去。 */
const NAME_PATTERN = /^[a-z0-9]{1,20}$/;

/** 实测：短于 15 字上游回 `preview_text should not be shorter than 15 characters`。 */
const MIN_PREVIEW_TEXT = 15;

function serialize(voice: BailianVoice) {
  return {
    id: voice.id,
    object: 'audio.voice',
    target_model: voice.targetModel ?? null,
    status: voice.status ?? null,
    created_at: voice.createdAt ?? null,
    updated_at: voice.updatedAt ?? null,
    ...(voice.preview ? { preview: { data: voice.preview.data, content_type: voice.preview.contentType } } : {}),
  };
}

// GET /api/v1/audio/voices?model=…
async function handleGet(req: NextRequest): Promise<Response> {
  const auth = checkGatewayAuth(req);
  if (!auth.ok) {
    return openaiErrorResponse(401, auth.message, { type: 'authentication_error', code: auth.code });
  }

  const params = req.nextUrl.searchParams;
  const model = params.get('model')?.trim();
  if (!model) {
    return openaiErrorResponse(400, '缺少必需的 model 参数：音色绑定目标合成模型，列举时要指明是哪一个', {
      param: 'model',
    });
  }

  return runModalityRequest({
    entry: 'openai',
    requestedModel: model,
    token: auth.token,
    source: normalizeRequestSource(req.headers.get('user-agent')),
    clientSignal: req.signal,
    accepts: acceptsBailianVoiceCustomization,
    rejectMessage: (target) => bailianVoiceRejectMessage(target.modelId, target.provider),
    errorResponse: (status, message, code) => openaiErrorResponse(status, message, { code }),
    execute: async ({ target, apiKey, signal }) => {
      const page = await listBailianVoices(target.provider, apiKey, {
        targetModel: target.modelId,
        prefix: params.get('prefix')?.trim() || undefined,
        pageIndex: Number(params.get('page_index') ?? 0) || 0,
        pageSize: Number(params.get('page_size') ?? 20) || 20,
        signal,
      });
      return {
        response: NextResponse.json({
          object: 'list',
          data: page.voices.map(serialize),
          page_index: page.pageIndex ?? null,
          page_size: page.pageSize ?? null,
          total_count: page.totalCount ?? null,
        }),
      };
    },
  });
}

/**
 * 两种请求体都收。
 *
 * 复刻要上传样本，只能走 multipart；设计只有几个字符串字段，JSON 更顺手，
 * 而且调用方本来就是从一个表单页面发过来的。强行只认一种会把设计这条路
 * 逼成一个没有文件的 multipart，没有道理。
 */
async function readVoiceInput(
  req: NextRequest,
): Promise<{ fields: Record<string, string | undefined>; file: Blob | null } | { error: Response }> {
  const contentType = req.headers.get('content-type') ?? '';
  const pick = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

  if (contentType.includes('application/json')) {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return { error: openaiErrorResponse(400, '请求体不是合法 JSON', { code: 'invalid_json' }) };
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { error: openaiErrorResponse(400, '请求体必须是 JSON 对象', { code: 'invalid_json' }) };
    }
    return {
      file: null,
      fields: {
        model: pick(body.model),
        name: pick(body.name),
        audio_url: pick(body.audio_url),
        prompt: pick(body.prompt),
        preview_text: pick(body.preview_text),
        language: pick(body.language),
      },
    };
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return {
      error: openaiErrorResponse(400, '请求体既不是 JSON 也不是合法的 multipart/form-data', {
        code: 'invalid_request_body',
      }),
    };
  }
  const raw = form.get('file');
  return {
    file: raw instanceof Blob ? raw : null,
    fields: {
      model: pick(form.get('model')),
      name: pick(form.get('name')),
      audio_url: pick(form.get('audio_url')),
      prompt: pick(form.get('prompt')),
      preview_text: pick(form.get('preview_text')),
      language: pick(form.get('language')),
    },
  };
}

// POST /api/v1/audio/voices —— 带 file/audio_url 是复刻，带 prompt 是设计。
async function handlePost(req: NextRequest): Promise<Response> {
  const auth = checkGatewayAuth(req);
  if (!auth.ok) {
    return openaiErrorResponse(401, auth.message, { type: 'authentication_error', code: auth.code });
  }

  const parsed = await readVoiceInput(req);
  if ('error' in parsed) return parsed.error;
  const { fields, file } = parsed;

  const model = fields.model;
  if (!model) return openaiErrorResponse(400, '缺少必需的模型参数 (model)', { param: 'model' });

  const name = fields.name;
  if (!name) return openaiErrorResponse(400, '缺少音色名 (name)', { param: 'name' });
  if (!NAME_PATTERN.test(name)) {
    return openaiErrorResponse(400, '音色名只能是 1-20 位小写字母或数字', { param: 'name', code: 'invalid_voice_name' });
  }

  const audioUrl = fields.audio_url;
  const prompt = fields.prompt;
  const previewText = fields.preview_text;
  const language = fields.language;

  const hasSample = Boolean(audioUrl) || file !== null;
  if (!hasSample && !prompt) {
    return openaiErrorResponse(
      400,
      '声音复刻要给样本（file 上传或 audio_url 地址），声音设计要给 prompt 描述；两者至少给一个。',
      { code: 'missing_voice_source' },
    );
  }
  if (hasSample && prompt) {
    return openaiErrorResponse(400, '样本与 prompt 只能给一个：有样本是复刻，有 prompt 是设计。', {
      code: 'ambiguous_voice_source',
    });
  }
  if (prompt && previewText && previewText.length < MIN_PREVIEW_TEXT) {
    return openaiErrorResponse(
      400,
      `试听文本 (preview_text) 至少 ${MIN_PREVIEW_TEXT} 个字符，当前 ${previewText.length} 个`,
      { param: 'preview_text', code: 'preview_text_too_short' },
    );
  }
  if (file && file.size > MAX_SAMPLE_BYTES) {
    return openaiErrorResponse(
      413,
      `样本音频 ${(file.size / 1024 / 1024).toFixed(1)}MB 超出上限 ${MAX_SAMPLE_BYTES / 1024 / 1024}MB`,
      { param: 'file', code: 'file_too_large' },
    );
  }

  return runModalityRequest({
    entry: 'openai',
    requestedModel: model,
    token: auth.token,
    source: normalizeRequestSource(req.headers.get('user-agent')),
    clientSignal: req.signal,
    accepts: acceptsBailianVoiceCustomization,
    rejectMessage: (target) => bailianVoiceRejectMessage(target.modelId, target.provider),
    errorResponse: (status, message, code) => openaiErrorResponse(status, message, { code }),
    execute: async ({ target, apiKey, signal }) => {
      let sampleUrl = audioUrl;

      if (!sampleUrl && file) {
        if (needsOssUpload(target.modelId)) {
          /**
           * 这一族的上游只收地址，不收 base64。网关没有对象存储，所以借百炼自己的：
           * 取直传策略 → 表单上传 → 拿到 oss:// 地址（48 小时有效）。
           */
          const policy = await getBailianUploadPolicy(target.provider, apiKey, target.modelId, signal);
          const fileName = file instanceof File && file.name ? file.name : `${name}.wav`;
          sampleUrl = await uploadBailianSample(policy, file, fileName, signal);
        } else {
          // qwen-voice-enrollment 的 audio.data 直接收 data URI，省掉上传这一跳。
          const buffer = Buffer.from(await file.arrayBuffer());
          sampleUrl = `data:${file.type || 'audio/wav'};base64,${buffer.toString('base64')}`;
        }
      }

      const voice = await createBailianVoice(target.provider, apiKey, {
        targetModel: target.modelId,
        name,
        audioUrl: sampleUrl,
        prompt,
        previewText,
        languageHints: language ? [language] : undefined,
        signal,
      });
      if (!voice.id) throw new UpstreamError(502, '百炼创建音色成功但没有返回音色 ID');

      return { response: NextResponse.json(serialize(voice), { status: 201 }), status: 201 };
    },
  });
}

export const GET = withRawCapture({ entry: 'audio-voices', path: '/v1/audio/voices' }, handleGet);
export const POST = withRawCapture({ entry: 'audio-voices', path: '/v1/audio/voices' }, handlePost);
