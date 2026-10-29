import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search,
  Bell,
  ChevronDown,
  LogOut,
  Layers,
  Activity,
  Box,
  Wrench,
  ShieldCheck,
  Truck,
} from 'lucide-react';

interface MenuItem {
  label: string;
  path: string;
}

interface NavMenu {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: MenuItem[];
}

const MENUS: NavMenu[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: <Activity className="w-3.5 h-3.5" />,
    items: [
      { label: 'Executive Dashboard', path: '/dashboard' },
      { label: 'Live Plant Status', path: '/overview/plant' },
    ],
  },
  {
    id: 'logistics',
    label: 'Logistics',
    icon: <Truck className="w-3.5 h-3.5" />,
    items: [
      { label: 'Warehouses', path: '/warehouses' },
      { label: 'Orders & Shipments', path: '/logistics/orders' },
      { label: 'Vehicle Fleet', path: '/logistics/vehicles' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: <Box className="w-3.5 h-3.5" />,
    items: [
      { label: 'Stock Balance', path: '/inventory' },
      { label: 'Spare Parts Optimizer', path: '/spare-parts' },
      { label: 'Parts Catalog', path: '/inventory/catalog' },
    ],
  },
  {
    id: 'assets',
    label: 'Assets & Maint.',
    icon: <Wrench className="w-3.5 h-3.5" />,
    items: [
      { label: 'Machine Registry', path: '/assets/machines' },
      { label: 'Downtime Analyzer', path: '/downtime' },
      { label: 'Work Orders', path: '/assets/work-orders' },
    ],
  },
  {
    id: 'quality',
    label: 'Quality',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
    items: [
      { label: 'Quality Watch', path: '/quality' },
      { label: 'Inspection Logs', path: '/quality/inspections' },
      { label: 'Batch Tracing', path: '/quality/batches' },
    ],
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    icon: <Layers className="w-3.5 h-3.5" />,
    items: [
      { label: 'Supplier Directory', path: '/suppliers' },
      { label: 'Reliability Scorecard', path: '/suppliers/scorecard' },
      { label: 'Supplier Ingestion', path: '/suppliers/ingest' },
    ],
  },
];

export function TopBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [userDropdown, setUserDropdown] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="border-b border-border bg-[#1C1C1C] sticky top-0 z-40" ref={navRef}>
      <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo Pill */}
        <div className="flex items-center gap-6">
          <NavLink to="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-pill bg-accent flex items-center justify-center font-bold text-accent-fg text-sm tracking-wider shadow-sm">
              LS
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-tx group-hover:text-accent transition-colors">
                LogiSense
              </span>
              <span className="text-[10px] text-tx-muted tracking-wider uppercase font-mono">
                Exasol Ops
              </span>
            </div>
          </NavLink>

          {/* Quick Search */}
          <div className="relative hidden md:block w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted" />
            <input
              type="text"
              placeholder="Search assets, SKUs..."
              className="w-full bg-[#252525] border border-border rounded-control pl-8 pr-3 py-1 text-xs text-tx placeholder:text-tx-muted focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Six Dropdown Menus */}
        <nav className="flex items-center gap-1">
          {MENUS.map((menu) => {
            const isActive = menu.items.some((item) =>
              location.pathname.startsWith(item.path)
            );
            const isOpen = openMenu === menu.id;

            return (
              <div key={menu.id} className="relative">
                <button
                  onClick={() => setOpenMenu(isOpen ? null : menu.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-medium transition-all ${
                    isActive
                      ? 'text-accent bg-accent/15 border border-accent/20'
                      : 'text-tx-secondary hover:text-tx hover:bg-[#252525]'
                  }`}
                >
                  {menu.icon}
                  <span>{menu.label}</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>

                {isOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-48 bg-card border border-border rounded-control shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                    {menu.items.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setOpenMenu(null)}
                        className={({ isActive: itemActive }) =>
                          `block px-3 py-2 text-xs transition-colors ${
                            itemActive
                              ? 'text-accent bg-accent/10 font-semibold'
                              : 'text-tx-secondary hover:text-tx hover:bg-[#2A2A2A]'
                          }`
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Chip & Alerts */}
        <div className="flex items-center gap-3">
          <button
            className="relative p-2 text-tx-muted hover:text-tx rounded-control hover:bg-[#252525] transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
          </button>

          <div className="relative">
            <button
              onClick={() => setUserDropdown(!userDropdown)}
              className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-pill bg-[#252525] border border-border hover:border-tx-muted transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-[10px] font-bold text-accent">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-medium text-tx leading-none">
                  {user?.full_name || 'User'}
                </span>
                <span className="text-[10px] text-accent font-mono leading-tight">
                  {user?.role || 'PLANNER'}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-tx-muted ml-0.5" />
            </button>

            {userDropdown && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-card border border-border rounded-control shadow-xl py-1 z-50">
                <div className="px-3 py-2 border-b border-border/60">
                  <p className="text-[11px] text-tx-muted font-mono">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-danger/10 text-left transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
