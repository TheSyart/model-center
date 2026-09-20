import { NextRequest, NextResponse } from 'next/server';
import { checkGatewayAuth } from '@/lib/gateway/auth';
import { resolveModel } from '@/lib/gateway/router';
import { decrypt } from '@/lib/crypto';
import { callBailianTts, isBailianTtsModel } from '@/lib/services/dashscope-audio';
import { writeRequestLog } from '@/lib/gateway/logger';

export async function POST(req: NextRequest) {
  const start = Date.now();
  const auth = checkGatewayAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: { message: auth.message, type: auth.code } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const model = typeof body.model === 'string' ? body.model.trim() : '';
    const text = typeof body.input === 'string' ? body.input.trim() : '';
    const voice = typeof body.voice === 'string' ? body.voice.trim() : undefined;
    const format = (['wav', 'mp3', 'opus', 'pcm'].includes(body.response_format)
      ? body.response_format
      : 'wav') as 'wav' | 'mp3' | 'opus' | 'pcm';
    const speed = typeof body.speed === 'number' ? body.speed : undefined;

    if (!model) {
      return NextResponse.json(
        { error: { message: '缺少必需的模型参数 (model)', type: 'invalid_request_error' } },
        { status: 400 },
      );
    }
    if (!text) {
      return NextResponse.json(
        { error: { message: '缺少必需的待合成文本 (input)', type: 'invalid_request_error' } },
        { status: 400 },
      );
    }

    const route = resolveModel(model);
    const target = route.targets[0];
    if (!target) {
      return NextResponse.json(
        { error: { message: `未找到可用模型: ${model}`, type: 'model_not_found' } },
        { status: 404 },
      );
    }

    const apiKey = decrypt(target.provider.apiKeyEnc);
    const ttsRes = await callBailianTts(target.provider, apiKey, {
      model: target.modelId,
      text,
      voice,
      format,
      rate: speed,
    });

    const latencyMs = Date.now() - start;
    writeRequestLog({
      ts: Date.now(),
      providerId: target.provider.id,
      modelId: target.modelId,
      alias: route.alias,
      tokenId: auth.token?.id,
      tokenName: auth.token?.name,
      tokenPrefix: auth.token?.prefix,
      entryProtocol: 'openai',
      upstreamProtocol: target.provider.protocol,
      status: 200,
      latencyMs,
      usage: ttsRes.characters
        ? {
            prompt_tokens: ttsRes.characters,
            completion_tokens: 0,
            total_tokens: ttsRes.characters,
          }
        : null,
      error: null,
      stream: false,
    });

    if (ttsRes.audioBuffer) {
      const contentType = format === 'mp3' ? 'audio/mpeg' : format === 'opus' ? 'audio/opus' : 'audio/wav';
      return new Response(new Uint8Array(ttsRes.audioBuffer), {
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(ttsRes.audioBuffer.byteLength),
        },
      });
    }

    if (ttsRes.audioUrl) {
      // 若无本地 buffer 则重定向到生成的临时音频地址
      return NextResponse.redirect(ttsRes.audioUrl);
    }

    return NextResponse.json({ error: { message: '百炼 TTS 未能生成音频', type: 'internal_error' } }, { status: 502 });
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    writeRequestLog({
      ts: Date.now(),
      providerId: null,
      modelId: null,
      alias: null,
      tokenId: auth.token?.id,
      tokenName: auth.token?.name,
      tokenPrefix: auth.token?.prefix,
      entryProtocol: 'openai',
      status: 500,
      latencyMs,
      usage: null,
      error: err instanceof Error ? err.message : String(err),
      stream: false,
    });

    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : String(err), type: 'internal_error' } },
      { status: 500 },
    );
  }
}
