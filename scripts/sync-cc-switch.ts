#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

import {
  collectProviderExports,
  mergeProviderRecords,
  normalizeProviderRecord,
  parseModelPricingSource,
  resolveIconAssetFiles,
  type CcSwitchSourceApp,
} from './cc-switch-sync-lib.ts';

const REPOSITORY = 'https://github.com/farion1231/cc-switch.git';
const PINNED_SHA = '9a596158ca926e74b56243c08af67d9dd13fc27c';
const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');

const PROVIDER_SOURCES: Array<{ app: CcSwitchSourceApp; file: string; expected: number }> = [
  { app: 'claude', file: 'src/config/claudeProviderPresets.ts', expected: 77 },
  { app: 'claude-desktop', file: 'src/config/claudeDesktopProviderPresets.ts', expected: 74 },
  { app: 'codex', file: 'src/config/codexProviderPresets.ts', expected: 72 },
  { app: 'gemini', file: 'src/config/geminiProviderPresets.ts', expected: 23 },
  // 37 条数组记录 + 独立导出的 Grok Official。
  { app: 'grok-build', file: 'src/config/grokBuildProviderPresets.ts', expected: 38 },
  { app: 'opencode', file: 'src/config/opencodeProviderPresets.ts', expected: 65 },
  { app: 'openclaw', file: 'src/config/openclawProviderPresets.ts', expected: 65 },
  { app: 'hermes', file: 'src/config/hermesProviderPresets.ts', expected: 66 },
  { app: 'pi', file: 'src/config/piProviderPresets.ts', expected: 58 },
  { app: 'universal', file: 'src/config/universalProviderPresets.ts', expected: 2 },
];

const BALANCE_SOURCE = 'src-tauri/src/services/balance.rs';
const CODING_PLAN_SOURCE = 'src/config/codingPlanProviders.ts';

const BALANCE_CAPABILITIES = [
  { id: 'deepseek', patterns: ['api.deepseek.com'], endpoint: 'https://api.deepseek.com/user/balance' },
  { id: 'stepfun', patterns: ['api.stepfun.ai', 'api.stepfun.com'], endpoint: 'https://api.stepfun.com/v1/accounts' },
  { id: 'siliconflow-cn', patterns: ['api.siliconflow.cn'], endpoint: 'https://api.siliconflow.cn/v1/user/info' },
  { id: 'siliconflow-en', patterns: ['api.siliconflow.com'], endpoint: 'https://api.siliconflow.com/v1/user/info' },
  { id: 'openrouter', patterns: ['openrouter.ai'], endpoint: 'https://openrouter.ai/api/v1/credits' },
  { id: 'novita', patterns: ['api.novita.ai'], endpoint: 'https://api.novita.ai/v3/user/balance' },
] as const;

function codingPlanCapabilities(source: string): Array<{ id: string; label: string; pattern: string }> {
  const entries = [...source.matchAll(/\bid:\s*"([^"]+)"[\s\S]*?\blabel:\s*"([^"]+)"[\s\S]*?\bpattern:\s*(\/[^\n]+\/[a-z]*)/g)]
    .map((match) => ({ id: match[1], label: match[2], pattern: match[3] }));
  if (entries.length !== 6) throw new Error(`Coding Plan 类型应为 6，实际为 ${entries.length}`);
  return entries;
}

function validateBalanceCapabilities(source: string): void {
  const expectedMarkers = [
    ...BALANCE_CAPABILITIES.flatMap((provider) => provider.patterns),
    'https://api.deepseek.com/user/balance',
    'https://api.stepfun.com/v1/accounts',
    '/v1/user/info',
    'https://openrouter.ai/api/v1/credits',
    'https://api.novita.ai/v3/user/balance',
  ];
  const missing = expectedMarkers.filter((marker) => !source.includes(marker));
  if (missing.length) throw new Error(`余额源码结构已变化，缺少：${missing.join(', ')}`);
}

interface Arguments {
  source?: string;
  ref: string;
  check: boolean;
}

function parseArguments(argv: string[]): Arguments {
  const result: Arguments = { ref: PINNED_SHA, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') result.check = true;
    else if (arg === '--source') result.source = path.resolve(argv[++index] ?? '');
    else if (arg.startsWith('--source=')) result.source = path.resolve(arg.slice('--source='.length));
    else if (arg === '--ref') result.ref = argv[++index] ?? result.ref;
    else if (arg.startsWith('--ref=')) result.ref = arg.slice('--ref='.length);
    else throw new Error(`未知参数：${arg}`);
  }
  return result;
}

