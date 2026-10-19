import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Sparkles,
  Lock,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Upload,
  FileCheck,
  Hash,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  X
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { paymentService } from '../../services/paymentService';
import { studentSubscriptionService } from '../../services/studentSubscriptionService';
import { ocrService } from '../../services/ocrService';
import { getPlanPaymentConfig } from '../../utils/pricing';
import { PaymentRequest } from '../../types';
import { validateUtr, normalizeUtr, UPI_APP_UTR_GUIDE } from '../../utils/utrValidation';

interface StudentPaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
  onSuccess?: () => void;
}

export const StudentPaywallModal: React.FC<StudentPaywallModalProps> = ({
  isOpen,
  onClose,
  reason = 'access premium PG booking, direct enquiries, compare tools and live locations',
  onSuccess,
}) => {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const planConfig = getPlanPaymentConfig('student_pass');
  const [activePaymentReq, setActivePaymentReq] = useState<PaymentRequest | null>(null);
  const [isLoadingReq, setIsLoadingReq] = useState(false);
  const [previousRejection, setPreviousRejection] = useState<string | null>(null);

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
  const [submissionComplete, setSubmissionComplete] = useState<{
    id: string;
    reference?: string;
    utr: string;
  } | null>(null);

  // Initialize or fetch unique payment request before displaying QR
  useEffect(() => {
    let isMounted = true;
    const initPaymentRequest = async () => {
      if (!isOpen || !isAuthenticated || !user) return;
      setIsLoadingReq(true);
      try {
        // Fetch any previous rejection status to show guidance
        const { rejectedRequest } = await studentSubscriptionService.getPaymentStatus(user.id);
        if (rejectedRequest?.rejection_reason && isMounted) {
          setPreviousRejection(rejectedRequest.rejection_reason);
        }

        const req = await paymentService.createPaymentRequest({
          userId: user.id,
          userType: 'student',
          purpose: 'student_lifetime_pass',
          planId: 'student_pass',
        });
        if (isMounted) {
          setActivePaymentReq(req);
        }
      } catch (err) {
        console.warn('Payment request pre-creation notice:', err);
      } finally {
        if (isMounted) setIsLoadingReq(false);
      }
    };

    initPaymentRequest();
    return () => {
      isMounted = false;
    };
  }, [isOpen, isAuthenticated, user]);

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
        // Automatically populate UTR if currently empty
        if (!utr.trim()) {
          setUtr(result.extractedUtr);
        }
        showToast({
          type: 'success',
          title: 'Reference Verified via OCR',
          message: `Detected ${result.extractedUtr.startsWith('T') && result.extractedUtr.length > 15 ? 'Transaction ID' : 'UTR'} ${result.extractedUtr} from receipt.`,
        });
      } else {
        // No UTR or Transaction ID detected in the screenshot
        setReceiptFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setInvalidImageWarning(
          'Invalid image: No UTR or Transaction ID found in this screenshot. Please send the payment image with a visible Transaction ID or 12-digit UTR/UPI reference number.'
        );
        showToast({
          type: 'error',
          title: 'Invalid Image',
          message: 'No UTR or Transaction ID found in screenshot. Please send the payment image with a visible reference.',
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

    if (!isAuthenticated || !user) {
      showToast({
        type: 'error',
        title: 'Authentication Required',
        message: 'Please sign in or create an account to activate your student pass.',
      });
      return;
    }

    if (isScanningReceipt) {
      showToast({
        type: 'info',
        title: 'Scanning Image',
        message: 'Please wait while we check your screenshot for the UTR or Transaction ID...',
      });
      return;
    }

    if (receiptFile && !ocrDetectedUtr) {
      setInvalidImageWarning(
        'Invalid image: No UTR or Transaction ID found in this screenshot. Please send the payment image with a visible Transaction ID or 12-digit UTR/UPI reference number.'
      );
      return;
    }

    if (!utrValidation.isValid) {
      const errMsg = utrValidation.error || 'Please enter a valid UPI transaction reference (UTR or Transaction ID).';
      setSubmissionError(errMsg);
      showToast({
        type: 'error',
        title: 'Invalid Reference Format',
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
        const result = await studentSubscriptionService.submitStudentPaymentRequest({
          studentId: user.id,
          studentName: user.full_name || 'Student Resident',
          studentEmail: user.email || '',
          utr: cleanUtr,
          receiptFile,
        });
        resultReq = result.request;
      }

      setSubmissionComplete({
        id: resultReq.id,
        reference: resultReq.reference || activePaymentReq?.reference,
        utr: cleanUtr,
      });

      showToast({
        type: 'success',
        title: 'Payment Proof Submitted',
        message: 'Your ₹9 payment proof has been saved and marked as pending manual verification by admin.',
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Payment proof submission error:', err);
      const msg = err?.message || 'Could not record payment submission in Supabase. Please try again.';
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

  const handleModalClose = () => {
    setSubmissionComplete(null);
    setUtr('');
    setReceiptFile(null);
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleModalClose}
        title=""
        maxWidth="md"
      >
      <div className="space-y-5 -mt-2">
        
        {/* Header Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-brand-500/20 to-violet-500/20 text-brand-300 text-xs font-bold border border-brand-500/30">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>Rento Student Access Pass</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Unlock Full Access for Just <span className="text-gradient-brand">₹ {planConfig.amountRupees}</span>
          </h2>

          <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
            Without an active subscription, premium PG features are locked. To <strong className="text-white">{reason}</strong>, complete your ₹ {planConfig.amountRupees} UPI payment below.
          </p>
        </div>

        {/* Previous Payment Rejection Notice */}
        {previousRejection && (
          <div className="p-4 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-xs text-rose-200 space-y-1.5 shadow-lg">
            <div className="flex items-center gap-2 font-bold text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Your Previous Payment Request Failed</span>
            </div>
            <p className="text-slate-200 text-xs leading-relaxed">
              Because of this reason: <strong className="text-rose-200 font-bold bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30 font-mono inline-block">"{previousRejection}"</strong>, your previous payment was rejected and temporary access has ended.
            </p>
            <p className="text-rose-300/90 text-[11px] font-semibold pt-0.5">
              👉 Please pay ₹{planConfig.amountRupees} again below, enter your correct 12-digit UPI reference (UTR), and upload a clear screenshot of the payment showing the UTR.
            </p>
          </div>
        )}

        {/* Not Logged In Notice */}
        {!isAuthenticated && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2 text-center">
            <p className="font-bold text-white">Sign In Required</p>
            <p className="text-slate-300">
              Your lifetime pass will be permanently linked to your verified Supabase student account. Please sign in before submitting.
            </p>
            <div className="pt-1">
              <Link to="/auth?mode=login&role=student" onClick={onClose}>
                <Button variant="primary" size="sm" className="w-full">
                  Sign In as Student →
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Successful Submission View */}
        {submissionComplete ? (
          <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Payment Submission Recorded!</h3>
              <p className="text-xs text-emerald-300 font-mono">
                Status: Pending Admin Verification
              </p>
              {submissionComplete.reference && (
                <p className="text-xs text-slate-300 font-mono">
                  Ref: <strong className="text-white">{submissionComplete.reference}</strong> • UTR: {submissionComplete.utr}
                </p>
              )}
            </div>

            {/* Provisional Access Notice */}
            <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/30 text-xs text-brand-200 text-left space-y-1">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-400" />
                <span>Provisional 24-Hour Access Active</span>
              </p>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                You can immediately access direct enquiries, visits, and PG locations while our finance team reconciles your transaction reference against our bank statement.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-navy-950/80 border border-navy-800 text-xs text-slate-300 text-left space-y-1.5 leading-relaxed">
              <p className="font-semibold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Anti-Fraud &amp; Verification Safeguards</span>
              </p>
              <p>
                1. Your normalized UTR and cryptographic receipt hash are recorded in the Supabase audit log.
              </p>
              <p>
                2. Automated OCR and fraud scoring triage the submission for human review.
              </p>
              <p>
                3. Permanent lifetime access activates once admin confirms actual received funds.
              </p>
            </div>

            <Button
              variant="outline"
              size="md"
              className="w-full"
              onClick={handleModalClose}
            >
              Continue to Dashboard
            </Button>
          </div>
        ) : (
          <>
            {/* What gets unlocked checklist */}
            <div className="p-4 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400 block mb-1">
                Included with ₹ 9 Student Pass:
              </span>
              <div className="grid grid-cols-1 gap-2 text-slate-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Send direct enquiries &amp; chat with PG owners</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Schedule free in-person room visits</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Reserve beds &amp; pay advance booking online</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>View exact address, landmark &amp; live Google Maps directions</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Compare multiple PGs side-by-side</span>
                </div>
              </div>
            </div>

            {/* Step-by-Step UPI Payment Form */}
            <form onSubmit={handleSubmitPayment} className="space-y-4">
              
              {/* Payment Request Reference Pill */}
              {activePaymentReq?.reference && (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-navy-900 border border-navy-750 text-xs">
                  <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-brand-400" />
                    <span className="text-slate-400">Payment Reference:</span>
                    <span className="font-mono font-bold text-white">{activePaymentReq.reference}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyRef}
                    className="text-[10px] text-brand-300 hover:text-white font-medium underline"
                  >
                    Copy
                  </button>
                </div>
              )}

              {/* UPI QR & VPA Box */}
              <div className="p-4 rounded-2xl bg-navy-950 border border-navy-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Step 1: Scan &amp; Pay Exact ₹ {planConfig.amountRupees} via UPI
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Official QR
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* QR Box */}
                  <div className="w-36 h-auto rounded-2xl bg-white p-2 shrink-0 flex flex-col items-center justify-center shadow-lg border border-slate-200">
                    <img
                      src={planConfig.qrCodeUrl}
                      alt="Student Pass UPI QR Code"
                      className="w-32 h-auto object-contain rounded-lg"
                      loading="eager"
                    />
                  </div>

                  {/* VPA Info */}
                  <div className="space-y-2 flex-1 min-w-0 text-center sm:text-left">
                    <p className="text-[11px] text-slate-400">Official UPI ID / VPA:</p>
                    <div className="flex items-center gap-1.5 bg-navy-900 px-3 py-1.5 rounded-xl border border-navy-750 justify-between">
                      <span className="font-mono text-xs font-bold text-brand-300 truncate">
                        {planConfig.upiId}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="text-slate-400 hover:text-white p-1"
                        title="Copy UPI ID"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="p-2 rounded-lg bg-navy-900/60 border border-navy-800 text-[10px] text-slate-300 leading-snug">
                      Amount: <strong className="text-emerald-400">₹ {planConfig.amountRupees}.00</strong> (one-time lifetime).
                      Compatible with Google Pay, PhonePe, Paytm, BHIM, CRED &amp; all banks.
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: UTR Reference Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Step 2: Enter UPI Reference (UTR / Transaction ID) <span className="text-red-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAppGuide(!showAppGuide)}
                    className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-1"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>Where to find UTR / Transaction ID?</span>
                    {showAppGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                <Input
                  value={utr}
                  onChange={e => {
                    setUtr(e.target.value);
                    if (submissionError) setSubmissionError(null);
                  }}
                  placeholder="e.g. 428912345678 or T2610101024439827156"
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
                            : `Valid Reference (${utrValidation.detectedAppHint || 'Alphanumeric 10–35'})`}
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
                  <div className="p-3 rounded-xl bg-navy-900 border border-navy-750 space-y-2 text-[11px] text-slate-300 animate-fadeIn">
                    <p className="font-bold text-white text-xs">Finding Your UPI Reference (UTR / Transaction ID):</p>
                    <div className="space-y-1.5">
                      {UPI_APP_UTR_GUIDE.map(app => (
                        <div key={app.appName} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                          <span className="font-semibold text-brand-300 w-24 shrink-0">• {app.appName}:</span>
                          <span className="text-slate-400">{app.fieldLabel} ({app.digits}). {app.notes}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Optional Receipt Upload */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Attach Payment Screenshot / Receipt (with UTR or Transaction ID)
                  </label>
                  <span className="text-[10px] text-brand-400 font-mono">OCR Scanned &amp; Protected</span>
                </div>
                <div className={`relative border border-dashed rounded-xl p-3 text-center transition-colors ${
                  isScanningReceipt
                    ? 'border-brand-500/60 bg-brand-950/20'
                    : ocrDetectedUtr
                    ? 'border-emerald-500/60 bg-emerald-950/20'
                    : 'border-navy-750 hover:border-brand-500/50 bg-navy-950/50'
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
                      <div className="flex items-center gap-2 text-brand-300 font-medium py-0.5">
                        <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
                        <span>Scanning screenshot with OCR for UTR or Transaction ID...</span>
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
                        <span>Click to upload screenshot showing UTR (JPG, PNG max 5MB)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Provisional Access Guarantee Banner */}
              <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-500/30 text-[11px] text-violet-200 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white">Instant 24-Hour Provisional Access:</span>
                  <p className="text-slate-300 mt-0.5">
                    Upon submitting your UTR, you receive immediate 24-hour access to all premium PG features while our admin team audits received bank credits.
                  </p>
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

              {/* Action Button */}
              <div className="space-y-2 pt-2">
                <Button
                  type="submit"
                  variant="glow"
                  size="lg"
                  className="w-full font-bold py-3.5 shadow-xl shadow-brand-500/25 flex items-center justify-center gap-2"
                  isLoading={isProcessing || isLoadingReq || isScanningReceipt}
                  disabled={isProcessing || isLoadingReq || isScanningReceipt || !isAuthenticated || !utrValidation.isValid}
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {isScanningReceipt
                      ? 'Scanning Screenshot...'
                      : previousRejection
                      ? `Pay Again & Submit ₹ ${planConfig.amountRupees} Payment Proof`
                      : `Submit ₹ ${planConfig.amountRupees} Payment for Admin Verification`}
                  </span>
                </Button>

                <p className="text-[10px] text-center text-slate-400 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Authoritative verification: Access unlocks upon admin verification in Supabase</span>
                </p>
              </div>

            </form>
          </>
        )}

      </div>
    </Modal>

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
          <h3 className="text-lg font-bold text-white">No UTR or Transaction ID Found in Screenshot</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Our automated OCR scanner could not detect any 12-digit UPI transaction reference (UTR) or Transaction ID in the uploaded image.
          </p>
          <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs font-semibold leading-relaxed">
            ⚠️ Invalid image: Please send the payment image with a visible UTR or Transaction ID.
          </div>
          <p className="text-[11px] text-slate-400">
            Please take a full screenshot of the completed payment receipt from Google Pay, PhonePe, Paytm, or your banking app where the Transaction ID (e.g. T26...) or 12-digit UTR/RRN is clearly visible.
          </p>
        </div>

        <div className="pt-2">
          <Button
            variant="primary"
            size="md"
            className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold"
            onClick={() => setInvalidImageWarning(null)}
          >
            Upload Payment Image with Reference
          </Button>
        </div>
      </div>
    </Modal>
    </>
  );
};
