import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, Wrench, BarChart3, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const OwnerModulePlaceholder: React.FC = () => {
  const location = useLocation();
  const isTenants = location.pathname.includes('tenants');
  const isMaintenance = location.pathname.includes('maintenance');
  const isAnalytics = location.pathname.includes('analytics');

  const title = isTenants
    ? 'Tenants & Digital Rent Ledger'
    : isMaintenance
    ? 'Maintenance & Complaints Tracker'
    : 'Property Analytics & Occupancy Forecasting';

  const description = isTenants
    ? 'Manage student lease agreements, monthly rent collection logs, and auto-generated digital payment receipts. Slated for backend payment gateway integration.'
    : isMaintenance
    ? 'Log repair requests for plumbing, Wi-Fi router resets, air conditioning maintenance, and assign tasks to on-premise wardens.'
    : 'Gain deep visual insights into student inquiry conversions, lead response times, and seasonal university admissions trends.';

  const Icon = isTenants ? Users : isMaintenance ? Wrench : BarChart3;

  return (
    <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-10 text-center max-w-xl mx-auto space-y-5 my-8 shadow-xl">
      <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mx-auto">
        <Icon className="w-8 h-8" />
      </div>

      <span className="text-[11px] font-bold uppercase tracking-widest text-violet-300 bg-violet-500/15 px-3 py-1 rounded-full border border-violet-500/30">
        Owner SaaS Phase 2
      </span>

      <h2 className="text-xl sm:text-2xl font-bold text-white">{title}</h2>
      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">{description}</p>

      <div className="pt-4 flex items-center justify-center gap-3">
        <Link to="/owner/dashboard">
          <Button variant="secondary" size="md">
            Return to Dashboard
          </Button>
        </Link>
        <Link to="/owner/listings">
          <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
            Manage Active PGs
          </Button>
        </Link>
      </div>
    </div>
  );
};