function command(cwd: string, executable: string, args: string[]): string {
  return execFileSync(executable, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

function prepareSource(args: Arguments): { root: string; cleanup?: () => void; sha: string } {
  if (args.source) {
    const sha = command(args.source, 'git', ['rev-parse', 'HEAD']);
    const expected = command(args.source, 'git', ['rev-parse', args.ref]);
    if (sha !== expected) throw new Error(`源码目录 HEAD ${sha} 与 --ref ${expected} 不一致`);
    return { root: args.source, sha };
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'model-center-cc-switch-'));
  command(directory, 'git', ['clone', '--filter=blob:none', '--no-checkout', REPOSITORY, '.']);
  command(directory, 'git', ['sparse-checkout', 'set', 'src/config', 'src/types', 'src/utils', 'src/icons/extracted', 'src-tauri/src/database/schema.rs', 'src-tauri/src/services/balance.rs']);
  command(directory, 'git', ['checkout', '--detach', args.ref]);
  return { root: directory, sha: command(directory, 'git', ['rev-parse', 'HEAD']), cleanup: () => fs.rmSync(directory, { recursive: true, force: true }) };
}

function resolveModule(root: string, fromFile: string, specifier: string): string {
  let candidate: string;
  if (specifier.startsWith('@/')) candidate = path.join(root, 'src', specifier.slice(2));
  else if (specifier.startsWith('.')) candidate = path.resolve(path.dirname(fromFile), specifier);
  else throw new Error(`CC Switch 配置引用了未允许的外部模块：${specifier} (${fromFile})`);

  const candidates = [candidate, `${candidate}.ts`, `${candidate}.tsx`, `${candidate}.json`, path.join(candidate, 'index.ts')];
  const resolved = candidates.find((value) => fs.existsSync(value) && fs.statSync(value).isFile());
  if (!resolved) throw new Error(`无法解析 CC Switch 模块 ${specifier} (${fromFile})`);
  return resolved;
}

function createModuleLoader(root: string): (file: string) => Record<string, unknown> {
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  const load = (file: string): Record<string, unknown> => {
    const resolved = path.resolve(file);
    const cached = cache.get(resolved);
    if (cached) return cached.exports;
    if (resolved.endsWith('.json')) return JSON.parse(fs.readFileSync(resolved, 'utf8')) as Record<string, unknown>;

    const cjsModule = { exports: {} as Record<string, unknown> };
    cache.set(resolved, cjsModule);
    const source = fs.readFileSync(resolved, 'utf8');
    const compiled = ts.transpileModule(source, {
      fileName: resolved,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
      reportDiagnostics: true,
    });
    const errors = compiled.diagnostics?.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error) ?? [];
    if (errors.length) throw new Error(`无法编译 ${resolved}: ${errors.map((error) => error.messageText).join('; ')}`);

    const localRequire = (specifier: string) => {
      // grokBuildConfig 仅为预设导出默认模型常量；其 TOML 运行时依赖在同步期间不会被调用。
      if (specifier === 'smol-toml') return { parse: () => ({}), stringify: () => '' };
      return load(resolveModule(root, resolved, specifier));
    };
    const wrapper = vm.runInNewContext(`(function(require,module,exports,__filename,__dirname){${compiled.outputText}\n})`, {
      structuredClone,
      URL,
      URLSearchParams,
    }) as (require: (specifier: string) => unknown, module: { exports: Record<string, unknown> }, exports: Record<string, unknown>, filename: string, dirname: string) => void;
    wrapper(localRequire, cjsModule, cjsModule.exports, resolved, path.dirname(resolved));
    return cjsModule.exports;
  };
  return load;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value: unknown): string {
  const visit = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(visit);
    if (!item || typeof item !== 'object') return item;
    return Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, visit(child)]));
  };
  return `${JSON.stringify(visit(value), null, 2)}\n`;
}

function generatedTs(header: string, exportName: string, value: unknown, typeName: string, typeImport: string): string {
  return `${header}\nimport type { ${typeName} } from '${typeImport}';\n\nexport const ${exportName}: ${typeName}[] = ${JSON.stringify(value, null, 2)};\n`;
}

