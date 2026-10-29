import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Lock, Mail, ArrowRight, Database, Cpu, ShieldAlert } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      addToast('Please enter both email and password', 'warning');
      return;
    }
    try {
      setLoading(true);
      await login(email, password);
      addToast('Welcome to LogiSense', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Authentication failed';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const setDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('demo1234');
  };

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-container rounded-card border border-border overflow-hidden grid grid-cols-1 md:grid-cols-2 shadow-2xl">
        {/* Left: Login Form */}
        <div className="p-8 md:p-12 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 rounded-pill bg-accent flex items-center justify-center font-bold text-accent-fg text-sm">
                LS
              </div>
              <span className="font-bold text-base text-tx">LogiSense</span>
            </div>

            <h1 className="text-2xl font-bold text-tx tracking-tight">Sign In</h1>
            <p className="text-xs text-tx-secondary mt-1">
              Access the Exasol-powered operational command center
            </p>

            <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
              <div>
                <label className="label-xs block mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-tx-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@logisense.dev"
                    required
                    className="w-full bg-card border border-border rounded-control pl-9 pr-3 py-2 text-xs text-tx focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="label-xs block mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-tx-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-card border border-border rounded-control pl-9 pr-3 py-2 text-xs text-tx focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-accent text-accent-fg font-semibold py-2 px-4 rounded-control text-xs flex items-center justify-center gap-2 hover:bg-accent/90 transition-all disabled:opacity-50"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Quick Demo Credentials */}
          <div className="mt-8 pt-6 border-t border-border">
            <span className="label-xs block mb-2.5">One-Click Demo Credentials</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDemoAccount('admin@logisense.dev')}
                className="py-1.5 px-2 bg-card border border-border rounded-control text-[11px] text-tx-secondary hover:text-accent hover:border-accent/40 transition-colors"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount('planner@logisense.dev')}
                className="py-1.5 px-2 bg-card border border-border rounded-control text-[11px] text-tx-secondary hover:text-accent hover:border-accent/40 transition-colors"
              >
                Planner
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount('warehouse@logisense.dev')}
                className="py-1.5 px-2 bg-card border border-border rounded-control text-[11px] text-tx-secondary hover:text-accent hover:border-accent/40 transition-colors"
              >
                Warehouse
              </button>
            </div>
          </div>
        </div>

        {/* Right: Brand Banner */}
        <div className="bg-[#181818] border-l border-border p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-pill bg-accent/15 border border-accent/20 text-accent text-xs font-semibold mb-6">
              <Database className="w-3.5 h-3.5" />
              <span>Exasol In-Memory Analytics</span>
            </div>
            <h2 className="text-xl font-bold text-tx leading-snug">
              Predictive Operations & Supply Chain Intelligence
            </h2>
            <p className="text-xs text-tx-secondary mt-3 leading-relaxed">
              Real-time equipment downtime precursor detection, multi-warehouse stock balancing,
              and early-warning quality defect surveillance.
            </p>
          </div>

          <div className="space-y-4 my-8">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-control bg-card border border-border text-accent">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-tx">Precursor Anomaly Engine</h4>
                <p className="text-[11px] text-tx-muted mt-0.5">
                  Sub-second window aggregations over 200k+ sensor logs.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-control bg-card border border-border text-accent">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-tx">Multi-Stage Quality Watch</h4>
                <p className="text-[11px] text-tx-muted mt-0.5">
                  Surfaces production anomalies 3–5 days prior to final inspection.
                </p>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-tx-muted font-mono flex items-center justify-between border-t border-border/50 pt-4">
            <span>Target: Exasol SaaS</span>
            <span>ExaThon India 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}
