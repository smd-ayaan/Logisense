import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMachines, fetchMachineHealthGrid } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Link } from 'react-router-dom';
import { Cpu, ArrowRight, ShieldCheck, Activity } from 'lucide-react';

export function AssetsView() {
  const { data: healthGrid, isLoading } = useQuery({
    queryKey: ['machine-health-grid'],
    queryFn: fetchMachineHealthGrid,
  });

  const columns: Column<any>[] = [
    {
      key: 'MACHINE_ID',
      header: 'Asset ID',
      sortable: true,
      render: (r) => <span className="font-mono text-accent font-semibold">{r.MACHINE_ID}</span>,
    },
    {
      key: 'MACHINE_NAME',
      header: 'Machine Name',
      sortable: true,
      render: (r) => <span className="font-semibold text-tx">{r.MACHINE_NAME}</span>,
    },
    {
      key: 'MACHINE_TYPE',
      header: 'Type',
      sortable: true,
      render: (r) => <span className="font-mono text-tx-secondary">{r.MACHINE_TYPE}</span>,
    },
    {
      key: 'LOCATION',
      header: 'Location',
      render: (r) => <span className="text-tx-secondary">{r.LOCATION}</span>,
    },
    {
      key: 'INSTALL_DATE',
      header: 'Installed',
      render: (r) => <span className="mono text-tx-muted">{r.INSTALL_DATE}</span>,
    },
    {
      key: 'ANOMALY_STATUS',
      header: 'Telemetry Health',
      render: (r) => (
        <StatusBadge
          status={r.ANOMALY_STATUS}
          variant={
            r.ANOMALY_STATUS === 'CRITICAL'
              ? 'danger'
              : r.ANOMALY_STATUS === 'WARNING'
              ? 'warning'
              : 'success'
          }
        />
      ),
    },
    {
      key: 'ACTIONS',
      header: 'Actions',
      render: (r) => (
        <Link
          to="/downtime"
          className="text-xs text-accent hover:underline flex items-center gap-1 font-semibold"
        >
          <span>Telemetry</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Production Machinery & Equipment Registry"
        subtitle="Critical manufacturing assets equipped with high-frequency telemetry sensor streaming into Exasol"
      />

      <div className="bg-card rounded-card border border-border p-5">
        <DataTable
          data={healthGrid || []}
          columns={columns}
          loading={isLoading}
          searchPlaceholder="Search machines by name or bay..."
          searchKey="MACHINE_NAME"
        />
      </div>
    </div>
  );
}
