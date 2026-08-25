import { NextRequest, NextResponse } from 'next/server';

import { sqlite } from '@/lib/db';
import { historyPagination } from '@/lib/security-lab/admin';
import { createSecurityLabStore } from '@/lib/security-lab/store';

export function GET(req: NextRequest) {
  const store = createSecurityLabStore(sqlite);
  const pagination = historyPagination(req.nextUrl.searchParams);
  return NextResponse.json(store.listHistory(pagination));
}

export function DELETE() {
  const store = createSecurityLabStore(sqlite);
  return NextResponse.json({ deleted: store.clearHistory() });
}
