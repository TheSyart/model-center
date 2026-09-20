import assert from 'node:assert/strict';
import test from 'node:test';

import { detectCcSwitchBalanceProvider } from '../lib/presets/balance-provider.ts';

test('detects every CC Switch built-in balance provider from protocol variants', () => {
  assert.equal(detectCcSwitchBalanceProvider('https://api.deepseek.com/anthropic'), 'deepseek');
  assert.equal(detectCcSwitchBalanceProvider('https://api.stepfun.com/step_plan/v1'), 'stepfun');
  assert.equal(detectCcSwitchBalanceProvider('https://api.stepfun.ai/v1'), 'stepfun');
  assert.equal(detectCcSwitchBalanceProvider('https://api.siliconflow.cn/v1'), 'siliconflow-cn');
  assert.equal(detectCcSwitchBalanceProvider('https://api.siliconflow.com/v1'), 'siliconflow-en');
  assert.equal(detectCcSwitchBalanceProvider('https://openrouter.ai/api/v1'), 'openrouter');
  assert.equal(detectCcSwitchBalanceProvider('https://api.novita.ai/openai/v1'), 'novita');
});

test('does not treat an unrelated gateway as a balance provider', () => {
  assert.equal(detectCcSwitchBalanceProvider('https://gateway.example.com/v1'), null);
});
