import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import RawDataClient from '@/app/(admin)/raw-data/raw-data-client';
import { ConfirmProvider } from '@/components/confirm-dialog';
import { ToastProvider } from '@/components/toast';
import type { RawCaptureArchive, RawCaptureRecord, RawCaptureStatus } from '@/lib/raw-capture/types';

const record: RawCaptureRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  day: '2026-08-26',
  startedAt: Date.parse('2026-08-26T10:30:00+08:00'),
  completedAt: Date.parse('2026-08-26T10:30:01+08:00'),
  path: '/v1/messages',
  entryProtocol: 'anthropic',
  status: 200,
  stream: true,
  contentType: 'text/event-stream',
  requestBytes: 18,
  responseBytes: 15,
  complete: true,
  captureError: null,
  location: 'active',
};

const archive: RawCaptureArchive = {
  day: '2026-08-25',
  recordCount: 7,
  rawBytes: 8192,
  archiveBytes: 2048,
  createdAt: Date.parse('2026-08-26T00:10:00+08:00'),
  status: 'ready',
  error: null,
};

const status: RawCaptureStatus = {
  enabled: false,
  rootDir: '/tmp/model-center/raw-captures',
  today: '2026-08-26',
  todayRecords: 1,
  todayBytes: 33,
  totalRecords: 8,
  totalBytes: 8225,
  archiveCount: 1,
  coverageStart: Date.parse('2026-08-25T09:00:00+08:00'),
  coverageEnd: Date.parse('2026-08-26T10:30:01+08:00'),
  lastArchive: archive,
  lastCaptureError: null,
};

type ApiOptions = {
  enabled?: boolean;
  requestPreview?: string;
  responsePreview?: string;
  records?: RawCaptureRecord[];
  archives?: RawCaptureArchive[];
};

function json(data: unknown, responseStatus = 200): Response {
  return new Response(JSON.stringify(data), {
    status: responseStatus,
    headers: { 'content-type': 'application/json' },
  });
}

function renderClient() {
  return render(
    <ToastProvider>
      <ConfirmProvider>
        <RawDataClient />
      </ConfirmProvider>
    </ToastProvider>,
  );
}

function installRawDataApi(options: ApiOptions = {}) {
  let records = options.records ?? [record];
  const archives = options.archives ?? [archive];
  let enabled = options.enabled ?? false;
  const putBodies: unknown[] = [];

  const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url === '/api/admin/raw-data/config' && method === 'GET') {
      return json({ config: { enabled }, status: { ...status, enabled } });
    }
    if (url === '/api/admin/raw-data/config' && method === 'PUT') {
      const body = JSON.parse(String(init?.body));
      putBodies.push(body);
      enabled = body.enabled;
      return json({ config: { enabled }, status: { ...status, enabled } });
    }
    if (url.startsWith('/api/admin/raw-data/records?') && method === 'GET') {
      const page = Number(new URL(url, 'http://localhost').searchParams.get('page') ?? '1');
      return json({ items: records, total: records.length, page, pageSize: 20 });
    }
    if (url === `/api/admin/raw-data/records/${record.id}` && method === 'GET') {
      return json({ record });
    }
    if (url === `/api/admin/raw-data/records/${record.id}/request` && method === 'GET') {
      return new Response(options.requestPreview ?? '{  "model":"x" }', {
        headers: { 'X-Raw-Total-Bytes': '300000', 'X-Raw-Truncated': 'true' },
      });
    }
    if (url === `/api/admin/raw-data/records/${record.id}/response` && method === 'GET') {
      return new Response(options.responsePreview ?? 'data: {"x":1}\n\n', {
        headers: { 'X-Raw-Total-Bytes': '15', 'X-Raw-Truncated': 'false' },
      });
    }
    if (url === '/api/admin/raw-data/archives' && method === 'GET') {
      return json({ archives });
    }
    if (url === '/api/admin/raw-data/archives' && method === 'POST') {
      return json({ archived: [], skipped: [], errors: [] });
    }
    if (url === `/api/admin/raw-data/archives/${archive.day}` && method === 'DELETE') {
      records = records.filter((item) => item.day !== archive.day || item.location !== 'archived');
      return json({ deleted: true, day: archive.day });
    }
    throw new Error(`unexpected request: ${method} ${url}`);
  });
  vi.stubGlobal('fetch', fetchSpy);
  return { fetchSpy, putBodies };
}

