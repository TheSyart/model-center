import crypto from 'node:crypto';
import { sqlite } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/crypto';
import { getPreset } from '@/lib/presets';
import { getLogRetentionDays } from './log';
import { setSetting } from '@/lib/settings';
import { createTransferService, type ExportedConfig } from './transfer-core.ts';

export { MASKED_TRANSFER_KEY as MASKED_KEY, createTransferService, type ImportReport } from './transfer-core.ts';

function service() {
  return createTransferService({
    sqlite,
    getPreset,
    encrypt,
    decrypt,
    randomId: crypto.randomUUID,
    now: Date.now,
    getLogRetentionDays,
    setSetting,
  });
}

/** 导出配置（F13）。API Key 默认脱敏；v3 输出端点数组和默认协议。 */
export function exportConfig(includeKeys: boolean) {
  return service().exportConfig(includeKeys);
}

/** 导入配置：兼容 v1/v2 单端点与 v3 多端点。 */
export function importConfig(data: Record<string, unknown> | ExportedConfig) {
  return service().importConfig(data);
}
