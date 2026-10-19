import React, { useState, useEffect, useRef } from 'react';
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
  Lock,
  RefreshCw,
  Info,
  Calendar,
  Check,
  Copy,
  Upload,
  FileCheck,
  Clock,
  Hash,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  X
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Navbar } from '../../components/layout/Navbar';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { paymentService } from '../../services/paymentService';
import { ocrService } from '../../services/ocrService';
import {
  getSubscriptionPlan,
  formatINR,
  formatListingLimit,
  getPlanPaymentConfig
} from '../../utils/pricing';
import { SubscriptionPlanId, PaymentRequest } from '../../types';
import { validateUtr, normalizeUtr, UPI_APP_UTR_GUIDE } from '../../utils/utrValidation';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const {
    selectedPlan,
    selectPlan,
    submitPaymentRequest,
    isLoading: isSubLoading,
    refreshSubscription,
  } = useSubscription();

  const planParam = searchParams.get('plan') as SubscriptionPlanId | null;
  const isUpgrade = searchParams.get('upgrade') === 'true';

  useEffect(() => {
    if (planParam && (planParam === 'basic' || planParam === 'pro' || planParam === 'pro_plus')) {
      selectPlan(planParam);
    }
  }, [planParam, selectPlan]);

  const planConfig = getPlanPaymentConfig(selectedPlan.id);

  const [activePaymentReq, setActivePaymentReq] = useState<PaymentRequest | null>(null);
  const [isLoadingReq, setIsLoadingReq] = useState(false);
  const [utr, setUtr] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [ocrDetectedUtr, setOcrDetectedUtr] = useState<string | null>(null);
  const [invalidImageWarning, setInvalidImageWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [showAppGuide, setShowAppGuide] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);

  // Pre-create unique payment request in Supabase before showing the QR code
  useEffect(() => {
    let isMounted = true;
    const initPaymentReq = async () => {
      if (!user || user.role !== 'owner') return;
      setIsLoadingReq(true);
      try {
        const req = await paymentService.createPaymentRequest({
          userId: user.id,
          userType: 'owner',
          purpose: isUpgrade ? 'owner_subscription_upgrade' : 'owner_subscription_renewal',
          planId: selectedPlan.id,
        });
        if (isMounted) setActivePaymentReq(req);
      } catch (err) {
        console.warn('Owner payment request pre-creation notice:', err);
      } finally {
        if (isMounted) setIsLoadingReq(false);
      }
    };

    initPaymentReq();
    return () => {
      isMounted = false;
    };
  }, [user, selectedPlan.id, isUpgrade]);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(planConfig.upiId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    showToast({
      type: 'info',
      title: 'UPI ID Copied',
      message: `${planConfig.upiId} copied to clipboard`,
    });
  };

  const handleCopyRef = () => {
    if (!activePaymentReq?.reference) return;
    navigator.clipboard.writeText(activePaymentReq.reference);
    showToast({
      type: 'info',
      title: 'Reference Copied',
      message: `${activePaymentReq.reference} copied to clipboard`,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showToast({
        type: 'error',
        title: 'File Too Large',
        message: 'Receipt image must be under 5MB.',
      });
      return;
    }

    setReceiptFile(file);
    setIsScanningReceipt(true);
    setOcrDetectedUtr(null);
    setSubmissionError(null);

    try {
      const result = await ocrService.extractReceiptData(file, planConfig.amountPaise, utr || undefined);
      if (result.extractedUtr) {
        setOcrDetectedUtr(result.extractedUtr);
        if (!utr.trim()) {
          setUtr(result.extractedUtr);
        }
        showToast({
          type: 'success',
          title: 'UTR Verified via OCR',
          message: `Detected UTR ${result.extractedUtr} from receipt.`,
        });
      } else {
        setReceiptFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setInvalidImageWarning(
          'Invalid image: No UTR number found in this screenshot. Please send the payment image with a visible 12-digit UTR/UPI reference number.'
        );
        showToast({
          type: 'error',
          title: 'Invalid Image',
          message: 'No UTR number found in screenshot. Please send the payment image with UTR number.',
        });
      }
    } catch (ocrErr) {
      console.warn('OCR processing notice:', ocrErr);
    } finally {
      setIsScanningReceipt(false);
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    setOcrDetectedUtr(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const utrValidation = validateUtr(utr);

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);

    if (isScanningReceipt) {
      showToast({
        type: 'info',
        title: 'Scanning Image',
        message: 'Please wait while we check your screenshot for the UTR number...',
      });
      return;
    }

    if (receiptFile && !ocrDetectedUtr) {
      setInvalidImageWarning(
        'Invalid image: No UTR number found in this screenshot. Please send the payment image with a visible 12-digit UTR/UPI reference number.'
      );
      return;
    }

    if (!utrValidation.isValid) {
      const errMsg = utrValidation.error || 'Please enter a valid 12-digit UPI reference (UTR).';
      setSubmissionError(errMsg);
      showToast({
        type: 'error',
        title: 'Invalid UTR Format',
        message: errMsg,
      });
      return;
    }

    const cleanUtr = utrValidation.normalizedUtr;
    setIsProcessing(true);

    try {
      let resultReq: PaymentRequest;
      if (activePaymentReq) {
        resultReq = await paymentService.submitPaymentProof({
          paymentId: activePaymentReq.id,
          utr: cleanUtr,
          receiptFile,
        });
      } else {
        resultReq = await submitPaymentRequest(cleanUtr, receiptFile);
      }

      setSubmittedRequestId(resultReq.id);
      showToast({
        type: 'success',
        title: 'Payment Submitted',
        message: 'Your payment proof was recorded with status pending_verification.',
      });

      await refreshSubscription();

      setTimeout(() => {
        navigate('/owner/subscription');
      }, 2500);
    } catch (err: any) {
      const msg = err?.message || 'Could not record payment in Supabase.';
      setSubmissionError(msg);
      showToast({
        type: 'error',
        title: 'Submission Failed',
        message: msg,
      });
    } finally {
      setIsProcessing(false);
    }
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
            onClick={handleCancelAndReturn}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {isUpgrade ? 'Subscription Management' : 'Owner Plans'}</span>
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
              <span>4. Verification</span>
            </span>
          </div>
        </div>

        {/* Verification Notice Banner */}
        <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-violet-950/60 via-navy-900 to-navy-900 border border-violet-500/30 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-violet-500/20 text-violet-300 shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-sm uppercase tracking-wider">
                  Secure Manual UPI Payment Workflow
                </span>
                <span className="text-[10px] bg-violet-500/20 text-violet-300 font-bold px-2 py-0.5 rounded-full border border-violet-500/30">
                  Manual Bank Audit
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                A unique payment request is generated in Supabase. Scan the configured QR code, pay exact <strong>₹ {planConfig.amountRupees}</strong>, and enter your 12-digit UTR. Access activates upon admin verification.
              </p>
            </div>
          </div>
        </div>

        {/* Successful Submission View */}
        {submittedRequestId && (
          <div className="rounded-2xl p-6 bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 flex flex-col sm:flex-row items-center gap-4 animate-fadeIn">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
            <div className="space-y-1">
              <p className="font-bold text-white text-base">Payment Submitted for Admin Verification!</p>
              <p className="text-xs text-slate-300">
                Payment request <strong className="text-white">#{submittedRequestId.slice(0, 8)}</strong> was saved in Supabase with status <span className="font-mono text-emerald-400">pending_verification</span>. Redirecting to your subscription portal...
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
                    {planConfig.description}
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

              {/* Price Calculation Box */}
              <div className="pt-4 border-t border-navy-800 space-y-3">
                <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                  Exact Plan Amount
                </p>

                <div className="space-y-2 text-xs">
                  <div className="pt-2 flex items-baseline justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">Total Amount Due</p>
                      <p className="text-[11px] text-slate-400">Monthly renewal interval</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-white text-gradient-brand">
                        ₹ {planConfig.amountRupees}.00
                      </p>
                      <p className="text-[10px] text-slate-400">Flat price for {selectedPlan.name}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Renewal Terms */}
              <div className="p-3.5 rounded-2xl bg-navy-950/70 border border-navy-800 text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-2 text-slate-300 font-semibold">
                  <Calendar className="w-3.5 h-3.5 text-violet-400" />
                  <span>Billing Frequency &amp; Renewal Terms</span>
                </div>
                <p>
                  • <strong>Billing Period:</strong> 30 days active access per renewal.
                </p>
                <p>
                  • <strong>Listing Safety:</strong> Existing PG listings are never deleted if a subscription expires.
                </p>
                <p>
                  • <strong>No Auto-Charge:</strong> Renewal requires a verified UPI transaction before reactivation.
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

          {/* Right Column: Manual UPI Payment Form */}
          <div className="lg:col-span-5 space-y-6">
            <form onSubmit={handleSubmitPayment} className="bg-navy-900 border border-navy-750 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 rounded-full blur-2xl pointer-events-none" />

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span>UPI Transfer Checkout</span>
                  </h3>
                  <span className="text-[10px] font-mono bg-violet-500/10 text-violet-300 px-2 py-0.5 rounded border border-violet-500/20">
                    INR UPI
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Pay exact <strong>₹ {planConfig.amountRupees}.00</strong> via any UPI App and record your UTR:
                </p>
              </div>

              {/* Payment Request Reference Pill */}
              {activePaymentReq?.reference && (
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-navy-950 border border-navy-800 text-xs">
                  <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-slate-400">Payment Reference:</span>
                    <span className="font-mono font-bold text-white">{activePaymentReq.reference}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyRef}
                    className="text-[10px] text-violet-400 hover:text-white font-medium underline"
                  >
                    Copy
                  </button>
                </div>
              )}

              {/* QR and UPI Box */}
              <div className="p-4 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-3">
                <div className="text-center space-y-3">
                  <div className="w-40 h-auto mx-auto rounded-2xl bg-white p-2.5 flex items-center justify-center shadow-lg border border-slate-200">
                    <img
                      src={planConfig.qrCodeUrl}
                      alt={`${selectedPlan.name} ₹${planConfig.amountRupees} Payment QR Code`}
                      className="w-36 h-auto object-contain rounded-xl"
                      loading="eager"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[11px] text-slate-400">Official Rento UPI VPA:</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono text-xs font-bold text-violet-300 bg-navy-900 px-3 py-1.5 rounded-xl border border-navy-800">
                        {planConfig.upiId}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="text-slate-400 hover:text-white p-1"
                        title="Copy UPI VPA"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Amount: <strong className="text-emerald-400">₹ {planConfig.amountRupees}.00</strong> • Scan with Google Pay, PhonePe, Paytm or BHIM.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2: UTR Reference Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Enter UPI Reference (UTR) <span className="text-red-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAppGuide(!showAppGuide)}
                    className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>Where to find UTR?</span>
                    {showAppGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                <Input
                  value={utr}
                  onChange={e => {
                    setUtr(e.target.value);
                    if (submissionError) setSubmissionError(null);
                  }}
                  placeholder="e.g. 428998765432"
                  className={`font-mono uppercase tracking-wider ${
                    utr && !utrValidation.isValid
                      ? 'border-red-500/50 focus:border-red-500 bg-red-950/20'
                      : utrValidation.isValid
                      ? 'border-emerald-500/50 focus:border-emerald-500 bg-emerald-950/20'
                      : ''
                  }`}
                  required
                />

                {/* Real-time UTR Validation Feedback */}
                {utr.trim().length > 0 && (
                  <div className="pt-0.5">
                    {utrValidation.isValid ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {utrValidation.format === 'npci_12_digit'
                            ? `Valid 12-digit UPI UTR (${utrValidation.detectedAppHint || 'NPCI Format'})`
                            : 'Valid 10–18 character Bank Alphanumeric Reference'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[11px] text-red-400 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{utrValidation.error}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Expandable UPI App Reference Guide */}
                {showAppGuide && (
                  <div className="p-3.5 rounded-xl bg-navy-950 border border-navy-800 space-y-2 text-[11px] text-slate-300 animate-fadeIn">
                    <p className="font-bold text-white text-xs">Finding Your UPI Reference (UTR):</p>
                    <div className="space-y-1.5">
                      {UPI_APP_UTR_GUIDE.map(app => (
                        <div key={app.appName} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                          <span className="font-semibold text-violet-300 w-24 shrink-0">• {app.appName}:</span>
                          <span className="text-slate-400">{app.fieldLabel} ({app.digits}). {app.notes}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Optional Receipt Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Attach Payment Screenshot / Receipt (with UTR)
                  </label>
                  <span className="text-[10px] text-violet-400 font-mono">OCR Scanned</span>
                </div>
                <div className={`relative border border-dashed rounded-xl p-3.5 text-center transition-colors ${
                  isScanningReceipt
                    ? 'border-violet-500/60 bg-violet-950/20'
                    : ocrDetectedUtr
                    ? 'border-emerald-500/60 bg-emerald-950/20'
                    : 'border-navy-750 hover:border-violet-500/50 bg-navy-950/50'
                }`}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={isScanningReceipt}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                    {isScanningReceipt ? (
                      <div className="flex items-center gap-2 text-violet-300 font-medium py-0.5">
                        <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                        <span>Scanning screenshot with OCR for UTR number...</span>
                      </div>
                    ) : receiptFile ? (
                      <div className="flex items-center justify-between w-full px-2">
                        <div className="flex items-center gap-2 truncate">
                          <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="text-white font-medium text-xs truncate max-w-[160px] sm:max-w-xs">{receiptFile.name}</span>
                          {ocrDetectedUtr && (
                            <span className="text-[10px] text-emerald-300 font-bold bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 shrink-0">
                              UTR: {ocrDetectedUtr} ✓
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveReceipt();
                          }}
                          className="p-1 text-slate-400 hover:text-white hover:bg-navy-800 rounded-lg transition-colors z-10"
                          title="Remove screenshot"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span>Upload screenshot showing UTR (JPG, PNG max 5MB)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Submission Error Banner */}
              {submissionError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-300">Payment Submission Blocked</p>
                    <p className="text-[11px] text-red-200/90 mt-0.5">{submissionError}</p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="space-y-3 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full font-bold py-4 shadow-xl shadow-violet-600/25 flex items-center justify-center gap-2 text-base"
                  isLoading={isProcessing || isLoadingReq || isScanningReceipt}
                  disabled={isProcessing || isLoadingReq || isScanningReceipt || !utrValidation.isValid}
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {isScanningReceipt
                      ? 'Scanning Screenshot...'
                      : 'Submit Payment for Admin Verification'}
                  </span>
                </Button>

                <div className="p-3 rounded-xl bg-navy-950/60 border border-navy-800 text-[10px] text-slate-400 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Safe Verification Policy</span>
                  </div>
                  <p>
                    Payments are manually verified by our finance team against actual bank account credits before activation.
                  </p>
                </div>
              </div>

            </form>
          </div>

        </div>

        </div>
      </main>

      {/* INVALID RECEIPT POPUP WARNING MODAL */}
      <Modal
        isOpen={Boolean(invalidImageWarning)}
        onClose={() => setInvalidImageWarning(null)}
        title="Invalid Payment Screenshot"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center p-2">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30 shadow-inner">
            <AlertCircle className="w-8 h-8 text-rose-400" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">No UTR Number Found in Screenshot</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Our automated OCR scanner could not detect any 12-digit UPI transaction reference (UTR) or payment reference in the uploaded image.
            </p>
            <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs font-semibold leading-relaxed">
              ⚠️ Invalid image: Please send the payment image with a visible UTR number.
            </div>
            <p className="text-[11px] text-slate-400">
              Please take a full screenshot of the completed payment receipt from Google Pay, PhonePe, Paytm, or your banking app where the 12-digit UTR/RRN is clearly visible.
            </p>
          </div>

          <div className="pt-2">
            <Button
              variant="primary"
              size="md"
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold"
              onClick={() => setInvalidImageWarning(null)}
            >
              Upload Payment Image with UTR
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
