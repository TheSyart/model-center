import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import SecurityLabClient from '@/app/(admin)/security-lab/security-lab-client';
import type { RewriteHistoryRecord, SecurityLabConfig } from '@/lib/security-lab/live-types';

const defaultConfig: SecurityLabConfig = {
  promptInjection: { enabled: false, suffix: '' },
  toolInjection: {
    enabled: false,
    toolName: 'Bash',
    toolInput: { command: "printf 'model-center security lab\\n'" },
  },
  updatedAt: 0,
};

const historyRecord: RewriteHistoryRecord = {
  id: 'rewrite_request-test',
  requestId: 'request-test',
  timestamp: Date.parse('2026-08-25T10:00:00+08:00'),
  model: 'provider/claude-demo',
  source: 'claude-cli/2.1.0',
  stream: true,
  result: 'modified',
  steps: [
    { code: 'request_received', timestamp: 1, status: 'completed', detail: '收到请求' },
    { code: 'prompt_appended', timestamp: 2, status: 'completed', detail: '追加提示词' },
    { code: 'tool_injected', timestamp: 3, status: 'completed', detail: '新增 Bash' },
  ],
  prompt: {
    before: 'review this code',
    suffix: '[video suffix]',
    after: 'review this code\n\n[video suffix]',
  },
  tools: {
    original: [{ id: 'toolu_original', name: 'Read', input: { file_path: '/tmp/demo' } }],
    injected: {
      id: 'toolu_security_lab_test',
      name: 'Bash',
      input: { command: "printf 'demo'" },
      result: {
        content: 'demo output\nMemory: 32 GB',
        isError: false,
        returnedAt: Date.parse('2026-08-25T10:00:03+08:00'),
      },
    },
  },
};

const skippedHistoryRecord: RewriteHistoryRecord = {
  id: 'rewrite_request-skipped',
  requestId: 'request-skipped',
  timestamp: Date.parse('2026-08-25T09:59:00+08:00'),
  model: 'provider/claude-demo',
  source: 'claude-cli/2.1.0',
  stream: true,
  result: 'skipped',
  steps: [{ code: 'request_received', timestamp: 1, status: 'completed', detail: '收到请求' }],
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function installApi(history: RewriteHistoryRecord[] = []) {
  let savedConfig = structuredClone(defaultConfig);
  const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/admin/security-lab/config' && (!init?.method || init.method === 'GET')) {
      return json({ config: savedConfig });
    }
    if (url === '/api/admin/security-lab/config' && init?.method === 'PUT') {
      savedConfig = JSON.parse(String(init.body));
      savedConfig.updatedAt = 100;
      return json({ config: savedConfig });
    }
    if (url.startsWith('/api/admin/security-lab/history') && (!init?.method || init.method === 'GET')) {
      return json({ items: history, total: history.length, page: 1, pageSize: 20 });
    }
    if (url === '/api/admin/security-lab/history' && init?.method === 'DELETE') {
      return json({ deleted: history.length });
    }
    throw new Error(`unexpected request: ${init?.method ?? 'GET'} ${url}`);
  });
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

describe('SecurityLabClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads independent switches and saves a custom prompt suffix', async () => {
    const user = userEvent.setup();
    const fetchSpy = installApi();
    render(<SecurityLabClient initialBaseUrl="http://localhost/security-lab" />);

    const promptSwitch = await screen.findByRole('switch', { name: '启用提示词注入' });
    expect(promptSwitch).not.toBeChecked();
    await user.type(screen.getByLabelText('注入提示词'), '追加演示要求');
    await user.click(promptSwitch);
    await user.click(screen.getByRole('button', { name: '保存提示词注入' }));

    expect(await screen.findByRole('status')).toHaveTextContent('提示词注入配置已保存');
    const put = fetchSpy.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(String(put?.[1]?.body)).promptInjection).toEqual({ enabled: true, suffix: '追加演示要求' });
  });

  it('hydrates the generated Base URL without a server/client text mismatch', async () => {
    installApi();
    const browserWindow = globalThis.window;
    vi.stubGlobal('window', undefined);
    const html = renderToString(<SecurityLabClient />);
    vi.stubGlobal('window', browserWindow);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let root: ReturnType<typeof hydrateRoot> | undefined;

    await act(async () => {
      root = hydrateRoot(container, <SecurityLabClient />);
      await Promise.resolve();
    });

    expect(consoleError.mock.calls.flat().join('\n')).not.toMatch(/Hydration failed|didn't match/);
    await act(async () => root?.unmount());
    container.remove();
    consoleError.mockRestore();
  });

  it('rejects malformed tool JSON before calling the API', async () => {
    const user = userEvent.setup();
    const fetchSpy = installApi();
    render(<SecurityLabClient initialBaseUrl="http://localhost/security-lab" />);

    const editor = await screen.findByLabelText('工具调用参数');
    fireEvent.change(editor, { target: { value: '{bad json' } });
    await user.click(screen.getByRole('button', { name: '保存工具注入' }));

    expect(screen.getByRole('alert')).toHaveTextContent('请输入合法的 JSON 对象');
    expect(fetchSpy.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0);
  });

  it('renders persistent history and opens an accessible detail sheet', async () => {
    const user = userEvent.setup();
    installApi([historyRecord]);
    render(<SecurityLabClient initialBaseUrl="http://localhost/security-lab" />);

    expect(await screen.findByText('request-test')).toBeVisible();
    expect(screen.getByText('执行成功')).toBeVisible();
    expect(screen.getByText(/demo output/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: '查看 request-test 详情' }));

    expect(screen.getByRole('dialog', { name: '改写详情' })).toBeVisible();
    expect(screen.getByText(/toolu_security_lab_test/)).toBeVisible();
    expect(screen.getByRole('heading', { name: '工具执行结果' })).toBeVisible();
    expect(screen.queryByText('prompt_appended')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '展开技术时间线' }));
    expect(screen.getByText('prompt_appended')).toBeVisible();
  });

  it('filters history by meaningful rewrite type without hiding result counts', async () => {
    const user = userEvent.setup();
    installApi([historyRecord, skippedHistoryRecord]);
    render(<SecurityLabClient initialBaseUrl="http://localhost/security-lab" />);

    expect(await screen.findByText('request-test')).toBeVisible();
    expect(screen.getByText('request-skipped')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '工具' }));
    expect(screen.getByText('request-test')).toBeVisible();
    expect(screen.queryByText('request-skipped')).not.toBeInTheDocument();
    expect(screen.getByText('1 / 2 条')).toBeVisible();
  });

  it('updates an open detail sheet when the tool result arrives', async () => {
    const user = userEvent.setup();
    const waitingRecord = structuredClone(historyRecord);
    delete waitingRecord.tools?.injected?.result;
    const records = [waitingRecord];
    installApi(records);
    render(<SecurityLabClient initialBaseUrl="http://localhost/security-lab" />);

    await user.click(await screen.findByRole('button', { name: '查看 request-test 详情' }));
    const dialog = screen.getByRole('dialog', { name: '改写详情' });
    expect(within(dialog).getByText('等待执行')).toBeVisible();

    records[0] = historyRecord;
    fireEvent.click(screen.getByText('刷新'));
    expect(await within(dialog).findByText('执行成功')).toBeVisible();
    expect(within(dialog).getByText(/Memory: 32 GB/)).toBeVisible();
  });

  it('has no serious accessibility violations', async () => {
    installApi([historyRecord]);
    const { container } = render(<SecurityLabClient initialBaseUrl="http://localhost/security-lab" />);
    expect(await screen.findByText('request-test')).toBeVisible();
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')).toEqual([]);
  });
});
