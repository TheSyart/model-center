import { NextRequest, NextResponse } from 'next/server';
import { checkGatewayAuth } from '@/lib/gateway/auth';
import { resolveModel } from '@/lib/gateway/router';
import { decrypt } from '@/lib/crypto';
import { callBailianAsr, isBailianAsrModel } from '@/lib/services/dashscope-audio';
import { isOfficialBailianCatalogProvider } from '@/lib/services/bailian-catalog';
import { writeRequestLog } from '@/lib/gateway/logger';

export async function POST(req: NextRequest) {
  const start = Date.now();
  const auth = checkGatewayAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: { message: auth.message, type: auth.code } }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const model = (formData.get('model') as string | null)?.trim();
    const language = (formData.get('language') as string | null)?.trim();
    const prompt = (formData.get('prompt') as string | null)?.trim();

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: { message: '缺少必需的音频文件 (file)', type: 'invalid_request_error' } },
        { status: 400 },
      );
    }
    if (!model) {
      return NextResponse.json(
        { error: { message: '缺少必需的模型参数 (model)', type: 'invalid_request_error' } },
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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || 'audio/wav';
    const audioDataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;

    const apiKey = decrypt(target.provider.apiKeyEnc);
    const asrRes = await callBailianAsr(target.provider, apiKey, {
      model: target.modelId,
      audioDataUriOrUrl: audioDataUri,
      languageHints: language ? [language] : undefined,
      contextMessages: prompt ? [{ role: 'user', text: prompt }] : undefined,
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
      usage: asrRes.duration
        ? {
            prompt_tokens: Math.round(asrRes.duration * 10),
            completion_tokens: asrRes.text.length,
            total_tokens: Math.round(asrRes.duration * 10) + asrRes.text.length,
          }
        : null,
      error: null,
      stream: false,
    });

    return NextResponse.json({ text: asrRes.text });
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
