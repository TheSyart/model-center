'use client';

import { createContext, useCallback, useContext } from 'react';
import { toast as sonnerToast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

export type ToastType = 'success' | 'error';
const ToastContext = createContext<{ toast: (text: string, type?: ToastType) => void }>({ toast: () => {} });

export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toast = useCallback((text: string, type: ToastType = 'success') => {
    if (type === 'error') sonnerToast.error(text);
    else sonnerToast.success(text);
  }, []);
  return <ToastContext.Provider value={{ toast }}>{children}<Toaster /></ToastContext.Provider>;
}
