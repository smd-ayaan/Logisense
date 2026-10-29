import axios from 'axios';
import { getToken, clearAuth } from './auth';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const api = axios.create({ baseURL: BASE_URL });

/* Attach JWT on every request */
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* On 401, clear auth and reload to /login only if not already on /login or calling auth/login */
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginEndpoint = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !isLoginEndpoint) {
      clearAuth();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

/* ─── Typed helpers ─── */

export interface DashboardKpis {
  machines_active:  number;
  machines_down:    number;
  open_alerts:      number;
  low_stock_items:  number;
  total_warehouses: number;
  supplier_count:   number;
}

export interface RecentEvent {
  EVENT_ID:          string;
  MACHINE_ID:        string;
  MACHINE_NAME:      string;
  FAULT_CODE:        string;
  START_TS:          string;
  DURATION_H:        number;
  ROOT_CAUSE:        string;
  MAINTENANCE_COST:  number;
}

export interface InventoryItem {
  INVENTORY_ID:      string;
  WAREHOUSE_ID:      string;
  WAREHOUSE_NAME:    string;
  PART_ID:           string;
  PART_NAME:         string;
  CATEGORY:          string;
  UNIT_COST:         number;
  REORDER_POINT:     number;
  QTY_ON_HAND:       number;
  SURPLUS:           number;
  STOCK_STATUS:      string;
}

export interface TransferRec {
  PART_ID:            string;
  PART_NAME:          string;
  FROM_WAREHOUSE:     string;
  TO_WAREHOUSE:       string;
  SUGGESTED_QTY:      number;
  TRANSFER_VALUE_USD: number;
}

export interface Supplier {
  SUPPLIER_ID:    string;
  SUPPLIER_NAME:  string;
  COUNTRY:        string;
  ON_TIME_RATE:   number;
  QUALITY_SCORE:  number;
  COMPOSITE_SCORE?: number;
  SCORE_RANK?:    number;
}

export interface Machine {
  MACHINE_ID:   string;
  MACHINE_NAME: string;
  MACHINE_TYPE: string;
  LOCATION:     string;
  STATUS:       string;
}

export const fetchKpis           = () => api.get<DashboardKpis>('/api/v1/dashboard/kpis').then(r => r.data);
export const fetchRecentEvents   = (limit = 8) => api.get<RecentEvent[]>(`/api/v1/dashboard/recent-events?limit=${limit}`).then(r => r.data);
export const fetchInventory      = (params?: Record<string, string>) => api.get<InventoryItem[]>('/api/v1/inventory/balance', { params }).then(r => r.data);
export const fetchTransfers      = () => api.get<TransferRec[]>('/api/v1/inventory/transfer-recommendations').then(r => r.data);
export const fetchMachines       = () => api.get<Machine[]>('/api/v1/assets/machines').then(r => r.data);
export const fetchSuppliers      = () => api.get<Supplier[]>('/api/v1/suppliers').then(r => r.data);
export const fetchScorecard      = () => api.get<Supplier[]>('/api/v1/suppliers/scorecard').then(r => r.data);
export const fetchWarehouses     = () => api.get('/api/v1/warehouses').then(r => r.data);
export const fetchAlerts         = () => api.get('/api/v1/dashboard/alerts').then(r => r.data);

/* ─── Downtime Analyzer ─── */
export interface MachineHealth {
  MACHINE_ID:          string;
  MACHINE_NAME:        string;
  MACHINE_TYPE:        string;
  LOCATION:            string;
  STATUS:              string;
  INSTALL_DATE:        string;
  ANOMALY_STATUS:      'NORMAL' | 'WARNING' | 'CRITICAL';
  CRITICAL_SENSORS:    number;
  WARNING_SENSORS:     number;
  RECENT_EVENT_COUNT:  number;
}

export interface PrecursorReading {
  EVENT_ID:            string;
  MACHINE_ID:          string;
  MACHINE_NAME:        string;
  MACHINE_TYPE:        string;
  FAULT_CODE:          string;
  FAILURE_TS:          string;
  SENSOR_ID:           string;
  SENSOR_TYPE:         string;
  UNIT:                string;
  THRESHOLD_WARN:      number;
  THRESHOLD_CRIT:      number;
  READING_TS:          string;
  READING_VALUE:       number;
  APPROX_HOURS_BEFORE: number;
  ALERT_LEVEL:         'NORMAL' | 'WARNING' | 'CRITICAL';
}

export interface RootCause {
  MACHINE_TYPE:        string;
  FAULT_CODE:          string;
  ROOT_CAUSE:          string;
  EVENT_COUNT:         number;
  AVG_DURATION_H:      number;
  TOTAL_DURATION_H:    number;
  TOTAL_COST:          number;
  COST_RANK:           number;
  CONFIDENCE_PCT:      number;
  SEQUENCE_PATTERN?:   string;
}

export const fetchMachineHealthGrid = () =>
  api.get<MachineHealth[]>('/api/v1/downtime/health-grid').then(r => r.data);

export const fetchPreFailureTelemetry = (machineId?: string, eventId?: string) =>
  api.get<PrecursorReading[]>('/api/v1/downtime/pre-failure-telemetry', {
    params: { machine_id: machineId, event_id: eventId }
  }).then(r => r.data);

export const fetchRootCauses = (machineType?: string) =>
  api.get<RootCause[]>('/api/v1/downtime/root-causes', {
    params: { machine_type: machineType }
  }).then(r => r.data);

/* ─── Spare Parts Optimizer ─── */
export interface SparePartsMetrics {
  stockout_count:                number;
  low_stock_count:               number;
  excess_count:                  number;
  tied_up_capital_usd:           number;
  transfer_recommendation_count: number;
  rebalance_savings_usd:         number;
}

export const fetchSparePartsMetrics = () =>
  api.get<SparePartsMetrics>('/api/v1/spareparts/metrics').then(r => r.data);

export const fetchSparePartsHeatmap = () =>
  api.get<InventoryItem[]>('/api/v1/spareparts/balance-heatmap').then(r => r.data);

export const fetchSparePartsRecommendations = () =>
  api.get<TransferRec[]>('/api/v1/spareparts/recommendations').then(r => r.data);

export const approveStockTransfer = (payload: {
  part_id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  qty: number;
}) => api.post('/api/v1/spareparts/approve-transfer', payload).then(r => r.data);

/* ─── Quality Watch ─── */
export interface QualityAlert {
  MACHINE_ID:          string;
  MACHINE_NAME:        string;
  MACHINE_TYPE:        string;
  DEFECT_TYPE:         string;
  CHECK_DATE:          string;
  CURRENT_RATE:        number;
  BASELINE_30D_RATE:   number;
  PCT_ABOVE_BASELINE:  number;
  ALERT_LEVEL:         'ALERT' | 'WATCH' | 'NORMAL';
}

export interface StageComparisonPoint {
  CHECK_DATE: string;
  EARLY_RATE: number;
  MID_RATE:   number;
  FINAL_RATE: number;
}

export interface QualityMetrics {
  total_inspections:     number;
  total_defects:         number;
  total_sampled:         number;
  overall_defect_pct:    number;
  active_early_warnings: number;
}

export const fetchQualityMetrics = () =>
  api.get<QualityMetrics>('/api/v1/quality/metrics').then(r => r.data);

export const fetchQualityAlerts = () =>
  api.get<QualityAlert[]>('/api/v1/quality/alerts').then(r => r.data);

export const fetchStageComparison = (machineId = 'M-01', defectType = 'SCRATCH') =>
  api.get<StageComparisonPoint[]>('/api/v1/quality/stage-comparison', {
    params: { machine_id: machineId, defect_type: defectType },
  }).then(r => r.data);

/* ─── Supplier Ingestion ─── */
export interface IngestPreview {
  filename:        string;
  headers:         string[];
  auto_mapping:    Record<string, string | null>;
  standard_fields: string[];
  preview_rows:    Record<string, string>[];
}

export const previewSupplierFile = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<IngestPreview>('/api/v1/ingest/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const confirmSupplierImport = (payload: {
  filename:       string;
  supplier_id:    string;
  column_mapping: Record<string, string>;
  rows:           Record<string, string>[];
}) => api.post('/api/v1/ingest/confirm', payload).then(r => r.data);




