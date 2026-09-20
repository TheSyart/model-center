import { NextRequest, NextResponse } from 'next/server';
import { checkGatewayAuth } from '@/lib/gateway/auth';
import { openaiErrorResponse } from '@/lib/gateway/errors';
import { runModalityRequest } from '@/lib/gateway/modality-pipeline';
import { withRawCapture } from '@/lib/raw-capture/capture';
import { normalizeRequestSource } from '@/lib/services/usage-metrics';
import {
  acceptsBailianAsr,
  bailianAudioRejectMessage,
  callBailianAsr,
  resolveBailianAudioRoute,
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
          signal,
        });
        return { response: NextResponse.json({ text: result.text, transcripts: result.transcripts }) };
      }

      // 只有确认要发给百炼之后才把文件读进内存。
      const blob = file as Blob;
      const buffer = Buffer.from(await blob.arrayBuffer());
      const audioDataUri = `data:${blob.type || 'audio/wav'};base64,${buffer.toString('base64')}`;

      const asr = await callBailianAsr(target.provider, apiKey, {
        model: target.modelId,
        audioDataUriOrUrl: audioDataUri,
        languageHints: language ? [language] : undefined,
        contextMessages: prompt ? [{ role: 'user', text: prompt }] : undefined,
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
