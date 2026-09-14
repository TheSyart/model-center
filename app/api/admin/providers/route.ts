import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto';
import { db, schema, sqlite } from '@/lib/db';
import { getPreset } from '@/lib/presets';
import { EndpointValidationError, replaceProviderEndpoints } from '@/lib/services/provider-endpoint';
import { resolveEndpointSetForCreate } from '@/lib/services/provider-endpoint-request';
import { getProvider, listProviders, providerAuthPolicy, serializeProvider, validateBaseUrl } from '@/lib/services/provider';

// GET /api/admin/providers：服务商列表（不含 api_key，只返回 has_key）。
// ?auth_kind=api_key 只返回 API Key 服务商（服务商页）；默认含订阅服务商（别名、日志、看板需要）。
export async function GET(req: Request) {
  const linked = new URL(req.url).searchParams.get('auth_kind') === 'api_key' ? providerAuthPolicy.linkedProviderIds() : null;
  const providers = listProviders().filter((provider) => !linked?.has(provider.id));
  return NextResponse.json({ providers: providers.map((provider) => serializeProvider(provider)) });
}

interface CreateBody {
  slug?: string;
  name?: string;
  protocol?: string;
  base_url?: string;
  preset_key?: string | null;
  endpoints?: unknown[];
  default_protocol?: string;
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

  let endpoints;
  try {
    endpoints = resolveEndpointSetForCreate(body, getPreset, validateBaseUrl);
  } catch (error) {
    if (error instanceof EndpointValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
  const presetKey = typeof body.preset_key === 'string' ? body.preset_key.trim() : null;
  const preset = presetKey ? getPreset(presetKey) : undefined;
  const slug = body.slug?.trim() || preset?.slug;
  const name = body.name?.trim() || preset?.name;
  const apiKey = body.api_key?.trim();
  if (!slug || !name) {
    return NextResponse.json({ error: 'slug、name 不能为空' }, { status: 400 });
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return NextResponse.json({ error: 'slug 只能包含小写字母、数字、连字符' }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: 'api_key 不能为空' }, { status: 400 });
  }

  const now = Date.now();
  const defaultEndpoint = endpoints.find((endpoint) => endpoint.is_default)!;
  const balancePreset = preset ?? getPreset(slug);
  const row = {
    id: crypto.randomUUID(),
    slug,
    name,
    protocol: defaultEndpoint.protocol,
    baseUrl: defaultEndpoint.base_url,
    presetKey: preset?.presetKey ?? null,
    apiKeyEnc: encrypt(apiKey),
    enabled: body.enabled === false ? 0 : 1,
    priority: typeof body.priority === 'number' ? body.priority : 0,
    balanceConfig: balancePreset?.balance?.endpoint
      ? JSON.stringify({ endpoint: balancePreset.balance.endpoint, method: balancePreset.balance.method ?? 'GET' })
      : null,
    remark: body.remark?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    sqlite.transaction(() => {
      db.insert(schema.providers).values(row).run();
      replaceProviderEndpoints(sqlite, row.id, endpoints, now, validateBaseUrl);
    })();
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      return NextResponse.json({ error: `slug "${slug}" 已存在` }, { status: 409 });
    }
    throw e;
  }
  return NextResponse.json({ provider: serializeProvider(getProvider(row.id)!) }, { status: 201 });
}
