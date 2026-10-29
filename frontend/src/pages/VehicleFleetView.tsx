import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Truck, Fuel, Gauge } from 'lucide-react';

const VEHICLES = [
  { id: 'VH-101', reg: 'MH-12-RN-8801', model: 'Tata Prima 4028', type: 'Heavy Haul (28T)', driver: 'Sanjay Rawat', status: 'ACTIVE', fuel: '78%', odo: '1,42,800 km', location: 'NH48 - Pune Corridor' },
  { id: 'VH-102', reg: 'KA-04-MB-4512', model: 'Ashok Leyland Ecomet', type: 'Mid Cargo (16T)', driver: 'Ramesh Gowda', status: 'ACTIVE', fuel: '45%', odo: '98,400 km', location: 'Hosur Road Depot' },
  { id: 'VH-103', reg: 'TN-09-BK-9023', model: 'BharatBenz 2823', type: 'Heavy Haul (28T)', driver: 'K. Balaji', status: 'MAINTENANCE', fuel: '20%', odo: '1,86,100 km', location: 'Chennai Workshop' },
  { id: 'VH-104', reg: 'DL-01-AC-3190', model: 'Eicher Pro 3019', type: 'Mid Cargo (19T)', driver: 'Jaswinder Singh', status: 'ACTIVE', fuel: '88%', odo: '64,200 km', location: 'Kundli Bypass' },
  { id: 'VH-105', reg: 'GJ-01-XX-7721', model: 'Tata Signa 4825', type: 'Heavy Haul (48T)', driver: 'Hitesh Patel', status: 'ACTIVE', fuel: '62%', odo: '1,12,300 km', location: 'Sanand Industrial DC' },
];

export function VehicleFleetView() {
  const cols: Column<any>[] = [
    { key: 'id', header: 'Vehicle ID', sortable: true, render: r => <span className="mono text-accent font-semibold">{r.id}</span> },
    { key: 'reg', header: 'Registration', render: r => <span className="mono font-bold text-tx">{r.reg}</span> },
    { key: 'model', header: 'Vehicle Model', render: r => <div><span className="text-tx font-medium block">{r.model}</span><span className="text-[10px] text-tx-muted">{r.type}</span></div> },
    { key: 'driver', header: 'Assigned Driver', render: r => <span className="text-tx-secondary">{r.driver}</span> },
    { key: 'location', header: 'Current Route', render: r => <span className="text-tx-secondary">{r.location}</span> },
    { key: 'fuel', header: 'Fuel Level', render: r => <span className="mono text-tx flex items-center gap-1"><Fuel className="w-3 h-3 text-warning" />{r.fuel}</span> },
    { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Logistics Fleet & Vehicles" subtitle="Fleet telemetry, payload tracking, and regional highway corridors" />
      <div className="bg-card rounded-card border border-border p-5">
        <DataTable data={VEHICLES} columns={cols} searchPlaceholder="Search fleet or registration..." searchKey="reg" />
      </div>
    </div>
  );
}
