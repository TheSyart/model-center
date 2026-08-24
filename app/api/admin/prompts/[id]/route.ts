import { NextRequest, NextResponse } from 'next/server';
import { deletePrompt, getPromptById, serializePrompt, updatePrompt } from '@/lib/services/prompt';

// GET /api/admin/prompts/:id
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = getPromptById(id);
  if (!row) return NextResponse.json({ error: '提示词不存在' }, { status: 404 });
  return NextResponse.json({ prompt: serializePrompt(row) });
}

interface PatchBody {
  name?: string;
  content?: string;
  description?: string;
}

// PATCH /api/admin/prompts/:id
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体非法' }, { status: 400 });
  }
  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: 'name 不能为空' }, { status: 400 });
    if (!/^[\w][\w-]*$/.test(body.name.trim())) {
      return NextResponse.json({ error: 'name 只能包含字母、数字、下划线、连字符' }, { status: 400 });
    }
    body.name = body.name.trim();
  }
  if (body.content !== undefined && !body.content) {
    return NextResponse.json({ error: 'content 不能为空' }, { status: 400 });
  }

  const row = updatePrompt(id, { name: body.name, content: body.content, description: body.description });
  if (row === 'conflict') return NextResponse.json({ error: `name "${body.name}" 已存在` }, { status: 409 });
  if (!row) return NextResponse.json({ error: '提示词不存在' }, { status: 404 });
  return NextResponse.json({ prompt: serializePrompt(row) });
}

// DELETE /api/admin/prompts/:id
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!deletePrompt(id)) return NextResponse.json({ error: '提示词不存在' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
