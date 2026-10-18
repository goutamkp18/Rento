import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  ArrowRight,
  Building2,
  GraduationCap,
  Info,
  Check,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useStudentSubscription } from '../../context/StudentSubscriptionContext';
import { useSubscription } from '../../context/SubscriptionContext';
import {
  OWNER_SUBSCRIPTION_PLANS,
  STUDENT_SUBSCRIPTION_PLAN,
  calculatePlanPrice,
  formatINR,
  formatListingLimit,
  DEFAULT_GST_RATE
} from '../../utils/pricing';
import { SubscriptionPlanId } from '../../types';

export const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { hasStudentSubscription, openPaywall } = useStudentSubscription();
  const { trialInfo, isTrialActive, isTrialEligible, isTrialExpired } = useSubscription();
  const [activeSegment, setActiveSegment] = useState<'all' | 'owners' | 'students'>('all');

  const handleStudentAction = () => {
    if (hasStudentSubscription) {
      navigate('/pgs');
    } else {
      openPaywall('activate full student access pass');
    }
  };

  const handleOwnerAction = (planId?: SubscriptionPlanId) => {
    if (isAuthenticated && user?.role === 'owner') {
      navigate(planId ? `/owner/checkout?plan=${planId}` : '/owner/plans');
    } else {
      navigate('/signup?role=owner');
    }
  };

  const handleStartTrial = () => {
    if (isAuthenticated && user?.role === 'owner') {
      navigate('/owner/listings/new');
    } else {
      navigate('/signup?role=owner');
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Title */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-xs font-bold text-violet-400 uppercase tracking-widest bg-violet-500/10 px-3.5 py-1.5 rounded-full border border-violet-500/20">
            Transparent Pricing Structure
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Plans for Students & <span className="text-gradient-brand">PG Owners</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Free basic browsing for everyone. Students activate the ₹ 9 pass to unlock owner messaging, visits, booking, live directions & comparisons. Owners subscribe from ₹ 49/mo to list and manage accommodations.
          </p>

          {/* Transparent GST Notice */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 max-w-xl mx-auto flex items-start gap-3 text-left">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Transparent 18% GST Compliance</p>
              <p className="text-slate-300 mt-0.5">
                All subscriptions are billed with standard 18% GST clearly itemized. Starter at ₹ 49, Pro at ₹ 99, Pro Plus at ₹ 199, and Student Pass at ₹ 9.
              </p>
            </div>
          </div>
        </div>

        {/* Student Pass Highlight Banner */}
        <div className="bg-gradient-to-r from-brand-950/70 via-navy-900 to-navy-900 border border-brand-500/30 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <GraduationCap className="w-5 h-5 text-brand-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-brand-400">
                For Students &amp; Residents
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-bold">
                {hasStudentSubscription ? 'Active Pass' : '₹ 9 Only (Incl. GST)'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Rento Student Access Pass — ₹ 9
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Without subscription, students can view general PG overview and rent. Activate your ₹ 9 pass to unlock direct owner messaging, schedule physical room visits, reserve beds online, view exact Google Maps live navigation, and compare up to 3 PGs side-by-side.
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-slate-300 pt-1">
              <span>✓ Direct Owner Chat</span>
              <span>✓ Schedule Room Visits</span>
              <span>✓ Online Bed Reservation</span>
              <span>✓ Google Maps Live Directions</span>
              <span>✓ Multi-PG Comparison</span>
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
            <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 text-right hidden sm:block">
              <div className="text-xl font-black text-emerald-400">₹ 9.00</div>
              <div className="text-[10px] text-slate-400">Base ₹ 7.63 + ₹ 1.37 GST</div>
            </div>
            <Button
              variant="glow"
              size="lg"
              onClick={handleStudentAction}
              className="font-bold shadow-lg shadow-brand-500/25"
            >
              {hasStudentSubscription ? 'Browse Verified PGs →' : 'Unlock Student Pass for ₹ 9 →'}
            </Button>
          </div>
        </div>

        {/* 30-Day Free Trial Banner for PG Owners */}
        <div className="bg-gradient-to-br from-navy-900 via-navy-900 to-violet-950/40 border border-violet-500/35 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          
          {/* Reminders for 7, 3, 1 day (if logged in owner with active trial) */}
          {isTrialActive && trialInfo.reminderStage && (
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                trialInfo.reminderStage === '1_day'
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                  : trialInfo.reminderStage === '3_days'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                  : 'bg-violet-500/10 border-violet-500/30 text-violet-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  {trialInfo.reminderStage === '1_day'
                    ? `Final Day Reminder: Trial ends in ${trialInfo.hoursRemaining} hours. Seamless transition to free Basic plan.`
                    : trialInfo.reminderStage === '3_days'
                    ? `3 Days Remaining on your 30-day free trial. Choose a plan below to retain 3 listing slots.`
                    : `7 Days Remaining on your 30-day free trial. Explore all Pro capabilities with zero charges.`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleOwnerAction('pro')}
                className="font-bold underline hover:text-white shrink-0"
              >
                Upgrade to Pro →
              </button>
            </div>
          )}

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-navy-800">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-violet-300 bg-violet-500/15 px-3 py-1 rounded-full border border-violet-500/30 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  Eligible PG Owners
                </span>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  No Credit Card Required
                </span>
                {isTrialActive && (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    {trialInfo.daysRemaining} Days Remaining
                  </span>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Start your 30-day free trial
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Eligible new PG owners receive a genuine 30-day free trial with access to our Pro management suite. Countdown begins when you submit your first valid PG listing for review.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
              <Button
                variant="glow"
                size="lg"
                onClick={handleStartTrial}
                className="font-bold shadow-lg shadow-violet-500/25"
              >
                {isTrialActive ? 'Open Owner Dashboard →' : 'Start your 30-day free trial →'}
              </Button>
            </div>
          </div>

          {/* Trial Details Grid: Dates, Days, Guarantee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-1">
              <span className="text-slate-400 text-[11px] block">Trial Start Date</span>
              <p className="text-sm font-bold text-white">
                {trialInfo.startDate
                  ? new Date(trialInfo.startDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'On First Listing Review'}
              </p>
              <span className="text-[10px] text-slate-500 block">
                Authoritative server timestamp
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-1">
              <span className="text-slate-400 text-[11px] block">Trial Expiry Date</span>
              <p className="text-sm font-bold text-white">
                {trialInfo.endDate
                  ? new Date(trialInfo.endDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '+30 Days from Submission'}
              </p>
              <span className="text-[10px] text-slate-500 block">
                Zero automatic charges
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-1">
              <span className="text-slate-400 text-[11px] block">Days Remaining</span>
              <p className="text-sm font-bold text-gradient-brand">
                {isTrialActive
                  ? `${trialInfo.daysRemaining} Days (${trialInfo.hoursRemaining}h)`
                  : '30 Days Complete Trial'}
              </p>
              <span className="text-[10px] text-slate-500 block">
                Full Pro tier features
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-1">
              <span className="text-slate-400 text-[11px] block">Payment Method</span>
              <p className="text-sm font-bold text-emerald-400">None Required</p>
              <span className="text-[10px] text-slate-500 block">
                No credit card needed to activate
              </span>
            </div>
          </div>

          {/* Features Included in the Trial */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Features Included in the 30-Day Free Trial
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Manage up to 3 PG properties</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Full room &amp; bed inventory management</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Photo uploads to secure storage</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Student enquiry &amp; visit booking inbox</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Priority placement in student search</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Real-time occupancy analytics &amp; overview</span>
              </div>
            </div>
          </div>

          {/* Explanation of Expiry */}
          <div className="p-4 rounded-2xl bg-navy-950 border border-navy-800 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-white text-xs">
              <Info className="w-4 h-4 text-brand-400" />
              <span>What happens when the 30-day trial expires?</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              When your trial concludes, <strong>you will not be charged automatically</strong>. Your owner account will switch to the free Basic plan (1 PG listing limit). All your property records, room inventories, uploaded photos, and enquiry history remain permanently preserved. If you have more than 1 listing, you can select which listing remains active or upgrade anytime to Starter (₹49/mo + 18% GST = ₹57.82), Pro (₹99/mo + 18% GST = ₹116.82), or Pro Plus (₹199/mo + 18% GST = ₹234.82).
            </p>
          </div>

        </div>

        {/* 3 Owner SaaS Plans Header */}
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              PG Owner Paid Subscription Plans
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Transparent, low monthly tiers with illustrative 18% GST. Upgrade anytime to expand property capacity.
            </p>
          </div>

          {/* 3 Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch pt-4">
            {OWNER_SUBSCRIPTION_PLANS.map(plan => {
              const price = calculatePlanPrice(plan.basePrice, DEFAULT_GST_RATE);

              return (
                <div
                  key={plan.id}
                  className={`bg-navy-900 border rounded-3xl p-8 flex flex-col justify-between shadow-2xl transition-all relative ${
                    plan.isRecommended
                      ? 'border-violet-500 shadow-violet-500/10 ring-1 ring-violet-500/40'
                      : 'border-navy-800 hover:border-navy-700'
                  }`}
                >
                  {plan.isRecommended && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-brand-600 text-white text-[10px] font-extrabold uppercase tracking-widest px-3.5 py-1 rounded-full shadow-lg">
                      Recommended Tier
                    </div>
                  )}

                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
                          {plan.name}
                        </span>
                        <Badge variant={plan.isRecommended ? 'glow' : 'outline'} size="sm">
                          {formatListingLimit(plan.listingLimit)}
                        </Badge>
                      </div>
                      <h3 className="text-2xl font-black text-white mt-1">{plan.name}</h3>
                      <p className="text-xs text-slate-400 mt-1">{plan.description}</p>
                    </div>

                    {/* Price with GST Breakdown */}
                    <div className="p-4 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-1.5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-white">{formatINR(plan.basePrice)}</span>
                        <span className="text-xs text-slate-400">/ month</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-navy-850">
                        <span>+ 18% GST (illustrative)</span>
                        <span className="text-slate-300 font-semibold">{formatINR(price.gstAmount)}</span>
                      </div>
                      <div className="text-xs text-violet-300 font-bold flex items-center justify-between pt-1">
                        <span>Total Monthly Due</span>
                        <span className="text-white font-extrabold">{formatINR(price.totalMonthlyPrice)}</span>
                      </div>
                    </div>

                    {/* Features List */}
                    <div className="space-y-2.5 pt-2 border-t border-navy-800">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Plan Entitlements
                      </p>
                      <ul className="space-y-2 text-xs text-slate-300">
                        {plan.features.map((feat, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-8">
                    <Button
                      variant={plan.isRecommended ? 'glow' : 'outline'}
                      className="w-full justify-center"
                      onClick={() => handleOwnerAction(plan.id)}
                    >
                      Choose {plan.name} →
                    </Button>
                    <p className="text-[10px] text-center text-slate-500 mt-2">
                      Simulated demo checkout • No real charge
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comparison Table */}
        <div className="bg-navy-900 border border-navy-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div>
            <h3 className="text-xl font-bold text-white">Side-by-Side Feature Comparison</h3>
            <p className="text-xs text-slate-400 mt-1">
              Compare owner entitlements across all three proposed subscription tiers
            </p>
          </div>

          <div className="overflow-x-auto scrollbar-none">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-navy-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Feature / Entitlement</th>
                  <th className="py-3 px-4">Basic</th>
                  <th className="py-3 px-4 text-violet-300 font-bold">Pro (Recommended)</th>
                  <th className="py-3 px-4">Pro Plus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60">
                <tr>
                  <td className="py-3 px-4 font-semibold text-white">Monthly Base Price</td>
                  <td className="py-3 px-4 font-bold">₹49</td>
                  <td className="py-3 px-4 font-bold text-violet-300">₹99</td>
                  <td className="py-3 px-4 font-bold">₹199</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-white">18% GST</td>
                  <td className="py-3 px-4">₹8.82</td>
                  <td className="py-3 px-4 text-violet-300 font-semibold">₹17.82</td>
                  <td className="py-3 px-4">₹35.82</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-white">Total Monthly Total</td>
                  <td className="py-3 px-4 font-extrabold text-white">₹57.82</td>
                  <td className="py-3 px-4 font-extrabold text-violet-300">₹116.82</td>
                  <td className="py-3 px-4 font-extrabold text-white">₹234.82</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-white">PG Listing Limit</td>
                  <td className="py-3 px-4">1 Property</td>
                  <td className="py-3 px-4 text-violet-300 font-semibold">Up to 3 Properties</td>
                  <td className="py-3 px-4 font-bold text-emerald-400">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Bed & Room Availability Matrix</td>
                  <td className="py-3 px-4 text-emerald-400">✓ Included</td>
                  <td className="py-3 px-4 text-emerald-400">✓ Included</td>
                  <td className="py-3 px-4 text-emerald-400">✓ Included</td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Student Enquiries & Visit Requests</td>
                  <td className="py-3 px-4 text-emerald-400">✓ Included</td>
                  <td className="py-3 px-4 text-emerald-400">✓ Included</td>
                  <td className="py-3 px-4 text-emerald-400">✓ Included</td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Combined Multi-Property Inbox</td>
                  <td className="py-3 px-4 text-slate-600">—</td>
                  <td className="py-3 px-4 text-emerald-400">✓ Included</td>
                  <td className="py-3 px-4 text-emerald-400">✓ Included</td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Occupancy Overview & Basic Analytics</td>
                  <td className="py-3 px-4 text-slate-600">—</td>
                  <td className="py-3 px-4 text-emerald-400">✓ Included</td>
                  <td className="py-3 px-4 text-emerald-400">✓ Included</td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Advanced Portfolio Analytics</td>
                  <td className="py-3 px-4 text-slate-600">—</td>
                  <td className="py-3 px-4 text-slate-600">—</td>
                  <td className="py-3 px-4 text-emerald-400">✓ Included</td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Priority Support (Proposed)</td>
                  <td className="py-3 px-4 text-slate-600">—</td>
                  <td className="py-3 px-4 text-slate-600">—</td>
                  <td className="py-3 px-4 text-emerald-400">✓ Included</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
