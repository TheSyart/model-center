import type Database from 'better-sqlite3';

import {
  createRawCaptureArchiveService,
  type RawCaptureArchiveService,
  type RawCaptureArchiveServiceOptions,
} from './archive.ts';
import { createRawCaptureConfigStore } from './config.ts';
import {
  createRawCaptureStore,
  type RawCaptureStore,
  type RawCaptureStoreOptions,
} from './store.ts';

export interface RawCaptureRuntime {
  store: RawCaptureStore;
  archive: RawCaptureArchiveService;
  config: ReturnType<typeof createRawCaptureConfigStore>;
}

export interface RawCaptureRuntimeOptions {
  store?: RawCaptureStoreOptions;
  archive?: RawCaptureArchiveServiceOptions;
}

export function createRawCaptureRuntime(
  database: Database.Database,
  options: RawCaptureRuntimeOptions = {},
): RawCaptureRuntime {
  const store = createRawCaptureStore(database, options.store);
  const archive = createRawCaptureArchiveService(store, options.archive);
  return {
    store,
    archive,
    config: createRawCaptureConfigStore(database),
  };
}

/** Coalesces one initialization attempt and permits a clean retry after rejection. */
export function createRawCaptureRuntimeAccessor(
  factory: () => RawCaptureRuntime | Promise<RawCaptureRuntime>,
): () => Promise<RawCaptureRuntime> {
  let runtimePromise: Promise<RawCaptureRuntime> | undefined;
  return () => {
    if (runtimePromise) return runtimePromise;
    const pending = Promise.resolve().then(factory);
    runtimePromise = pending;
    void pending.catch(() => {
      if (runtimePromise === pending) runtimePromise = undefined;
    });
    return pending;
  };
}

type RawCaptureRuntimeGlobal = typeof globalThis & {
  __modelCenterRawCaptureRuntimePromise?: Promise<RawCaptureRuntime>;
};

export function getDefaultRawCaptureRuntime(): Promise<RawCaptureRuntime> {
  const state = globalThis as RawCaptureRuntimeGlobal;
  if (state.__modelCenterRawCaptureRuntimePromise) return state.__modelCenterRawCaptureRuntimePromise;

  const pending = import('../db/index.ts')
    .then(({ sqlite }) => createRawCaptureRuntime(sqlite));
  state.__modelCenterRawCaptureRuntimePromise = pending;
  void pending.catch(() => {
    if (state.__modelCenterRawCaptureRuntimePromise === pending) {
      delete state.__modelCenterRawCaptureRuntimePromise;
    }
  });
  return pending;
}
