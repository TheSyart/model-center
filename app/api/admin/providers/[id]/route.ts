import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto';
import { db, schema } from '@/lib/db';
import { PROTOCOLS, getProvider, serializeProvider, validateBaseUrl } from '@/lib/services/provider';
import type { Protocol } from '@/lib/services/provider';

interface PatchBody {
  name?: string;
  protocol?: string;
  base_url?: string;
  api_key?: string;
  enabled?: boolean;
  priority?: number;
  remark?: string;
  balance_config?: string | null;
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

  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: 'name 不能为空' }, { status: 400 });
    updates.name = body.name.trim();
  }
  if (body.protocol !== undefined) {
    if (!(PROTOCOLS as readonly string[]).includes(body.protocol)) {
      return NextResponse.json({ error: `protocol 必须是 ${PROTOCOLS.join(' / ')}` }, { status: 400 });
    }
    updates.protocol = body.protocol as Protocol;
  }
  if (body.base_url !== undefined) {
    const baseUrl = body.base_url.trim();
    if (!baseUrl) return NextResponse.json({ error: 'base_url 不能为空' }, { status: 400 });
    const urlError = validateBaseUrl(baseUrl);
    if (urlError) return NextResponse.json({ error: urlError }, { status: 400 });
    updates.baseUrl = baseUrl;
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

  db.update(schema.providers).set(updates).where(eq(schema.providers.id, id)).run();
  return NextResponse.json({ provider: serializeProvider(getProvider(id)!) });
}

// DELETE /api/admin/providers/:id
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  if (!getProvider(id)) {
    return NextResponse.json({ error: '服务商不存在' }, { status: 404 });
  }
  db.delete(schema.providers).where(eq(schema.providers.id, id)).run();
  return NextResponse.json({ ok: true });
}
