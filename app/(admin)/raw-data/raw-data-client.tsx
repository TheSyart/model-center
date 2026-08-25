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
  const [configPending, setConfigPending] = useState(false);
  const [archiveRunning, setArchiveRunning] = useState(false);
  const [pendingDay, setPendingDay] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const requestVersion = useRef(0);
  const refreshController = useRef<AbortController | null>(null);
  const activeMutations = useRef(0);
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

  const beginMutation = useCallback(() => {
    activeMutations.current += 1;
    cancelRefresh();
  }, [cancelRefresh]);

  const endMutation = useCallback(() => {
    activeMutations.current = Math.max(0, activeMutations.current - 1);
  }, []);

  const refresh = useCallback(async (
    targetPage: number,
    includeArchives: boolean,
    quiet = false,
    policy: 'replace' | 'skip' = 'replace',
  ) => {
    if (activeMutations.current > 0) return;
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
      setSelected((current) => current
        ? nextRecords.items.find((item) => item.id === current.id) ?? current
        : null);
      setError('');
    } catch (loadError) {
      if (controller.signal.aborted || !mounted.current || version !== requestVersion.current) return;
      showError(errorMessage(loadError, '原始数据加载失败'));
    } finally {
      if (refreshController.current === controller) refreshController.current = null;
      if (mounted.current && version === requestVersion.current) {
        setLoading(false);
        if (!quiet) setRefreshing(false);
      }
    }
  }, [showError]);

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
    const timer = window.setInterval(() => { void refresh(records.page, false, true, 'skip'); }, 2000);
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
      if (!approved) return;
    }

    beginMutation();
    setConfigPending(true);
    setError('');
    setNotice('');
    try {
      const next = await requestJson<DashboardResponse>('/api/admin/raw-data/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!mounted.current) return;
      setDashboard(next);
      const message = enabled ? '原始数据采集已开启' : '原始数据采集已关闭';
      setNotice(message);
      toast(message);
    } catch (saveError) {
      if (!mounted.current) return;
      const message = errorMessage(saveError, '采集配置保存失败');
      showError(message);
      toast(message, 'error');
    } finally {
      endMutation();
      if (mounted.current) setConfigPending(false);
    }
  }

  async function runArchiveCheck() {
    beginMutation();
    setArchiveRunning(true);
    setError('');
    setNotice('');
    try {
      const result = await requestJson<ArchiveRunResult>('/api/admin/raw-data/archives', { method: 'POST' });
      const [archiveResponse, nextDashboard] = await Promise.all([
        requestJson<ArchivesResponse>('/api/admin/raw-data/archives'),
        requestJson<DashboardResponse>('/api/admin/raw-data/config'),
      ]);
      if (!mounted.current) return;
      setArchives(archiveResponse.archives);
      setDashboard(nextDashboard);
      const message = result.errors.length > 0
        ? `归档检查完成，${result.errors.length} 个日期失败`
        : `归档检查已完成，新增 ${result.archived.length} 个归档`;
      if (result.errors.length > 0) {
        showError(message);
        toast(message, 'error');
      } else {
        setNotice(message);
        toast(message);
      }
    } catch (archiveError) {
      if (!mounted.current) return;
      const message = errorMessage(archiveError, '归档检查失败');
      showError(message);
      toast(message, 'error');
    } finally {
      endMutation();
      if (mounted.current) setArchiveRunning(false);
    }
  }

  async function deleteArchive(item: RawCaptureArchive) {
    const approved = await confirm({
      title: `删除 ${item.day} 归档？`,
      description: `将永久删除该日 ${item.recordCount} 条原始请求与响应，操作不可恢复。`,
      confirmText: '删除归档',
      danger: true,
    });
    if (!approved) return;
    beginMutation();
    setPendingDay(item.day);
    setError('');
    setNotice('');
    try {
      await requestJson<{ deleted: true; day: string }>(`/api/admin/raw-data/archives/${item.day}`, { method: 'DELETE' });
      if (!mounted.current) return;
      setArchives((current) => current.filter((archive) => archive.day !== item.day));
      if (selected?.day === item.day && selected.location === 'archived') setSelected(null);
      const [nextDashboard, nextRecords] = await Promise.all([
        requestJson<DashboardResponse>('/api/admin/raw-data/config'),
        loadRecordPage(records.page),
      ]);
      if (!mounted.current) return;
      setDashboard(nextDashboard);
      setRecords(nextRecords);
      const message = `${item.day} 归档已删除`;
      setNotice(message);
      toast(message);
    } catch (deleteError) {
      if (!mounted.current) return;
      const message = errorMessage(deleteError, '归档删除失败');
      showError(message);
      toast(message, 'error');
    } finally {
      endMutation();
      if (mounted.current) setPendingDay(null);
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      {error && <div role="alert" aria-live="assertive" className="rounded-md border border-destructive/25 bg-destructive-soft px-4 py-3 text-sm text-destructive">{error}</div>}
      {notice && <div role="status" aria-live="polite" className="rounded-md border border-success/25 bg-success-soft px-4 py-3 text-sm text-success">{notice}</div>}

      <CaptureControl
        config={dashboard?.config ?? null}
        status={dashboard?.status ?? null}
        pending={configPending}
        onEnabledChange={(enabled) => { void changeEnabled(enabled); }}
      />

      <RawRecordList
        page={records}
        loading={loading}
        refreshing={refreshing}
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
        onRun={() => { void runArchiveCheck(); }}
        onDelete={(item) => { void deleteArchive(item); }}
      />

      <RawRecordDetail record={selected} returnFocusRef={detailTriggerRef} onRecordChange={setSelected} onError={showError} />
    </div>
  );
}
