import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Layers, ShieldCheck, AlertCircle } from 'lucide-react';

const BATCHES = [
  { batch: 'BAT-2026-104', part: 'Hydraulic Valve Spool 24V', supplier: 'Bharat Industrial Fasteners', machine: 'M-01 (Press 500T)', size: 1200, defect_early: '9.8%', defect_final: '14.2%', yield: '85.8%', status: 'FLAGGED' },
  { batch: 'BAT-2026-103', part: 'Roller Bearing Sleeve 6205', supplier: 'Apex Precision Bearings', machine: 'M-03 (CNC Lathe A)', size: 2500, defect_early: '8.4%', defect_final: '11.5%', yield: '88.5%', status: 'FLAGGED' },
  { batch: 'BAT-2026-102', part: 'Precision Viton O-Ring 50mm', supplier: 'Precision Seals & Gaskets', machine: 'M-04 (Milling Center)', size: 5000, defect_early: '1.2%', defect_final: '1.6%', yield: '98.4%', status: 'COMPLETED' },
  { batch: 'BAT-2026-101', part: 'Hydraulic Gear Pump 20cc', supplier: 'Kalyani Hydraulics', machine: 'M-02 (Transfer Press)', size: 850, defect_early: '0.8%', defect_final: '1.1%', yield: '98.9%', status: 'COMPLETED' },
  { batch: 'BAT-2026-100', part: 'V-Belt Drive V1050', supplier: 'Vanguard Belts & Drive', machine: 'M-06 (Conveyor Line)', size: 3200, defect_early: '2.1%', defect_final: '2.4%', yield: '97.6%', status: 'COMPLETED' },
];

export function BatchTracingView() {
  const cols: Column<any>[] = [
    { key: 'batch', header: 'Batch ID', sortable: true, render: r => <span className="mono text-accent font-semibold">{r.batch}</span> },
    { key: 'part', header: 'Component Name', render: r => <span className="font-medium text-tx">{r.part}</span> },
    { key: 'supplier', header: 'Supplier Origin', render: r => <span className="text-tx-secondary">{r.supplier}</span> },
    { key: 'machine', header: 'Line / Unit', render: r => <span className="mono text-tx-secondary">{r.machine}</span> },
    { key: 'size', header: 'Lot Size', render: r => <span className="mono">{r.size.toLocaleString()}</span> },
    { key: 'defect_early', header: 'EARLY Defect', render: r => <span className={`mono font-bold ${parseFloat(r.defect_early) > 5 ? 'text-danger' : 'text-tx-secondary'}`}>{r.defect_early}</span> },
    { key: 'yield', header: 'Final Yield', render: r => <span className="mono font-semibold text-tx">{r.yield}</span> },
    { key: 'status', header: 'Surveillance Status', render: r => <StatusBadge status={r.status} variant={r.status === 'FLAGGED' ? 'danger' : 'success'} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Production Batch Quality Tracing" subtitle="End-to-end genealogy connecting component suppliers, machinery, in-process defect waves, and final lot yields" />
      <div className="bg-card rounded-card border border-border p-5">
        <DataTable data={BATCHES} columns={cols} searchPlaceholder="Search batch or component..." searchKey="batch" />
      </div>
    </div>
  );
}
