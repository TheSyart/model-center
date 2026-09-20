import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PROVIDER_TOOL_CATALOGS,
  formatToolBilling,
  toolCatalogFor,
} from '../lib/vendors/tools.ts';
import { PROVIDER_PRESETS } from '../lib/presets/index.ts';

test('every catalog entry carries a doc link and a verification date', () => {
  for (const catalog of PROVIDER_TOOL_CATALOGS) {
    assert.match(catalog.verifiedAt, /^\d{4}-\d{2}-\d{2}$/, `${catalog.vendor} 缺少核对日期`);
    assert.ok(catalog.presetKeys.length > 0, `${catalog.vendor} 没有关联的 presetKey`);
    assert.ok(catalog.tools.length > 0, `${catalog.vendor} 没有工具`);
    for (const tool of catalog.tools) {
      assert.match(tool.docUrl, /^https:\/\//, `${tool.name} 缺少官方文档链接`);
      assert.ok(tool.description.trim(), `${tool.name} 缺少说明`);
    }
  }
});

test('tool ids are unique across the whole catalog', () => {
  const ids = PROVIDER_TOOL_CATALOGS.flatMap((c) => c.tools.map((t) => t.id));
  assert.equal(new Set(ids).size, ids.length, '存在重复的工具 id');
});

test('every presetKey actually exists in the provider preset catalog', () => {
  // 写错 slug 会让工具目录永远匹配不上任何服务商，且不会报错——所以必须钉住。
  const known = new Set(PROVIDER_PRESETS.flatMap((p) => [p.slug, p.presetKey].filter(Boolean) as string[]));
  for (const catalog of PROVIDER_TOOL_CATALOGS) {
    for (const key of catalog.presetKeys) {
      assert.ok(known.has(key), `${catalog.vendor} 引用了不存在的 preset: ${key}`);
    }
  }
});

test('standalone tools carry a real endpoint, inline tools carry surfaces', () => {
  for (const catalog of PROVIDER_TOOL_CATALOGS) {
    for (const tool of catalog.tools) {
      if (tool.invocation.kind === 'endpoint') {
        assert.match(tool.invocation.url, /^https:\/\//, `${tool.name} 的接口地址无效`);
      } else {
        assert.ok(tool.invocation.surfaces.length > 0, `${tool.name} 没有标注适用的协议面`);
      }
    }
  }
});

test('unpublished prices stay unpublished instead of being guessed', () => {
  // 智谱多数工具官方确实没写价格，这里钉住「不许填数」。
  const zhipu = PROVIDER_TOOL_CATALOGS.find((c) => c.vendor === '智谱 GLM')!;
  const reader = zhipu.tools.find((t) => t.id === 'zhipu-reader')!;
  assert.equal(reader.billing.unit, 'unknown');
  assert.equal(formatToolBilling({ unit: 'unknown' }), '官方未公布');
});

test('billing formats read correctly for every unit', () => {
  assert.equal(formatToolBilling({ unit: 'per_call', amount: 0.015, currency: 'CNY' }), '¥0.015 / 次');
  assert.equal(formatToolBilling({ unit: 'per_thousand_calls', amount: 10, currency: 'USD' }), '$10 / 千次');
  assert.equal(formatToolBilling({ unit: 'per_page', amount: 0.02, currency: 'CNY' }), '¥0.02 / 页');
  assert.equal(formatToolBilling({ unit: 'free_promo' }), '限时免费');
  assert.equal(formatToolBilling({ unit: 'token_only' }), '不额外收费（仅计 token）');
  assert.equal(
    formatToolBilling({ unit: 'per_container_hour', amount: 0.05, currency: 'USD', freeAllowance: '每月 1,550 小时' }),
    '$0.05 / 容器·小时（每月 1,550 小时）',
  );
});

test('catalog lookup matches by slug or presetKey', () => {
  assert.equal(toolCatalogFor({ slug: 'kimi-for-coding' })?.vendor, 'Kimi（月之暗面）');
  assert.equal(toolCatalogFor({ presetKey: 'zhipu-glm', slug: 'whatever' })?.vendor, '智谱 GLM');
  assert.equal(toolCatalogFor({ slug: 'deepseek' }), null);
});
