'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useConfirm } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { requestJson } from '@/lib/client/request';
import type { ArchiveRunResult } from '@/lib/raw-capture/archive';
import type { RawCaptureArchive, RawCaptureConfig, RawCapturePage, RawCaptureRecord, RawCaptureStatus } from '@/lib/raw-capture/types';
import { ArchiveList } from './archive-list';
import { CaptureControl } from './capture-control';
import { RawRecordDetail } from './raw-record-detail';
import { RawRecordList } from './raw-record-list';

type DashboardResponse = { config: RawCaptureConfig; status: RawCaptureStatus };
type ArchivesResponse = { archives: RawCaptureArchive[] };
type RefreshOptions = {
  quiet?: boolean;
  policy?: 'replace' | 'skip';
  duringMutation?: boolean;
  invalidatedArchiveDay?: string;
};

const EMPTY_PAGE: RawCapturePage = { items: [], total: 0, page: 1, pageSize: 20 };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function recordsUrl(page: number): string {
  return `/api/admin/raw-data/records?page=${page}&page_size=20`;
}

async function loadRecordPage(targetPage: number, signal?: AbortSignal): Promise<RawCapturePage> {
  const requested = await requestJson<RawCapturePage>(recordsUrl(targetPage), { signal });
  const lastPage = Math.max(1, Math.ceil(requested.total / Math.max(1, requested.pageSize)));
  if (requested.page <= lastPage) return requested;
  return requestJson<RawCapturePage>(recordsUrl(lastPage), { signal });
}

