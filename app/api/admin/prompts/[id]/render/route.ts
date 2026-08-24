import { NextRequest, NextResponse } from 'next/server';
import { getPromptById, renderPrompt } from '@/lib/services/prompt';

// POST /api/admin/prompts/:id/render：用变量渲染预览
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = getPromptById(id);
  if (!row) return NextResponse.json({ error: '提示词不存在' }, { status: 404 });

  let body: { vars?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体非法' }, { status: 400 });
  }
  const result = renderPrompt(row.content, body.vars ?? {});
  return NextResponse.json({ rendered: result.text, missing: result.missing });
}
