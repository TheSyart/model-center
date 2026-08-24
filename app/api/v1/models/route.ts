import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { checkGatewayAuth } from '@/lib/gateway/auth';
import { openaiErrorResponse } from '@/lib/gateway/errors';

interface ModelEntry {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

// GET /api/v1/models（对外 /v1/models）：所有启用模型的聚合列表（OpenAI 格式）
export async function GET(req: NextRequest) {
  const auth = checkGatewayAuth(req);
  if (!auth.ok) {
    return openaiErrorResponse(401, auth.message, { type: 'authentication_error', code: auth.code });
  }

  const now = Math.floor(Date.now() / 1000);
  const data: ModelEntry[] = [];
  const seen = new Set<string>();
  const push = (id: string, ownedBy: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    data.push({ id, object: 'model', created: now, owned_by: ownedBy });
  };

  // 启用服务商下的启用模型：id 为 provider-slug/model_id；有别名的额外列别名条目
  const rows = db
    .select({ model: schema.models, provider: schema.providers })
    .from(schema.models)
    .innerJoin(schema.providers, eq(schema.models.providerId, schema.providers.id))
    .all();
  for (const { model, provider } of rows) {
    if (provider.enabled !== 1 || model.enabled !== 1) continue;
    push(`${provider.slug}/${model.modelId}`, provider.slug);
    if (model.alias) push(model.alias, provider.slug);
  }

  // 启用的路由别名也作为可调用模型名列出
  const aliases = db.select().from(schema.routeAliases).all();
  for (const a of aliases) {
    if (a.enabled === 1) push(a.alias, 'model-center');
  }

  return NextResponse.json({ object: 'list', data });
}