describe('RawDataClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('requires confirmation before enabling full raw capture', async () => {
    const user = userEvent.setup();
    const api = installRawDataApi();
    renderClient();

    await user.click(await screen.findByRole('switch', { name: '记录所有原始对话' }));
    expect(screen.getByRole('alertdialog', { name: '开启原始数据采集？' })).toBeVisible();
    expect(api.putBodies).toEqual([]);

    await user.click(screen.getByRole('button', { name: '确认开启' }));
    await waitFor(() => expect(api.putBodies).toEqual([{ enabled: true }]));
    expect(screen.getByRole('status')).toHaveTextContent('原始数据采集已开启');
  });

  it('shows exact unformatted request and response previews in a focus-managed sheet', async () => {
    const user = userEvent.setup();
    installRawDataApi({ requestPreview: '{  "model":"x" }', responsePreview: 'data: {"x":1}\n\n' });
    renderClient();

    const [trigger] = await screen.findAllByRole('button', { name: `查看记录 ${record.id}` });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '原始记录详情' });
    const requestRegion = await within(dialog).findByRole('region', { name: '请求原始正文' });
    expect(requestRegion.querySelector('pre')?.textContent).toBe('{  "model":"x" }');
    expect(within(dialog).getByText(/仅预览前/)).toBeVisible();
    expect(within(dialog).getByRole('link', { name: '下载完整请求' })).toHaveAttribute(
      'href',
      `/api/admin/raw-data/records/${record.id}/request?download=1`,
    );

    await user.click(within(dialog).getByRole('tab', { name: 'Response' }));
    const responseRegion = await within(dialog).findByRole('region', { name: '响应原始正文' });
    expect(responseRegion.querySelector('pre')?.textContent).toBe('data: {"x":1}\n\n');
    await user.click(within(dialog).getByRole('button', { name: '关闭' }));
    expect(trigger).toHaveFocus();
  });

  it('runs archive checks and confirms deletion of only one day', async () => {
    const user = userEvent.setup();
    const { fetchSpy } = installRawDataApi();
    renderClient();

    await user.click(await screen.findByRole('button', { name: '执行归档检查' }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(
      '/api/admin/raw-data/archives',
      expect.objectContaining({ method: 'POST' }),
    ));
    expect(screen.getByRole('status')).toHaveTextContent('归档检查已完成');
    expect(screen.getByRole('link', { name: `下载 ${archive.day} 归档` })).toHaveAttribute(
      'href',
      `/api/admin/raw-data/archives/${archive.day}`,
    );

    await user.click(screen.getByRole('button', { name: `删除 ${archive.day} 归档` }));
    expect(screen.getByRole('alertdialog', { name: `删除 ${archive.day} 归档？` })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '删除归档' }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(
      `/api/admin/raw-data/archives/${archive.day}`,
      expect.objectContaining({ method: 'DELETE' }),
    ));
    expect(screen.queryByRole('button', { name: /清空/ })).not.toBeInTheDocument();
  });

  it('removes deleted archive records from the visible pagination total', async () => {
    const user = userEvent.setup();
    const archivedRecord: RawCaptureRecord = { ...record, day: archive.day, location: 'archived' };
    installRawDataApi({ records: [archivedRecord] });
    renderClient();

    await screen.findAllByRole('button', { name: `查看记录 ${record.id}` });
    expect(screen.getByText('第 1 / 1 页，共 1 条')).toBeVisible();
    await user.click(screen.getByRole('button', { name: `删除 ${archive.day} 归档` }));
    await user.click(screen.getByRole('button', { name: '删除归档' }));

    expect(await screen.findByText('尚无原始记录')).toBeVisible();
    expect(screen.queryByText('第 1 / 1 页，共 1 条')).not.toBeInTheDocument();
  });

  it('announces API failures without replacing retained records', async () => {
    const user = userEvent.setup();
    const { fetchSpy } = installRawDataApi();
    renderClient();
    expect((await screen.findAllByRole('button', { name: `查看记录 ${record.id}` }))[0]).toBeVisible();
    fetchSpy.mockImplementationOnce(async () => json({ error: '磁盘不可用' }, 500));

    await user.click(screen.getByRole('button', { name: '刷新数据' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('磁盘不可用');
    expect(screen.getAllByRole('button', { name: `查看记录 ${record.id}` })[0]).toBeVisible();
  });

  it('has no serious accessibility violations', async () => {
    installRawDataApi();
    const { container } = renderClient();
    expect(await screen.findByText('今日原始数据')).toBeVisible();
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  });
});
