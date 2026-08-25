import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import RawDataClient from '@/app/(admin)/raw-data/raw-data-client';
import * as ConfirmDialog from '@/components/confirm-dialog';
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
  detailRecord?: RawCaptureRecord;
  requestPreview?: string | Uint8Array;
  responsePreview?: string | Uint8Array;
  requestPreviewHeaders?: Record<string, string>;
  responsePreviewHeaders?: Record<string, string>;
  records?: RawCaptureRecord[];
  archives?: RawCaptureArchive[];
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function json(data: unknown, responseStatus = 200): Response {
  return new Response(JSON.stringify(data), {
    status: responseStatus,
    headers: { 'content-type': 'application/json' },
  });
}

function rawBody(body: string | Uint8Array): BodyInit {
  if (typeof body === 'string') return body;
  return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
}

function renderClient() {
  return render(
    <ToastProvider>
      <ConfirmDialog.ConfirmProvider>
        <RawDataClient />
      </ConfirmDialog.ConfirmProvider>
    </ToastProvider>,
  );
}

function installRawDataApi(options: ApiOptions = {}) {
  let records = options.records ?? [record];
  let archives = options.archives ?? [archive];
  let enabled = options.enabled ?? false;
  const putBodies: unknown[] = [];

  const respond = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
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
      const pageSize = 20;
      const offset = (page - 1) * pageSize;
      return json({ items: records.slice(offset, offset + pageSize), total: records.length, page, pageSize });
    }
    const recordMatch = url.match(/^\/api\/admin\/raw-data\/records\/([^/]+)$/);
    if (recordMatch && method === 'GET') {
      const matchedRecord = options.detailRecord?.id === recordMatch[1]
        ? options.detailRecord
        : records.find((item) => item.id === recordMatch[1]);
      return matchedRecord ? json({ record: matchedRecord }) : json({ error: '记录不存在' }, 404);
    }
    const previewMatch = url.match(/^\/api\/admin\/raw-data\/records\/([^/]+)\/(request|response)$/);
    if (previewMatch?.[2] === 'request' && method === 'GET') {
      const body = options.requestPreview ?? '{  "model":"x" }';
      return new Response(rawBody(body), {
        headers: {
          'Content-Length': String(typeof body === 'string' ? new TextEncoder().encode(body).byteLength : body.byteLength),
          'X-Raw-Total-Bytes': '300000',
          'X-Raw-Truncated': 'true',
          ...options.requestPreviewHeaders,
        },
      });
    }
    if (previewMatch?.[2] === 'response' && method === 'GET') {
      const body = options.responsePreview ?? 'data: {"x":1}\n\n';
      return new Response(rawBody(body), {
        headers: {
          'Content-Length': String(typeof body === 'string' ? new TextEncoder().encode(body).byteLength : body.byteLength),
          'X-Raw-Total-Bytes': '15',
          'X-Raw-Truncated': 'false',
          ...options.responsePreviewHeaders,
        },
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
      archives = archives.filter((item) => item.day !== archive.day);
      return json({ deleted: true, day: archive.day });
    }
    throw new Error(`unexpected request: ${method} ${url}`);
  };
  const fetchSpy = vi.fn(respond);
  vi.stubGlobal('fetch', fetchSpy);
  return { fetchSpy, putBodies, respond };
}

