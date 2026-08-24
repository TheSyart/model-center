'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastType = 'success' | 'error';
interface Toast {
  id: number;
  text: string;
  type: ToastType;
}

const ToastContext = createContext<{ toast: (text: string, type?: ToastType) => void }>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

/** 全局 toast（成功绿/错误红，3.5s 自动消失，右上角堆叠）。 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((text: string, type: ToastType = 'success') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div aria-label="通知" className="pointer-events-none fixed inset-x-4 top-4 z-50 ml-auto flex max-w-80 flex-col gap-2 sm:right-5 sm:left-auto">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            aria-live={t.type === 'error' ? 'assertive' : 'polite'}
            className={`pointer-events-auto rounded-md border bg-surface px-4 py-3 text-sm shadow-lg ${
              t.type === 'error' ? 'border-destructive/25 text-destructive' : 'border-success/25 text-success'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
