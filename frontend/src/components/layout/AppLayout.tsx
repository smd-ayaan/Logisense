import React from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { TopBar } from './TopBar';
import { ToastContainer } from '../ui/ToastContainer';
import { ChevronRight } from 'lucide-react';

export function AppLayout() {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  return (
    <div className="min-h-screen bg-page flex flex-col">
      <TopBar />

      {/* Main Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6 flex flex-col">
        {/* Breadcrumb row */}
        <div className="flex items-center gap-1.5 text-xs text-tx-muted mb-4 font-mono">
          <Link to="/dashboard" className="hover:text-tx">Home</Link>
          {pathSegments.map((seg, i) => {
            const url = `/${pathSegments.slice(0, i + 1).join('/')}`;
            const isLast = i === pathSegments.length - 1;
            const formatted = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');

            return (
              <React.Fragment key={url}>
                <ChevronRight className="w-3 h-3 text-tx-muted" />
                {isLast ? (
                  <span className="text-accent">{formatted}</span>
                ) : (
                  <Link to={url} className="hover:text-tx">{formatted}</Link>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Rounded container panel */}
        <div className="flex-1 bg-container rounded-card border border-border p-6 relative">
          <Outlet />
        </div>
      </main>

      <ToastContainer />
    </div>
  );
}
