/**
 * 抓包入口 → 它唯一对应的对外路径。
 *
 * 归档校验依赖这个一一对应关系（archive.ts 会比对记录里的 path），
 * 所以一个入口只能有一条路径；四条音频面各自独立成项，不能合并成一个 'audio'。
 *
 * 这张表同时是 isRawCaptureEntry 的唯一依据——此前 archive.ts 与 store.ts
 * 各维护了一份手写的取值列表，加一个入口要记得改两处。
 */
export const RAW_CAPTURE_ENTRY_PATHS = {
  openai: '/v1/chat/completions',
  anthropic: '/v1/messages',
  responses: '/v1/responses',
  'security-lab-anthropic': '/security-lab/v1/messages',
  'audio-speech': '/v1/audio/speech',
  'audio-transcriptions': '/v1/audio/transcriptions',
  'dashscope-asr': '/v1/services/aigc/multimodal-generation/generation',
  'dashscope-tts': '/v1/services/audio/tts/SpeechSynthesizer',
} as const;

export type RawCaptureEntry = keyof typeof RAW_CAPTURE_ENTRY_PATHS;

export function isRawCaptureEntry(value: unknown): value is RawCaptureEntry {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(RAW_CAPTURE_ENTRY_PATHS, value);
}
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
