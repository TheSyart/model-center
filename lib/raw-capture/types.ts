export type RawCaptureEntry = 'openai' | 'anthropic' | 'responses' | 'security-lab-anthropic';
export type RawCaptureLocation = 'active' | 'archived';

export interface RawCaptureConfig {
  enabled: boolean;
}

export interface RawCaptureRecord {
  id: string;
  day: string;
  startedAt: number;
  completedAt: number | null;
  path: string;
  entryProtocol: RawCaptureEntry;
  status: number | null;
  stream: boolean;
  contentType: string | null;
  requestBytes: number;
  responseBytes: number;
  complete: boolean;
  captureError: string | null;
  location: RawCaptureLocation;
}

export interface RawCaptureSession {
  record: RawCaptureRecord;
  appendResponse(chunk: Uint8Array): Promise<void>;
  finish(input: {
    status: number;
    stream: boolean;
    contentType: string | null;
    complete: boolean;
    captureError?: string | null;
  }): Promise<RawCaptureRecord>;
  fail(message: string): Promise<RawCaptureRecord>;
}

export interface RawCaptureArchive {
  day: string;
  recordCount: number;
  rawBytes: number;
  archiveBytes: number;
  createdAt: number;
  status: 'ready' | 'error';
  error: string | null;
}

export interface RawCapturePage {
  items: RawCaptureRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RawCaptureStatus {
  enabled: boolean;
  rootDir: string;
  today: string;
  todayRecords: number;
  todayBytes: number;
  totalRecords: number;
  totalBytes: number;
  archiveCount: number;
  coverageStart: number | null;
  coverageEnd: number | null;
  lastArchive: RawCaptureArchive | null;
  lastCaptureError: string | null;
}
