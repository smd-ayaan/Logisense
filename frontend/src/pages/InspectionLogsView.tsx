import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';

export function InspectionLogsView() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['inspection-logs'],
    queryFn: () => api.get('/api/v1/quality/trend').then(r => r.data),
  });

  const cols: Column<any>[] = [
    { key: 'CHECK_DATE', header: 'Date', sortable: true, render: r => <span className="mono text-tx-muted">{r.CHECK_DATE}</span> },
    { key: 'MACHINE_NAME', header: 'Machine Unit', render: r => <div><span className="font-medium text-tx block">{r.MACHINE_NAME}</span><span className="text-[10px] mono text-tx-muted">{r.MACHINE_ID}</span></div> },
    { key: 'CHECK_STAGE', header: 'Stage', render: r => <span className={`px-2 py-0.5 rounded-pill font-mono text-[10px] font-bold ${r.CHECK_STAGE === 'EARLY' ? 'bg-accent/15 text-accent' : r.CHECK_STAGE === 'MID' ? 'bg-warning/15 text-warning' : 'bg-danger/15 text-danger'}`}>{r.CHECK_STAGE}</span> },
    { key: 'DEFECT_TYPE', header: 'Defect Category', render: r => <span className="text-tx-secondary font-mono">{r.DEFECT_TYPE}</span> },
    { key: 'CHECKS_ON_DAY', header: 'Inspections', render: r => <span className="mono">{r.CHECKS_ON_DAY}</span> },
    { key: 'DAILY_AVG_DEFECT_RATE', header: 'Daily Defect Rate', sortable: true, render: r => <span className="mono font-bold text-tx">{(r.DAILY_AVG_DEFECT_RATE * 100).toFixed(2)}%</span> },
    { key: 'ROLLING_7D_DEFECT_RATE', header: '7d Rolling Avg', sortable: true, render: r => <span className="mono font-bold text-accent">{(r.ROLLING_7D_DEFECT_RATE * 100).toFixed(2)}%</span> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Production Quality Inspection Logs" subtitle="Historical line quality checks across EARLY, MID, and FINAL verification stages from Exasol V_QUALITY_TREND" />
      <div className="bg-card rounded-card border border-border p-5">
        <DataTable data={logs || []} columns={cols} loading={isLoading} searchPlaceholder="Search machine or defect..." searchKey="DEFECT_TYPE" />
      </div>
    </div>
  );
}
