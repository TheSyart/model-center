import { NextRequest, NextResponse } from 'next/server';
import { checkGatewayAuth } from '@/lib/gateway/auth';
import { openaiErrorResponse } from '@/lib/gateway/errors';
import { runModalityRequest } from '@/lib/gateway/modality-pipeline';
import { withRawCapture } from '@/lib/raw-capture/capture';
import { normalizeRequestSource } from '@/lib/services/usage-metrics';
import {
  acceptsBailianAsr,
  audioFormatFromName,
  bailianAudioRejectMessage,
  callBailianAsr,
  resolveBailianAudioRoute,
  supportsBailianVocabulary,
} from '@/lib/vendors/bailian/audio';
import { callBailianFiletrans } from '@/lib/vendors/bailian/asr-filetrans';

/**
 * 网关自身的内存护栏，不是上游的限制。
 *
 * 音频要整个读进内存再 base64 成 data URI（约 1.37 倍），没有上限的话
 * 一个大文件就能把进程撑爆。25 MiB 取自 OpenAI 转写接口的同名限制，
 * 对照着用最不容易让客户端意外。
 */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

// POST /api/v1/audio/transcriptions（对外经 rewrite 暴露为 /v1/audio/transcriptions）
async function handlePost(req: NextRequest): Promise<Response> {
  const auth = checkGatewayAuth(req);
  if (!auth.ok) {
    return openaiErrorResponse(401, auth.message, { type: 'authentication_error', code: auth.code });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return openaiErrorResponse(400, '请求体不是合法的 multipart/form-data', { code: 'invalid_form_data' });
  }

  const model = (formData.get('model') as string | null)?.trim();
  if (!model) return openaiErrorResponse(400, '缺少必需的模型参数 (model)', { param: 'model' });

  const language = (formData.get('language') as string | null)?.trim();
  const prompt = (formData.get('prompt') as string | null)?.trim();
  /**
   * 对 OpenAI 契约的扩展：录音文件转写模型只接受公网可访问的 URL，
   * 网关没有对象存储能替客户端上传，所以由客户端直接给地址。
   */
  const fileUrl = (formData.get('file_url') as string | null)?.trim();
  /** 同样是扩展：热词。OpenAI 没有对应字段，不传就退回原样。 */
  const vocabularyRaw = (formData.get('vocabulary') as string | null)?.trim();
  const vocabularyId = (formData.get('vocabulary_id') as string | null)?.trim();

  let vocabulary: Record<string, number> | undefined;
  if (vocabularyRaw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(vocabularyRaw);
    } catch {
      return openaiErrorResponse(400, 'vocabulary 必须是 JSON 对象字符串，例如 {"小单":5}', {
        param: 'vocabulary',
        code: 'invalid_vocabulary',
      });
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return openaiErrorResponse(400, 'vocabulary 必须是「词 → 权重」的 JSON 对象，例如 {"小单":5}', {
        param: 'vocabulary',
        code: 'invalid_vocabulary',
      });
    }
    const entries = Object.entries(parsed as Record<string, unknown>);
    for (const [word, weight] of entries) {
      if (typeof weight !== 'number' || !Number.isFinite(weight)) {
        return openaiErrorResponse(400, `热词 "${word}" 的权重必须是数字（1-5，50 为超权重）`, {
          param: 'vocabulary',
          code: 'invalid_vocabulary',
        });
      }
    }
    vocabulary = Object.fromEntries(entries) as Record<string, number>;
  }

  if ((vocabulary || vocabularyId) && !supportsBailianVocabulary(model)) {
    // 静默丢弃最坏：客户端以为热词生效了，其实一直没有。
    return openaiErrorResponse(
      400,
      `模型 "${model}" 不支持热词。qwen3-asr 系列在官方规格里「热词」就是否，实测传了也不生效；` +
        '请改用 qwen-audio-3.0-asr-flash（或它的 -filetrans 版本），那一族支持 vocabulary。',
      { param: 'vocabulary', code: 'vocabulary_not_supported' },
    );
  }

  const route = resolveBailianAudioRoute(model);
  const isFiletrans = route.supported && route.kind === 'asr-filetrans';
  const file = formData.get('file');

  if (isFiletrans) {
    if (!fileUrl) {
      return openaiErrorResponse(
        400,
        `模型 "${model}" 是录音文件转写模型，只接受公网可访问的音频地址：请用 file_url 字段代替 file 上传。`,
        { param: 'file_url', code: 'file_url_required' },
      );
    }
  } else {
    if (fileUrl) {
      return openaiErrorResponse(
        400,
        `模型 "${model}" 是同步识别模型，请用 file 上传音频；file_url 只适用于 *-filetrans 模型。`,
        { param: 'file_url' },
      );
    }
    if (!file || !(file instanceof Blob)) {
      return openaiErrorResponse(400, '缺少必需的音频文件 (file)', { param: 'file' });
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return openaiErrorResponse(
        413,
        `音频文件 ${(file.size / 1024 / 1024).toFixed(1)}MB 超出上限 ${MAX_AUDIO_BYTES / 1024 / 1024}MB`,
        { param: 'file', code: 'file_too_large' },
      );
    }
  }

  return runModalityRequest({
    entry: 'openai',
    requestedModel: model,
    token: auth.token,
    source: normalizeRequestSource(req.headers.get('user-agent')),
    clientSignal: req.signal,
    accepts: acceptsBailianAsr,
    rejectMessage: (target) => bailianAudioRejectMessage('ASR', target.modelId, target.provider),
    errorResponse: (status, message, code) => openaiErrorResponse(status, message, { code }),
    execute: async ({ target, apiKey, signal }) => {
      if (isFiletrans) {
        const result = await callBailianFiletrans(target.provider, apiKey, {
          model: target.modelId,
          fileUrl: fileUrl!,
          vocabulary,
          vocabularyId,
          languageHints: language ? [language] : undefined,
          signal,
        });
        return { response: NextResponse.json({ text: result.text, transcripts: result.transcripts }) };
      }

      // 只有确认要发给百炼之后才把文件读进内存。
      const blob = file as Blob;
      const buffer = Buffer.from(await blob.arrayBuffer());
      const mime = blob.type || 'audio/wav';
      const audioDataUri = `data:${mime};base64,${buffer.toString('base64')}`;

      const asr = await callBailianAsr(target.provider, apiKey, {
        model: target.modelId,
        audioDataUriOrUrl: audioDataUri,
        languageHints: language ? [language] : undefined,
        // 角色必须是 system——user 会被上游以 InvalidParameter 拒掉，
        // 这正是 OpenAI 标准的 prompt 字段此前在网关上 400 的原因。
        contextMessages: prompt ? [{ role: 'system', text: prompt }] : undefined,
        vocabulary,
        vocabularyId,
        format: audioFormatFromName(mime, file instanceof File ? file.name : undefined),
        signal,
      });

      return { response: NextResponse.json({ text: asr.text }) };
    },
  });
}

export const POST = withRawCapture(
  { entry: 'audio-transcriptions', path: '/v1/audio/transcriptions' },
  handlePost,
);

export function GET() {
  return openaiErrorResponse(405, 'Method not allowed');
}
