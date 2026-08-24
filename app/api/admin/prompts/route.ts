import { NextRequest, NextResponse } from 'next/server';
import { createPrompt, listPrompts, serializePrompt } from '@/lib/services/prompt';

// GET /api/admin/prompts：提示词列表
export async function GET() {
  return NextResponse.json({ prompts: listPrompts().map(serializePrompt) });
}

interface CreateBody {
  name?: string;
  content?: string;
  description?: string;
}

// POST /api/admin/prompts：新建提示词
export async function POST(req: NextRequest) {

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体非法' }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: 'name 不能为空' }, { status: 400 });
  if (!/^[\w][\w-]*$/.test(name)) {
    return NextResponse.json({ error: 'name 只能包含字母、数字、下划线、连字符' }, { status: 400 });
  }
  if (!body.content) return NextResponse.json({ error: 'content 不能为空' }, { status: 400 });

  const row = createPrompt({ name, content: body.content, description: body.description?.trim() || null });
  if (!row) return NextResponse.json({ error: `name "${name}" 已存在` }, { status: 409 });
  return NextResponse.json({ prompt: serializePrompt(row) }, { status: 201 });
}
