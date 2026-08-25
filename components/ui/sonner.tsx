'use client';

import { CheckCircle2, Info, Loader2, OctagonAlert, TriangleAlert, X } from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-right"
      closeButton
      icons={{
        success: <CheckCircle2 className="size-4" />,
        info: <Info className="size-4" />,
        warning: <TriangleAlert className="size-4" />,
        error: <OctagonAlert className="size-4" />,
        loading: <Loader2 className="size-4 animate-spin" />,
        close: <X className="size-3.5" />,
      }}
      toastOptions={{
        classNames: {
          toast: '!rounded-md !border-border !bg-popover !text-popover-foreground !shadow-[0_12px_36px_rgba(0,0,0,0.16)]',
          description: '!text-muted-foreground',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
