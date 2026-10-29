import { AlertCircle, InboxIcon } from 'lucide-react';

interface Props {
  title:     string;
  subtitle?: string;
  icon?:     'empty' | 'error';
}

export function EmptyState({ title, subtitle, icon = 'empty' }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-12 h-12 rounded-full bg-[#222] flex items-center justify-center">
        {icon === 'error'
          ? <AlertCircle className="w-6 h-6 text-danger" />
          : <InboxIcon className="w-6 h-6 text-tx-muted" />
        }
      </div>
      <p className="text-tx font-semibold">{title}</p>
      {subtitle && <p className="text-tx-muted text-sm max-w-xs">{subtitle}</p>}
    </div>
  );
}
