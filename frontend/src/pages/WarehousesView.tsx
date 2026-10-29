import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWarehouses } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Warehouse, MapPin, Box, Layers } from 'lucide-react';

export function WarehousesView() {
  const { data: warehouses, isLoading } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: fetchWarehouses,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Distribution Centers & Logistics Hubs"
        subtitle="Network facility capacities, geographic distribution, and connected operational storage"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-card" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses?.map((w: any) => (
            <div
              key={w.WAREHOUSE_ID}
              className="bg-card rounded-card border border-border p-5 flex flex-col justify-between hover:border-tx-muted transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-pill">
                    {w.WAREHOUSE_ID}
                  </span>
                  <StatusBadge status="ACTIVE" variant="success" />
                </div>

                <h3 className="text-sm font-bold text-tx leading-snug">{w.WAREHOUSE_NAME}</h3>

                <div className="flex items-center gap-1.5 text-xs text-tx-secondary mt-1 font-mono">
                  <MapPin className="w-3.5 h-3.5 text-tx-muted shrink-0" />
                  <span>{w.LOCATION}</span>
                </div>
              </div>

              <div className="pt-3 mt-4 border-t border-border/50 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-tx-muted uppercase block">Rated Capacity</span>
                  <span className="font-semibold text-tx mono">
                    {w.CAPACITY?.toLocaleString()} units
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-tx-muted uppercase block">Status</span>
                  <span className="text-success font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                    Online
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
