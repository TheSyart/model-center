const BAILIAN_PRESET_KEY = 'bailian';
const BAILIAN_SLUGS = new Set([
  'bailian',
  'bailian-openai',
  'qwen-coder-openai',
  'bailian-responses',
  'bailian-anthropic',
]);

export interface BailianCatalogProviderIdentity {
  slug: string;
  presetKey?: string | null;
}

export function isOfficialBailianCatalogProvider(provider: BailianCatalogProviderIdentity): boolean {
  return provider.presetKey === BAILIAN_PRESET_KEY || BAILIAN_SLUGS.has(provider.slug);
}

/** A workspace ID is interpolated into a DNS label, so dots, slashes and empty labels are rejected. */
export function normalizeBailianWorkspaceId(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('百炼 Workspace ID 必须是字符串');
  const workspaceId = value.trim();
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(workspaceId)) {
    throw new Error('百炼 Workspace ID 格式无效');
  }
  return workspaceId;
}

export function bailianCatalogUrl(workspaceId: unknown, page: number, pageSize: number): string {
  const normalized = normalizeBailianWorkspaceId(workspaceId);
  if (!normalized) throw new Error('百炼模型同步需要先配置 Workspace ID');
  const url = new URL(`https://${normalized}.cn-beijing.maas.aliyuncs.com/api/v1/models`);
  url.searchParams.set('page_no', String(page));
  url.searchParams.set('page_size', String(pageSize));
  return url.toString();
}
