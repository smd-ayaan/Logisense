import React from 'react';

interface Props {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, action, children, className = '' }: Props) {
  return (
    <div className={`bg-card rounded-card border border-border p-5 flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-tx">{title}</h3>
          {subtitle && <p className="text-xs text-tx-muted mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="w-full flex-1 min-h-[220px]">{children}</div>
    </div>
  );
}
