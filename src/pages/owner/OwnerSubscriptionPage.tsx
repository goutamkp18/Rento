import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Clock,
  AlertCircle,
  Building2,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  XCircle,
  Calendar,
  Check,
  Info
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useSubscription } from '../../context/SubscriptionContext';
import {
  OWNER_SUBSCRIPTION_PLANS,
  calculatePlanPrice,
  formatINR,
  formatListingLimit,
  DEFAULT_GST_RATE
} from '../../utils/pricing';
import { SubscriptionPlanId } from '../../types';

export const OwnerSubscriptionPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    subscription,
    currentPlan,
    status,
    hasActiveSubscription,
    listingCount,
    listingLimit,
    remainingCapacity,
    canAddListing,
    selectPlan,
    upgradePlan,
    cancelSubscription,
    isLoading
  } = useSubscription();

  const [isActionLoading, setIsActionLoading] = useState(false);

  // Formatter for dates
  const formatDate = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
      return new Date(isoString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return isoString;
    }
  };

  const handleSelectUpgrade = (planId: SubscriptionPlanId) => {
    selectPlan(planId);
    navigate(`/owner/checkout?plan=${planId}&upgrade=true`);
  };

  const handleInstantUpgradeDemo = async (planId: SubscriptionPlanId) => {
    setIsActionLoading(true);
    await upgradePlan(planId);
    setIsActionLoading(false);
  };

  const handleSimulateCancel = async () => {
    if (window.confirm('Simulate cancelling this subscription in demo mode? PG registration will be locked.')) {
      setIsActionLoading(true);
      await cancelSubscription();
      setIsActionLoading(false);
    }
  };

  const currentPriceBreakdown = currentPlan
    ? calculatePlanPrice(currentPlan.basePrice, DEFAULT_GST_RATE)
    : null;

  const usagePercent =
    listingLimit === Infinity
      ? 100
      : Math.min(100, Math.round((listingCount / listingLimit) * 100));

  return (
    <div className="space-y-8 max-w-5xl">
      
      {/* Header */}
      <div className="pb-4 border-b border-navy-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-violet-400" />
            <h1 className="text-2xl font-black text-white">Owner Subscription & Entitlements</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage your active SaaS plan, property listing capacity, and transparent GST breakdowns
          </p>
        </div>

        {/* Global Action */}
        <Link to="/owner/plans">
          <Button variant="outline" size="sm" leftIcon={<Sparkles className="w-3.5 h-3.5 text-violet-400" />}>
            View All Plans
          </Button>
        </Link>
      </div>

      {/* Honest Prototype Notice */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-3 shadow-lg">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-white text-sm">Frontend Prototype Demonstration</p>
          <p className="leading-relaxed text-slate-300">
            This subscription interface is a mock demonstration for testing owner onboarding and plan-based listing enforcement. No actual bank transactions, auto-debits, or gateway integrations have occurred. All data is persisted in browser local storage.
          </p>
        </div>
      </div>

      {/* Primary Status Card */}
      {hasActiveSubscription && currentPlan ? (
        <div className="bg-navy-900 border border-navy-750 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active Subscription
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-navy-950 px-2 py-0.5 rounded border border-navy-800">
                  REF: {subscription?.demo_payment_reference || 'DEMO_SUB_ACTIVE'}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-2">
                {currentPlan.name} Plan
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{currentPlan.description}</p>
            </div>

            <div className="text-left sm:text-right bg-navy-950/80 p-4 rounded-2xl border border-navy-800 sm:border-0 sm:bg-transparent sm:p-0">
              <span className="text-2xl sm:text-3xl font-black text-white text-gradient-brand">
                {formatINR(subscription?.total_monthly_price || currentPriceBreakdown?.totalMonthlyPrice || 0)}
              </span>
              <span className="text-xs text-slate-400 block mt-0.5">/ month (including 18% GST)</span>
            </div>
          </div>

          {/* Pricing & GST Breakdown Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-navy-950/70 border border-navy-800 text-xs">
            <div>
              <p className="text-slate-400 text-[11px]">Monthly Base Price</p>
              <p className="text-white font-bold text-sm mt-0.5">
                {formatINR(subscription?.monthly_base_price || currentPlan.basePrice)}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Illustrative GST (18%)</p>
              <p className="text-white font-bold text-sm mt-0.5">
                {formatINR(subscription?.gst_amount || (currentPriceBreakdown ? currentPriceBreakdown.gstAmount : 0))}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Next Renewal Date (Simulated)</p>
              <p className="text-violet-300 font-bold text-sm mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(subscription?.renewal_date)}
              </p>
            </div>
          </div>

          {/* PG Listing Usage & Capacity Bar */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-violet-400" />
                <span className="font-bold text-white">PG Listing Capacity</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-white">{listingCount}</span>
                <span className="text-slate-400"> of </span>
                <span className="font-bold text-violet-300">
                  {listingLimit === Infinity ? 'Unlimited' : `${listingLimit} PGs`}
                </span>
                {listingLimit !== Infinity && (
                  <span className="text-slate-400 text-[11px] ml-2">
                    ({remainingCapacity} slot{remainingCapacity !== 1 ? 's' : ''} left)
                  </span>
                )}
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-navy-950 rounded-full h-3 overflow-hidden border border-navy-800">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  listingLimit === Infinity
                    ? 'bg-gradient-to-r from-violet-500 to-brand-400 w-full'
                    : usagePercent >= 100
                    ? 'bg-gradient-to-r from-amber-500 to-red-500'
                    : 'bg-gradient-to-r from-brand-500 to-violet-500'
                }`}
                style={{ width: `${listingLimit === Infinity ? 100 : usagePercent}%` }}
              />
            </div>

            {!canAddListing && (
              <p className="text-xs text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                ⚠️ You have reached your listing limit ({listingLimit} PG{listingLimit > 1 ? 's' : ''}). Upgrade to list additional properties.
              </p>
            )}
          </div>

          {/* Included Features */}
          <div className="pt-4 border-t border-navy-800 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Active Entitlements on this Plan
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300">
              {currentPlan.features.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Simulation Testing Toolbar */}
          <div className="pt-4 border-t border-navy-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-400 text-[11px]">
              Demo Controls: Test sandbox subscription transitions
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSimulateCancel}
                isLoading={isActionLoading}
                className="text-xs text-red-300 border-red-500/30 hover:bg-red-500/10"
              >
                Simulate Cancellation
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Inactive / No Subscription Notice */
        <div className="bg-navy-900 border border-navy-750 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">No Active Subscription</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Your PG owner account does not currently have an active monthly plan. A subscription is required before listing properties or managing rooms on Rento.
            </p>
          </div>
          <Link to="/owner/plans">
            <Button variant="glow" size="lg" leftIcon={<Sparkles className="w-4 h-4" />}>
              Choose a Subscription Plan
            </Button>
          </Link>
        </div>
      )}

      {/* Available Upgrades Section */}
      <div className="space-y-4 pt-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            <span>Available Subscription Tiers</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Switch plans anytime to unlock more property listings and advanced management capabilities.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {OWNER_SUBSCRIPTION_PLANS.map(plan => {
            const price = calculatePlanPrice(plan.basePrice, DEFAULT_GST_RATE);
            const isCurrent = currentPlan?.id === plan.id && hasActiveSubscription;

            return (
              <div
                key={plan.id}
                className={`bg-navy-900 border rounded-3xl p-6 flex flex-col justify-between space-y-5 shadow-xl transition-all ${
                  isCurrent
                    ? 'border-emerald-500/40 bg-navy-900/90 ring-1 ring-emerald-500/30'
                    : plan.isRecommended
                    ? 'border-violet-500/40 hover:border-violet-500/70'
                    : 'border-navy-800 hover:border-navy-700'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
                      {plan.name}
                    </span>
                    {isCurrent ? (
                      <Badge variant="success" size="sm">Current Plan</Badge>
                    ) : plan.isRecommended ? (
                      <Badge variant="glow" size="sm">Recommended</Badge>
                    ) : null}
                  </div>

                  <div>
                    <span className="text-2xl font-black text-white">
                      {formatINR(plan.basePrice)}
                    </span>
                    <span className="text-xs text-slate-400"> / month</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      +18% GST ({formatINR(price.gstAmount)}) = <span className="text-white font-semibold">{formatINR(price.totalMonthlyPrice)}</span>/mo
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-navy-950/80 border border-navy-800 text-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Capacity</span>
                    <span className="text-white font-bold">{formatListingLimit(plan.listingLimit)}</span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-300 pt-2 border-t border-navy-800">
                    {plan.features.slice(0, 4).map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-navy-800">
                  {isCurrent ? (
                    <Button variant="secondary" className="w-full text-xs" disabled>
                      Currently Active
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Button
                        variant={plan.isRecommended ? 'glow' : 'outline'}
                        className="w-full text-xs justify-center"
                        onClick={() => handleSelectUpgrade(plan.id)}
                      >
                        Select & Checkout →
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleInstantUpgradeDemo(plan.id)}
                        disabled={isActionLoading}
                        className="w-full text-[10px] text-slate-500 hover:text-slate-300 text-center block transition-colors"
                      >
                        Instant Demo Switch
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
