import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle2,
  ShieldCheck,
  Building2,
  ArrowRight,
  Sparkles,
  Info,
  HelpCircle,
  Clock,
  Zap,
  Check,
  X
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Navbar } from '../../components/layout/Navbar';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAuth } from '../../context/AuthContext';
import {
  OWNER_SUBSCRIPTION_PLANS,
  calculatePlanPrice,
  formatINR,
  formatListingLimit,
  DEFAULT_GST_RATE
} from '../../utils/pricing';
import { SubscriptionPlanId } from '../../types';

export const PlanSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectPlan, subscription, hasActiveSubscription } = useSubscription();

  const handleSelectAndProceed = (planId: SubscriptionPlanId) => {
    selectPlan(planId);
    navigate('/owner/checkout');
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col">
      <Navbar />
      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
        
          {/* Onboarding Stepper Header */}
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>New PG Owner Welcome Offer</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Start Your <span className="text-gradient-brand">30-Day Free Trial</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Every eligible new PG owner receives a genuine 30-day free trial with Pro management capabilities. Zero payment method or credit card required. Countdown begins when you submit your first PG listing for review.
            </p>

            {/* Stepper Dots */}
            <div className="flex items-center justify-center gap-3 pt-2 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">✓</span>
                <span>1. Account Created</span>
              </span>
              <span className="text-slate-600">→</span>
              <span className="flex items-center gap-1.5 text-violet-300 bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/30">
                <span className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px]">2</span>
                <span>2. 30-Day Free Trial</span>
              </span>
              <span className="text-slate-600">→</span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-5 h-5 rounded-full bg-navy-800 text-slate-400 flex items-center justify-center text-[10px]">3</span>
                <span>3. Register First PG</span>
              </span>
              <span className="text-slate-600">→</span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-5 h-5 rounded-full bg-navy-800 text-slate-400 flex items-center justify-center text-[10px]">4</span>
                <span>4. Owner Dashboard</span>
              </span>
            </div>

            {/* 30-Day Free Trial Highlight Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-violet-950/60 via-navy-900 to-navy-900 border border-violet-500/40 text-left space-y-4 shadow-xl mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-violet-300 bg-violet-500/20 px-2.5 py-0.5 rounded-full border border-violet-500/30">
                      Recommended
                    </span>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      No Credit Card Required
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white mt-1.5">
                    Start your 30-day free trial (Pro Plan Access)
                  </h2>
                  <p className="text-xs text-slate-300 mt-1">
                    Manage up to 3 PG properties, room &amp; bed vacancies, photo uploads, and student enquiries.
                  </p>
                </div>
                <div className="shrink-0">
                  <Button
                    variant="glow"
                    size="lg"
                    onClick={() => navigate('/owner/listings/new')}
                    className="font-bold shadow-lg shadow-violet-500/25"
                  >
                    Activate Free Trial &amp; Register PG →
                  </Button>
                </div>
              </div>

              <div className="pt-3 border-t border-navy-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
                <div>
                  <strong className="text-white block text-[11px]">Countdown Start:</strong>
                  <span>Begins when first PG listing is submitted for review</span>
                </div>
                <div>
                  <strong className="text-white block text-[11px]">Trial Expiry:</strong>
                  <span>Automatic transition to free Basic plan (no auto charges)</span>
                </div>
                <div>
                  <strong className="text-white block text-[11px]">Data Guarantee:</strong>
                  <span>Properties and enquiries are never deleted</span>
                </div>
              </div>
            </div>

            {/* Illustrative GST Notice */}
            <div className="p-3.5 rounded-2xl bg-navy-900/80 border border-navy-750 text-xs text-slate-300 max-w-xl mx-auto flex items-start gap-2.5 text-left">
              <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <p>
                <strong>Or Choose a Direct Paid Tier:</strong> If you already manage a larger portfolio and wish to subscribe immediately, select a plan below. All prices clearly itemize illustrative 18% GST.
              </p>
            </div>
          </div>

        {/* 3 Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
          {OWNER_SUBSCRIPTION_PLANS.map(plan => {
            const price = calculatePlanPrice(plan.basePrice, DEFAULT_GST_RATE);
            const isCurrent = subscription?.plan_id === plan.id && hasActiveSubscription;

            return (
              <div
                key={plan.id}
                className={`rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl transition-all relative ${
                  plan.isRecommended
                    ? 'bg-gradient-to-b from-navy-900 via-navy-900 to-violet-950/40 border-2 border-violet-500/60 shadow-violet-500/10 scale-100 md:-translate-y-2'
                    : 'bg-navy-900/90 border border-navy-800 hover:border-navy-700'
                }`}
              >
                {/* Visual Recommendation Banner */}
                {plan.isRecommended && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-brand-600 text-white text-[11px] font-bold uppercase tracking-wider px-4 py-1 rounded-full shadow-lg border border-white/20">
                    Recommended Plan
                  </div>
                )}

                <div className="space-y-6">
                  {/* Plan Header */}
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-violet-400">
                        {plan.badge || 'SaaS Plan'}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-navy-950 border border-navy-800 text-slate-300">
                        {formatListingLimit(plan.listingLimit)}
                      </span>
                    </div>

                    <h3 className="text-2xl font-black text-white mt-2">{plan.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{plan.tagline}</p>
                  </div>

                  {/* Price Breakdown Box */}
                  <div className="p-4 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-400">Monthly Base:</span>
                      <span className="text-xl font-bold text-white">{formatINR(price.basePrice)}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-xs text-slate-400">
                      <span>GST ({price.gstPercentage}% illustrative):</span>
                      <span className="font-medium text-slate-300">+{formatINR(price.gstAmount)}</span>
                    </div>
                    <div className="pt-2 border-t border-navy-850 flex items-baseline justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Final Total:</span>
                      <div className="text-right">
                        <span className="text-2xl font-black text-emerald-400">{formatINR(price.totalAmount)}</span>
                        <span className="text-[11px] text-slate-400 block font-normal">/ month</span>
                      </div>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-bold text-white uppercase tracking-wider">Plan Entitlements:</p>
                    <ul className="space-y-2.5 text-xs text-slate-300">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Card Action Button */}
                <div className="pt-8 space-y-2">
                  <Button
                    variant={plan.isRecommended ? 'glow' : 'primary'}
                    size="md"
                    className="w-full font-bold"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                    onClick={() => handleSelectAndProceed(plan.id)}
                  >
                    {isCurrent ? 'Current Plan (Manage)' : `Select ${plan.name} Plan`}
                  </Button>
                  <p className="text-[10px] text-center text-slate-500">
                    Proceeds to simulated demo checkout
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Plan Comparison Table */}
        <div className="max-w-5xl mx-auto bg-navy-900/80 border border-navy-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Side-by-Side Feature Comparison</h3>
            <p className="text-xs text-slate-400">Compare owner entitlements and limits across all three tiers</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-navy-800 text-slate-400">
                  <th className="py-3 px-4 font-bold text-white">Feature &amp; Specification</th>
                  <th className="py-3 px-4 font-bold text-white">Basic</th>
                  <th className="py-3 px-4 font-bold text-violet-400">Pro (Recommended)</th>
                  <th className="py-3 px-4 font-bold text-brand-400">Pro Plus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60 text-slate-300">
                <tr>
                  <td className="py-3 px-4 font-semibold text-white">Maximum PG Listings</td>
                  <td className="py-3 px-4">1 PG</td>
                  <td className="py-3 px-4 font-bold text-violet-300">Up to 3 PGs</td>
                  <td className="py-3 px-4 font-bold text-emerald-400">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-white">Monthly Base Price</td>
                  <td className="py-3 px-4">₹49.00</td>
                  <td className="py-3 px-4 font-semibold text-white">₹99.00</td>
                  <td className="py-3 px-4 font-semibold text-white">₹199.00</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-white">Illustrative GST (18%)</td>
                  <td className="py-3 px-4">₹8.82</td>
                  <td className="py-3 px-4">₹17.82</td>
                  <td className="py-3 px-4">₹35.82</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-white">Final Monthly Total</td>
                  <td className="py-3 px-4 font-bold text-white">₹57.82</td>
                  <td className="py-3 px-4 font-bold text-emerald-400">₹116.82</td>
                  <td className="py-3 px-4 font-bold text-emerald-400">₹234.82</td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Room &amp; Bed Vacancy Matrix</td>
                  <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-400" /></td>
                  <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-400" /></td>
                  <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-400" /></td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Student Visit &amp; Enquiry Inbox</td>
                  <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-400" /></td>
                  <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-400" /></td>
                  <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-400" /></td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Portfolio Occupancy Overview</td>
                  <td className="py-3 px-4"><X className="w-4 h-4 text-slate-600" /></td>
                  <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-400" /></td>
                  <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-400" /></td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Portfolio Revenue Analytics</td>
                  <td className="py-3 px-4"><X className="w-4 h-4 text-slate-600" /></td>
                  <td className="py-3 px-4 text-slate-400">Basic</td>
                  <td className="py-3 px-4 font-semibold text-brand-300">Advanced</td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Priority Support (Proposed)</td>
                  <td className="py-3 px-4"><X className="w-4 h-4 text-slate-600" /></td>
                  <td className="py-3 px-4"><X className="w-4 h-4 text-slate-600" /></td>
                  <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-400" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Frequently Asked Questions */}
        <div className="max-w-3xl mx-auto space-y-4 pt-4">
          <h4 className="text-center font-bold text-white text-base">Subscription Questions</h4>
          <div className="space-y-3 text-xs text-slate-300">
            <div className="p-4 rounded-2xl bg-navy-900 border border-navy-800 space-y-1">
              <p className="font-bold text-white">Why is a subscription mandatory for PG owners?</p>
              <p className="text-slate-400 leading-relaxed">
                Rento provides dedicated SaaS tools for live bed tracking, student visit scheduling, and operations audit verification. Subscriptions ensure zero brokerage fees for students while maintaining physical verification standards.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-navy-900 border border-navy-800 space-y-1">
              <p className="font-bold text-white">Can I upgrade from Basic to Pro later?</p>
              <p className="text-slate-400 leading-relaxed">
                Yes! You can upgrade your plan at any time from your Owner Subscription settings. Additional property capacity is unlocked immediately upon simulated checkout.
              </p>
            </div>
          </div>
        </div>

      </div>
      </main>
    </div>
  );
};
