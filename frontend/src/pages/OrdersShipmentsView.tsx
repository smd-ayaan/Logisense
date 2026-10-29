import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Truck, MapPin } from 'lucide-react';

const ORDERS = [
  { id: 'SHP-9021', order: 'ORD-1044', dest: 'Bengaluru Hub', carrier: 'BlueDart Air', eta: 'Today, 18:30', status: 'IN_TRANSIT', items: 25, val: 145000 },
  { id: 'SHP-9022', order: 'ORD-1045', dest: 'Chennai DC', carrier: 'TCI Freight', eta: 'Tomorrow, 10:00', status: 'IN_TRANSIT', items: 40, val: 210000 },
  { id: 'SHP-9020', order: 'ORD-1042', dest: 'Pune Hub', carrier: 'SafeXpress', eta: 'Delivered', status: 'COMPLETED', items: 12, val: 84000 },
  { id: 'SHP-9019', order: 'ORD-1040', dest: 'Delhi North', carrier: 'Delhivery', eta: 'Delayed (+4h)', status: 'WARNING', items: 60, val: 320000 },
  { id: 'SHP-9018', order: 'ORD-1038', dest: 'Ahmedabad DC', carrier: 'GATI', eta: 'Delivered', status: 'COMPLETED', items: 18, val: 95000 },
];

export function OrdersShipmentsView() {
  const cols: Column<any>[] = [
    { key: 'id', header: 'Shipment ID', sortable: true, render: r => <span className="mono text-accent font-semibold">{r.id}</span> },
    { key: 'order', header: 'Order Ref', render: r => <span className="mono text-tx-secondary">{r.order}</span> },
    { key: 'dest', header: 'Destination', render: r => <span className="text-tx font-medium flex items-center gap-1"><MapPin className="w-3 h-3 text-tx-muted" />{r.dest}</span> },
    { key: 'carrier', header: 'Carrier', render: r => <span className="text-tx-secondary">{r.carrier}</span> },
    { key: 'eta', header: 'ETA / Arrival', render: r => <span className="mono text-tx">{r.eta}</span> },
    { key: 'items', header: 'Units', render: r => <span className="mono">{r.items}</span> },
    { key: 'val', header: 'Value (₹)', render: r => <span className="mono font-semibold">₹{r.val.toLocaleString()}</span> },
    { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Orders & Active Shipments" subtitle="Real-time multi-modal logistics tracking across regional distribution network" />
      <div className="bg-card rounded-card border border-border p-5">
        <DataTable data={ORDERS} columns={cols} searchPlaceholder="Search shipments or destinations..." searchKey="dest" />
      </div>
    </div>
  );
}