export default function RawDataClient() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [records, setRecords] = useState<RawCapturePage>(EMPTY_PAGE);
  const [archives, setArchives] = useState<RawCaptureArchive[]>([]);
  const [selected, setSelected] = useState<RawCaptureRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mutationPending, setMutationPending] = useState(false);
  const [archiveRunning, setArchiveRunning] = useState(false);
  const [pendingDay, setPendingDay] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const requestVersion = useRef(0);
  const refreshController = useRef<AbortController | null>(null);
  const mutationActive = useRef(false);
  const mounted = useRef(true);
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const { confirm } = useConfirm();
  const { toast } = useToast();

  const showError = useCallback((message: string) => {
    setError(message);
    setNotice('');
  }, []);

  const cancelRefresh = useCallback(() => {
    requestVersion.current += 1;
    if (refreshController.current) {
      refreshController.current.abort();
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  const beginMutation = useCallback((): boolean => {
    if (!mounted.current || mutationActive.current) return false;
    mutationActive.current = true;
    cancelRefresh();
    setMutationPending(true);
    return true;
  }, [cancelRefresh]);

  const refresh = useCallback(async (
    targetPage: number,
    includeArchives: boolean,
    options: RefreshOptions = {},
  ) => {
    const {
      quiet = false,
      policy = 'replace',
      duringMutation = false,
      invalidatedArchiveDay,
    } = options;
    if (mutationActive.current && !duringMutation) return;
    if (refreshController.current) {
      if (policy === 'skip') return;
      refreshController.current.abort();
    }

    const controller = new AbortController();
    refreshController.current = controller;
    const version = ++requestVersion.current;
    if (!quiet && mounted.current) setRefreshing(true);
    try {
      const responses = await Promise.all([
        requestJson<DashboardResponse>('/api/admin/raw-data/config', { signal: controller.signal }),
        loadRecordPage(targetPage, controller.signal),
        includeArchives
          ? requestJson<ArchivesResponse>('/api/admin/raw-data/archives', { signal: controller.signal })
          : Promise.resolve(null),
      ]);
      if (!mounted.current || version !== requestVersion.current) return;
      const [nextDashboard, nextRecords, nextArchives] = responses;
      setDashboard(nextDashboard);
      setRecords(nextRecords);
      if (nextArchives) setArchives(nextArchives.archives);
      setSelected((current) => {
        if (!current) return null;
        if (current.location === 'archived' && current.day === invalidatedArchiveDay) return null;
        return nextRecords.items.find((item) => item.id === current.id) ?? current;
      });
      setError('');
    } catch (loadError) {
      const wasAborted = controller.signal.aborted;
      if (!wasAborted) controller.abort();
      if (wasAborted || !mounted.current || version !== requestVersion.current) return;
      showError(errorMessage(loadError, '原始数据加载失败'));
    } finally {
      if (refreshController.current === controller) refreshController.current = null;
      if (mounted.current && version === requestVersion.current) {
        setLoading(false);
        if (!quiet) setRefreshing(false);
      }
    }
  }, [showError]);

  const finishMutation = useCallback(async (targetPage: number, invalidatedArchiveDay?: string) => {
    try {
      if (mounted.current) {
        await refresh(targetPage, true, { quiet: true, duringMutation: true, invalidatedArchiveDay });
      }
    } finally {
      mutationActive.current = false;
      if (mounted.current) setMutationPending(false);
    }
  }, [refresh]);

  useEffect(() => {
    mounted.current = true;
    void refresh(1, true);
    return () => {
      mounted.current = false;
      cancelRefresh();
    };
  }, [cancelRefresh, refresh]);

  useEffect(() => {
    if (!dashboard?.config.enabled) return;
    const timer = window.setInterval(() => {
      void refresh(records.page, false, { quiet: true, policy: 'skip' });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [dashboard?.config.enabled, records.page, refresh]);

  async function changeEnabled(enabled: boolean) {
    if (enabled) {
      const approved = await confirm({
        title: '开启原始数据采集？',
        description: '开启后会原封不动保存新请求与最终响应，可能包含提示词、代码上下文和工具结果。数据只保存在本机。',
        confirmText: '确认开启',
        danger: true,
      });
      if (!approved || !mounted.current) return;
    }

    if (!beginMutation()) return;
    setError('');
    setNotice('');
    let failure = '';
    const success = enabled ? '原始数据采集已开启' : '原始数据采集已关闭';
    try {
      await requestJson<DashboardResponse>('/api/admin/raw-data/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
    } catch (saveError) {
      failure = errorMessage(saveError, '采集配置保存失败');
    } finally {
      await finishMutation(records.page);
      if (!mounted.current) return;
      if (failure) {
        showError(failure);
        toast(failure, 'error');
      } else {
        setNotice(success);
        toast(success);
      }
    }
  }

  async function runArchiveCheck() {
    if (!beginMutation()) return;
    setArchiveRunning(true);
    setError('');
    setNotice('');
    let failure = '';
    let success = '';
    try {
      const result = await requestJson<ArchiveRunResult>('/api/admin/raw-data/archives', { method: 'POST' });
      const message = result.errors.length > 0
        ? `归档检查完成，${result.errors.length} 个日期失败`
        : `归档检查已完成，新增 ${result.archived.length} 个归档`;
      if (result.errors.length > 0) {
        failure = message;
      } else {
        success = message;
      }
    } catch (archiveError) {
      failure = errorMessage(archiveError, '归档检查失败');
    } finally {
      await finishMutation(records.page);
      if (!mounted.current) return;
      setArchiveRunning(false);
      if (failure) {
        showError(failure);
        toast(failure, 'error');
      } else {
        setNotice(success);
        toast(success);
      }
    }
  }

  async function deleteArchive(item: RawCaptureArchive) {
    const approved = await confirm({
      title: `删除 ${item.day} 归档？`,
      description: `将永久删除该日 ${item.recordCount} 条原始请求与响应，操作不可恢复。`,
      confirmText: '删除归档',
      danger: true,
    });
    if (!approved || !mounted.current) return;
    if (!beginMutation()) return;
    setPendingDay(item.day);
    setError('');
    setNotice('');
    let failure = '';
    let deletedArchiveDay: string | undefined;
    const success = `${item.day} 归档已删除`;
    try {
      await requestJson<{ deleted: true; day: string }>(`/api/admin/raw-data/archives/${item.day}`, { method: 'DELETE' });
      deletedArchiveDay = item.day;
      if (mounted.current) {
        setSelected((current) => (
          current?.day === item.day && current.location === 'archived' ? null : current
        ));
      }
    } catch (deleteError) {
      failure = errorMessage(deleteError, '归档删除失败');
    } finally {
      await finishMutation(records.page, deletedArchiveDay);
      if (!mounted.current) return;
      setPendingDay(null);
      if (failure) {
        showError(failure);
        toast(failure, 'error');
      } else {
        setNotice(success);
        toast(success);
      }
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      {error && <div role="alert" aria-live="assertive" className="rounded-md border border-destructive/25 bg-destructive-soft px-4 py-3 text-sm text-destructive">{error}</div>}
      {notice && <div role="status" aria-live="polite" className="rounded-md border border-success/25 bg-success-soft px-4 py-3 text-sm text-success">{notice}</div>}

      <CaptureControl
        config={dashboard?.config ?? null}
        status={dashboard?.status ?? null}
        pending={mutationPending}
        onEnabledChange={(enabled) => { void changeEnabled(enabled); }}
      />

      <RawRecordList
        page={records}
        loading={loading}
        refreshing={refreshing}
        mutationPending={mutationPending}
        onRefresh={() => { void refresh(records.page, true); }}
        onSelect={(record) => {
          detailTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setSelected(record);
        }}
        onPageChange={(page) => { void refresh(page, false); }}
      />

      <ArchiveList
        archives={archives}
        loading={loading}
        pendingDay={pendingDay}
        archiveRunning={archiveRunning}
        mutationPending={mutationPending}
        onRun={() => { void runArchiveCheck(); }}
        onDelete={(item) => { void deleteArchive(item); }}
      />

      <RawRecordDetail record={selected} returnFocusRef={detailTriggerRef} onRecordChange={setSelected} onError={showError} />
    </div>
  );
}
