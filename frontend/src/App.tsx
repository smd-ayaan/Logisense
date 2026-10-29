import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { DowntimeAnalyzer } from '@/pages/DowntimeAnalyzer';
import { SparePartsOptimizer } from '@/pages/SparePartsOptimizer';
import { QualityWatch } from '@/pages/QualityWatch';
import { SupplierIngestion } from '@/pages/SupplierIngestion';
import { WarehousesView } from '@/pages/WarehousesView';
import { OrdersShipmentsView } from '@/pages/OrdersShipmentsView';
import { VehicleFleetView } from '@/pages/VehicleFleetView';
import { InspectionLogsView } from '@/pages/InspectionLogsView';
import { BatchTracingView } from '@/pages/BatchTracingView';
import { AssetsView } from '@/pages/AssetsView';
import { PlaceholderPage } from '@/pages/PlaceholderPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuth } = useAuth();
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public route */}
              <Route path="/login" element={<Login />} />

              {/* Protected App Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />

                {/* Logistics */}
                <Route
                  path="warehouses"
                  element={<WarehousesView />}
                />
                <Route
                  path="logistics/orders"
                  element={<OrdersShipmentsView />}
                />
                <Route
                  path="logistics/vehicles"
                  element={<VehicleFleetView />}
                />

                {/* Inventory */}
                <Route
                  path="inventory"
                  element={<SparePartsOptimizer />}
                />
                <Route
                  path="spare-parts"
                  element={<SparePartsOptimizer />}
                />
                <Route
                  path="inventory/catalog"
                  element={<SparePartsOptimizer />}
                />

                {/* Assets & Downtime */}
                <Route
                  path="assets/machines"
                  element={<AssetsView />}
                />
                <Route
                  path="downtime"
                  element={<DowntimeAnalyzer />}
                />
                <Route
                  path="assets/work-orders"
                  element={<PlaceholderPage title="Work Orders" module="Maintenance" phase="Phase 5" />}
                />

                {/* Quality */}
                <Route
                  path="quality"
                  element={<QualityWatch />}
                />
                <Route
                  path="quality/inspections"
                  element={<InspectionLogsView />}
                />
                <Route
                  path="quality/batches"
                  element={<BatchTracingView />}
                />

                {/* Suppliers */}
                <Route
                  path="suppliers"
                  element={<SupplierIngestion />}
                />
                <Route
                  path="suppliers/scorecard"
                  element={<SupplierIngestion />}
                />
                <Route
                  path="suppliers/ingest"
                  element={<SupplierIngestion />}
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
