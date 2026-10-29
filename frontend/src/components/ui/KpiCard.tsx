import React from 'react';
import { clsx } from 'clsx';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface SparklinePoint {
  val: number;
}

interface Props {
  title: string;
  value: string | number;
  subValue?: string;
  trend?: { val: string; positive: boolean };
  sparklineData?: SparklinePoint[];
  glow?: boolean;
}

export function KpiCard({ title, value, subValue, trend, sparklineData, glow }: Props) {
  return (
    <div
      className={clsx(
        'bg-card rounded-card border border-border p-5 flex flex-col justify-between relative overflow-hidden transition-all',
        glow && 'glow-accent border-accent/40'
      )}
    >
      <div>
        <span className="label-xs">{title}</span>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-3xl font-semibold text-tx mono">{value}</span>
          {subValue && <span className="text-sm text-tx-secondary">{subValue}</span>}
        </div>
        {trend && (
          <div className="flex items-center gap-1 mt-2 text-xs">
            <span className={clsx('font-medium', trend.positive ? 'text-success' : 'text-danger')}>
              {trend.positive ? '+' : ''}{trend.val}
            </span>
            <span className="text-tx-muted">vs last cycle</span>
          </div>
        )}
      </div>

      {sparklineData && sparklineData.length > 0 && (
        <div className="h-10 w-full mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData}>
              <defs>
                <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C6F135" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#C6F135" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="val"
                stroke="#C6F135"
                strokeWidth={1.5}
                fill={`url(#grad-${title})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
