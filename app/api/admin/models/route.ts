import { NextRequest, NextResponse } from 'next/server';
import { createModel, listModels, serializeModel } from '@/lib/services/model';
import type { ModelInput } from '@/lib/services/model';
import { getProvider } from '@/lib/services/provider';

// GET /api/admin/models?provider=<id>：模型列表（可按 provider 过滤）
export async function GET(req: NextRequest) {
  const providerId = req.nextUrl.searchParams.get('provider') || undefined;
  return NextResponse.json({ models: listModels(providerId).map(serializeModel) });
}

// POST /api/admin/models：手动添加模型（synced=0）
export async function POST(req: NextRequest) {

  let body: Partial<ModelInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体非法' }, { status: 400 });
  }
  if (!body.provider_id || !body.model_id?.trim()) {
    return NextResponse.json({ error: 'provider_id 与 model_id 不能为空' }, { status: 400 });
  }
  if (!getProvider(body.provider_id)) {
    return NextResponse.json({ error: '服务商不存在' }, { status: 404 });
  }
  if (body.alias && !/^[\w][\w./-]*$/.test(body.alias)) {
    return NextResponse.json({ error: 'alias 格式非法' }, { status: 400 });
  }

  const row = createModel({ ...body, model_id: body.model_id.trim() } as ModelInput);
  if (row === 'conflict') {
    return NextResponse.json({ error: `该服务商下模型 "${body.model_id}" 已存在` }, { status: 409 });
  }
  if (row === 'alias_conflict') {
    return NextResponse.json({ error: `别名 "${body.alias}" 已被占用` }, { status: 409 });
  }
  return NextResponse.json({ model: serializeModel(row) }, { status: 201 });
}
