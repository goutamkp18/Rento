import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  AlertCircle,
  FileText,
  User,
  GraduationCap,
  Building2,
  RefreshCw,
  Eye,
  Check,
  X,
  Hash,
  Copy,
  AlertTriangle,
  FileSpreadsheet,
  ShieldAlert,
  ChevronRight,
  CheckSquare,
  HelpCircle,
  Calendar,
  Sparkles
} from 'lucide-react';
import { PaymentRequest, PaymentRequestStatus, RiskLevel, ReconciliationStatus } from '../../types';
import { paymentService } from '../../services/paymentService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { formatINR, getPlanPaymentConfig } from '../../utils/pricing';

export const AdminPaymentsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filters & Tabs
  const [statusFilter, setStatusFilter] = useState<'all' | 'high_risk' | 'disputed' | PaymentRequestStatus>('pending_verification');
  const [typeFilter, setTypeFilter] = useState<'all' | 'student' | 'owner'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detailed payment inspection modal
  const [selectedInspectReq, setSelectedInspectReq] = useState<PaymentRequest | null>(null);

  // Approval verification modal
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [requestToApprove, setRequestToApprove] = useState<PaymentRequest | null>(null);

  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('UPI reference number (UTR) not found in our bank statement.');

  // Triage & Reconciliation modal
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [requestToReconcile, setRequestToReconcile] = useState<PaymentRequest | null>(null);
  const [reconcileDecision, setReconcileDecision] = useState<ReconciliationStatus>('confirmed_credit');
  const [reconcileNotes, setReconcileNotes] = useState('');

  // Bank statement matching tool modal
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [statementText, setStatementText] = useState('');
  const [statementMatchResult, setStatementMatchResult] = useState<{
    matched: Array<{ request: PaymentRequest; line: string; statementUtr: string; statementAmount?: number }>;
    unmatchedRequests: PaymentRequest[];
    unmatchedStatementLines: string[];
    amountMismatches: Array<{ request: PaymentRequest; expectedAmount: number; statementAmount: number }>;
  } | null>(null);

  // Image preview modal with secure signed URL
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const data = await paymentService.getAllPaymentRequestsForAdmin();
      setRequests(data);
    } catch (err: any) {
      console.error('Failed to load payment requests:', err);
      showToast({
        type: 'error',
        title: 'Query Error',
        message: err?.message || 'Could not fetch payment requests from Supabase.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleOpenApproveModal = (request: PaymentRequest) => {
    setRequestToApprove(request);
    setApproveModalOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!requestToApprove) return;

    setIsProcessing(true);
    try {
      await paymentService.adminVerifyPayment(requestToApprove.id, 'approve');
      showToast({
        type: 'success',
        title: 'Payment Verified & Approved',
        message: `Entitlement successfully activated in Supabase for ${requestToApprove.user_type === 'student' ? 'student' : 'owner'}.`,
      });
      setApproveModalOpen(false);
      setRequestToApprove(null);
      if (selectedInspectReq?.id === requestToApprove.id) {
        setSelectedInspectReq(null);
      }
      await loadRequests();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Approval Error',
        message: err?.message || 'Could not approve payment.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenRejectModal = (request: PaymentRequest) => {
    setSelectedRequest(request);
    setRejectionReason('UPI reference number (UTR) not found in our bank statement.');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedRequest) return;

    if (!rejectionReason.trim()) {
      showToast({
        type: 'error',
        title: 'Rejection Reason Required',
        message: 'Please provide a clear reason so the resident/owner understands why the transaction was rejected.',
      });
      return;
    }

    setIsProcessing(true);
    try {
      await paymentService.adminVerifyPayment(selectedRequest.id, 'reject', rejectionReason.trim());
      showToast({
        type: 'info',
        title: 'Payment Request Rejected',
        message: 'Status updated to rejected and provisional privileges suspended.',
      });
      setRejectModalOpen(false);
      setSelectedRequest(null);
      if (selectedInspectReq?.id === selectedRequest.id) {
        setSelectedInspectReq(null);
      }
      await loadRequests();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Rejection Error',
        message: err?.message || 'Could not reject payment request.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenReconcileModal = (request: PaymentRequest) => {
    setRequestToReconcile(request);
    setReconcileDecision('confirmed_credit');
    setReconcileNotes('');
    setReconcileModalOpen(true);
  };

  const handleConfirmReconcile = async () => {
    if (!requestToReconcile) return;

    setIsProcessing(true);
    try {
      await paymentService.adminReconcilePayment(
        requestToReconcile.id,
        reconcileDecision,
        reconcileNotes.trim() || undefined
      );

      showToast({
        type: 'success',
        title: 'Reconciliation Recorded',
        message: `Decision "${reconcileDecision}" saved to audit trail.`,
      });

      setReconcileModalOpen(false);
      setRequestToReconcile(null);
      if (selectedInspectReq?.id === requestToReconcile.id) {
        setSelectedInspectReq(null);
      }
      await loadRequests();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Reconciliation Error',
        message: err?.message || 'Could not record reconciliation decision.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunStatementReconciliation = async () => {
    if (!statementText.trim()) {
      showToast({
        type: 'error',
        title: 'Input Required',
        message: 'Please paste bank statement lines or transaction records.',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const lines = statementText.split('\n');
      const result = await paymentService.reconcileWithBankStatement(lines);
      setStatementMatchResult(result);
      showToast({
        type: 'info',
        title: 'Statement Parsed',
        message: `Found ${result.matched.length} matched credits and ${result.amountMismatches.length} amount discrepancies.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Reconciliation Failed',
        message: err?.message || 'Could not parse statement.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenReceiptPreview = async (pathOrUrl?: string) => {
    if (!pathOrUrl) return;
    try {
      const signedUrl = await paymentService.getReceiptSignedUrl(pathOrUrl);
      setPreviewImageUrl(signedUrl || pathOrUrl);
    } catch {
      setPreviewImageUrl(pathOrUrl);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast({
      type: 'info',
      title: 'Copied',
      message: `${label} copied to clipboard`,
    });
  };

  // Metrics
  const pendingVerificationCount = requests.filter(r => r.status === 'pending_verification').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const highRiskCount = requests.filter(r => r.risk_level === 'high' || (r.risk_score && r.risk_score >= 70)).length;
  const disputedCount = requests.filter(r => r.status === 'disputed' || r.is_disputed).length;
  const studentCount = requests.filter(r => r.user_type === 'student').length;
  const ownerCount = requests.filter(r => r.user_type === 'owner').length;

  // Filtered list
  const filteredRequests = requests.filter(req => {
    // Status / Special queue filter
    if (statusFilter === 'high_risk') {
      const isHigh = req.risk_level === 'high' || (req.risk_score !== undefined && req.risk_score >= 70);
      if (!isHigh) return false;
    } else if (statusFilter === 'disputed') {
      if (req.status !== 'disputed' && !req.is_disputed) return false;
    } else if (statusFilter !== 'all') {
      if (req.status !== statusFilter) return false;
    }

    // Role filter
    if (typeFilter !== 'all' && req.user_type !== typeFilter) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = req.reference?.toLowerCase().includes(q);
      const matchUtr = req.utr?.toLowerCase().includes(q);
      const matchId = req.id.toLowerCase().includes(q);
      const matchName = req.user_profile?.full_name?.toLowerCase().includes(q);
      const matchEmail = req.user_profile?.email?.toLowerCase().includes(q);
      const matchPlan = req.plan_id.toLowerCase().includes(q);
      const matchFlag = req.risk_flags?.some(f => f.toLowerCase().includes(q));

      if (!matchRef && !matchUtr && !matchId && !matchName && !matchEmail && !matchPlan && !matchFlag) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Page Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-navy-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Payment Anti-Fraud &amp; Daily Bank Reconciliation
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Verify manual UPI transfers against received bank credits. Enforce global UTR uniqueness, review automated OCR consistency signals, triage risk flags, and record idempotent activation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatementModalOpen(true)}
            leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-400" />}
            className="border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-300 font-semibold"
          >
            Reconcile Bank Statement
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadRequests}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* KPI Triage Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div
          onClick={() => setStatusFilter('pending_verification')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'pending_verification'
              ? 'bg-amber-950/40 border-amber-500/50 shadow-lg shadow-amber-500/10'
              : 'bg-navy-900/90 border-navy-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Needs Verification</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 animate-pulse" />
            </div>
          </div>
          <p className="text-xl font-black text-white mt-2">{pendingVerificationCount}</p>
          <p className="text-[10px] text-amber-400 font-medium mt-0.5">Awaiting bank reconciliation</p>
        </div>

        <div
          onClick={() => setStatusFilter('high_risk')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'high_risk'
              ? 'bg-red-950/40 border-red-500/50 shadow-lg shadow-red-500/10'
              : 'bg-navy-900/90 border-navy-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">High Risk Queue</span>
            <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl font-black text-white mt-2">{highRiskCount}</p>
          <p className="text-[10px] text-red-400 font-medium mt-0.5">Score &ge; 70 or mismatch flags</p>
        </div>

        <div
          onClick={() => setStatusFilter('disputed')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'disputed'
              ? 'bg-purple-950/40 border-purple-500/50 shadow-lg shadow-purple-500/10'
              : 'bg-navy-900/90 border-navy-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Disputed Submissions</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl font-black text-white mt-2">{disputedCount}</p>
          <p className="text-[10px] text-purple-400 font-medium mt-0.5">User appeals awaiting review</p>
        </div>

        <div
          onClick={() => setStatusFilter('approved')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'approved'
              ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
              : 'bg-navy-900/90 border-navy-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Approved Payments</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl font-black text-white mt-2">{approvedCount}</p>
          <p className="text-[10px] text-emerald-400 font-medium mt-0.5">Authoritative subscriptions</p>
        </div>

        <div
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'all'
              ? 'bg-brand-950/40 border-brand-500/50 shadow-lg shadow-brand-500/10'
              : 'bg-navy-900/90 border-navy-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Total Requests</span>
            <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl font-black text-white mt-2">{requests.length}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">{studentCount} Stu • {ownerCount} Own</p>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-navy-900 border border-navy-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-navy-950 rounded-xl border border-navy-800 text-xs w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('pending_verification')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
              statusFilter === 'pending_verification'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Needs Verification ({pendingVerificationCount})
          </button>
          <button
            onClick={() => setStatusFilter('high_risk')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
              statusFilter === 'high_risk'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            High Risk ({highRiskCount})
          </button>
          <button
            onClick={() => setStatusFilter('disputed')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
              statusFilter === 'disputed'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Disputes ({disputedCount})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
              statusFilter === 'approved'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
              statusFilter === 'rejected'
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Rejected
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
              statusFilter === 'all'
                ? 'bg-brand-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({requests.length})
          </button>
        </div>

        {/* Type Filter & Search Bar */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 p-1 bg-navy-950 rounded-xl border border-navy-800 text-xs shrink-0">
            {(['all', 'student', 'owner'] as const).map(tp => (
              <button
                key={tp}
                onClick={() => setTypeFilter(tp)}
                className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-all ${
                  typeFilter === tp ? 'bg-navy-800 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tp === 'all' ? 'All Roles' : tp}
              </button>
            ))}
          </div>

          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search Ref, UTR, name, flag..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-navy-950 border border-navy-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

      </div>

      {/* Main Reconciliation Table */}
      <div className="bg-navy-900 border border-navy-800 rounded-3xl shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-brand-400" />
            <p>Loading payment requests from Supabase...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-400 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-white font-bold text-sm">No payment requests found</p>
            <p className="text-slate-500 max-w-sm mx-auto">
              {statusFilter === 'pending_verification'
                ? 'All submitted payments have been reviewed and reconciled.'
                : 'No payment requests match the current filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-navy-800 text-slate-400 text-[11px] uppercase tracking-wider font-semibold bg-navy-950/60">
                  <th className="py-4 pl-6 pr-4">Reference / User</th>
                  <th className="py-4 px-4">Plan &amp; Amount</th>
                  <th className="py-4 px-4">Submitted UTR vs OCR</th>
                  <th className="py-4 px-4">Receipt</th>
                  <th className="py-4 px-4">Risk &amp; Flags</th>
                  <th className="py-4 px-4">Status &amp; Expiry</th>
                  <th className="py-4 pr-6 text-right">Reconciliation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800 text-slate-300">
                {filteredRequests.map(req => {
                  const isPending = req.status === 'pending_verification' || req.status === 'pending' || req.status === 'disputed';
                  const riskScore = req.risk_score ?? 0;
                  const isHighRisk = req.risk_level === 'high' || riskScore >= 70;
                  const isMedRisk = req.risk_level === 'medium' || (riskScore >= 30 && riskScore < 70);

                  return (
                    <tr
                      key={req.id}
                      className={`hover:bg-navy-850/60 transition-colors ${
                        isHighRisk ? 'bg-red-950/10' : req.status === 'disputed' ? 'bg-purple-950/10' : ''
                      }`}
                    >
                      {/* Reference & User Details */}
                      <td className="py-4 pl-6 pr-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            {req.reference ? (
                              <button
                                type="button"
                                onClick={() => copyText(req.reference!, 'Reference')}
                                className="font-mono text-xs font-bold text-brand-300 hover:text-white flex items-center gap-1"
                                title="Click to copy reference"
                              >
                                <span>{req.reference}</span>
                                <Copy className="w-3 h-3 text-slate-500" />
                              </button>
                            ) : (
                              <span className="font-mono text-[11px] text-slate-500">#{req.id.slice(0, 8)}</span>
                            )}
                            <span className={`inline-block text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                              req.user_type === 'student'
                                ? 'bg-brand-500/10 text-brand-300 border border-brand-500/20'
                                : 'bg-violet-500/10 text-violet-300 border border-violet-500/20'
                            }`}>
                              {req.user_type}
                            </span>
                          </div>

                          <p className="font-semibold text-white text-[11px]">
                            {req.user_profile?.full_name || 'Registered User'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">
                            {req.user_profile?.email || req.user_id}
                          </p>
                        </div>
                      </td>

                      {/* Plan & Amount */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <span className="font-bold text-white capitalize text-[11px]">
                            {req.plan_id.replace('_', ' ')}
                          </span>
                          <p className="text-sm font-black text-white text-gradient-brand">
                            ₹ {((req.amount_paise || 0) / 100).toFixed(2)}
                          </p>
                          {req.ocr_extracted_amount != null && (
                            <p className={`text-[10px] font-mono ${
                              Math.abs(Number(req.ocr_extracted_amount) - (req.amount_paise || 0) / 100) > 0.05
                                ? 'text-red-400 font-bold'
                                : 'text-slate-400'
                            }`}>
                              OCR: ₹{Number(req.ocr_extracted_amount).toFixed(2)}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* UTR vs OCR */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          {req.utr ? (
                            <button
                              type="button"
                              onClick={() => copyText(req.utr!, 'UTR')}
                              className="flex items-center gap-1 font-mono text-xs text-emerald-400 bg-navy-950 px-2 py-1 rounded border border-navy-800 hover:border-emerald-500/50"
                              title="Click to copy UTR"
                            >
                              <span>{req.utr}</span>
                              <Copy className="w-3 h-3 text-slate-500 ml-0.5" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">Not submitted</span>
                          )}

                          {req.ocr_extracted_utr && (
                            <div className="flex items-center gap-1 text-[10px] font-mono">
                              <span className="text-slate-500">OCR:</span>
                              <span className={req.utr === req.ocr_extracted_utr ? 'text-emerald-400' : 'text-amber-400 font-bold'}>
                                {req.ocr_extracted_utr}
                              </span>
                              {req.utr === req.ocr_extracted_utr ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-400 inline" />
                              ) : (
                                <AlertCircle className="w-3 h-3 text-amber-400 inline" />
                              )}
                            </div>
                          )}

                          {req.ocr_detected_app && (
                            <span className="text-[9px] text-slate-400 font-semibold bg-navy-950 px-1.5 py-0.5 rounded border border-navy-800 inline-block">
                              {req.ocr_detected_app}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Receipt Screenshot */}
                      <td className="py-4 px-4">
                        {req.receipt_url || req.receipt_storage_path ? (
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => handleOpenReceiptPreview(req.receipt_storage_path || req.receipt_url)}
                              className="inline-flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 font-semibold underline"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Receipt</span>
                            </button>

                            {req.screenshot_hash && (
                              <p className="text-[9px] font-mono text-slate-500 truncate max-w-[100px]" title={req.screenshot_hash}>
                                SHA: {req.screenshot_hash.slice(0, 8)}...
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500">None attached</span>
                        )}
                      </td>

                      {/* Risk Assessment & Flags */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          {/* Risk Badge */}
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border ${
                              isHighRisk
                                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                : isMedRisk
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            }`}>
                              {isHighRisk && <ShieldAlert className="w-3 h-3 text-red-400" />}
                              <span>{req.risk_level || (riskScore >= 70 ? 'HIGH' : riskScore >= 30 ? 'MED' : 'LOW')}</span>
                              <span>({riskScore})</span>
                            </span>

                            <button
                              type="button"
                              onClick={() => setSelectedInspectReq(req)}
                              className="text-[10px] text-slate-400 hover:text-white underline"
                              title="Inspect full fraud flags and consistency report"
                            >
                              Audit Details
                            </button>
                          </div>

                          {/* Risk Flag Badges */}
                          {req.risk_flags && req.risk_flags.length > 0 && (
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {req.risk_flags.slice(0, 2).map((flag, idx) => (
                                <span
                                  key={idx}
                                  className="text-[9px] font-mono bg-red-950/60 text-red-300 px-1.5 py-0.5 rounded border border-red-500/30 truncate"
                                  title={flag}
                                >
                                  {flag.replace(/_/g, ' ')}
                                </span>
                              ))}
                              {req.risk_flags.length > 2 && (
                                <span className="text-[9px] text-slate-400 font-mono">
                                  +{req.risk_flags.length - 2} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status & Expiry */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          {req.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Confirmed</span>
                            </span>
                          ) : req.status === 'rejected' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                              <XCircle className="w-3 h-3" />
                              <span>Rejected</span>
                            </span>
                          ) : req.status === 'disputed' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Disputed</span>
                            </span>
                          ) : req.status === 'pending_verification' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                              <Clock className="w-3 h-3" />
                              <span>Pending Verification</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                              <span>{req.status}</span>
                            </span>
                          )}

                          <p className="text-[10px] text-slate-500">
                            {new Date(req.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </td>

                      {/* Action Column */}
                      <td className="py-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending ? (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] px-2.5 py-1"
                                onClick={() => handleOpenApproveModal(req)}
                                title="Confirm credit received and activate entitlement"
                              >
                                Quick Verify
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-[11px] px-2 py-1"
                                onClick={() => handleOpenReconcileModal(req)}
                                title="Triage reconciliation (amount mismatch, credit not found, investigate)"
                              >
                                Triage
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                className="border-red-500/40 text-red-400 hover:bg-red-500/10 text-[11px] px-2 py-1"
                                onClick={() => handleOpenRejectModal(req)}
                                title="Reject payment with reason"
                              >
                                Reject
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-slate-400 hover:text-white text-[11px]"
                              onClick={() => setSelectedInspectReq(req)}
                            >
                              Inspect Details
                            </Button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAILED INSPECTION MODAL */}
      <Modal
        isOpen={Boolean(selectedInspectReq)}
        onClose={() => setSelectedInspectReq(null)}
        title="Payment Consistency &amp; Fraud Audit Report"
        maxWidth="lg"
      >
        {selectedInspectReq && (
          <div className="space-y-5 text-xs max-h-[80vh] overflow-y-auto pr-1">
            
            {/* Header Status Summary */}
            <div className="p-4 rounded-2xl bg-navy-950 border border-navy-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Request Identifier</span>
                <p className="font-mono text-base font-bold text-white">
                  {selectedInspectReq.reference || `#${selectedInspectReq.id.slice(0, 8)}`}
                </p>
                <p className="text-[11px] text-slate-400">
                  User: {selectedInspectReq.user_profile?.full_name} ({selectedInspectReq.user_profile?.email})
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400">Risk Assessment</span>
                <div>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase border mt-1 ${
                    selectedInspectReq.risk_level === 'high' || (selectedInspectReq.risk_score && selectedInspectReq.risk_score >= 70)
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : selectedInspectReq.risk_level === 'medium' || (selectedInspectReq.risk_score && selectedInspectReq.risk_score >= 30)
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Score: {selectedInspectReq.risk_score ?? 0} / 100</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Consistency Check Comparison Grid */}
            <div className="p-4 rounded-2xl bg-navy-950/70 border border-navy-800 space-y-3">
              <p className="font-bold text-white text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span>Form Submission vs. OCR Extraction Consistency</span>
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                <div className="p-3 rounded-xl bg-navy-900 border border-navy-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">UTR Reference</span>
                  <p className="font-mono text-xs font-bold text-white">Form: {selectedInspectReq.utr || 'N/A'}</p>
                  <p className="font-mono text-xs text-slate-400">OCR: {selectedInspectReq.ocr_extracted_utr || 'Not detected'}</p>
                </div>

                <div className="p-3 rounded-xl bg-navy-900 border border-navy-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Plan Amount</span>
                  <p className="font-mono text-xs font-bold text-emerald-400">Expected: ₹{((selectedInspectReq.amount_paise || 0) / 100).toFixed(2)}</p>
                  <p className="font-mono text-xs text-slate-400">
                    OCR: {selectedInspectReq.ocr_extracted_amount != null ? `₹${Number(selectedInspectReq.ocr_extracted_amount).toFixed(2)}` : 'Not detected'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-navy-900 border border-navy-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Transaction Status</span>
                  <p className="font-mono text-xs text-slate-300">Database: {selectedInspectReq.status}</p>
                  <p className="font-mono text-xs text-slate-400">OCR: {selectedInspectReq.ocr_extracted_status || 'UNKNOWN'}</p>
                </div>

                <div className="p-3 rounded-xl bg-navy-900 border border-navy-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Detected Payment App</span>
                  <p className="font-mono text-xs text-white">{selectedInspectReq.ocr_detected_app || 'Standard UPI App'}</p>
                  <p className="font-mono text-xs text-slate-400">Payee: {selectedInspectReq.ocr_extracted_payee || 'gangadhar.66@superyes'}</p>
                </div>
              </div>

              {/* Mismatch Reasons & Flags */}
              {selectedInspectReq.mismatch_reasons && selectedInspectReq.mismatch_reasons.length > 0 && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1 text-red-300">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    <span>Consistency Mismatch Flags:</span>
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-red-200/90">
                    {selectedInspectReq.mismatch_reasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Receipt Image & Hash */}
            {selectedInspectReq.receipt_storage_path || selectedInspectReq.receipt_url ? (
              <div className="p-4 rounded-2xl bg-navy-950/70 border border-navy-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">Attached Payment Receipt:</span>
                  <button
                    type="button"
                    onClick={() => handleOpenReceiptPreview(selectedInspectReq.receipt_storage_path || selectedInspectReq.receipt_url)}
                    className="text-[11px] text-brand-400 hover:text-brand-300 underline font-semibold flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open High-Res Preview</span>
                  </button>
                </div>

                {selectedInspectReq.screenshot_hash && (
                  <p className="text-[10px] font-mono text-slate-400">
                    SHA-256 Checksum: <span className="text-white">{selectedInspectReq.screenshot_hash}</span>
                  </p>
                )}

                {selectedInspectReq.ocr_raw_text && (
                  <div className="p-3 rounded-xl bg-navy-900 border border-navy-800 text-[10px] font-mono text-slate-400 max-h-32 overflow-y-auto whitespace-pre-wrap">
                    <span className="text-slate-500 block mb-1 uppercase font-bold">Raw OCR Extracted Text:</span>
                    {selectedInspectReq.ocr_raw_text}
                  </div>
                )}
              </div>
            ) : null}

            {/* Dispute details if present */}
            {selectedInspectReq.is_disputed && (
              <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 space-y-1.5">
                <p className="font-bold text-purple-300 flex items-center gap-1 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-purple-400" />
                  <span>Resident Dispute Statement:</span>
                </p>
                <p className="text-slate-200 text-xs italic bg-navy-950 p-2.5 rounded-xl border border-navy-800">
                  &ldquo;{selectedInspectReq.dispute_reason}&rdquo;
                </p>
                {selectedInspectReq.disputed_at && (
                  <p className="text-[10px] text-slate-400">
                    Submitted on {new Date(selectedInspectReq.disputed_at).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-navy-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedInspectReq(null)}
              >
                Close Audit
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                onClick={() => handleOpenReconcileModal(selectedInspectReq)}
              >
                Triage &amp; Reconcile
              </Button>

              <Button
                variant="primary"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                onClick={() => handleOpenApproveModal(selectedInspectReq)}
              >
                Confirm Bank Credit &amp; Activate
              </Button>
            </div>

          </div>
        )}
      </Modal>

      {/* BANK STATEMENT RECONCILIATION MODAL */}
      <Modal
        isOpen={statementModalOpen}
        onClose={() => setStatementModalOpen(false)}
        title="Daily Bank Statement Reconciliation"
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-navy-950 border border-navy-800 space-y-1.5 leading-relaxed">
            <p className="font-bold text-white flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Import &amp; Cross-Check Received Bank Transactions</span>
            </p>
            <p className="text-slate-300 text-[11px]">
              Paste statement lines, credit entries or transaction IDs from your mobile banking app or export. The engine automatically matches submitted UTRs against verified credit entries.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Paste Statement Records (One transaction per line)
            </label>
            <textarea
              rows={5}
              value={statementText}
              onChange={e => setStatementText(e.target.value)}
              placeholder={`e.g.
428912345678 CR INR 9.00 UPI/gangadhar.66@superyes
AXI42891234567 CR INR 99.00 TRANSFER
428998765432 CR INR 49.00 UPI`}
              className="w-full bg-navy-950 border border-navy-800 rounded-xl p-3 font-mono text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatementText('');
                setStatementMatchResult(null);
                setStatementModalOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 font-bold"
              onClick={handleRunStatementReconciliation}
              isLoading={isProcessing}
            >
              Cross-Check Records
            </Button>
          </div>

          {/* Statement Match Results Display */}
          {statementMatchResult && (
            <div className="p-4 rounded-2xl bg-navy-950 border border-navy-800 space-y-3 animate-fadeIn">
              <p className="font-bold text-white text-xs">Reconciliation Analysis Result:</p>

              <div className="space-y-2">
                {/* Matched Credits */}
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 space-y-1">
                  <p className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{statementMatchResult.matched.length} Verified Bank Credits Matched:</span>
                  </p>
                  {statementMatchResult.matched.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">No matching UTRs found in statement.</p>
                  ) : (
                    <div className="space-y-1 pt-1">
                      {statementMatchResult.matched.map((m, idx) => (
                        <div key={idx} className="flex items-center justify-between font-mono text-[11px] bg-navy-900 p-2 rounded-lg">
                          <span>UTR: {m.statementUtr} ({m.request.user_profile?.full_name})</span>
                          <span className="text-emerald-400 font-bold">₹{m.statementAmount || (m.request.amount_paise / 100)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Amount Mismatches */}
                {statementMatchResult.amountMismatches.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 space-y-1">
                    <p className="font-bold text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>{statementMatchResult.amountMismatches.length} Amount Discrepancies:</span>
                    </p>
                    <div className="space-y-1 pt-1">
                      {statementMatchResult.amountMismatches.map((m, idx) => (
                        <div key={idx} className="flex items-center justify-between font-mono text-[11px] bg-navy-900 p-2 rounded-lg">
                          <span>{m.request.reference} ({m.request.user_profile?.full_name})</span>
                          <span className="text-amber-400">Statement: ₹{m.statementAmount} vs Plan: ₹{m.expectedAmount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unmatched Requests */}
                <div className="p-3 rounded-xl bg-navy-900 border border-navy-800 space-y-1">
                  <p className="font-semibold text-slate-300 text-[11px]">
                    {statementMatchResult.unmatchedRequests.length} Pending Requests Awaiting Credit in Statement:
                  </p>
                  <p className="text-[10px] text-slate-400">
                    These submitted payments could not be found in the pasted statement lines.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </Modal>

      {/* TRIAGE / RECONCILIATION MODAL */}
      <Modal
        isOpen={reconcileModalOpen}
        onClose={() => setReconcileModalOpen(false)}
        title="Record Daily Reconciliation Decision"
        maxWidth="md"
      >
        {requestToReconcile && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-navy-950 border border-navy-800 font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Reference:</span>
                <span className="text-white font-bold">{requestToReconcile.reference || requestToReconcile.id.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Submitted UTR:</span>
                <span className="text-emerald-400 font-bold">{requestToReconcile.utr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Expected Price:</span>
                <span className="text-white">₹ {((requestToReconcile.amount_paise || 0) / 100).toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Reconciliation Outcome
              </label>
              <select
                value={reconcileDecision}
                onChange={e => setReconcileDecision(e.target.value as ReconciliationStatus)}
                className="w-full bg-navy-950 border border-navy-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="confirmed_credit">Confirmed credit received in bank account</option>
                <option value="credit_not_found">Credit not found in bank records</option>
                <option value="amount_mismatch">Amount mismatch with plan price</option>
                <option value="duplicate_transaction">Duplicate transaction reference</option>
                <option value="investigating">Needs further investigation / Bank delay</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Audit Notes / Findings
              </label>
              <textarea
                rows={3}
                value={reconcileNotes}
                onChange={e => setReconcileNotes(e.target.value)}
                placeholder="Enter details about statement credit matching, time stamps, or bank communication..."
                className="w-full bg-navy-950 border border-navy-800 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReconcileModalOpen(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-brand-600 hover:bg-brand-500 font-bold"
                onClick={handleConfirmReconcile}
                isLoading={isProcessing}
              >
                Save Reconciliation Decision
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* CONFIRM APPROVE MODAL */}
      <Modal
        isOpen={approveModalOpen}
        onClose={() => setApproveModalOpen(false)}
        title="Confirm Bank Credit Verification"
        maxWidth="md"
      >
        {requestToApprove && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-white">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Manual Bank Reconciliation Required</span>
              </p>
              <p className="text-slate-300 text-[11px]">
                Do not treat a screenshot or OCR match as proof of credit. Please confirm that the funds have cleared in your official UPI account or bank statement.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-navy-950 border border-navy-800 space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Reference:</span>
                <span className="font-bold text-white">{requestToApprove.reference || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Submitted UTR:</span>
                <span className="font-bold text-emerald-400">{requestToApprove.utr || 'NOT_SUBMITTED'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Expected Amount:</span>
                <span className="font-bold text-white text-sm">₹ {((requestToApprove.amount_paise || 0) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">User:</span>
                <span className="text-slate-300">{requestToApprove.user_profile?.full_name} ({requestToApprove.user_profile?.email})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Entitlement to Grant:</span>
                <span className="text-violet-300 uppercase font-bold">{requestToApprove.plan_id.replace('_', ' ')}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApproveModalOpen(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 font-bold"
                onClick={handleConfirmApprove}
                isLoading={isProcessing}
              >
                I Confirm Credit Received — Activate Entitlement
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* REJECT MODAL */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Payment Request"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            Specify a clear reason for rejecting payment request{' '}
            <strong className="text-white font-mono">#{selectedRequest?.id.slice(0, 8)}</strong>:
          </p>

          <div className="space-y-2">
            {[
              'UPI reference number (UTR) not found in our bank statement.',
              'Payment screenshot appears to show a pending or failed transaction.',
              'Reused screenshot: Image hash already submitted by another account.',
              'Submitted UTR does not match the UTR extracted from payment screenshot.',
              'Received credit amount does not match the selected subscription plan.',
              'Duplicate transaction reference already credited to another subscription.',
              'Payment was made to an unauthorized third-party UPI VPA.'
            ].map((reason, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setRejectionReason(reason)}
                className={`w-full text-left p-2.5 rounded-xl border text-[11px] transition-all ${
                  rejectionReason === reason
                    ? 'bg-red-500/10 border-red-500/40 text-red-200'
                    : 'bg-navy-950 border-navy-800 text-slate-400 hover:text-white'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Custom Rejection Note
            </label>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              className="w-full bg-navy-950 border border-navy-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectModalOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-red-600 hover:bg-red-500 font-bold"
              onClick={handleConfirmReject}
              isLoading={isProcessing}
            >
              Confirm Rejection &amp; Suspend Access
            </Button>
          </div>
        </div>
      </Modal>

      {/* IMAGE PREVIEW MODAL */}
      <Modal
        isOpen={Boolean(previewImageUrl)}
        onClose={() => setPreviewImageUrl(null)}
        title="Payment Receipt Screenshot"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="bg-black/90 rounded-2xl p-2 flex items-center justify-center max-h-[70vh] overflow-hidden">
            <img
              src={previewImageUrl || ''}
              alt="Payment Receipt"
              className="max-h-[65vh] w-auto object-contain rounded-xl"
            />
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Confidential Financial Document • Authorized Admin Access Only</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewImageUrl(null)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
