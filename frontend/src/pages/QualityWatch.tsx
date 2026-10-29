import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchQualityMetrics,
  fetchQualityAlerts,
  fetchStageComparison,
  fetchMachineHealthGrid,
} from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { ChartCard } from '@/components/ui/ChartCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Sparkles,
  Search,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

export function QualityWatch() {
  const [selectedMachine, setSelectedMachine] = useState('M-01');
  const [selectedDefect, setSelectedDefect] = useState('SCRATCH');

  // 1. Quality Metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['quality-metrics'],
    queryFn: fetchQualityMetrics,
  });

  // 2. Early-Warning Alerts
  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['quality-alerts'],
    queryFn: fetchQualityAlerts,
  });

  // 3. Stage Comparison Series (EARLY vs MID vs FINAL)
  const { data: stageSeries, isLoading: stageLoading } = useQuery({
    queryKey: ['quality-stage-comparison', selectedMachine, selectedDefect],
    queryFn: () => fetchStageComparison(selectedMachine, selectedDefect),
  });

  // 4. Machines for selector
  const { data: machines } = useQuery({
    queryKey: ['machine-health-grid'],
    queryFn: fetchMachineHealthGrid,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quality Watch — Early Defect Surveillance"
        subtitle="Exasol in-database window analytics identifying early-stage in-process defect spikes 3–5 days before final inspection rejection"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-accent bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-pill flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              <span>3–5 Days Lead Warning</span>
            </span>
          </div>
        }
      />

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-card" />)
        ) : (
          <>
            <KpiCard
              title="EARLY-WARNING ALERTS"
              value={metrics?.active_early_warnings ?? 0}
              subValue="critical units"
              trend={{ val: 'Catches defects early', positive: true }}
              glow
            />
            <KpiCard
              title="OVERALL DEFECT RATE"
              value={`${metrics?.overall_defect_pct ?? 0}%`}
              subValue="across stages"
              trend={{ val: '0.4% lower', positive: true }}
            />
            <KpiCard
              title="UNITS INSPECTED"
              value={(metrics?.total_sampled ?? 0).toLocaleString()}
              subValue="total parts"
              trend={{ val: '100% coverage', positive: true }}
            />
            <KpiCard
              title="LEAD-TIME SAVED"
              value="3.8 Days"
              subValue="avg early detection"
              trend={{ val: 'Before final QA', positive: true }}
            />
          </>
        )}
      </div>

      {/* Row 2: Lead-Time Wave Chart (EARLY -> MID -> FINAL) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 3-Stage Wave Chart */}
        <ChartCard
          title={`Multi-Stage Defect Progression — ${selectedMachine} (${selectedDefect})`}
          subtitle="Notice the EARLY defect wave (accent) peaking days prior to the FINAL end-of-line wave (red)"
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-2">
              <select
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
                className="bg-[#252525] border border-border rounded-control px-2.5 py-1 text-xs text-tx focus:outline-none focus:border-accent"
              >
                {machines?.map((m) => (
                  <option key={m.MACHINE_ID} value={m.MACHINE_ID}>
                    {m.MACHINE_ID} - {m.MACHINE_NAME}
                  </option>
                ))}
              </select>
              <select
                value={selectedDefect}
                onChange={(e) => setSelectedDefect(e.target.value)}
                className="bg-[#252525] border border-border rounded-control px-2.5 py-1 text-xs text-tx focus:outline-none focus:border-accent"
              >
                <option value="SCRATCH">SCRATCH</option>
                <option value="MISALIGN">MISALIGN</option>
                <option value="CRACK">CRACK</option>
              </select>
            </div>
          }
        >
          {stageLoading ? (
            <Skeleton className="h-72 w-full rounded-card" />
          ) : !stageSeries || stageSeries.length === 0 ? (
            <div className="h-72 flex items-center justify-center">
              <EmptyState
                title="No Quality Data"
                subtitle="No checks recorded for this parameter combination."
              />
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stageSeries} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="earlyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C6F135" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#C6F135" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="midGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F5B83D" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#F5B83D" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="finalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F0524F" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#F0524F" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="CHECK_DATE" stroke="#6B6B6B" fontSize={10} tickFormatter={(v) => v.slice(5)} />
                  <YAxis stroke="#6B6B6B" fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1C1C1C',
                      border: '1px solid #3A3A3A',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                    formatter={(v: any) => [`${v}%`, '']}
                  />
                  <Legend
                    verticalAlign="top"
                    height={30}
                    iconType="circle"
                    formatter={(value) => <span className="text-xs text-tx-secondary">{value}</span>}
                  />
                  <Area
                    type="monotone"
                    dataKey="EARLY_RATE"
                    name="1. EARLY Stage (Leading Indicator)"
                    stroke="#C6F135"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#earlyGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="MID_RATE"
                    name="2. MID Assembly"
                    stroke="#F5B83D"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#midGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="FINAL_RATE"
                    name="3. FINAL Inspection (Lagging)"
                    stroke="#F0524F"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#finalGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-between text-[11px] text-tx-muted mt-2 font-mono">
                <span className="text-accent font-semibold">← EARLY Stage Surge Detected</span>
                <span className="text-danger font-semibold">FINAL Stage Rejection Follows 3–5 Days Later →</span>
              </div>
            </div>
          )}
        </ChartCard>

        {/* Right Col: Planted Pattern Explanation Card */}
        <div className="bg-card rounded-card border border-border p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="label-xs">Exasol Intelligence</span>
              <span className="px-2 py-0.5 rounded-pill bg-accent/15 text-accent text-[10px] font-mono">
                Planted Pattern #3
              </span>
            </div>

            <h3 className="text-base font-bold text-tx">The Multi-Stage Defect Wave</h3>
            <p className="text-xs text-tx-secondary mt-2 leading-relaxed">
              In manufacturing, defects introduced at machine in-process staging (such as tooling micro-scratches)
              propagate down the assembly line.
            </p>

            <div className="space-y-3 my-5">
              <div className="p-3 rounded-control bg-[#222] border border-border flex items-start gap-2.5">
                <div className="p-1 rounded-full bg-accent/20 text-accent shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-tx block">Early Stage Warning</span>
                  <p className="text-[11px] text-tx-muted mt-0.5">
                    `V_EARLY_WARNING_ALERTS` runs window functions calculating 7d rolling average vs. 30d baseline.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-control bg-[#222] border border-border flex items-start gap-2.5">
                <div className="p-1 rounded-full bg-danger/20 text-danger shrink-0 mt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-tx block">Avoids Final Line Stoppage</span>
                  <p className="text-[11px] text-tx-muted mt-0.5">
                    Operations can adjust calibration before finished assemblies fail final inspection.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-control bg-accent/10 border border-accent/20 text-center">
            <span className="text-xs font-bold text-accent font-mono">
              Estimated ₹3,20,000 Scrap Material Saved
            </span>
          </div>
        </div>
      </div>

      {/* Row 3: Active Early Warning Alerts Table */}
      <div className="bg-card rounded-card border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-tx">
              Active Early-Warning Anomaly Register (Exasol V_EARLY_WARNING_ALERTS)
            </h3>
            <p className="text-xs text-tx-muted mt-0.5">
              Production lines where EARLY defect rate has breached the +50% threshold over baseline
            </p>
          </div>
          <span className="label-xs">{alerts?.length || 0} Critical Triggers</span>
        </div>

        {alertsLoading ? (
          <Skeleton className="h-44 w-full rounded-card" />
        ) : !alerts || alerts.length === 0 ? (
          <EmptyState
            title="All Quality Metrics In Control"
            subtitle="No machines currently exceed early-warning defect thresholds."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {alerts.map((a, i) => (
              <div
                key={`${a.MACHINE_ID}-${a.DEFECT_TYPE}-${a.CHECK_DATE}-${i}`}
                className="bg-[#222] border border-border hover:border-danger/40 rounded-card p-4 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono text-tx-muted">{a.CHECK_DATE}</span>
                    <StatusBadge
                      status={a.ALERT_LEVEL}
                      variant={a.ALERT_LEVEL === 'ALERT' ? 'danger' : 'warning'}
                    />
                  </div>

                  <h4 className="text-xs font-bold text-tx leading-snug">{a.MACHINE_NAME}</h4>
                  <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-tx-secondary">
                    <span>{a.MACHINE_ID}</span>
                    <span>•</span>
                    <span>Defect: <strong className="text-accent">{a.DEFECT_TYPE}</strong></span>
                  </div>

                  <div className="my-3 p-2.5 rounded-control bg-[#1A1A1A] border border-border/70 flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="text-[9px] text-tx-muted uppercase block">Current 7d Rate</span>
                      <span className="text-danger font-bold">{(a.CURRENT_RATE * 100).toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-tx-muted uppercase block">30d Baseline</span>
                      <span className="text-tx-secondary">{(a.BASELINE_30D_RATE * 100).toFixed(2)}%</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-tx-muted uppercase block">Variance</span>
                      <span className="text-danger font-bold">+{a.PCT_ABOVE_BASELINE}%</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-tx-muted font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-warning" />
                    <span>~4 days before Final failure</span>
                  </span>

                  <button
                    onClick={() => {
                      setSelectedMachine(a.MACHINE_ID);
                      setSelectedDefect(a.DEFECT_TYPE);
                    }}
                    className="text-xs text-accent hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>Inspect</span>
                    <TrendingUp className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
