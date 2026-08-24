import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto';
import { db, schema } from '@/lib/db';
import { getPreset } from '@/lib/presets';
import { PROTOCOLS, listProviders, serializeProvider, validateBaseUrl } from '@/lib/services/provider';
import type { Protocol } from '@/lib/services/provider';

// GET /api/admin/providers：服务商列表（不含 api_key，只返回 has_key）
export async function GET() {
  return NextResponse.json({ providers: listProviders().map(serializeProvider) });
}

interface CreateBody {
  slug?: string;
  name?: string;
  protocol?: string;
  base_url?: string;
  api_key?: string;
  remark?: string;
  priority?: number;
  enabled?: boolean;
}

// POST /api/admin/providers：新建服务商（api_key 加密入库）
export async function POST(req: NextRequest) {

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体非法' }, { status: 400 });
  }

  const slug = body.slug?.trim();
  const name = body.name?.trim();
  const baseUrl = body.base_url?.trim();
  const apiKey = body.api_key?.trim();
  if (!slug || !name || !baseUrl) {
    return NextResponse.json({ error: 'slug、name、base_url 不能为空' }, { status: 400 });
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return NextResponse.json({ error: 'slug 只能包含小写字母、数字、连字符' }, { status: 400 });
  }
  if (!body.protocol || !(PROTOCOLS as readonly string[]).includes(body.protocol)) {
    return NextResponse.json({ error: `protocol 必须是 ${PROTOCOLS.join(' / ')}` }, { status: 400 });
  }
  const urlError = validateBaseUrl(baseUrl);
  if (urlError) {
    return NextResponse.json({ error: urlError }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: 'api_key 不能为空' }, { status: 400 });
  }

  const now = Date.now();
  const preset = getPreset(slug);
  const row = {
    id: crypto.randomUUID(),
    slug,
    name,
    protocol: body.protocol as Protocol,
    baseUrl,
    apiKeyEnc: encrypt(apiKey),
    enabled: body.enabled === false ? 0 : 1,
    priority: typeof body.priority === 'number' ? body.priority : 0,
    balanceConfig: preset?.balance?.endpoint
      ? JSON.stringify({ endpoint: preset.balance.endpoint, method: preset.balance.method ?? 'GET' })
      : null,
    remark: body.remark?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    db.insert(schema.providers).values(row).run();
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      return NextResponse.json({ error: `slug "${slug}" 已存在` }, { status: 409 });
    }
    throw e;
  }
  return NextResponse.json({ provider: serializeProvider(row) }, { status: 201 });
}
