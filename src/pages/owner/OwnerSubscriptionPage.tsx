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
  Info,
  Plus
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
    trialInfo,
    isTrialActive,
    isTrialEligible,
    isTrialExpired,
    activeListingId,
    setActiveListingForBasic,
    selectPlan,
    upgradePlan,
    cancelSubscription,
    isLoading
  } = useSubscription();

  const [isActionLoading, setIsActionLoading] = useState(false);

  // Formatter for dates
  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Pending First Submission';
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
            <h1 className="text-2xl font-black text-white">Owner Subscription &amp; Entitlements</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage your 30-day free trial, active SaaS plan, property listing capacity, and transparent GST breakdowns
          </p>
        </div>

        {/* Global Action */}
        <Link to="/owner/plans">
          <Button variant="outline" size="sm" leftIcon={<Sparkles className="w-3.5 h-3.5 text-violet-400" />}>
            View All Plans
          </Button>
        </Link>
      </div>

      {/* Reminders for 7 Days, 3 Days, and 1 Day */}
      {isTrialActive && trialInfo.reminderStage && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 shadow-lg transition-all ${
            trialInfo.reminderStage === '1_day'
              ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
              : trialInfo.reminderStage === '3_days'
              ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
              : 'bg-violet-950/40 border-violet-500/40 text-violet-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <Clock
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                trialInfo.reminderStage === '1_day'
                  ? 'text-rose-400 animate-pulse'
                  : trialInfo.reminderStage === '3_days'
                  ? 'text-amber-400'
                  : 'text-violet-400'
              }`}
            />
            <div className="space-y-1">
              <p className="font-bold text-sm text-white">
                {trialInfo.reminderStage === '1_day'
                  ? 'Final Day Reminder: 30-Day Free Trial Ends Tomorrow!'
                  : trialInfo.reminderStage === '3_days'
                  ? '3 Days Remaining on Your 30-Day Free Trial'
                  : '7 Days Remaining on Your 30-Day Free Trial'}
              </p>
              <p className="text-xs leading-relaxed text-slate-300">
                {trialInfo.reminderStage === '1_day'
                  ? `Your trial expires on ${formatDate(trialInfo.endDate)} (${trialInfo.hoursRemaining} hours left). You will automatically switch to the free Basic plan (1 PG limit). You will not be charged.`
                  : trialInfo.reminderStage === '3_days'
                  ? `Your trial ends on ${formatDate(trialInfo.endDate)}. Upgrade now to continue managing up to 3 listings seamlessly, or smoothly transition to the free Basic plan.`
                  : `You have 7 days left to explore all Pro features without payment. At expiry, you transition to the free Basic plan (1 listing limit). Zero automatic charges.`}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <Button
              variant={trialInfo.reminderStage === '1_day' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleSelectUpgrade('pro')}
              className="text-xs font-bold"
            >
              Upgrade to Pro →
            </Button>
          </div>
        </div>
      )}

      {/* Trial Expired Alert with Active Listing Selector */}
      {isTrialExpired && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-white text-sm">30-Day Free Trial Expired</p>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  Your trial concluded on {formatDate(trialInfo.endDate)}. Your account was automatically transitioned to the free Basic plan (1 PG listing limit). <strong>You were not charged.</strong> All your properties, rooms, beds, and enquiries have been safely preserved.
                  {listingCount > 1 &&
                    ` Since you have ${listingCount} properties saved, please select which property remains active below, or upgrade to Pro to keep all active.`}
                </p>
              </div>
            </div>
            <Button
              variant="glow"
              size="sm"
              onClick={() => handleSelectUpgrade('pro')}
              className="font-bold text-xs shrink-0"
            >
              Upgrade to Pro (₹99/mo)
            </Button>
          </div>

          {/* Active Listing Chooser for Basic Plan */}
          {listingCount > 1 && (
            <div className="pt-3 border-t border-amber-500/20 space-y-2">
              <span className="font-bold text-white text-xs block">
                Designate Active Listing for Free Basic Plan:
              </span>
              <p className="text-[11px] text-slate-400">
                The chosen property will remain active in search. Other properties remain saved and can be reactivated anytime with an upgrade.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveListingForBasic('primary')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 border border-emerald-500 text-emerald-300 shadow-sm"
                >
                  ✓ Primary Listing Active
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Primary Status Card */}
      {isTrialActive || isTrialEligible ? (
        /* 30-Day Free Trial Status Card */
        <div className="bg-navy-900 border border-navy-750 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-violet-300 bg-violet-500/15 px-2.5 py-1 rounded-full border border-violet-500/30 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  {isTrialActive ? '30-Day Free Trial (Active)' : 'Start your 30-day free trial'}
                </span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  No Credit Card Required
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-2">
                Start your 30-day free trial
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                {isTrialActive
                  ? 'Your 30-day free trial started when you submitted your first listing for review. Enjoy full access to Pro features.'
                  : 'Eligible new PG owner trial. Countdown begins when you submit your first PG listing for review.'}
              </p>
            </div>

            <div className="text-left sm:text-right bg-navy-950/80 p-4 rounded-2xl border border-navy-800 sm:border-0 sm:bg-transparent sm:p-0">
              <span className="text-2xl sm:text-3xl font-black text-white text-gradient-brand">
                ₹0.00
              </span>
              <span className="text-xs text-emerald-400 block mt-0.5 font-bold">100% Free (30 Days)</span>
            </div>
          </div>

          {/* Trial Dates & Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-navy-950/70 border border-navy-800 text-xs">
            <div>
              <p className="text-slate-400 text-[11px]">Trial Start Date</p>
              <p className="text-white font-bold text-sm mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-violet-400" />
                {formatDate(trialInfo.startDate)}
              </p>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {trialInfo.hasStarted ? 'Activated on review submission' : 'Starts on first review submit'}
              </span>
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Trial Expiry Date</p>
              <p className="text-violet-300 font-bold text-sm mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-violet-400" />
                {formatDate(trialInfo.endDate)}
              </p>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                30 days duration (no auto-debit)
              </span>
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Days Remaining</p>
              <p className="text-emerald-400 font-bold text-sm mt-0.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {isTrialActive ? `${trialInfo.daysRemaining} Days (${trialInfo.hoursRemaining} hrs)` : '30 Days Available'}
              </p>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {isTrialActive ? 'Countdown in progress' : 'Ready to start'}
              </span>
            </div>
          </div>

          {/* PG Listing Capacity Bar */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-violet-400" />
                <span className="font-bold text-white">Trial Property Listing Capacity</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-white">{listingCount}</span>
                <span className="text-slate-400"> of </span>
                <span className="font-bold text-violet-300">3 PG Listings</span>
                <span className="text-slate-400 text-[11px] ml-2">
                  ({Math.max(0, 3 - listingCount)} remaining)
                </span>
              </div>
            </div>

            <div className="w-full bg-navy-950 rounded-full h-3 overflow-hidden border border-navy-800">
              <div
                className="h-3 rounded-full transition-all duration-500 bg-gradient-to-r from-brand-500 to-violet-500"
                style={{ width: `${Math.min(100, Math.round((listingCount / 3) * 100))}%` }}
              />
            </div>
          </div>

          {/* Features Included in Free Trial */}
          <div className="pt-4 border-t border-navy-800 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Features Included in the 30-Day Free Trial
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Manage up to 3 PG properties</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Full room &amp; bed availability tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Categorized photo uploads to secure storage</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Student enquiry &amp; visit booking inbox</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Priority placement in student search results</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero automatic billing or charges at trial end</span>
              </div>
            </div>
          </div>

          {/* Explanation of what happens when trial expires */}
          <div className="p-4 rounded-2xl bg-navy-950/70 border border-navy-800 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-white text-xs">
              <Info className="w-4 h-4 text-brand-400" />
              <span>What happens when your 30-day trial expires?</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              When your trial concludes, <strong>we do not charge you automatically</strong>. Your account will automatically switch to the free Basic plan with a 1 PG listing limit. All your property records, room inventories, uploaded photos, and student enquiry history are safely preserved. If you have more than 1 listing, you can upgrade or choose which listing remains active.
            </p>
          </div>
        </div>
      ) : hasActiveSubscription && currentPlan ? (
        /* Active Paid Plan Card */
        <div className="bg-navy-900 border border-navy-750 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active Subscription
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-navy-950 px-2 py-0.5 rounded border border-navy-800">
                  REF: {subscription?.demo_payment_reference || 'SUB_ACTIVE'}
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
              <p className="text-slate-400 text-[11px]">Next Renewal Date</p>
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
          </div>
        </div>
      ) : (
        /* Inactive Notice */
        <div className="bg-navy-900 border border-navy-750 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Start your 30-day free trial</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Activate your 30-day free trial today. Manage up to 3 PG properties with zero credit card required.
            </p>
          </div>
          <Link to="/owner/plans">
            <Button variant="glow" size="lg" leftIcon={<Sparkles className="w-4 h-4" />}>
              Start 30-Day Free Trial
            </Button>
          </Link>
        </div>
      )}

      {/* Available Upgrades Section */}
      <div className="space-y-4 pt-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            <span>Upgrade Options &amp; Configured Pricing</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Switch plans anytime to unlock more property listings. Low, accessible pricing with transparent 18% GST.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {OWNER_SUBSCRIPTION_PLANS.map(plan => {
            const price = calculatePlanPrice(plan.basePrice, DEFAULT_GST_RATE);
            const isCurrent = currentPlan?.id === plan.id && hasActiveSubscription && !isTrialActive;

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
                        Select &amp; Upgrade →
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleInstantUpgradeDemo(plan.id)}
                        disabled={isActionLoading}
                        className="w-full text-[10px] text-slate-500 hover:text-slate-300 text-center block transition-colors"
                      >
                        Instant Switch
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
