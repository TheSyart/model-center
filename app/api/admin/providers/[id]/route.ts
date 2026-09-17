import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto';
import { db, schema, sqlite } from '@/lib/db';
import { getPreset } from '@/lib/presets';
import { EndpointValidationError, listProviderEndpoints, replaceProviderEndpoints } from '@/lib/services/provider-endpoint';
import { resolveEndpointSetForPatch } from '@/lib/services/provider-endpoint-request';
import { getProvider, serializeProvider, validateBaseUrl, providerAuthPolicy, ProviderAuthError, rejectSubscriptionProviderAction } from '@/lib/services/provider';
import { isOfficialBailianCatalogProvider, normalizeBailianWorkspaceId } from '@/lib/services/bailian-catalog';

interface PatchBody {
  name?: string;
  protocol?: string;
  base_url?: string;
  preset_key?: string | null;
  endpoints?: unknown[];
  default_protocol?: string;
  api_key?: string;
  enabled?: boolean;
  priority?: number;
  remark?: string;
  balance_config?: string | null;
  workspace_id?: unknown;
}

// PATCH /api/admin/providers/:id：修改（含启用/禁用）；api_key 非空时才更新
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const existing = getProvider(id);
  if (!existing) {
    return NextResponse.json({ error: '服务商不存在' }, { status: 404 });
  }

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体非法' }, { status: 400 });
  }

  try { providerAuthPolicy.validatePatch(id, body as Record<string, unknown>); }
  catch (error) { if (error instanceof ProviderAuthError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; }

  let endpoints;
  try {
    endpoints = resolveEndpointSetForPatch(body, listProviderEndpoints(sqlite, id), getPreset, validateBaseUrl);
  } catch (error) {
    if (error instanceof EndpointValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }

  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: 'name 不能为空' }, { status: 400 });
    updates.name = body.name.trim();
  }
  if (body.preset_key !== undefined) {
    updates.presetKey = typeof body.preset_key === 'string' ? body.preset_key.trim() : null;
  }
  if (body.api_key !== undefined && body.api_key.trim() !== '') {
    updates.apiKeyEnc = encrypt(body.api_key.trim());
  }
  if (body.enabled !== undefined) {
    updates.enabled = body.enabled ? 1 : 0;
  }
  if (body.priority !== undefined) {
    updates.priority = body.priority;
  }
  if (body.remark !== undefined) {
    updates.remark = body.remark.trim() || null;
  }
  if (body.balance_config !== undefined) {
    updates.balanceConfig = body.balance_config;
  }
  const nextPresetKey = body.preset_key === undefined
    ? existing.presetKey
    : typeof body.preset_key === 'string' ? body.preset_key.trim() : null;
  const officialBailian = isOfficialBailianCatalogProvider({ slug: existing.slug, presetKey: nextPresetKey });
  if (body.workspace_id !== undefined) {
    let workspaceId: string | null;
    try {
      workspaceId = normalizeBailianWorkspaceId(body.workspace_id);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : '百炼 Workspace ID 无效' }, { status: 400 });
    }
    if (officialBailian && !workspaceId) {
      return NextResponse.json({ error: '百炼服务商必须配置 Workspace ID' }, { status: 400 });
    }
    if (!officialBailian && workspaceId) {
      return NextResponse.json({ error: 'Workspace ID 仅用于普通百炼服务商' }, { status: 400 });
    }
    updates.workspaceId = workspaceId;
  } else if (body.preset_key !== undefined && !officialBailian) {
    updates.workspaceId = null;
  }

  sqlite.transaction(() => {
    db.update(schema.providers).set(updates).where(eq(schema.providers.id, id)).run();
    if (body.enabled !== undefined) providerAuthPolicy.syncEnabled(id, body.enabled, Number(updates.updatedAt));
    if (endpoints) replaceProviderEndpoints(sqlite, id, endpoints, Date.now(), validateBaseUrl);
  })();
  return NextResponse.json({ provider: serializeProvider(getProvider(id)!) });
}

// DELETE /api/admin/providers/:id
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  if (!getProvider(id)) {
    return NextResponse.json({ error: '服务商不存在' }, { status: 404 });
  }
  const blocked = rejectSubscriptionProviderAction(id); if (blocked) return blocked;
  db.delete(schema.providers).where(eq(schema.providers.id, id)).run();
  return NextResponse.json({ ok: true });
}