function writeOrCheck(file: string, content: string, check: boolean): void {
  if (check) {
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (current !== content) throw new Error(`生成文件不是最新状态：${path.relative(PROJECT_ROOT, file)}`);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function copyIcons(sourceRoot: string, check: boolean): { count: number; checksum: string; files: string[] } {
  const sourceDirectory = path.join(sourceRoot, 'src/icons/extracted');
  const targetDirectory = path.join(PROJECT_ROOT, 'public/logos');
  const files = fs.readdirSync(sourceDirectory).filter((file) => !['index.ts', 'metadata.ts'].includes(file)).sort();
  if (files.length !== 99) throw new Error(`图标数量应为 99，实际为 ${files.length}`);
  const hashes: string[] = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(sourceDirectory, file));
    hashes.push(`${file}:${sha256(content)}`);
    const target = path.join(targetDirectory, file);
    if (check) {
      if (!fs.existsSync(target) || !fs.readFileSync(target).equals(content)) throw new Error(`图标不是最新状态：public/logos/${file}`);
    } else {
      fs.mkdirSync(targetDirectory, { recursive: true });
      fs.writeFileSync(target, content);
    }
  }
  return { count: files.length, checksum: sha256(hashes.join('\n')), files };
}

function main(): void {
  const args = parseArguments(process.argv.slice(2));
  const source = prepareSource(args);
  try {
    if (source.sha !== PINNED_SHA && args.ref === PINNED_SHA) throw new Error(`固定提交不匹配：${source.sha}`);
    const loadModule = createModuleLoader(source.root);
    const rawRecords: Array<{ app: CcSwitchSourceApp; index: number; record: Record<string, unknown> }> = [];
    const sourceCounts: Record<string, number> = {};
    const blobs: Record<string, string> = {};
    for (const item of PROVIDER_SOURCES) {
      const file = path.join(source.root, item.file);
      const rows = collectProviderExports(item.app, loadModule(file));
      if (rows.length !== item.expected) throw new Error(`${item.app} 预设数量应为 ${item.expected}，实际为 ${rows.length}`);
      sourceCounts[item.app] = rows.length;
      blobs[item.file] = command(source.root, 'git', ['rev-parse', `${source.sha}:${item.file}`]);
      rows.forEach((record, index) => rawRecords.push({ app: item.app, index, record }));
    }
    if (rawRecords.length !== 540) throw new Error(`原始预设总数应为 540（539 条数组记录 + Grok Official），实际为 ${rawRecords.length}`);

    const normalized = rawRecords.map(({ app, index, record }) => normalizeProviderRecord(app, index, record));
    const catalog = mergeProviderRecords(normalized);
    const covered = catalog.coverage.included + catalog.coverage.merged + catalog.coverage.excluded;
    if (covered !== rawRecords.length) throw new Error(`预设覆盖账本不完整：${covered}/${rawRecords.length}`);

    const pricingFile = 'src-tauri/src/database/schema.rs';
    const pricing = parseModelPricingSource(fs.readFileSync(path.join(source.root, pricingFile), 'utf8'));
    if (pricing.length !== 192) throw new Error(`最终定价数量应为 192，实际为 ${pricing.length}`);
    // 中央定价表已包含有序 repair；同模型的应用目录旧价格以中央最终值收敛。
    const pricingByModel = new Map(pricing.map((row) => [row.modelId.toLowerCase(), row]));
    for (const provider of catalog.providers) {
      for (const model of provider.models) {
        const normalizedId = model.id.toLowerCase();
        const central = pricingByModel.get(normalizedId) ?? pricingByModel.get(normalizedId.split('/').pop() ?? '');
        if (central) {
          model.pricing = {
            input: central.input,
            output: central.output,
            cacheRead: central.cacheRead,
            cacheWrite: central.cacheWrite,
          };
        }
      }
    }
    blobs[pricingFile] = command(source.root, 'git', ['rev-parse', `${source.sha}:${pricingFile}`]);
    const balanceSource = fs.readFileSync(path.join(source.root, BALANCE_SOURCE), 'utf8');
    validateBalanceCapabilities(balanceSource);
    blobs[BALANCE_SOURCE] = command(source.root, 'git', ['rev-parse', `${source.sha}:${BALANCE_SOURCE}`]);
    const codingPlanSource = fs.readFileSync(path.join(source.root, CODING_PLAN_SOURCE), 'utf8');
    const codingPlans = codingPlanCapabilities(codingPlanSource);
    blobs[CODING_PLAN_SOURCE] = command(source.root, 'git', ['rev-parse', `${source.sha}:${CODING_PLAN_SOURCE}`]);
    const icons = copyIcons(source.root, args.check);
    const iconIndexFile = 'src/icons/extracted/index.ts';
    const iconIndexSource = fs.readFileSync(path.join(source.root, iconIndexFile), 'utf8');
    const iconAssets = resolveIconAssetFiles(iconIndexSource, icons.files);
    const iconFiles = new Set(icons.files);
    for (const provider of catalog.providers) {
      const iconKey = provider.logo?.match(/^\/logos\/([^.]+)\.svg$/)?.[1]?.toLowerCase();
      if (!iconKey) continue;
      const asset = iconAssets.get(iconKey);
      provider.logo = asset ? `/logos/${asset}` : undefined;
    }
    const invalidLogos = catalog.providers
      .map((provider) => provider.logo)
      .filter((logo): logo is string => Boolean(logo))
      .filter((logo) => !iconFiles.has(logo.replace('/logos/', '')));
    if (invalidLogos.length) throw new Error(`生成了不存在的图标路径：${[...new Set(invalidLogos)].join(', ')}`);
    blobs[iconIndexFile] = command(source.root, 'git', ['rev-parse', `${source.sha}:${iconIndexFile}`]);
    const commitTime = command(source.root, 'git', ['show', '-s', '--format=%cI', source.sha]);

    const header = `/** GENERATED FILE — DO NOT EDIT. Source: farion1231/cc-switch@${source.sha}; commit time: ${commitTime}. Run npm run sync:cc-switch. */`;
    const summaries = catalog.providers.map((provider) => ({
      slug: provider.slug,
      name: provider.name,
      protocol: provider.protocol,
      baseUrl: provider.baseUrl,
      category: provider.category,
      logo: provider.logo,
      websiteUrl: provider.websiteUrl,
      consoleUrl: provider.consoleUrl,
      supported: provider.supported,
      disabledReason: provider.disabledReason,
      authMode: provider.authMode,
      sourceApps: provider.sourceApps,
      extra: {
        endpoint_candidates: provider.endpointCandidates,
        api_key_field: provider.apiKeyField,
        official: provider.official,
        partner: provider.partner,
      },
    }));
    const manifest = {
      schemaVersion: 2,
      repository: REPOSITORY,
      commit: source.sha,
      commitTime,
      blobs,
      sourceCounts,
      rawProviderCount: rawRecords.length,
      arrayProviderCount: rawRecords.length - 1,
      providerCount: catalog.providers.length,
      coverage: catalog.coverage,
      exclusionCount: catalog.exclusions.length,
      pricingCount: pricing.length,
      capabilities: {
        balanceProviders: BALANCE_CAPABILITIES,
        codingPlanProviders: codingPlans,
      },
      iconCount: icons.count,
      iconChecksum: icons.checksum,
    };

    writeOrCheck(
      path.join(PROJECT_ROOT, 'lib/presets/cc-switch.ts'),
      generatedTs(header, 'CC_SWITCH_PRESETS', summaries, 'ProviderPreset', './types'),
      args.check,
    );
    writeOrCheck(
      path.join(PROJECT_ROOT, 'lib/pricing/cc-switch.ts'),
      generatedTs(header, 'CC_SWITCH_PRICING', pricing, 'ModelPricingRow', '../../scripts/cc-switch-sync-lib'),
      args.check,
    );
    writeOrCheck(path.join(PROJECT_ROOT, 'lib/presets/cc-switch-catalog.json'), stableJson({ manifest, providers: catalog.providers, exclusions: catalog.exclusions }), args.check);
    writeOrCheck(path.join(PROJECT_ROOT, 'lib/presets/cc-switch-manifest.json'), stableJson(manifest), args.check);
    process.stdout.write(`${args.check ? 'checked' : 'generated'} ${rawRecords.length} raw providers -> ${catalog.providers.length} variants, ${catalog.exclusions.length} exclusions, ${pricing.length} prices, ${icons.count} icons @ ${source.sha}\n`);
  } finally {
    source.cleanup?.();
  }
}

main();
