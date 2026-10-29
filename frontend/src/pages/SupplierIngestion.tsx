import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchScorecard,
  fetchSuppliers,
  previewSupplierFile,
  confirmSupplierImport,
  IngestPreview,
} from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { ChartCard } from '@/components/ui/ChartCard';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Award,
  Layers,
  RefreshCw,
} from 'lucide-react';

export function SupplierIngestion() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<IngestPreview | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [selectedSupplierId, setSelectedSupplierId] = useState('SUP-01');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. Fetch live supplier scorecard from Exasol view V_SUPPLIER_SCORECARD
  const { data: scorecard, isLoading: scoreLoading, refetch: refetchScorecard } = useQuery({
    queryKey: ['supplier-scorecard'],
    queryFn: fetchScorecard,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: fetchSuppliers,
  });

  // Upload Preview Mutation
  const previewMutation = useMutation({
    mutationFn: previewSupplierFile,
    onSuccess: (data) => {
      setPreviewData(data);
      const initialMap: Record<string, string> = {};
      Object.entries(data.auto_mapping).forEach(([raw, target]) => {
        if (target) initialMap[raw] = target;
      });
      setColumnMapping(initialMap);
      setIsModalOpen(true);
      addToast(`Fuzzy matched headers for ${data.filename}`, 'info');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.detail || 'Failed to parse file', 'error');
    },
  });

  // Confirm Import Mutation
  const importMutation = useMutation({
    mutationFn: confirmSupplierImport,
    onSuccess: (data) => {
      addToast(data.message, 'success');
      setIsModalOpen(false);
      setSelectedFile(null);
      setPreviewData(null);
      queryClient.invalidateQueries({ queryKey: ['supplier-scorecard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.detail || 'Import failed', 'error');
    },
  });

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      previewMutation.mutate(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      previewMutation.mutate(file);
    }
  };

  const handleConfirm = () => {
    if (!previewData) return;
    importMutation.mutate({
      filename: previewData.filename,
      supplier_id: selectedSupplierId,
      column_mapping: columnMapping,
      rows: previewData.preview_rows,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Supplier Data Ingestion & Reliability Engine"
        subtitle="Universal CSV/XLSX schema mapping with fuzzy header normalization and Exasol in-database composite scoring (V_SUPPLIER_SCORECARD)"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-accent bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-pill flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              <span>Fuzzy Normalization Active</span>
            </span>
          </div>
        }
      />

      {/* Row 1: Drag-and-Drop Ingestion Dropzone */}
      <div className="bg-card rounded-card border border-border p-6 flex flex-col items-center justify-center relative overflow-hidden">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          className={`w-full max-w-2xl border-2 border-dashed rounded-card p-8 flex flex-col items-center justify-center text-center transition-all ${
            dragOver
              ? 'border-accent bg-accent/5'
              : 'border-border hover:border-tx-muted bg-[#222]'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-[#1C1C1C] border border-border flex items-center justify-center text-accent mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>

          <h3 className="text-sm font-bold text-tx">Drag & Drop Messy Supplier Files</h3>
          <p className="text-xs text-tx-secondary mt-1 max-w-md">
            Accepts inconsistent column names, dates (DD/MM/YYYY, Mon-YY), and currencies ($ / ₹ / €). Auto-detects standard target fields.
          </p>

          <label className="mt-4 cursor-pointer">
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileInput}
              className="hidden"
            />
            <span className="bg-accent text-accent-fg font-semibold py-1.5 px-4 rounded-control text-xs flex items-center gap-1.5 hover:bg-accent/90 transition-all shadow-sm">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Browse Sample File</span>
            </span>
          </label>

          <span className="text-[10px] text-tx-muted font-mono mt-3">
            Supports CSV, XLSX • Test samples available in <code className="text-accent">data/supplier_samples/</code>
          </span>
        </div>
      </div>

      {/* Row 2: Live Exasol Supplier Scorecard Leaderboard */}
      <div className="bg-card rounded-card border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-tx">
              Supplier Reliability Leaderboard (Exasol V_SUPPLIER_SCORECARD)
            </h3>
            <p className="text-xs text-tx-muted mt-0.5">
              Weighted composite evaluation: 40% On-Time Delivery + 40% Order Fill Rate + 20% Cost Efficiency
            </p>
          </div>

          <button
            onClick={() => refetchScorecard()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-control border border-border text-xs text-tx-secondary hover:text-tx hover:bg-[#2A2A2A] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Recalculate Scores</span>
          </button>
        </div>

        {scoreLoading ? (
          <Skeleton className="h-64 w-full rounded-card" />
        ) : !scorecard || scorecard.length === 0 ? (
          <EmptyState
            title="No Suppliers Found"
            subtitle="Ingest delivery data to populate the reliability scorecard."
          />
        ) : (
          <div className="overflow-x-auto border border-border rounded-card">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-[#222]">
                  <th className="p-3 label-xs text-center w-12">Rank</th>
                  <th className="p-3 label-xs">Supplier & Origin</th>
                  <th className="p-3 label-xs text-center">Deliveries</th>
                  <th className="p-3 label-xs text-center">On-Time %</th>
                  <th className="p-3 label-xs text-center">Fill Rate</th>
                  <th className="p-3 label-xs text-center">Avg Delay</th>
                  <th className="p-3 label-xs text-center">Avg Cost (₹)</th>
                  <th className="p-3 label-xs text-center min-w-[120px]">Composite Score</th>
                </tr>
              </thead>
              <tbody>
                {scorecard.map((s) => (
                  <tr key={s.SUPPLIER_ID} className="border-b border-border/50 hover:bg-[#252525] transition-colors">
                    <td className="p-3 text-center">
                      <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#2A2A2A] font-mono font-bold text-xs">
                        {s.SCORE_RANK === 1 ? (
                          <Award className="w-3.5 h-3.5 text-accent" />
                        ) : (
                          `#${s.SCORE_RANK}`
                        )}
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="font-semibold text-tx leading-snug">{s.SUPPLIER_NAME}</div>
                      <div className="text-[10px] text-tx-muted font-mono flex items-center gap-1.5 mt-0.5">
                        <span>{s.COUNTRY}</span>
                        <span>•</span>
                        <span>{s.PAYMENT_TERMS || 'NET30'}</span>
                      </div>
                    </td>

                    <td className="p-3 text-center mono text-tx-secondary">
                      {s.TOTAL_DELIVERIES}
                    </td>

                    <td className="p-3 text-center">
                      <span className="mono font-semibold text-success">
                        {((s.ON_TIME_RATE || 0) * 100).toFixed(1)}%
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      <span className="mono text-tx-secondary">
                        {((s.FILL_RATE || 0) * 100).toFixed(1)}%
                      </span>
                    </td>

                    <td className="p-3 text-center mono">
                      {s.AVG_DELAY_DAYS && s.AVG_DELAY_DAYS > 0 ? (
                        <span className="text-warning">+{s.AVG_DELAY_DAYS}d</span>
                      ) : (
                        <span className="text-success">On-schedule</span>
                      )}
                    </td>

                    <td className="p-3 text-center mono text-tx-secondary">
                      ₹{Math.round((s.AVG_UNIT_COST_USD || 50) * 83).toLocaleString()}
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-[#1A1A1A] h-2 rounded-full overflow-hidden border border-border">
                          <div
                            className="bg-accent h-full rounded-full"
                            style={{ width: `${Math.min(100, (s.COMPOSITE_SCORE || 0) * 100)}%` }}
                          />
                        </div>
                        <span className="font-bold font-mono text-accent text-xs">
                          {((s.COMPOSITE_SCORE || 0) * 100).toFixed(1)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schema Mapping Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Auto-Mapped Schema Preview — ${previewData?.filename}`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-tx-secondary">
            Review auto-detected column matches before committing rows into Exasol <code className="text-accent">SUPPLIER_DELIVERIES</code>.
          </p>

          <div className="flex items-center gap-3">
            <label className="text-xs text-tx font-semibold">Assign to Supplier:</label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="bg-[#252525] border border-border rounded-control px-2.5 py-1 text-xs text-tx focus:outline-none focus:border-accent"
            >
              {suppliers?.map((sup) => (
                <option key={sup.SUPPLIER_ID} value={sup.SUPPLIER_ID}>
                  {sup.SUPPLIER_ID} - {sup.SUPPLIER_NAME}
                </option>
              ))}
            </select>
          </div>

          <div className="border border-border rounded-control max-h-56 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#222] border-b border-border sticky top-0">
                <tr>
                  <th className="p-2 label-xs">File Column</th>
                  <th className="p-2 label-xs">Target Standard Field</th>
                </tr>
              </thead>
              <tbody>
                {previewData?.headers.map((h) => (
                  <tr key={h} className="border-b border-border/50">
                    <td className="p-2 font-mono text-tx-secondary">{h}</td>
                    <td className="p-2">
                      <select
                        value={columnMapping[h] || ''}
                        onChange={(e) =>
                          setColumnMapping({ ...columnMapping, [h]: e.target.value })
                        }
                        className="w-full bg-[#1A1A1A] border border-border rounded-control p-1 text-xs text-accent font-mono focus:outline-none focus:border-accent"
                      >
                        <option value="">-- Ignore Column --</option>
                        {previewData.standard_fields.map((sf) => (
                          <option key={sf} value={sf}>
                            {sf}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 rounded-control text-xs text-tx-secondary hover:bg-[#252525]"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={importMutation.isPending}
              className="bg-accent text-accent-fg font-semibold py-1.5 px-4 rounded-control text-xs flex items-center gap-1.5 hover:bg-accent/90 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{importMutation.isPending ? 'Ingesting...' : 'Confirm & Ingest'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