describe('RawDataClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('requires confirmation before enabling full raw capture', async () => {
    const user = userEvent.setup();
    const api = installRawDataApi();
    renderClient();

    const captureSwitch = await screen.findByRole('switch', { name: '记录所有原始对话' });
    expect(captureSwitch).toHaveClass('h-11', 'md:h-6');
    await user.click(captureSwitch);
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
    expect(within(dialog).getByRole('tab', { name: 'Request' })).toHaveClass('h-11', 'md:h-8');
    expect(within(dialog).getByRole('button', { name: '关闭' })).toHaveClass('size-11', 'md:size-9');
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

  it('counts preview bytes without re-encoding and renders non-text responses as deterministic hex', async () => {
    const user = userEvent.setup();
    const binaryRecord = {
      ...record,
      contentType: 'application/octet-stream',
      requestBytes: 12,
      responseBytes: 4,
    };
    installRawDataApi({
      records: [binaryRecord],
      requestPreview: new Uint8Array([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xe4, 0xb8]),
      responsePreview: new Uint8Array([0x00, 0xff, 0x10, 0x41]),
      requestPreviewHeaders: {
        'Content-Length': '8',
        'X-Raw-Total-Bytes': '12',
        'X-Raw-Truncated': 'true',
      },
      responsePreviewHeaders: {
        'Content-Length': '4',
        'X-Raw-Total-Bytes': '4',
        'X-Raw-Truncated': 'false',
      },
    });
    renderClient();

    const [trigger] = await screen.findAllByRole('button', { name: `查看记录 ${record.id}` });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '原始记录详情' });
    const requestRegion = await within(dialog).findByRole('region', { name: '请求原始正文' });
    expect(requestRegion.querySelector('pre')?.textContent).toBe('{"x":"�');
    expect(within(requestRegion).getByText('仅预览前 8 B，完整正文 12 B')).toBeVisible();

    await user.click(within(dialog).getByRole('tab', { name: 'Response' }));
    const responseRegion = await within(dialog).findByRole('region', { name: '响应原始正文' });
    expect(within(responseRegion).getByText('十六进制预览')).toBeVisible();
    expect(responseRegion.querySelector('pre')?.textContent).toBe('00 ff 10 41');
    expect(within(responseRegion).getByText('完整预览 · 4 B')).toBeVisible();
  });

  it('uses fresh text contentType from record detail instead of stale list metadata', async () => {
    const user = userEvent.setup();
    const staleRecord: RawCaptureRecord = { ...record, contentType: null };
    const freshRecord: RawCaptureRecord = { ...staleRecord, contentType: 'text/plain; charset=utf-8' };
    const api = installRawDataApi({
      records: [staleRecord],
      detailRecord: freshRecord,
      responsePreview: '汉字',
      responsePreviewHeaders: {
        'Content-Length': '6',
        'X-Raw-Total-Bytes': '6',
        'X-Raw-Truncated': 'false',
      },
    });
    renderClient();

    const [trigger] = await screen.findAllByRole('button', { name: `查看记录 ${record.id}` });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '原始记录详情' });
    await user.click(within(dialog).getByRole('tab', { name: 'Response' }));
    const responseRegion = await within(dialog).findByRole('region', { name: '响应原始正文' });

    expect(within(responseRegion).queryByText('十六进制预览')).not.toBeInTheDocument();
    expect(responseRegion.querySelector('pre')?.textContent).toBe('汉字');
    expect(within(responseRegion).getByText('完整预览 · 6 B')).toBeVisible();
    expect(api.fetchSpy.mock.calls.filter(([input]) => (
      String(input) === `/api/admin/raw-data/records/${record.id}`
    ))).toHaveLength(1);
    expect(api.fetchSpy.mock.calls.filter(([input]) => (
      String(input) === `/api/admin/raw-data/records/${record.id}/response`
    ))).toHaveLength(1);
  });

  it('uses fresh binary contentType from record detail instead of stale text metadata', async () => {
    const user = userEvent.setup();
    const staleRecord: RawCaptureRecord = { ...record, contentType: 'text/event-stream' };
    const freshRecord: RawCaptureRecord = { ...staleRecord, contentType: 'application/octet-stream' };
    const api = installRawDataApi({
      records: [staleRecord],
      detailRecord: freshRecord,
      responsePreview: new Uint8Array([0xe4, 0xb8, 0xad, 0x00]),
      responsePreviewHeaders: {
        'Content-Length': '4',
        'X-Raw-Total-Bytes': '4',
        'X-Raw-Truncated': 'false',
      },
    });
    renderClient();

    const [trigger] = await screen.findAllByRole('button', { name: `查看记录 ${record.id}` });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '原始记录详情' });
    await user.click(within(dialog).getByRole('tab', { name: 'Response' }));
    const responseRegion = await within(dialog).findByRole('region', { name: '响应原始正文' });

    expect(within(responseRegion).getByText('十六进制预览')).toBeVisible();
    expect(responseRegion.querySelector('pre')?.textContent).toBe('e4 b8 ad 00');
    expect(within(responseRegion).getByText('完整预览 · 4 B')).toBeVisible();
    expect(api.fetchSpy.mock.calls.filter(([input]) => (
      String(input) === `/api/admin/raw-data/records/${record.id}`
    ))).toHaveLength(1);
    expect(api.fetchSpy.mock.calls.filter(([input]) => (
      String(input) === `/api/admin/raw-data/records/${record.id}/response`
    ))).toHaveLength(1);
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
    const archiveCreatedAt = screen.getByText(/压缩于/).closest('time');
    expect(archiveCreatedAt).toHaveAttribute('dateTime', new Date(archive.createdAt).toISOString());

    await user.click(screen.getByRole('button', { name: `删除 ${archive.day} 归档` }));
    expect(screen.getByRole('alertdialog', { name: `删除 ${archive.day} 归档？` })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '删除归档' }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(
      `/api/admin/raw-data/archives/${archive.day}`,
      expect.objectContaining({ method: 'DELETE' }),
    ));
    expect(screen.queryByRole('button', { name: /清空/ })).not.toBeInTheDocument();
  });

  it('disables every mutation control and rejects overlapping archive work while config is pending', async () => {
    const user = userEvent.setup();
    const api = installRawDataApi({ enabled: true });
    renderClient();

    const captureSwitch = await screen.findByRole('switch', { name: '记录所有原始对话' });
    const archiveRunButton = screen.getByRole('button', { name: '执行归档检查' });
    const deleteButton = screen.getByRole('button', { name: `删除 ${archive.day} 归档` });
    const refreshButton = screen.getByRole('button', { name: '刷新数据' });
    const configSave = deferred<Response>();
    const mutationMethods: string[] = [];
    api.fetchSpy.mockImplementation((input, init) => {
      const method = init?.method ?? 'GET';
      if (method !== 'GET') mutationMethods.push(method);
      if (String(input) === '/api/admin/raw-data/config' && method === 'PUT') return configSave.promise;
      return api.respond(input, init);
    });

    await user.click(captureSwitch);
    await waitFor(() => expect(mutationMethods).toEqual(['PUT']));
    expect.soft(captureSwitch).toBeDisabled();
    expect.soft(archiveRunButton).toBeDisabled();
    expect.soft(deleteButton).toBeDisabled();
    expect.soft(refreshButton).toBeDisabled();
    act(() => { archiveRunButton.click(); });

    await act(async () => {
      configSave.resolve(json({ config: { enabled: false }, status: { ...status, enabled: false } }));
      await configSave.promise;
    });
    await waitFor(() => expect(captureSwitch).toBeEnabled());
    expect(mutationMethods).toEqual(['PUT']);
  });

  it('ignores a stale mutation response and performs one coherent authoritative refresh', async () => {
    const user = userEvent.setup();
    const api = installRawDataApi({ enabled: true });
    renderClient();
    const captureSwitch = await screen.findByRole('switch', { name: '记录所有原始对话' });
    let mutationStarted = false;
    const refreshReads = { config: 0, records: 0, archives: 0 };

    api.fetchSpy.mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/admin/raw-data/config' && method === 'PUT') {
        mutationStarted = true;
        return Promise.resolve(json({
          config: { enabled: false },
          status: { ...status, enabled: false, todayRecords: 999 },
        }));
      }
      if (mutationStarted && url === '/api/admin/raw-data/config' && method === 'GET') {
        refreshReads.config += 1;
        return Promise.resolve(json({
          config: { enabled: true },
          status: { ...status, enabled: true, todayRecords: 2 },
        }));
      }
      if (mutationStarted && url.startsWith('/api/admin/raw-data/records?') && method === 'GET') {
        refreshReads.records += 1;
      }
      if (mutationStarted && url === '/api/admin/raw-data/archives' && method === 'GET') {
        refreshReads.archives += 1;
      }
      return api.respond(input, init);
    });

    await user.click(captureSwitch);

    expect(await screen.findByRole('status')).toHaveTextContent('原始数据采集已关闭');
    await waitFor(() => expect(refreshReads).toEqual({ config: 1, records: 1, archives: 1 }));
    expect(captureSwitch).toBeChecked();
    expect(screen.getByText('2 条')).toBeVisible();
    expect(screen.queryByText('999 条')).not.toBeInTheDocument();
  });

  it('releases the mutation guard after a real failure and keeps the error visible', async () => {
    const user = userEvent.setup();
    const api = installRawDataApi({ enabled: true });
    renderClient();
    const captureSwitch = await screen.findByRole('switch', { name: '记录所有原始对话' });
    const archiveRunButton = screen.getByRole('button', { name: '执行归档检查' });
    api.fetchSpy.mockImplementation((input, init) => {
      if (String(input) === '/api/admin/raw-data/config' && init?.method === 'PUT') {
        return Promise.resolve(json({ error: '配置写入失败' }, 500));
      }
      return api.respond(input, init);
    });

    await user.click(captureSwitch);

    expect(await screen.findByRole('alert')).toHaveTextContent('配置写入失败');
    await waitFor(() => expect(archiveRunButton).toBeEnabled());
    await user.click(archiveRunButton);
    await waitFor(() => expect(api.fetchSpy).toHaveBeenCalledWith(
      '/api/admin/raw-data/archives',
      expect.objectContaining({ method: 'POST' }),
    ));
    expect(await screen.findByRole('status')).toHaveTextContent('归档检查已完成');
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

  it('clamps to the last valid page after archive deletion shrinks pagination', async () => {
    const user = userEvent.setup();
    const pageRecords = Array.from({ length: 21 }, (_, index): RawCaptureRecord => ({
      ...record,
      id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`,
      startedAt: record.startedAt + index,
      ...(index === 20 ? { day: archive.day, location: 'archived' as const } : {}),
    }));
    installRawDataApi({
      records: pageRecords,
      archives: [{ ...archive, recordCount: 1 }],
    });
    renderClient();

    expect(await screen.findByText('第 1 / 2 页，共 21 条')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '下一页' }));
    expect(await screen.findByText('第 2 / 2 页，共 21 条')).toBeVisible();
    expect((await screen.findAllByRole('button', { name: `查看记录 ${pageRecords[20].id}` }))[0]).toBeVisible();

    await user.click(screen.getByRole('button', { name: `删除 ${archive.day} 归档` }));
    await user.click(screen.getByRole('button', { name: '删除归档' }));

    expect(await screen.findByText('第 1 / 1 页，共 20 条')).toBeVisible();
    expect((await screen.findAllByRole('button', { name: `查看记录 ${pageRecords[0].id}` }))[0]).toBeVisible();
    expect(screen.queryByRole('button', { name: `查看记录 ${pageRecords[20].id}` })).not.toBeInTheDocument();
  });

  it('closes a record selected from the deleted archive while DELETE is pending', async () => {
    const user = userEvent.setup();
    const archivedRecord: RawCaptureRecord = { ...record, day: archive.day, location: 'archived' };
    const activeSameDay: RawCaptureRecord = {
      ...record,
      id: '22222222-2222-4222-8222-222222222222',
      day: archive.day,
      location: 'active',
    };
    const api = installRawDataApi({ records: [archivedRecord, activeSameDay] });
    const delayedDelete = deferred<Response>();
    let deleteRequest: [RequestInfo | URL, RequestInit | undefined] | null = null;
    api.fetchSpy.mockImplementation((input, init) => {
      if (String(input) === `/api/admin/raw-data/archives/${archive.day}` && init?.method === 'DELETE') {
        deleteRequest = [input, init];
        return delayedDelete.promise;
      }
      return api.respond(input, init);
    });
    renderClient();

    await screen.findAllByRole('button', { name: `查看记录 ${archivedRecord.id}` });
    await user.click(screen.getByRole('button', { name: `删除 ${archive.day} 归档` }));
    await user.click(screen.getByRole('button', { name: '删除归档' }));
    await waitFor(() => expect(deleteRequest).not.toBeNull());

    await user.click(screen.getAllByRole('button', { name: `查看记录 ${archivedRecord.id}` })[0]);
    const dialog = screen.getByRole('dialog', { name: '原始记录详情' });
    expect(within(dialog).getByText(new RegExp(archivedRecord.id))).toBeVisible();
    expect(within(dialog).getByRole('link', { name: '下载完整请求' })).toBeVisible();
    await within(dialog).findByRole('region', { name: '请求原始正文' });

    await act(async () => {
      const [input, init] = deleteRequest!;
      delayedDelete.resolve(await api.respond(input, init));
      await delayedDelete.promise;
    });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '原始记录详情' })).not.toBeInTheDocument());
    expect(await screen.findByRole('status')).toHaveTextContent(`${archive.day} 归档已删除`);
    expect(screen.queryByRole('link', { name: '下载完整请求' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `查看记录 ${archivedRecord.id}` })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: `查看记录 ${activeSameDay.id}` })[0]).toBeVisible();
  });

  it('keeps an active record selected from the same day when deleting an archive', async () => {
    const user = userEvent.setup();
    const archivedRecord: RawCaptureRecord = { ...record, day: archive.day, location: 'archived' };
    const activeSameDay: RawCaptureRecord = {
      ...record,
      id: '22222222-2222-4222-8222-222222222222',
      day: archive.day,
      location: 'active',
    };
    const api = installRawDataApi({ records: [archivedRecord, activeSameDay] });
    const delayedDelete = deferred<Response>();
    let deleteRequest: [RequestInfo | URL, RequestInit | undefined] | null = null;
    api.fetchSpy.mockImplementation((input, init) => {
      if (String(input) === `/api/admin/raw-data/archives/${archive.day}` && init?.method === 'DELETE') {
        deleteRequest = [input, init];
        return delayedDelete.promise;
      }
      return api.respond(input, init);
    });
    renderClient();

    await screen.findAllByRole('button', { name: `查看记录 ${activeSameDay.id}` });
    await user.click(screen.getByRole('button', { name: `删除 ${archive.day} 归档` }));
    await user.click(screen.getByRole('button', { name: '删除归档' }));
    await waitFor(() => expect(deleteRequest).not.toBeNull());
    await user.click(screen.getAllByRole('button', { name: `查看记录 ${activeSameDay.id}` })[0]);

    const dialog = screen.getByRole('dialog', { name: '原始记录详情' });
    await within(dialog).findByRole('region', { name: '请求原始正文' });
    await act(async () => {
      const [input, init] = deleteRequest!;
      delayedDelete.resolve(await api.respond(input, init));
      await delayedDelete.promise;
    });

    expect(await screen.findByRole('status', { hidden: true })).toHaveTextContent(`${archive.day} 归档已删除`);
    expect(screen.getByRole('dialog', { name: '原始记录详情' })).toBeVisible();
    expect(within(dialog).getByText(new RegExp(activeSameDay.id))).toBeVisible();
    expect(within(dialog).getByRole('link', { name: '下载完整请求' })).toHaveAttribute(
      'href',
      `/api/admin/raw-data/records/${activeSameDay.id}/request?download=1`,
    );
  });

  it('does not start an overlapping poll while one refresh is pending', async () => {
    let poll: (() => void) | undefined;
    vi.spyOn(window, 'setInterval').mockImplementation((handler, timeout) => {
      if (timeout === 2000) poll = () => handler(undefined);
      return 1 as unknown as ReturnType<typeof window.setInterval>;
    });
    const api = installRawDataApi({ enabled: true });
    renderClient();
    await screen.findByText('今日原始数据');
    await waitFor(() => expect(poll).toBeTypeOf('function'));

    const pendingConfig = deferred<Response>();
    let pollConfigCalls = 0;
    api.fetchSpy.mockImplementation((input, init) => {
      if (String(input) === '/api/admin/raw-data/config' && (!init?.method || init.method === 'GET')) {
        pollConfigCalls += 1;
        return pendingConfig.promise;
      }
      return api.respond(input, init);
    });

    act(() => { poll?.(); });
    act(() => { poll?.(); });
    expect(pollConfigCalls).toBe(1);

    await act(async () => {
      pendingConfig.resolve(json({ config: { enabled: true }, status: { ...status, enabled: true } }));
      await pendingConfig.promise;
    });
  });

  it('aborts the rest of a failed refresh batch and leaves no orphan after the next poll unmounts', async () => {
    let poll: (() => void) | undefined;
    vi.spyOn(window, 'setInterval').mockImplementation((handler, timeout) => {
      if (timeout === 2000) poll = () => handler(undefined);
      return 1 as unknown as ReturnType<typeof window.setInterval>;
    });
    const api = installRawDataApi({ enabled: true });
    const view = renderClient();
    await screen.findByText('今日原始数据');
    await waitFor(() => expect(poll).toBeTypeOf('function'));

    let mode: 'fail' | 'hang' = 'fail';
    let activeRequests = 0;
    let abortedRequests = 0;
    const waitForAbort = (signal: AbortSignal | null | undefined) => new Promise<Response>((_resolve, reject) => {
      activeRequests += 1;
      signal?.addEventListener('abort', () => {
        activeRequests -= 1;
        abortedRequests += 1;
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
    api.fetchSpy.mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET' && mode === 'fail' && url === '/api/admin/raw-data/config') {
        return Promise.resolve(json({ error: '磁盘不可用' }, 500));
      }
      if (method === 'GET' && mode === 'fail' && url.startsWith('/api/admin/raw-data/records?')) {
        return waitForAbort(init?.signal);
      }
      if (method === 'GET' && mode === 'hang' && url === '/api/admin/raw-data/config') {
        return waitForAbort(init?.signal);
      }
      return api.respond(input, init);
    });

    act(() => { poll?.(); });
    expect(await screen.findByRole('alert')).toHaveTextContent('磁盘不可用');
    await waitFor(() => expect.soft(activeRequests).toBe(0));
    expect.soft(abortedRequests).toBe(1);

    const orphanedBeforeNextPoll = activeRequests;
    mode = 'hang';
    act(() => { poll?.(); });
    await waitFor(() => expect(activeRequests).toBe(orphanedBeforeNextPoll + 1));
    view.unmount();
    await waitFor(() => expect(activeRequests).toBe(orphanedBeforeNextPoll));
    expect(activeRequests).toBe(0);
    expect(abortedRequests).toBe(2);
  });

  it('aborts a pending poll on disable and ignores its stale response', async () => {
    let poll: (() => void) | undefined;
    vi.spyOn(window, 'setInterval').mockImplementation((handler, timeout) => {
      if (timeout === 2000) poll = () => handler(undefined);
      return 1 as unknown as ReturnType<typeof window.setInterval>;
    });
    const api = installRawDataApi({ enabled: true });
    renderClient();
    const user = userEvent.setup();
    const captureSwitch = await screen.findByRole('switch', { name: '记录所有原始对话' });
    await waitFor(() => expect(poll).toBeTypeOf('function'));

    const staleConfig = deferred<Response>();
    let pollSignal: AbortSignal | undefined;
    let interceptedPoll = false;
    api.fetchSpy.mockImplementation((input, init) => {
      if (!interceptedPoll && String(input) === '/api/admin/raw-data/config' && (!init?.method || init.method === 'GET')) {
        interceptedPoll = true;
        pollSignal = init?.signal ?? undefined;
        return staleConfig.promise;
      }
      return api.respond(input, init);
    });

    act(() => { poll?.(); });
    await user.click(captureSwitch);
    expect(pollSignal?.aborted).toBe(true);
    expect(await screen.findByRole('status')).toHaveTextContent('原始数据采集已关闭');

    await act(async () => {
      staleConfig.resolve(json({
        config: { enabled: true },
        status: { ...status, enabled: true, todayRecords: 999 },
      }));
      await staleConfig.promise;
    });
    expect(captureSwitch).not.toBeChecked();
    expect(screen.queryByText('999 条')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('aborts outstanding refresh work on unmount', async () => {
    let poll: (() => void) | undefined;
    vi.spyOn(window, 'setInterval').mockImplementation((handler, timeout) => {
      if (timeout === 2000) poll = () => handler(undefined);
      return 1 as unknown as ReturnType<typeof window.setInterval>;
    });
    const api = installRawDataApi({ enabled: true });
    const view = renderClient();
    await screen.findByText('今日原始数据');
    await waitFor(() => expect(poll).toBeTypeOf('function'));

    let pollSignal: AbortSignal | undefined;
    api.fetchSpy.mockImplementation((input, init) => {
      if (String(input) === '/api/admin/raw-data/config' && (!init?.method || init.method === 'GET')) {
        pollSignal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          pollSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });
      }
      return api.respond(input, init);
    });

    act(() => { poll?.(); });
    view.unmount();
    expect(pollSignal?.aborted).toBe(true);
    await act(async () => { await Promise.resolve(); });
  });

  it('does not enable capture when confirmation resolves after unmount', async () => {
    const confirmation = deferred<boolean>();
    const confirm = vi.fn(() => confirmation.promise);
    vi.spyOn(ConfirmDialog, 'useConfirm').mockReturnValue({ confirm });
    const api = installRawDataApi();
    const user = userEvent.setup();
    const view = renderClient();

    await user.click(await screen.findByRole('switch', { name: '记录所有原始对话' }));
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: '开启原始数据采集？' }));
    view.unmount();
    await act(async () => {
      confirmation.resolve(true);
      await confirmation.promise;
      await Promise.resolve();
    });

    expect(api.fetchSpy.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });

  it('does not delete an archive when confirmation resolves after unmount', async () => {
    const confirmation = deferred<boolean>();
    const confirm = vi.fn(() => confirmation.promise);
    vi.spyOn(ConfirmDialog, 'useConfirm').mockReturnValue({ confirm });
    const api = installRawDataApi();
    const user = userEvent.setup();
    const view = renderClient();

    await user.click(await screen.findByRole('button', { name: `删除 ${archive.day} 归档` }));
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: `删除 ${archive.day} 归档？` }));
    view.unmount();
    await act(async () => {
      confirmation.resolve(true);
      await confirmation.promise;
      await Promise.resolve();
    });

    expect(api.fetchSpy.mock.calls.some(([input, init]) => (
      String(input) === `/api/admin/raw-data/archives/${archive.day}` && init?.method === 'DELETE'
    ))).toBe(false);
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
