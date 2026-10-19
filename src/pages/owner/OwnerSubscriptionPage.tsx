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
import { Modal } from '../../components/ui/Modal';
import { useSubscription } from '../../context/SubscriptionContext';
import { useToast } from '../../context/ToastContext';
import { paymentService } from '../../services/paymentService';
import {
  OWNER_SUBSCRIPTION_PLANS,
  calculatePlanPrice,
  formatINR,
  formatListingLimit,
  DEFAULT_GST_RATE,
  getSubscriptionPlan
} from '../../utils/pricing';
import { SubscriptionPlanId, PaymentRequest } from '../../types';

export const OwnerSubscriptionPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
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
    paymentHistory,
    refreshSubscription,
    isLoading
  } = useSubscription();

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [disputeItem, setDisputeItem] = useState<PaymentRequest | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

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

  const handleRefresh = async () => {
    setIsActionLoading(true);
    await refreshSubscription();
    setIsActionLoading(false);
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeItem || !disputeReason.trim()) return;
    setIsSubmittingDispute(true);
    try {
      await paymentService.disputePayment(disputeItem.id, disputeReason.trim());
      showToast({
        type: 'success',
        title: 'Dispute Submitted',
        message: 'Your dispute has been logged for admin re-investigation.',
      });
      setDisputeItem(null);
      setDisputeReason('');
      await refreshSubscription();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Dispute Failed',
        message: err?.message || 'Could not record dispute.',
      });
    } finally {
      setIsSubmittingDispute(false);
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

      {/* Pending Payment Verification Banner */}
      {(subscription?.payment_status === 'pending' || subscription?.payment_status === 'pending_verification') && (
        <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Payment Verification in Progress
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Pending Admin Verification
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">
                Your payment for the <strong className="text-white">{getSubscriptionPlan(subscription.selected_plan_id || subscription.plan_id).name}</strong> plan is currently pending manual verification by our operations team. Entitlements will activate once approved.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="shrink-0 text-xs font-semibold border-amber-500/30 text-amber-300 hover:bg-amber-500/10 shadow-sm"
            onClick={handleRefresh}
            isLoading={isActionLoading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5 text-amber-400" />}
          >
            Refresh Status
          </Button>
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
                    <Button
                      variant={plan.isRecommended ? 'glow' : 'outline'}
                      className="w-full text-xs justify-center"
                      onClick={() => handleSelectUpgrade(plan.id)}
                    >
                      Select &amp; Pay via UPI →
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Durable Payment & Renewal History Section */}
      <div className="bg-navy-900 border border-navy-750 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-800">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-violet-400" />
              <span>Durable Payment &amp; Subscription History</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Authoritative records of all renewal, upgrade, and subscription transactions stored permanently in Supabase.
            </p>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            isLoading={isActionLoading}
            className="text-xs text-slate-400 hover:text-white"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Records
          </Button>
        </div>

        {paymentHistory.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-navy-800 rounded-2xl text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">No payment history yet</p>
            <p className="text-[11px] text-slate-500">
              Your 30-day free trial or initial tier requires no payment. Renewal transactions will be permanently tracked here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-navy-800 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                  <th className="pb-3 pr-4">Request Ref</th>
                  <th className="pb-3 px-4">Plan</th>
                  <th className="pb-3 px-4">Amount</th>
                  <th className="pb-3 px-4">UTR Ref</th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 px-4">Date Submitted</th>
                  <th className="pb-3 pl-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800 text-slate-300">
                {paymentHistory.map(item => (
                  <tr key={item.id} className="hover:bg-navy-850/50 transition-colors">
                    <td className="py-3.5 pr-4 font-mono text-[11px] text-violet-300">
                      #{item.id.slice(0, 8)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white capitalize">
                      {item.plan_id.replace('_', ' ')}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      {formatINR(item.amount_paise / 100)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      {item.utr || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          item.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : item.status === 'pending' || item.status === 'pending_verification'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                            : item.status === 'disputed'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(item.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 pl-4 text-[11px] text-slate-400">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate max-w-xs">
                          {item.status === 'approved' && item.verified_at
                            ? `Verified on ${new Date(item.verified_at).toLocaleDateString('en-IN')}`
                            : item.status === 'disputed'
                            ? `Dispute logged: ${item.dispute_reason || 'In review'}`
                            : item.status === 'rejected' && item.rejection_reason
                            ? item.rejection_reason
                            : 'Awaiting manual operations audit'}
                        </span>
                        {item.status === 'rejected' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[10px] text-rose-300 hover:text-white px-2 py-0.5 h-auto border border-rose-500/30 shrink-0"
                            onClick={() => {
                              setDisputeItem(item);
                              setDisputeReason('');
                            }}
                          >
                            Dispute
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dispute Modal for Owners */}
      {disputeItem && (
        <Modal
          isOpen={!!disputeItem}
          onClose={() => {
            setDisputeItem(null);
            setDisputeReason('');
          }}
          title="Dispute Payment Rejection"
          maxWidth="md"
        >
          <form onSubmit={handleDisputeSubmit} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
              <p className="font-bold text-white flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>Re-investigation Request</span>
              </p>
              <p className="text-slate-300">
                Payment request <strong className="text-white">#{disputeItem.id.slice(0, 8)}</strong> was rejected with reason: <span className="text-rose-300 font-medium">"{disputeItem.rejection_reason || 'Bank credit not located'}"</span>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Provide Clarification / Bank Transaction Details: <span className="text-red-400">*</span>
              </label>
              <textarea
                value={disputeReason}
                onChange={e => setDisputeReason(e.target.value)}
                placeholder="e.g. Debited from SBI A/C ending 4589 at 14:20 IST. UTR is 4289... Please verify."
                rows={4}
                className="w-full bg-navy-950 border border-navy-750 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500 leading-relaxed"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDisputeItem(null);
                  setDisputeReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmittingDispute}
                disabled={!disputeReason.trim()}
              >
                Submit Dispute
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};
