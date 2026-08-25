import { NextRequest, NextResponse } from 'next/server';

import { sqlite } from '@/lib/db';
import { saveSecurityLabConfigInput } from '@/lib/security-lab/admin';
import { SecurityLabConfigError } from '@/lib/security-lab/config';
import { createSecurityLabStore } from '@/lib/security-lab/store';

export function GET() {
  const store = createSecurityLabStore(sqlite);
  return NextResponse.json({ config: store.getConfig() });
}

export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须是合法 JSON' }, { status: 400 });
  }

  try {
    const store = createSecurityLabStore(sqlite);
    const config = saveSecurityLabConfigInput(store, body);
    return NextResponse.json({ config });
  } catch (error) {
    if (error instanceof SecurityLabConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
