import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSparePartsMetrics,
  fetchSparePartsHeatmap,
  fetchSparePartsRecommendations,
  approveStockTransfer,
  TransferRec,
} from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  ArrowRightLeft,
  DollarSign,
  TrendingDown,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter,
} from 'lucide-react';

export function SparePartsOptimizer() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // 1. Fetch Metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['spareparts-metrics'],
    queryFn: fetchSparePartsMetrics,
  });

  // 2. Fetch Heatmap Items
  const { data: heatmapData, isLoading: heatmapLoading } = useQuery({
    queryKey: ['spareparts-heatmap'],
    queryFn: fetchSparePartsHeatmap,
  });

  // 3. Fetch Recommendations
  const { data: recs, isLoading: recsLoading } = useQuery({
    queryKey: ['spareparts-recommendations'],
    queryFn: fetchSparePartsRecommendations,
  });

  // Transfer Mutation
  const transferMutation = useMutation({
    mutationFn: approveStockTransfer,
    onSuccess: (data) => {
      addToast(data.message, 'success');
      queryClient.invalidateQueries({ queryKey: ['spareparts-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['spareparts-heatmap'] });
      queryClient.invalidateQueries({ queryKey: ['spareparts-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.detail || 'Transfer execution failed', 'error');
    },
  });

  // Pivot heatmap: unique parts x unique warehouses
  const { warehouses, partsMatrix } = useMemo(() => {
    if (!heatmapData) return { warehouses: [], partsMatrix: [] };

    const whMap: Record<string, string> = {};
    const partsMap: Record<string, any> = {};

    heatmapData.forEach((item) => {
      whMap[item.WAREHOUSE_ID] = item.WAREHOUSE_NAME.replace(/ Distribution Center| Logistics Hub| Electronics & Spares Depot| NCR Northern Gateway| Industrial Storage/, '');

      if (!partsMap[item.PART_ID]) {
        partsMap[item.PART_ID] = {
          part_id: item.PART_ID,
          part_name: item.PART_NAME,
          category: item.CATEGORY,
          reorder_point: item.REORDER_POINT,
          unit_cost: item.UNIT_COST,
          warehouses: {},
        };
      }

      partsMap[item.PART_ID].warehouses[item.WAREHOUSE_ID] = {
        qty: item.QTY_ON_HAND,
        surplus: item.SURPLUS,
        status: item.STOCK_STATUS,
      };
    });

    const whList = Object.entries(whMap).map(([id, name]) => ({ id, name }));
    const filteredParts = Object.values(partsMap).filter(
      (p) => categoryFilter === 'ALL' || p.category === categoryFilter
    );

    return { warehouses: whList, partsMatrix: filteredParts };
  }, [heatmapData, categoryFilter]);

  const categories = useMemo(() => {
    if (!heatmapData) return [];
    return Array.from(new Set(heatmapData.map((d) => d.CATEGORY)));
  }, [heatmapData]);

  const handleApprove = (rec: TransferRec) => {
    transferMutation.mutate({
      part_id: rec.PART_ID,
      from_warehouse_id: rec.FROM_WAREHOUSE_ID || 'WH-MUM',
      to_warehouse_id: rec.TO_WAREHOUSE_ID || 'WH-BLR',
      qty: rec.SUGGESTED_QTY,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Spare Parts Inventory Optimizer"
        subtitle="Automated cross-facility balancing to eliminate stock-outs and liquidate excess capital using Exasol V_TRANSFER_RECOMMENDATIONS"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-accent bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-pill flex items-center gap-1.5">
              <ArrowRightLeft className="w-3 h-3" />
              <span>Zero-Procurement Rebalancing</span>
            </span>
          </div>
        }
      />

      {/* Row 1: KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-card" />)
        ) : (
          <>
            <KpiCard
              title="SUGGESTED TRANSFERS"
              value={metrics?.transfer_recommendation_count ?? 0}
              subValue="actionable"
              trend={{ val: 'Zero delay', positive: true }}
              glow
            />
            <KpiCard
              title="REBALANCE VALUE"
              value={`₹${(metrics?.rebalance_savings_usd ? metrics.rebalance_savings_usd * 83 : 0).toLocaleString()}`}
              subValue="capital saved"
              trend={{ val: 'Avoids POs', positive: true }}
            />
            <KpiCard
              title="EXCESS STOCK LOCATIONS"
              value={metrics?.excess_count ?? 0}
              subValue=">3x ROP"
              trend={{ val: 'Overstocked', positive: false }}
            />
            <KpiCard
              title="CRITICAL DEFICITS"
              value={(metrics?.stockout_count ?? 0) + (metrics?.low_stock_count ?? 0)}
              subValue="at risk"
              trend={{ val: 'Immediate rebalance', positive: false }}
            />
          </>
        )}
      </div>

      {/* Row 2: Actionable Transfer Recommendations Panel */}
      <div className="bg-card rounded-card border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-tx">
              High-Priority Stock Transfer Directives (Exasol V_TRANSFER_RECOMMENDATIONS)
            </h3>
            <p className="text-xs text-tx-muted mt-0.5">
              Ranked transfers matching deepest warehouse deficits with largest excess stock
            </p>
          </div>
          <span className="label-xs">{recs?.length || 0} Directives Available</span>
        </div>

        {recsLoading ? (
          <Skeleton className="h-36 w-full rounded-card" />
        ) : !recs || recs.length === 0 ? (
          <EmptyState
            title="All Warehouses Balanced"
            subtitle="No critical inventory deficits detected across the network."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recs.map((rec) => (
              <div
                key={`${rec.PART_ID}-${rec.FROM_WAREHOUSE}-${rec.TO_WAREHOUSE}`}
                className="bg-[#222] border border-border hover:border-accent/40 rounded-card p-4 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-tx-muted">{rec.CATEGORY}</span>
                    <span className="text-xs font-bold text-accent mono">
                      ₹{(rec.TRANSFER_VALUE_USD ? rec.TRANSFER_VALUE_USD * 83 : 0).toLocaleString()}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-tx leading-snug">{rec.PART_NAME}</h4>
                  <span className="text-[10px] text-tx-muted font-mono block mt-0.5">
                    SKU: {rec.PART_ID}
                  </span>

                  {/* Flow Route */}
                  <div className="my-3 p-2.5 rounded-control bg-[#1A1A1A] border border-border/70 flex items-center justify-between text-xs font-mono">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-tx-muted uppercase">From (Excess)</span>
                      <span className="text-tx font-semibold truncate max-w-[90px]">
                        {rec.FROM_WAREHOUSE}
                      </span>
                      <span className="text-[10px] text-info">qty {rec.FROM_QTY}</span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-accent mx-2 shrink-0" />

                    <div className="flex flex-col text-right">
                      <span className="text-[9px] text-tx-muted uppercase">To (Deficit)</span>
                      <span className="text-tx font-semibold truncate max-w-[90px]">
                        {rec.TO_WAREHOUSE}
                      </span>
                      <span className="text-[10px] text-danger">qty {rec.TO_QTY}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-tx">
                    Transfer: <span className="text-accent mono font-bold">{rec.SUGGESTED_QTY} units</span>
                  </span>

                  <button
                    onClick={() => handleApprove(rec)}
                    disabled={transferMutation.isPending}
                    className="bg-accent text-accent-fg font-semibold py-1.5 px-3 rounded-control text-xs flex items-center gap-1.5 hover:bg-accent/90 transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Row 3: Multi-Facility Stock Heatmap Matrix */}
      <div className="bg-card rounded-card border border-border p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-tx">
              Network Inventory Balance Matrix
            </h3>
            <p className="text-xs text-tx-muted mt-0.5">
              Live SKU distribution vs. safety reorder thresholds across facilities
            </p>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs text-tx-muted flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3" />
              <span>Category:</span>
            </span>
            <button
              onClick={() => setCategoryFilter('ALL')}
              className={`px-2.5 py-1 rounded-control text-xs font-medium transition-colors ${
                categoryFilter === 'ALL'
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'bg-[#252525] text-tx-secondary hover:text-tx'
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-2.5 py-1 rounded-control text-xs font-medium transition-colors ${
                  categoryFilter === c
                    ? 'bg-accent/15 text-accent border border-accent/30'
                    : 'bg-[#252525] text-tx-secondary hover:text-tx'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {heatmapLoading ? (
          <Skeleton className="h-64 w-full rounded-card" />
        ) : (
          <div className="overflow-x-auto border border-border rounded-card">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-[#222]">
                  <th className="p-3 label-xs min-w-[220px]">Part SKU & Description</th>
                  <th className="p-3 label-xs text-center">Reorder Pt</th>
                  {warehouses.map((w) => (
                    <th key={w.id} className="p-3 label-xs text-center min-w-[120px]">
                      {w.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partsMatrix.map((p) => (
                  <tr key={p.part_id} className="border-b border-border/50 hover:bg-[#252525] transition-colors">
                    <td className="p-3">
                      <div className="font-semibold text-tx leading-snug">{p.part_name}</div>
                      <div className="text-[10px] text-tx-muted font-mono flex items-center gap-2 mt-0.5">
                        <span>{p.part_id}</span>
                        <span>•</span>
                        <span>₹{Math.round(p.unit_cost * 83)}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center mono font-medium text-tx-secondary">
                      {p.reorder_point}
                    </td>

                    {warehouses.map((w) => {
                      const stock = p.warehouses[w.id];
                      if (!stock) {
                        return (
                          <td key={w.id} className="p-3 text-center text-tx-muted mono">
                            -
                          </td>
                        );
                      }

                      return (
                        <td key={w.id} className="p-3 text-center">
                          <div
                            className={`inline-flex flex-col items-center justify-center px-2 py-1 rounded-control min-w-[55px] font-mono font-semibold text-xs ${
                              stock.status === 'EXCESS'
                                ? 'bg-info/15 text-info border border-info/30'
                                : stock.status === 'LOW'
                                ? 'bg-warning/15 text-warning border border-warning/30'
                                : stock.status === 'STOCKOUT'
                                ? 'bg-danger/20 text-danger border border-danger/40 animate-pulse'
                                : 'bg-[#2A2A2A] text-tx-secondary'
                            }`}
                          >
                            <span>{stock.qty}</span>
                            <span className="text-[9px] font-normal opacity-80 uppercase">
                              {stock.status}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
