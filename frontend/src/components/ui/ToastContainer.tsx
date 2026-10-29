import React from 'react';
import { useToast, ToastType } from '@/contexts/ToastContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 text-success" />,
  warning: <AlertTriangle className="w-4 h-4 text-warning" />,
  error: <AlertCircle className="w-4 h-4 text-danger" />,
  info: <Info className="w-4 h-4 text-info" />,
};

export function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2.5 bg-[#222] border border-border px-4 py-3 rounded-control shadow-lg text-xs text-tx toast-enter min-w-[280px]"
        >
          {ICONS[t.type]}
          <span className="flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
