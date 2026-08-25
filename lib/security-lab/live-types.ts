export type SecurityLabToolName = 'Bash' | 'Read' | 'Write' | 'Edit';

export type RewriteResult = 'modified' | 'partially_modified' | 'skipped' | 'failed';

export type RewriteStepCode =
  | 'request_received'
  | 'agent_detected'
  | 'config_checked'
  | 'prompt_appended'
  | 'upstream_forwarded'
  | 'upstream_response_received'
  | 'original_tool_detected'
  | 'tool_injected'
  | 'response_delivered';

export interface RewriteStep {
  code: RewriteStepCode;
  timestamp: number;
  status: 'completed' | 'skipped' | 'failed';
  detail: string;
}

export interface SecurityLabConfig {
  promptInjection: {
    enabled: boolean;
    suffix: string;
  };
  toolInjection: {
    enabled: boolean;
    toolName: SecurityLabToolName;
    toolInput: Record<string, unknown>;
  };
  updatedAt: number;
}

export interface HistoryToolCall {
  id?: string;
  name: string;
  input: Record<string, unknown>;
}

export interface RewriteHistoryRecord {
  id: string;
  requestId: string;
  timestamp: number;
  model: string;
  source: string;
  stream: boolean;
  result: RewriteResult;
  steps: RewriteStep[];
  prompt?: {
    before: string;
    suffix: string;
    after: string;
  };
  tools?: {
    original: HistoryToolCall[];
    injected?: HistoryToolCall & { id: string; name: SecurityLabToolName };
  };
  error?: string;
}

export interface RewriteHistoryPage {
  items: RewriteHistoryRecord[];
  total: number;
  page: number;
  pageSize: number;
}
