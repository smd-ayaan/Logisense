import { clsx } from 'clsx';

type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'active' | 'inactive';

const MAP: Record<StatusVariant, { bg: string; text: string; dot: string }> = {
  success:  { bg: 'bg-[#14301F]', text: 'text-success',  dot: 'bg-success' },
  warning:  { bg: 'bg-[#33260D]', text: 'text-warning',  dot: 'bg-warning' },
  danger:   { bg: 'bg-[#3A1717]', text: 'text-danger',   dot: 'bg-danger'  },
  info:     { bg: 'bg-[#14263D]', text: 'text-info',     dot: 'bg-info'    },
  active:   { bg: 'bg-[#14301F]', text: 'text-success',  dot: 'bg-success' },
  inactive: { bg: 'bg-[#3A1717]', text: 'text-danger',   dot: 'bg-danger'  },
  default:  { bg: 'bg-[#2A2A2A]', text: 'text-tx-2',     dot: 'bg-tx-muted'},
};

function toVariant(status: string): StatusVariant {
  const s = status?.toLowerCase() ?? '';
  if (s === 'active' || s === 'ok' || s === 'completed') return 'success';
  if (s === 'inactive' || s === 'stockout' || s === 'error' || s === 'failed') return 'danger';
  if (s === 'low' || s === 'warning' || s === 'pending' || s === 'watch') return 'warning';
  if (s === 'info' || s === 'in_transit' || s === 'open') return 'info';
  if (s === 'alert') return 'danger';
  if (s === 'excess') return 'info';
  if (s === 'maintenance') return 'warning';
  return 'default';
}

interface Props {
  status:   string;
  label?:   string;
  variant?: StatusVariant;
}

export function StatusBadge({ status, label, variant }: Props) {
  const v = variant ?? toVariant(status);
  const { bg, text, dot } = MAP[v];
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-xs font-medium', bg, text)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', dot)} />
      {label ?? status}
    </span>
  );
}
