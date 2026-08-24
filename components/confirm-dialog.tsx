'use client';

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { btn } from './ui';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  danger?: boolean;
}

const ConfirmContext = createContext<{ confirm: (opts: ConfirmOptions) => Promise<boolean> }>({
  confirm: async () => false,
});

export function useConfirm() {
  return useContext(ConfirmContext);
}

/** 确认弹窗（Promise 化：confirm(...) 返回用户选择）。 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const resolverRef = useRef<(v: boolean) => void>(() => {});
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const confirm = useCallback((opts: ConfirmOptions) => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setState({ ...opts, open: true });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  function close(result: boolean) {
    resolverRef.current(result);
    setState(null);
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!state?.open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state?.open]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 backdrop-blur-[2px]" onClick={() => close(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={state.description ? descriptionId : undefined}
            className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={titleId} className="text-lg font-semibold tracking-[-0.02em]">
              {state.title}
            </h3>
            {state.description && (
              <p id={descriptionId} className="mt-2 text-sm leading-6 text-muted-foreground">
                {state.description}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => close(false)} className={btn.ghost}>
                取消
              </button>
              <button onClick={() => close(true)} className={state.danger === false ? btn.primary : btn.danger} autoFocus>
                {state.confirmText ?? '确定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
