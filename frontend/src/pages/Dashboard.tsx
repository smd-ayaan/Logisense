import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchKpis, fetchRecentEvents, fetchInventory, fetchMachines } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { KpiCard } from '@/components/ui/KpiCard';
import { ChartCard } from '@/components/ui/ChartCard';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { KpiSkeleton } from '@/components/ui/Skeleton';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Activity, Radio, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react';

const TREND_MOCK = [
  { day: 'Mon', vibrations: 2.3, temperature: 54 },
  { day: 'Tue', vibrations: 2.5, temperature: 55 },
  { day: 'Wed', vibrations: 2.8, temperature: 58 },
  { day: 'Thu', vibrations: 3.4, temperature: 64 },
  { day: 'Fri', vibrations: 4.8, temperature: 76 },
  { day: 'Sat', vibrations: 6.2, temperature: 84 },
  { day: 'Sun', vibrations: 3.1, temperature: 56 },
];

export function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ALL' | 'MACHINES' | 'INVENTORY'>('ALL');

  const { data: kpis, isLoading: kpiLoading, refetch: refetchKpis } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: fetchKpis,
    refetchInterval: 30000,
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['recent-events'],
    queryFn: () => fetchRecentEvents(6),
  });

  const { data: inventory } = useQuery({
    queryKey: ['inventory-balance'],
    queryFn: () => fetchInventory({ limit: '20' }),
  });

  const { data: machines } = useQuery({
    queryKey: ['machines-list'],
    queryFn: fetchMachines,
  });

  // Attention Table Columns
  const eventColumns: Column<any>[] = [
    {
      key: 'START_TS',
      header: 'Timestamp',
      sortable: true,
      render: (r) => <span className="mono text-tx-muted">{r.START_TS?.slice(0, 16)}</span>,
    },
    {
      key: 'MACHINE_NAME',
      header: 'Machine',
      render: (r) => <span className="font-medium text-tx">{r.MACHINE_NAME}</span>,
    },
    {
      key: 'FAULT_CODE',
      header: 'Fault Code',
      render: (r) => <StatusBadge status={r.FAULT_CODE} variant="danger" />,
    },
    {
      key: 'DURATION_H',
      header: 'Downtime',
      render: (r) => <span className="mono">{r.DURATION_H} hrs</span>,
    },
    {
      key: 'ROOT_CAUSE',
      header: 'Likely Root Cause',
      render: (r) => <span className="text-tx-secondary truncate max-w-xs block">{r.ROOT_CAUSE}</span>,
    },
  ];

  const donutData = [
    { name: 'Active', value: kpis?.machines_active ?? 8, color: '#C6F135' },
    { name: 'Attention', value: kpis?.open_alerts ?? 4, color: '#F5B83D' },
    { name: 'Down', value: kpis?.machines_down ?? 2, color: '#F0524F' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Top Greeting & Live Indicator */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-tx">
              Welcome back, {user?.full_name?.split(' ')[0] || 'Planner'}
            </h1>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-pill bg-[#14301F] border border-success/30 text-success text-[10px] font-mono">
              <Radio className="w-2.5 h-2.5 animate-pulse" />
              <span>LIVE</span>
            </div>
          </div>
          <p className="text-xs text-tx-secondary mt-0.5">
            Exasol cluster operational & streaming real-time sensor batches
          </p>
        </div>

        <button
          onClick={() => refetchKpis()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-border text-xs text-tx-secondary hover:text-tx hover:bg-[#2A2A2A] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync Exasol</span>
        </button>
      </div>

      {/* Row 1: 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiLoading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              title="ACTIVE MACHINES"
              value={`${kpis?.machines_active ?? 0}`}
              subValue="/ 8 units"
              trend={{ val: '100%', positive: true }}
              sparklineData={[{ val: 6 }, { val: 7 }, { val: 8 }, { val: 8 }]}
              glow
            />
            <KpiCard
              title="ACTIVE PRECURSOR ALERTS"
              value={`${kpis?.open_alerts ?? 0}`}
              subValue="elevated"
              trend={{ val: '2 new', positive: false }}
              sparklineData={[{ val: 1 }, { val: 2 }, { val: 4 }, { val: 6 }]}
            />
            <KpiCard
              title="LOW STOCK PARTS"
              value={`${kpis?.low_stock_items ?? 0}`}
              subValue="SKUs"
              trend={{ val: '5 transfers suggested', positive: true }}
              sparklineData={[{ val: 8 }, { val: 6 }, { val: 5 }, { val: 5 }]}
            />
            <KpiCard
              title="SUPPLIERS MONITORED"
              value={`${kpis?.supplier_count ?? 0}`}
              subValue="vendors"
              trend={{ val: '0.92 avg OTD', positive: true }}
              sparklineData={[{ val: 7 }, { val: 7 }, { val: 7 }, { val: 7 }]}
            />
          </>
        )}
      </div>

      {/* Row 2: 1 Wide Chart Card + 2 Medium Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Wide Area Chart: Precursor Trend */}
        <ChartCard
          title="Telemetry Anomaly Gradient"
          subtitle="Pre-failure 48h vibration & thermal build-up (Machine M-01)"
          className="lg:col-span-2"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TREND_MOCK} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="vibeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C6F135" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#C6F135" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F5B83D" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#F5B83D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#6B6B6B" fontSize={11} tickLine={false} />
                <YAxis stroke="#6B6B6B" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1C1C1C',
                    border: '1px solid #3A3A3A',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="vibrations"
                  name="Vibration (mm/s)"
                  stroke="#C6F135"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#vibeGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="temperature"
                  name="Temperature (°C)"
                  stroke="#F5B83D"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#tempGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Medium Donut Card: Fleet Status */}
        <ChartCard
          title="Fleet Health Distribution"
          subtitle="Real-time operational status"
        >
          <div className="h-64 w-full flex flex-col items-center justify-center relative">
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute top-[40%] text-center">
              <span className="text-xl font-bold text-tx mono">
                {kpis?.machines_active ?? 8}
              </span>
              <span className="block text-[10px] text-tx-muted uppercase">Active</span>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs mt-2">
              {donutData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-tx-secondary">{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Row 3: Bottom Full-Width Table Card */}
      <div className="bg-card rounded-card border border-border p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-tx">Requiring Immediate Attention</h3>
            <p className="text-xs text-tx-muted mt-0.5">
              Detected sensor precursor anomalies and unplanned downtime events
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-[#252525] p-1 rounded-control border border-border">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1 rounded-control text-xs font-medium transition-colors ${
                activeTab === 'ALL' ? 'bg-[#333] text-accent' : 'text-tx-secondary hover:text-tx'
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => setActiveTab('MACHINES')}
              className={`px-3 py-1 rounded-control text-xs font-medium transition-colors ${
                activeTab === 'MACHINES' ? 'bg-[#333] text-accent' : 'text-tx-secondary hover:text-tx'
              }`}
            >
              Machines
            </button>
            <button
              onClick={() => setActiveTab('INVENTORY')}
              className={`px-3 py-1 rounded-control text-xs font-medium transition-colors ${
                activeTab === 'INVENTORY' ? 'bg-[#333] text-accent' : 'text-tx-secondary hover:text-tx'
              }`}
            >
              Low Stock
            </button>
          </div>
        </div>

        <DataTable
          data={events || []}
          columns={eventColumns}
          loading={eventsLoading}
          searchPlaceholder="Search events or fault codes..."
          searchKey="ROOT_CAUSE"
        />
      </div>
    </div>
  );
}
