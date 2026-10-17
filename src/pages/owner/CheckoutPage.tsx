import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Building2,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  XCircle,
  CreditCard,
  QrCode,
  Lock,
  RefreshCw,
  Info,
  Calendar,
  Check
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Navbar } from '../../components/layout/Navbar';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAuth } from '../../context/AuthContext';
import {
  getSubscriptionPlan,
  calculatePlanPrice,
  formatINR,
  formatListingLimit,
  DEFAULT_GST_RATE
} from '../../utils/pricing';
import { SubscriptionPlanId } from '../../types';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const {
    selectedPlan,
    selectPlan,
    simulatePayment,
    isLoading: isSubLoading,
    status
  } = useSubscription();

  const planParam = searchParams.get('plan') as SubscriptionPlanId | null;
  const isUpgrade = searchParams.get('upgrade') === 'true';

  useEffect(() => {
    if (planParam && (planParam === 'basic' || planParam === 'pro' || planParam === 'pro_plus')) {
      selectPlan(planParam);
    }
  }, [planParam, selectPlan]);

  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastPaymentResult, setLastPaymentResult] = useState<'success' | 'failed' | null>(
    status === 'payment_failed' ? 'failed' : null
  );

  const priceBreakdown = calculatePlanPrice(selectedPlan.basePrice, DEFAULT_GST_RATE);

  const handleSimulateSuccess = async () => {
    setIsProcessing(true);
    setLastPaymentResult(null);

    // Realistic brief simulated network processing
    await new Promise(resolve => setTimeout(resolve, 900));

    const ok = await simulatePayment(true);
    setIsProcessing(false);

    if (ok) {
      setLastPaymentResult('success');
      // Forward to PG Registration or Dashboard depending on upgrade vs initial onboarding
      setTimeout(() => {
        if (isUpgrade) {
          navigate('/owner/dashboard');
        } else {
          navigate('/owner/listings/new');
        }
      }, 1200);
    }
  };

  const handleSimulateFailure = async () => {
    setIsProcessing(true);
    setLastPaymentResult(null);

    await new Promise(resolve => setTimeout(resolve, 800));

    await simulatePayment(false);
    setIsProcessing(false);
    setLastPaymentResult('failed');
  };

  const handleCancelAndReturn = () => {
    if (isUpgrade) {
      navigate('/owner/subscription');
    } else {
      navigate('/owner/plans');
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col">
      <Navbar />
      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation & Stepper Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-800">
          <button
            type="button"
            onClick={handleCancelAndReturn}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors self-start"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isUpgrade ? 'Back to Subscription' : 'Back to Plans'}</span>
          </button>

          {/* Stepper Dots */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">✓</span>
              <span>1. Account</span>
            </span>
            <span className="text-slate-600">→</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">✓</span>
              <span>2. Plan</span>
            </span>
            <span className="text-slate-600">→</span>
            <span className="flex items-center gap-1 text-violet-300 bg-violet-500/10 px-2.5 py-0.5 rounded-full border border-violet-500/30">
              <span className="w-4 h-4 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px]">3</span>
              <span>3. Checkout</span>
            </span>
            <span className="text-slate-600">→</span>
            <span className="flex items-center gap-1 text-slate-500">
              <span className="w-4 h-4 rounded-full bg-navy-800 text-slate-400 flex items-center justify-center text-[10px]">4</span>
              <span>4. Register PG</span>
            </span>
          </div>
        </div>

        {/* DEMO MODE HERO BANNER */}
        <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-amber-500/15 via-violet-500/15 to-brand-500/15 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-sm uppercase tracking-wider">
                  Interactive Demo Mode
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  Zero Financial Risk
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                This is a mock checkout interface for hackathon & product demonstration. No real money will be charged, no bank OTP will be triggered, and no payment credentials are required.
              </p>
            </div>
          </div>
        </div>

        {/* Payment Failed Banner (Conditional) */}
        {lastPaymentResult === 'failed' && (
          <div className="rounded-2xl p-4 bg-red-500/10 border border-red-500/30 text-red-200 flex items-start gap-3 animate-fadeIn">
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-bold text-white text-sm">Simulated Payment Declined</p>
              <p className="text-slate-300">
                The simulated transaction was marked as failed. As per Rento policy, PG registration remains locked until an active subscription is confirmed.
              </p>
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setLastPaymentResult(null)}
                  className="font-bold text-red-300 hover:text-white underline"
                >
                  Dismiss & Try Again
                </button>
                <Link to="/owner/plans" className="text-slate-400 hover:text-white underline">
                  Choose a Different Plan
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Payment Success Temporary Splash */}
        {lastPaymentResult === 'success' && (
          <div className="rounded-2xl p-5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 flex items-center gap-3 animate-fadeIn">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-white text-sm">Demo Payment Approved!</p>
              <p className="text-xs text-slate-300 mt-0.5">
                Active demo subscription created. Unlocking the PG registration wizard...
              </p>
            </div>
          </div>
        )}

        {/* Main 2-Column Checkout Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Order Review & Transparent Pricing */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Selected Plan Details */}
            <div className="bg-navy-900 border border-navy-750 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400 bg-violet-500/10 px-2.5 py-1 rounded-full border border-violet-500/20">
                    Selected Owner Plan
                  </span>
                  <h2 className="text-2xl font-black text-white mt-2">
                    {selectedPlan.name} Plan
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedPlan.description}
                  </p>
                </div>

                <div className="text-right">
                  <Badge variant="glow" size="sm">
                    {formatListingLimit(selectedPlan.listingLimit)}
                  </Badge>
                  <p className="text-[11px] text-slate-400 mt-1">Billed Monthly</p>
                </div>
              </div>

              {/* Plan Benefits Checklist */}
              <div className="pt-4 border-t border-navy-800 space-y-2.5 text-xs text-slate-300">
                <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                  Included Entitlements
                </p>
                {selectedPlan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              {/* Tax & Price Breakdown Table */}
              <div className="pt-4 border-t border-navy-800 space-y-3">
                <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                  Transparent Price Calculation
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Monthly Base Subscription</span>
                    <span className="font-semibold text-white">{formatINR(priceBreakdown.basePrice)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span>Illustrative GST ({priceBreakdown.gstRatePercent}%)</span>
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        Indicative
                      </span>
                    </span>
                    <span className="font-semibold text-white">{formatINR(priceBreakdown.gstAmount)}</span>
                  </div>

                  <div className="pt-3 border-t border-navy-800 flex items-baseline justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">Total Amount Due</p>
                      <p className="text-[11px] text-slate-400">Monthly recurring billing</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-white text-gradient-brand">
                        {formatINR(priceBreakdown.totalMonthlyPrice)}
                      </p>
                      <p className="text-[10px] text-slate-400">per month (incl. GST)</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Renewal Terms & Disclaimers */}
              <div className="p-3.5 rounded-2xl bg-navy-950/70 border border-navy-800 text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-2 text-slate-300 font-semibold">
                  <Calendar className="w-3.5 h-3.5 text-violet-400" />
                  <span>Billing Frequency & Renewal Terms</span>
                </div>
                <p>
                  • <strong>Billing Cycle:</strong> Charged monthly on a 30-day recurring basis.
                </p>
                <p>
                  • <strong>Cancellation:</strong> Can be cancelled anytime before the next billing cycle from your Owner Subscription management portal.
                </p>
                <p>
                  • <strong>Tax Treatment Notice:</strong> GST rate of 18% is illustrative for this demonstration and subject to final tax review prior to production launch.
                </p>
              </div>
            </div>

            {/* Back or Change Plan Link */}
            <div className="flex items-center justify-between text-xs px-2 text-slate-400">
              <span>Want to choose a different capacity?</span>
              <Link to="/owner/plans" className="text-violet-400 hover:text-violet-300 font-semibold underline">
                Change Subscription Plan →
              </Link>
            </div>
          </div>

          {/* Right Column: Demo Payment Simulator */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-navy-900 border border-navy-750 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 rounded-full blur-2xl pointer-events-none" />

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span>Demo Payment Gateway</span>
                  </h3>
                  <span className="text-[10px] font-mono bg-violet-500/10 text-violet-300 px-2 py-0.5 rounded border border-violet-500/20">
                    TEST GATEWAY v2
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Choose a simulated payment channel to test the workflow:
                </p>
              </div>

              {/* Simulated Payment Method Selector */}
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-navy-950 rounded-2xl border border-navy-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('upi')}
                  className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'upi'
                      ? 'bg-violet-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-navy-900'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>UPI QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'card'
                      ? 'bg-violet-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-navy-900'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('netbanking')}
                  className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'netbanking'
                      ? 'bg-violet-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-navy-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>NetBanking</span>
                </button>
              </div>

              {/* Channel Visual Mockup */}
              <div className="p-4 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-3">
                {paymentMethod === 'upi' && (
                  <div className="text-center space-y-2">
                    <div className="w-32 h-32 mx-auto rounded-xl bg-white p-2.5 flex items-center justify-center shadow-lg border border-slate-200">
                      <div className="w-full h-full border-2 border-dashed border-navy-900/40 rounded flex flex-col items-center justify-center text-navy-950">
                        <QrCode className="w-16 h-16 text-navy-900" />
                        <span className="text-[9px] font-mono font-bold mt-1">DEMO QR CODE</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Simulated UPI VPA: <span className="font-mono text-violet-300">rento.subscriptions@icici</span>
                    </p>
                  </div>
                )}

                {paymentMethod === 'card' && (
                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-navy-850 to-navy-900 border border-navy-750 text-slate-300 space-y-1">
                      <p className="text-[10px] text-slate-400">Card Number (Simulated)</p>
                      <p className="font-mono text-white text-sm tracking-wider">•••• •••• •••• 4242</p>
                      <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                        <span>EXP: 12/28</span>
                        <span>CVV: •••</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 text-center">
                      Mock test card auto-populated for sandbox demonstration.
                    </p>
                  </div>
                )}

                {paymentMethod === 'netbanking' && (
                  <div className="space-y-2 text-xs text-center py-2">
                    <p className="text-slate-300">Supported Simulated Sandbox Banks:</p>
                    <div className="flex flex-wrap justify-center gap-1.5 text-[10px]">
                      <span className="px-2 py-1 bg-navy-900 rounded border border-navy-750 text-slate-300">HDFC Bank</span>
                      <span className="px-2 py-1 bg-navy-900 rounded border border-navy-750 text-slate-300">ICICI Bank</span>
                      <span className="px-2 py-1 bg-navy-900 rounded border border-navy-750 text-slate-300">SBI</span>
                      <span className="px-2 py-1 bg-navy-900 rounded border border-navy-750 text-slate-300">Axis Bank</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Explicit Mandatory Simulation Actions */}
              <div className="space-y-3 pt-2">
                <Button
                  variant="glow"
                  className="w-full justify-center py-3.5 text-sm"
                  isLoading={isProcessing}
                  onClick={handleSimulateSuccess}
                  leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                >
                  Simulate Successful Payment ({formatINR(priceBreakdown.totalMonthlyPrice)})
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-center py-3 text-xs border-red-500/30 text-red-300 hover:bg-red-500/10 hover:border-red-500/50"
                  disabled={isProcessing}
                  onClick={handleSimulateFailure}
                  leftIcon={<XCircle className="w-4 h-4 text-red-400" />}
                >
                  Simulate Failed Payment
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-center text-xs text-slate-400 hover:text-white"
                  disabled={isProcessing}
                  onClick={handleCancelAndReturn}
                >
                  Cancel and Return
                </Button>
              </div>

              {/* Security Audit Badge */}
              <div className="pt-2 border-t border-navy-800 flex items-center justify-center gap-2 text-[11px] text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Frontend demonstration only • No real banking transaction</span>
              </div>
            </div>
          </div>

        </div>

      </div>
      </main>
    </div>
  );
};
