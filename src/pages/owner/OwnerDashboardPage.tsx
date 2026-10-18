import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  BedDouble,
  Inbox,
  TrendingUp,
  Plus,
  ArrowRight,
  ShieldCheck,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  Users,
  IndianRupee,
  Wrench,
  CreditCard,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Trash2,
  Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { PGListing, Enquiry } from '../../types';
import { listingsService } from '../../services/listingsService';
import { enquiriesService } from '../../services/enquiriesService';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  calculatePlanPrice,
  formatINR,
  formatListingLimit,
  DEFAULT_GST_RATE
} from '../../utils/pricing';

export const OwnerDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const {
    currentPlan,
    subscription,
    hasActiveSubscription,
    canAddListing,
    listingLimit,
    listingCount: subListingCount,
    remainingCapacity,
    capacityReason,
    trialInfo,
    isTrialActive,
    isTrialEligible,
    isTrialExpired,
    activeListingId,
    setActiveListingForBasic,
  } = useSubscription();
  const { showToast } = useToast();

  const [listings, setListings] = useState<PGListing[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listingToDelete, setListingToDelete] = useState<PGListing | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteListing = async () => {
    if (!listingToDelete) return;
    setIsDeleting(true);
    try {
      await listingsService.deleteListing(listingToDelete.id);
      setListings(prev => prev.filter(l => l.id !== listingToDelete.id));
      showToast({
        type: 'success',
        title: 'Property Permanently Deleted',
        message: `"${listingToDelete.name}" and all associated photos, rooms and data were deleted.`,
      });
      setListingToDelete(null);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Could not delete listing. Please try again.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);

    Promise.all([
      listingsService.getOwnerListings(user.id),
      enquiriesService.getOwnerEnquiries(user.id),
    ]).then(([ownerListings, ownerEnquiries]) => {
      setListings(ownerListings);
      setEnquiries(ownerEnquiries);
      setIsLoading(false);
    });
  }, [user]);

  // Aggregate metrics derived dynamically from actual demo state
  const totalListings = listings.length;
  const publishedListings = listings.filter(l => l.publication_status === 'published').length;
  const pendingReviewListings = listings.filter(
    l => l.publication_status === 'pending_review' || l.publication_status === 'under_review'
  ).length;
  const draftListings = listings.filter(l => l.publication_status === 'draft').length;

  let totalBedsCapacity = 0;
  let totalAvailableBeds = 0;

  listings.forEach(l => {
    if (l.rooms && l.rooms.length > 0) {
      l.rooms.forEach(r => {
        totalBedsCapacity += r.total_capacity;
        totalAvailableBeds += r.available_beds;
      });
    }
  });

  const occupiedBeds = Math.max(0, totalBedsCapacity - totalAvailableBeds);
  const occupancyPercentage =
    totalBedsCapacity > 0 ? Math.round((occupiedBeds / totalBedsCapacity) * 100) : 0;

  const pendingVisits = enquiries.filter(
    e => e.enquiry_type === 'visit_request' && e.status === 'submitted'
  );

  return (
    <div className="space-y-8 pb-12">

      {/* Top Welcome Banner */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-violet-950 via-navy-900 to-navy-900 border border-violet-500/20 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 text-violet-300 text-xs font-semibold border border-violet-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Property Operations &amp; SaaS Suite</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Welcome back, {user?.full_name || 'Owner'} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Monitor real-time student bed vacancies, handle physical visit appointments, and oversee accommodation audit progress.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canAddListing ? (
            <Link to="/owner/listings/new">
              <Button variant="glow" size="md" leftIcon={<Plus className="w-4 h-4" />}>
                Add New Listing
              </Button>
            </Link>
          ) : (
            <div className="relative group" title={capacityReason || 'Listing limit reached. Upgrade to add more.'}>
              <Button
                variant="secondary"
                size="md"
                disabled
                leftIcon={<Plus className="w-4 h-4" />}
                className="opacity-60 cursor-not-allowed"
              >
                Add New Listing (Limit Reached)
              </Button>
            </div>
          )}
          <Link to="/owner/subscription">
            <Button variant="outline" size="md" leftIcon={<TrendingUp className="w-4 h-4 text-violet-400" />}>
              Upgrade Plan
            </Button>
          </Link>
          <Link to="/owner/enquiries">
            <Button variant="secondary" size="md" leftIcon={<Inbox className="w-4 h-4" />}>
              Inbox ({pendingVisits.length} Pending)
            </Button>
          </Link>
        </div>
      </div>

      {/* Reminder Alerts for 7 Days, 3 Days, 1 Day */}
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
                  ? `Final Day Reminder: 30-Day Free Trial Expires Soon!`
                  : trialInfo.reminderStage === '3_days'
                  ? `3 Days Remaining on Your 30-Day Free Trial`
                  : `7 Days Remaining on Your 30-Day Free Trial`}
              </p>
              <p className="text-xs leading-relaxed text-slate-300">
                {trialInfo.reminderStage === '1_day'
                  ? `Your trial expires on ${trialInfo.endDate ? new Date(trialInfo.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'soon'} (${trialInfo.hoursRemaining} hours left). You will automatically switch to the free Basic plan (1 PG limit). No credit card will be charged.`
                  : trialInfo.reminderStage === '3_days'
                  ? `Your trial ends on ${trialInfo.endDate ? new Date(trialInfo.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'soon'}. Upgrade to Pro to continue managing up to 3 listings seamlessly, or switch to the free Basic plan.`
                  : `You have 7 days left to explore all Pro features without payment. At expiry, you smoothly transition to the free Basic plan (1 listing limit). Zero automatic charges.`}
              </p>
            </div>
          </div>
          <Link to="/owner/subscription" className="shrink-0">
            <Button
              variant={trialInfo.reminderStage === '1_day' ? 'primary' : 'outline'}
              size="sm"
              className="text-xs font-bold"
            >
              View Upgrade Options →
            </Button>
          </Link>
        </div>
      )}

      {/* Trial Expired Alert with Active Listing Selector */}
      {isTrialExpired && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-white text-sm">30-Day Free Trial Has Expired</p>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  Your account has switched to the free Basic plan (1 active PG listing limit). <strong>You were not charged.</strong> All your properties, rooms, beds, and enquiries have been safely preserved.
                  {totalListings > 1 &&
                    ` Since you have ${totalListings} listings saved, please designate which listing remains active, or upgrade to Pro to keep all properties active.`}
                </p>
              </div>
            </div>
            <Link to="/owner/subscription" className="shrink-0">
              <Button variant="glow" size="sm" className="font-bold text-xs">
                Upgrade to Pro (₹99/mo)
              </Button>
            </Link>
          </div>

          {/* Active Listing Chooser for Basic Plan */}
          {totalListings > 1 && (
            <div className="pt-3 border-t border-amber-500/20 space-y-2">
              <span className="font-bold text-white text-xs block">
                Choose Which Property Remains Active on Free Basic Plan:
              </span>
              <div className="flex flex-wrap gap-2">
                {listings.map(l => {
                  const isActive = activeListingId ? activeListingId === l.id : listings[0]?.id === l.id;
                  return (
                    <button
                      key={l.id}
                      onClick={() => setActiveListingForBasic(l.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                          : 'bg-navy-950 border-navy-800 text-slate-400 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      <span>{isActive ? '✓ Active:' : 'Select:'}</span>
                      <span>{l.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 30-Day Free Trial / Plan Entitlements & Capacity Card */}
      <div className="rounded-3xl p-6 sm:p-7 bg-navy-900 border border-navy-750 shadow-2xl space-y-6">
        
        {/* Top Trial Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-navy-800">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-brand-500/20 border border-violet-500/30 text-violet-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  {isTrialActive
                    ? '30-Day Free Trial Active'
                    : isTrialEligible
                    ? 'Start your 30-day free trial'
                    : isTrialExpired
                    ? 'Free Basic Plan (Trial Expired)'
                    : `${currentPlan?.name || 'SaaS'} Plan`}
                </h2>
                {isTrialActive ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {trialInfo.daysRemaining} Days Left
                  </span>
                ) : isTrialEligible ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                    No Credit Card Required
                  </span>
                ) : isTrialExpired ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    Free Tier (1 PG Limit)
                  </span>
                ) : hasActiveSubscription ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Active Paid Plan
                  </span>
                ) : null}
              </div>

              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {isTrialActive
                  ? `Your 30-day free trial started when you submitted your first listing for review. Enjoy access to room & bed management, photo uploads, and student enquiries.`
                  : isTrialEligible
                  ? `Eligible new PG owner free trial. Countdown begins when you submit your first PG listing for review. Full access to add properties, upload photos, manage beds, and receive enquiries.`
                  : isTrialExpired
                  ? `Your trial period has concluded. Your account was automatically switched to the free Basic plan with zero charges. Upgrade anytime to restore multi-property capacity.`
                  : currentPlan?.description || 'Manage properties with Rento owner suite.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {isTrialEligible && canAddListing && (
              <Link to="/owner/listings/new">
                <Button variant="glow" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                  Create First Listing
                </Button>
              </Link>
            )}
            <Link to="/owner/subscription">
              <Button variant="outline" size="sm" leftIcon={<TrendingUp className="w-3.5 h-3.5 text-violet-400" />}>
                {isTrialActive ? 'Upgrade / Manage Trial' : 'Subscription Details'}
              </Button>
            </Link>
          </div>
        </div>

        {/* Trial Dates & Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-1">
            <span className="text-slate-400 text-[11px] block font-medium">Trial Start Date</span>
            <p className="text-sm font-bold text-white">
              {trialInfo.startDate
                ? new Date(trialInfo.startDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Pending First Listing'}
            </p>
            <span className="text-[10px] text-slate-500 block">
              {trialInfo.hasStarted ? 'Countdown begun' : 'Starts on review submission'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-1">
            <span className="text-slate-400 text-[11px] block font-medium">Trial Expiry Date</span>
            <p className="text-sm font-bold text-white">
              {trialInfo.endDate
                ? new Date(trialInfo.endDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '+30 Days From First PG'}
            </p>
            <span className="text-[10px] text-slate-500 block">
              {isTrialExpired ? 'Expired — Switched to Basic' : 'No auto-debit at expiry'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-1">
            <span className="text-slate-400 text-[11px] block font-medium">Days Remaining</span>
            <p className="text-sm font-bold text-gradient-brand">
              {isTrialActive
                ? `${trialInfo.daysRemaining} Days (${trialInfo.hoursRemaining} hrs)`
                : isTrialEligible
                ? '30 Days Available'
                : isTrialExpired
                ? '0 Days (Expired)'
                : 'N/A (Paid Active)'}
            </p>
            <span className="text-[10px] text-slate-500 block">
              {isTrialActive ? 'Live countdown' : 'Ready to start'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-1">
            <span className="text-slate-400 text-[11px] block font-medium">Auto-Billing Status</span>
            <p className="text-sm font-bold text-emerald-400">₹0.00 (Zero Charge)</p>
            <span className="text-[10px] text-slate-500 block">
              No credit card required
            </span>
          </div>
        </div>

        {/* Capacity Bar & Limits */}
        <div className="pt-2 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Active Listings: <strong className="text-white">{totalListings}</strong> of{' '}
              <strong className="text-violet-300">
                {listingLimit === Infinity ? 'Unlimited' : `${listingLimit} PGs`}
              </strong>
            </span>
            <span className="text-slate-400 text-[11px]">
              {listingLimit === Infinity
                ? 'Unlimited capacity'
                : remainingCapacity > 0
                ? `${remainingCapacity} slot${remainingCapacity !== 1 ? 's' : ''} remaining`
                : 'Maximum limit reached'}
            </span>
          </div>

          <div className="w-full bg-navy-950 rounded-full h-2 overflow-hidden border border-navy-800">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                listingLimit === Infinity
                  ? 'bg-gradient-to-r from-violet-500 to-brand-400 w-full'
                  : totalListings >= listingLimit
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-brand-500 to-violet-500'
              }`}
              style={{
                width: `${
                  listingLimit === Infinity
                    ? 100
                    : Math.min(100, Math.round((totalListings / listingLimit) * 100))
                }%`,
              }}
            />
          </div>

          {!canAddListing && !isTrialExpired && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between gap-2 mt-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {capacityReason || `Listing limit reached (${listingLimit} PG${listingLimit > 1 ? 's' : ''}). Upgrade to Pro Plus to add more properties.`}
                </span>
              </div>
              <Link to="/owner/subscription" className="shrink-0 font-bold underline hover:text-white text-[11px]">
                Upgrade Now →
              </Link>
            </div>
          )}
        </div>

        {/* What Happens at Expiry & Transparent Pricing Explanation */}
        <div className="p-4 rounded-2xl bg-navy-950/70 border border-navy-800 text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-2 font-bold text-white text-xs">
            <Info className="w-4 h-4 text-brand-400" />
            <span>What happens when the 30-day trial expires?</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            At expiry, you will <strong>never be charged automatically</strong>. Your account smoothly transitions to the free Basic plan (1 PG listing limit). All your property records, room inventories, uploaded photos, and student enquiry history are safely preserved. Upgrade options: Starter (₹49/mo + 18% GST = ₹57.82), Pro (₹99/mo + 18% GST = ₹116.82), Pro Plus (₹199/mo + 18% GST = ₹234.82).
          </p>
        </div>

      </div>

      {/* Dynamic KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Metric 1: Total Listings Breakdown */}
        <div className="bg-navy-900/90 border border-navy-800 rounded-2xl p-5 shadow-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Properties</span>
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="pt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white">{totalListings}</span>
            <span className="text-xs text-emerald-400 font-semibold">
              ({publishedListings} Published)
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            {pendingReviewListings > 0 ? (
              <span className="text-amber-300 font-medium">
                {pendingReviewListings} Pending Audit
              </span>
            ) : draftListings > 0 ? (
              <span className="text-slate-400">{draftListings} in Draft</span>
            ) : (
              <span>All properties active</span>
            )}
          </p>
        </div>

        {/* Metric 2: Live Bed Inventory */}
        <div className="bg-navy-900/90 border border-navy-800 rounded-2xl p-5 shadow-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Available Beds</span>
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
              <BedDouble className="w-4 h-4" />
            </div>
          </div>
          <div className="pt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white">{totalAvailableBeds}</span>
            <span className="text-xs text-slate-400">/ {totalBedsCapacity} total beds</span>
          </div>
          <p className="text-[11px] text-brand-400 font-medium">Ready for immediate move-in</p>
        </div>

        {/* Metric 3: Occupancy Rate */}
        <div className="bg-navy-900/90 border border-navy-800 rounded-2xl p-5 shadow-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Occupancy Rate</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="pt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">{occupancyPercentage}%</span>
            <span className="text-xs text-slate-400">({occupiedBeds} occupied)</span>
          </div>
          <div className="w-full bg-navy-950 rounded-full h-1.5 mt-1 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${occupancyPercentage}%` }}
            />
          </div>
        </div>

        {/* Metric 4: Incoming Enquiries & Visits */}
        <div className="bg-navy-900/90 border border-navy-800 rounded-2xl p-5 shadow-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Student Inquiries</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="pt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white">{enquiries.length}</span>
            <span className="text-xs text-amber-400 font-medium">
              ({pendingVisits.length} visits to confirm)
            </span>
          </div>
          <Link
            to="/owner/enquiries"
            className="text-[11px] text-brand-400 font-semibold flex items-center gap-1 hover:underline pt-0.5"
          >
            <span>Open student inbox</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

      </div>

      {/* Two Column Section: Properties Bed Matrix + Recent Enquiries */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Left: Properties Bed Summary & Controls (7 cols) */}
        <div className="lg:col-span-7 bg-navy-900/80 border border-navy-800 rounded-3xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-violet-400" />
              <h2 className="text-base font-bold text-white">My Properties Bed Summary</h2>
            </div>
            <Link
              to="/owner/listings"
              className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
            >
              Manage All ({listings.length})
            </Link>
          </div>

          <div className="space-y-4">
            {listings.map(item => {
              const cap = item.rooms?.reduce((acc, r) => acc + r.total_capacity, 0) || 20;
              const avail = item.rooms?.reduce((acc, r) => acc + r.available_beds, 0) || 6;
              const occPercent = cap > 0 ? Math.round(((cap - avail) / cap) * 100) : 0;

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 rounded-2xl bg-navy-950/80 border border-navy-800 hover:border-navy-700 transition-colors space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <img
                        src={item.images[0]?.image_url || 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=300&q=80'}
                        alt={item.name}
                        className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-navy-800"
                      />
                      <div>
                        <h4 className="font-bold text-white text-sm sm:text-base">{item.name}</h4>
                        <p className="text-xs text-slate-400">{item.locality}, {item.city}</p>
                        <p className="text-[11px] text-brand-300 font-medium mt-0.5">
                          ₹{item.min_monthly_rent.toLocaleString()} - ₹{item.max_monthly_rent.toLocaleString()} / mo
                        </p>
                      </div>
                    </div>

                    {/* Both Publication Status AND Verification Status */}
                    <div className="flex items-center sm:flex-col items-end gap-1.5 shrink-0">
                      <Badge variant={item.publication_status} size="sm" />
                      <Badge variant={item.verification_status} size="sm" />
                    </div>
                  </div>

                  {/* Bed Capacity Bar */}
                  <div className="pt-1 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        Capacity: <strong className="text-white">{cap} beds</strong> ({avail} vacant)
                      </span>
                      <span className="font-bold text-brand-300">{occPercent}% occupied</span>
                    </div>

                    <div className="w-full bg-navy-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-brand-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${occPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Property Action Controls */}
                  <div className="flex items-center justify-between pt-2 border-t border-navy-850 text-xs">
                    <span className="text-[11px] text-slate-500">
                      ID: {item.id.slice(0, 12)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Link to={`/owner/listings/${item.id}/rooms`}>
                        <button className="px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-slate-200 border border-navy-800 font-medium transition-colors">
                          Manage Beds
                        </button>
                      </Link>
                      <Link to={`/owner/listings/${item.id}/edit`}>
                        <button className="px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-slate-200 border border-navy-800 font-medium transition-colors">
                          Edit Property
                        </button>
                      </Link>
                      <button
                        onClick={() => setListingToDelete(item)}
                        title="Delete property from website and database"
                        className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-medium transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Urgent Student Inquiries Inbox (5 cols) */}
        <div className="lg:col-span-5 bg-navy-900/80 border border-navy-800 rounded-3xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox className="w-5 h-5 text-brand-400" />
              <h2 className="text-base font-bold text-white">Student Inquiries &amp; Visits</h2>
            </div>
            <Link
              to="/owner/enquiries"
              className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
            >
              Open Inbox ({enquiries.length})
            </Link>
          </div>

          <div className="space-y-3">
            {enquiries.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No inquiries submitted yet.
              </div>
            ) : (
              enquiries.slice(0, 4).map(enq => (
                <div
                  key={enq.id}
                  className="p-4 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-2 text-xs hover:border-navy-750 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white text-sm block">{enq.student_name}</span>
                      <span className="text-[11px] text-slate-400">{enq.listing_name}</span>
                    </div>
                    <Badge variant={enq.status} size="sm" />
                  </div>
                  <p className="text-slate-300 line-clamp-2 leading-relaxed">{enq.message}</p>

                  {enq.requested_visit_date && (
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Visit: {enq.requested_visit_date}</span>
                      </span>
                      <span>{enq.requested_visit_time_slot || '11:00 AM - 1:00 PM'}</span>
                    </div>
                  )}

                  {enq.owner_response && (
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">
                      <strong>Your Reply:</strong> {enq.owner_response}
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <Link to="/owner/enquiries">
                      <span className="text-[11px] text-brand-400 font-semibold hover:underline flex items-center gap-1">
                        <span>Respond in inbox</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ADDITIONAL MANAGEMENT MODULES & SUBSCRIPTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Module 1: Tenant & Rent Management Placeholder */}
        <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-6 space-y-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <IndianRupee className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              Active Module
            </span>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Tenant &amp; Rent Collections</h3>
            <p className="text-xs text-slate-400 mt-1">
              Active Student Leases: <strong className="text-white">0</strong>
            </p>
          </div>
          <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Signed Leases:</span>
              <span className="text-white font-semibold">0 active</span>
            </div>
            <div className="flex justify-between">
              <span>Pending Digital Agreements:</span>
              <span className="text-slate-400 font-semibold">None</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Digital rent receipts, e-signatures and tenant KYC records will be recorded as students move in.
          </p>
        </div>

        {/* Module 2: Maintenance & Tickets */}
        <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-6 space-y-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              Active Module
            </span>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Maintenance &amp; Service Tickets</h3>
            <p className="text-xs text-slate-400 mt-1">
              Premise issues reported by student residents.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 text-[11px] text-slate-400">
            <span>No maintenance tickets currently open.</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Student residents can raise service requests directly from their student portal.
          </p>
        </div>

        {/* Module 3: Subscription & Pricing Information */}
        <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-6 space-y-4 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${hasActiveSubscription ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>
                {hasActiveSubscription ? 'Active Subscription' : 'No Active Plan'}
              </span>
            </div>
            <div className="mt-3">
              <h3 className="text-base font-bold text-white">
                {hasActiveSubscription ? currentPlan?.name : 'Subscription Required'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {hasActiveSubscription && subscription
                  ? `${formatINR(subscription.total_price)}/month · ${listings.length}/${formatListingLimit(currentPlan?.listingLimit ?? 1)} Properties Listed`
                  : 'Subscribe to list accommodations on Rento.'}
              </p>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300 pt-3 border-t border-navy-800 mt-3">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Live bed vacancy inventory</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Unified student visit inbox</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Audit verification eligibility</span>
              </li>
            </ul>
          </div>

          <div className="pt-2">
            <Link to={hasActiveSubscription ? "/owner/subscription" : "/owner/plans"} className="block w-full">
              <Button variant="secondary" size="sm" className="w-full">
                {hasActiveSubscription ? "Manage Subscription" : "Choose a Plan"}
              </Button>
            </Link>
          </div>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {listingToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-navy-750 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Property?</h3>
                <p className="text-xs text-slate-400">This action cannot be undone</p>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-2 bg-navy-950/80 p-4 rounded-2xl border border-navy-800">
              <p>
                Are you sure you want to permanently delete{' '}
                <strong className="text-white font-semibold">"{listingToDelete.name}"</strong>?
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px] pt-1">
                <li>Deleted from website search and customer listings</li>
                <li>All room and bed sharing configurations erased</li>
                <li>All uploaded premise photos deleted from Supabase Storage</li>
                <li>All related student inquiries erased</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setListingToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleDeleteListing}
                isLoading={isDeleting}
                leftIcon={<Trash2 className="w-4 h-4" />}
              >
                Yes, Delete Property
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
