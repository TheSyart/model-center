export interface RecordScanPage<T> {
  items: T[];
  total: number;
  pageSize: number;
}

export interface RecordScanOptions<T> {
  maxPages: number;
  maxRecords: number;
  isBoundary?: (record: T) => boolean;
}

export interface RecordScanResult<T> {
  records: T[];
  coverageComplete: boolean;
  boundaryReached: boolean;
  pageOneStable: boolean;
  initialTotal: number;
  requiredPages: number;
  pageCalls: number[];
  diagnostic: string;
}

export interface RecordScanStability {
  hasStableSnapshot: boolean;
  confirmations: number;
  ready: boolean;
}

export async function scanBoundedRecords<T extends { id: string }>(
  fetchPage: (page: number) => Promise<RecordScanPage<T>>,
  options: RecordScanOptions<T>,
): Promise<RecordScanResult<T>> {
  if (!Number.isInteger(options.maxPages) || options.maxPages < 1) {
    throw new Error('maxPages must be a positive integer');
  }
  if (!Number.isInteger(options.maxRecords) || options.maxRecords < 1) {
    throw new Error('maxRecords must be a positive integer');
  }

  const records = new Map<string, T>();
  const pageCalls: number[] = [];
  let boundaryReached = false;
  let recordCapReached = false;

  const addPage = (page: RecordScanPage<T>) => {
    for (const record of page.items) {
      const isBoundary = options.isBoundary?.(record) ?? false;
      if (!records.has(record.id) && records.size >= options.maxRecords) {
        recordCapReached = true;
        if (isBoundary) boundaryReached = true;
        break;
      }
      records.set(record.id, record);
      if (isBoundary) {
        boundaryReached = true;
        break;
      }
    }
  };

  pageCalls.push(1);
  const firstPage = await fetchPage(1);
  if (!Number.isFinite(firstPage.total) || firstPage.total < 0) {
    throw new Error('record scan page total must be a non-negative finite number');
  }
  if (!Number.isInteger(firstPage.pageSize) || firstPage.pageSize < 1) {
    throw new Error('record scan pageSize must be a positive integer');
  }
  const initialTotal = firstPage.total;
  const requiredPages = Math.max(1, Math.ceil(initialTotal / firstPage.pageSize));
  const targetPages = Math.min(requiredPages, options.maxPages);
  const firstPageIds = firstPage.items.map((record) => record.id);
  addPage(firstPage);

  let lastSequentialPage = 1;
  for (let pageNumber = 2; pageNumber <= targetPages; pageNumber++) {
    if (boundaryReached || recordCapReached) break;
    pageCalls.push(pageNumber);
    addPage(await fetchPage(pageNumber));
    lastSequentialPage = pageNumber;
  }

  // OFFSET pagination is newest-first. Re-reading page 1 catches insertions that
  // shifted already-scanned pages during this bounded snapshot.
  pageCalls.push(1);
  const finalPageOne = await fetchPage(1);
  const finalPageOneIds = finalPageOne.items.map((record) => record.id);
  addPage(finalPageOne);

  const pageOneStable = firstPageIds.length === finalPageOneIds.length
    && firstPageIds.every((id, index) => id === finalPageOneIds[index]);
  const traversedInitialSnapshot = lastSequentialPage >= requiredPages;
  const coverageComplete = !recordCapReached && (
    boundaryReached
    || (requiredPages <= options.maxPages && traversedInitialSnapshot)
  );
  const capDiagnostic = coverageComplete
    ? 'scan_cap_reached=false'
    : `scan_cap_reached=true page_cap=${requiredPages > options.maxPages} record_cap=${recordCapReached}`;

  return {
    records: [...records.values()],
    coverageComplete,
    boundaryReached,
    pageOneStable,
    initialTotal,
    requiredPages,
    pageCalls,
    diagnostic: [
      `initial_total=${initialTotal}`,
      `required_pages=${requiredPages}`,
      `page_calls=[${pageCalls.join(',')}]`,
      `unique_records=${records.size}`,
      `boundary_reached=${boundaryReached}`,
      `page_one_stable=${pageOneStable}`,
      `coverage_complete=${coverageComplete}`,
      capDiagnostic,
    ].join(' '),
  };
}

export function accumulateRecordsById<T extends { id: string }>(
  accumulated: Map<string, T>,
  records: readonly T[],
  include: (record: T) => boolean,
): string[] {
  const newIds: string[] = [];
  for (const record of records) {
    if (!include(record)) continue;
    if (!accumulated.has(record.id)) newIds.push(record.id);
    accumulated.set(record.id, record);
  }
  return newIds;
}

export function advanceRecordScanStability(
  previous: RecordScanStability,
  scan: { coverageComplete: boolean; pageOneStable: boolean },
  newRelevantIds: readonly string[],
): RecordScanStability {
  if (!scan.coverageComplete || !scan.pageOneStable) {
    return { hasStableSnapshot: false, confirmations: 0, ready: false };
  }

  if (newRelevantIds.length > 0) {
    return { hasStableSnapshot: true, confirmations: 0, ready: false };
  }

  if (!previous.hasStableSnapshot) {
    return { hasStableSnapshot: true, confirmations: 0, ready: false };
  }

  const confirmations = previous.confirmations + 1;
  return { hasStableSnapshot: true, confirmations, ready: confirmations >= 1 };
}

export const initialRecordScanStability: RecordScanStability = {
  hasStableSnapshot: false,
  confirmations: 0,
  ready: false,
};
