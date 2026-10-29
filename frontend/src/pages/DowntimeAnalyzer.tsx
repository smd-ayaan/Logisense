import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchMachineHealthGrid,
  fetchPreFailureTelemetry,
  fetchRootCauses,
  MachineHealth,
} from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { ChartCard } from '@/components/ui/ChartCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  AlertTriangle,
  Activity,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';

export function DowntimeAnalyzer() {
  const [selectedMachineId, setSelectedMachineId] = useState<string>('M-01');

  // 1. Fetch Fleet Health Grid
  const { data: healthGrid, isLoading: healthLoading } = useQuery({
    queryKey: ['machine-health-grid'],
    queryFn: fetchMachineHealthGrid,
    refetchInterval: 30000,
  });

  // 2. Fetch Precursor Telemetry
  const { data: telemetry, isLoading: telemetryLoading } = useQuery({
    queryKey: ['precursor-telemetry', selectedMachineId],
    queryFn: () => fetchPreFailureTelemetry(selectedMachineId),
    enabled: !!selectedMachineId,
  });

  // 3. Fetch Root Cause Analysis
  const { data: rootCauses, isLoading: rootLoading } = useQuery({
    queryKey: ['root-causes'],
    queryFn: () => fetchRootCauses(),
  });

  const selectedMachine = useMemo(() => {
    return healthGrid?.find((m) => m.MACHINE_ID === selectedMachineId) || healthGrid?.[0];
  }, [healthGrid, selectedMachineId]);

  // Transform 48h readings into pivot chart format: { hours_before, vibration, temperature, ... }
  const chartData = useMemo(() => {
    if (!telemetry || telemetry.length === 0) return [];

    const grouped: Record<number, any> = {};
    telemetry.forEach((r) => {
      const bucket = Math.round(r.APPROX_HOURS_BEFORE * 2) / 2; // 30-min resolution
      if (!grouped[bucket]) {
        grouped[bucket] = { hours_before: -bucket };
      }
      if (r.SENSOR_TYPE === 'VIBRATION') {
        grouped[bucket].vibration = r.READING_VALUE;
        grouped[bucket].vibe_crit = r.THRESHOLD_CRIT;
        grouped[bucket].vibe_warn = r.THRESHOLD_WARN;
      } else if (r.SENSOR_TYPE === 'TEMPERATURE') {
        grouped[bucket].temperature = r.READING_VALUE;
        grouped[bucket].temp_crit = r.THRESHOLD_CRIT;
        grouped[bucket].temp_warn = r.THRESHOLD_WARN;
      }
    });

    return Object.values(grouped).sort((a, b) => a.hours_before - b.hours_before);
  }, [telemetry]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Downtime Root Cause & Precursor Engine"
        subtitle="Exasol in-database window analytics detecting equipment failure precursors 6–48h before breakdown"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-accent bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-pill flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              <span>In-Database Pattern Recognition</span>
            </span>
          </div>
        }
      />

      {/* Row 1: Fleet Machine Health Cards */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="label-xs">Production Fleet Status</span>
          <span className="text-xs text-tx-muted">Click a machine to inspect telemetry precursors</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {healthLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-card" />
            ))
          ) : (
            healthGrid?.map((m) => {
              const isSelected = m.MACHINE_ID === (selectedMachine?.MACHINE_ID || selectedMachineId);
              return (
                <div
                  key={m.MACHINE_ID}
                  onClick={() => setSelectedMachineId(m.MACHINE_ID)}
                  className={`bg-card rounded-card border p-3 flex flex-col justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'border-accent glow-accent bg-[#222]'
                      : 'border-border hover:border-tx-muted hover:bg-[#202020]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-tx mono">{m.MACHINE_ID}</span>
                    <StatusBadge
                      status={m.ANOMALY_STATUS}
                      variant={
                        m.ANOMALY_STATUS === 'CRITICAL'
                          ? 'danger'
                          : m.ANOMALY_STATUS === 'WARNING'
                          ? 'warning'
                          : 'success'
                      }
                    />
                  </div>

                  <div className="my-2">
                    <p className="text-xs font-semibold text-tx truncate leading-snug">
                      {m.MACHINE_NAME}
                    </p>
                    <span className="text-[10px] text-tx-muted block mt-0.5">{m.MACHINE_TYPE}</span>
                  </div>

                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-tx-secondary">{m.RECENT_EVENT_COUNT} faults</span>
                    {m.CRITICAL_SENSORS > 0 ? (
                      <span className="text-danger font-bold flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {m.CRITICAL_SENSORS} crit
                      </span>
                    ) : (
                      <span className="text-success flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        nom
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Row 2: Telemetry Precursor Chart + Selected Machine Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 48h Telemetry Area Chart */}
        <ChartCard
          title={`Precursor Telemetry Stream — ${selectedMachine?.MACHINE_NAME || 'Machine M-01'}`}
          subtitle="48-hour sensor build-up prior to failure event (V_SENSOR_PRE_FAILURE)"
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                <span className="text-tx-secondary text-[11px]">Vibration (mm/s)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-warning" />
                <span className="text-tx-secondary text-[11px]">Temperature (°C)</span>
              </div>
            </div>
          }
        >
          {telemetryLoading ? (
            <Skeleton className="h-72 w-full rounded-card" />
          ) : chartData.length === 0 ? (
            <div className="h-72 flex items-center justify-center">
              <EmptyState
                title="Nominal Telemetry"
                subtitle="No pre-failure anomaly window recorded for this unit. Machine operating within safe tolerances."
              />
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="hours_before"
                    stroke="#6B6B6B"
                    fontSize={11}
                    tickFormatter={(v) => `${v}h`}
                  />
                  <YAxis stroke="#6B6B6B" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1C1C1C',
                      border: '1px solid #3A3A3A',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                    labelFormatter={(label) => `${label} hours relative to breakdown`}
                  />
                  <ReferenceLine
                    y={7.2}
                    stroke="#F0524F"
                    strokeDasharray="3 3"
                    label={{ value: 'CRIT (7.2 mm/s)', fill: '#F0524F', fontSize: 10, position: 'right' }}
                  />
                  <ReferenceLine
                    y={4.5}
                    stroke="#F5B83D"
                    strokeDasharray="3 3"
                    label={{ value: 'WARN (4.5 mm/s)', fill: '#F5B83D', fontSize: 10, position: 'right' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="vibration"
                    name="Vibration"
                    stroke="#C6F135"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="temperature"
                    name="Temperature"
                    stroke="#F5B83D"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-between text-[11px] text-tx-muted mt-2 font-mono">
                <span>← 48 Hours Before Failure</span>
                <span className="text-danger font-bold">Failure Event (0h) →</span>
              </div>
            </div>
          )}
        </ChartCard>

        {/* Right Col: Machine Diagnostics & Work Order Card */}
        <div className="bg-card rounded-card border border-border p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="label-xs">Diagnostic Evidence</span>
              <StatusBadge status={selectedMachine?.STATUS || 'ACTIVE'} />
            </div>

            <h3 className="text-base font-bold text-tx">{selectedMachine?.MACHINE_NAME}</h3>
            <p className="text-xs text-tx-muted mt-0.5 font-mono">{selectedMachine?.LOCATION}</p>

            <div className="grid grid-cols-2 gap-3 my-5">
              <div className="p-3 rounded-control bg-[#252525] border border-border">
                <span className="text-[10px] text-tx-muted uppercase block">Installed</span>
                <span className="text-xs font-semibold text-tx mono mt-0.5 block">
                  {selectedMachine?.INSTALL_DATE}
                </span>
              </div>
              <div className="p-3 rounded-control bg-[#252525] border border-border">
                <span className="text-[10px] text-tx-muted uppercase block">Historical Faults</span>
                <span className="text-xs font-semibold text-tx mono mt-0.5 block">
                  {selectedMachine?.RECENT_EVENT_COUNT} events
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <span className="label-xs block">Identified Signature</span>
              <div className="p-3 rounded-control bg-accent/10 border border-accent/20 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-accent mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Sustained Precursor Drift</span>
                </div>
                <p className="text-tx-secondary text-[11px] leading-relaxed">
                  Vibration exponential growth detected starting 36 hours prior to mechanical seizure.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => alert(`Preventive Work Order scheduled for ${selectedMachine?.MACHINE_NAME}`)}
            className="w-full mt-6 bg-accent text-accent-fg font-semibold py-2 px-4 rounded-control text-xs flex items-center justify-center gap-2 hover:bg-accent/90 transition-all shadow-sm"
          >
            <Clock className="w-4 h-4" />
            <span>Generate Work Order</span>
          </button>
        </div>
      </div>

      {/* Row 3: Ranked Root Cause Analysis Panel */}
      <div className="bg-card rounded-card border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-tx">
              Ranked Root Causes & Sequence Progression (Exasol V_FAULT_ROOT_CAUSES)
            </h3>
            <p className="text-xs text-tx-muted mt-0.5">
              Aggregated fault patterns across fleet ranked by financial and downtime impact
            </p>
          </div>
          <span className="label-xs">Exasol Window Ranks</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {rootLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-card" />
            ))
          ) : (
            rootCauses?.map((rc) => (
              <div
                key={`${rc.MACHINE_TYPE}-${rc.FAULT_CODE}`}
                className="p-4 rounded-card bg-[#222] border border-border flex flex-col justify-between hover:border-tx-muted transition-colors relative overflow-hidden"
              >
                <div className="absolute top-2 right-2 text-2xl font-bold font-mono text-border/60">
                  #{rc.COST_RANK}
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <StatusBadge status={rc.FAULT_CODE} variant="danger" />
                    <span className="text-[11px] font-mono text-tx-secondary">
                      {rc.MACHINE_TYPE}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-tx leading-snug line-clamp-2">
                    {rc.ROOT_CAUSE}
                  </h4>

                  <div className="mt-3 p-2 rounded-control bg-[#1A1A1A] border border-border/60 text-[10px] font-mono text-accent">
                    {rc.SEQUENCE_PATTERN}
                  </div>
                </div>

                <div className="pt-3 mt-4 border-t border-border/50 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-tx-muted uppercase block">Impact</span>
                    <span className="font-semibold text-tx mono">
                      ₹{(rc.TOTAL_COST ? Math.round(rc.TOTAL_COST * 83) : 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-tx-muted uppercase block">Confidence</span>
                    <span className="font-semibold text-accent mono">
                      {rc.CONFIDENCE_PCT}%
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
