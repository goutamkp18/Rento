import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Building2,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Activity,
  History,
  AlertCircle
} from 'lucide-react';
import { listingsService } from '../../services/listingsService';
import { auditService, AdminAuditLog } from '../../services/auditService';
import { paymentService } from '../../services/paymentService';
import { PGListing, ListingRevision, PaymentRequest } from '../../types';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CreditCard } from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const [listings, setListings] = useState<PGListing[]>([]);
  const [revisions, setRevisions] = useState<(ListingRevision & { listing?: PGListing })[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [allListings, allRevisions, logs, payments] = await Promise.all([
          listingsService.getAllListingsForAdmin(),
          listingsService.getAllPendingRevisionsForAdmin(),
          auditService.getLogs(),
          paymentService.getAllPaymentRequestsForAdmin(),
        ]);
        setListings(allListings);
        setRevisions(allRevisions);
        setAuditLogs(logs);
        setPaymentRequests(payments);
      } catch (e) {
        console.error('Failed to load dashboard data', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const pendingListings = listings.filter(
    l => l.publication_status === 'pending_review' || l.publication_status === 'under_review'
  );
  const totalAwaitingReview = pendingListings.length + revisions.length;
  const publishedListings = listings.filter(l => l.publication_status === 'published');
  const verifiedListings = listings.filter(l => l.verification_status === 'verified');
  const pendingPayments = paymentRequests.filter(r => r.status === 'pending');

  return (
    <div className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Header Banner */}
        <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-brand-950 via-navy-900 to-navy-900 border border-brand-500/20 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-300 text-xs font-semibold border border-brand-500/20">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
              <span>Operations Management Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              System Administration &amp; Moderation
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Inspect submitted PG accommodations, conduct physical safety verification audits, review owner compliance, and verify UPI subscription payments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link to="/admin/payments">
              <Button
                variant={pendingPayments.length > 0 ? 'glow' : 'outline'}
                size="md"
                leftIcon={<CreditCard className="w-4 h-4" />}
              >
                Verify Payments ({pendingPayments.length})
              </Button>
            </Link>
            <Link to="/admin/listings">
              <Button variant="primary" size="md" leftIcon={<Building2 className="w-4 h-4" />}>
                Review Listings ({totalAwaitingReview})
              </Button>
            </Link>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-5 rounded-2xl bg-navy-900/90 border border-navy-800 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Total Properties</span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-white mt-2">{listings.length}</p>
            <p className="text-[11px] text-slate-400 mt-1">Across all registered PG owners</p>
          </div>

          <div className="p-5 rounded-2xl bg-navy-900/90 border border-navy-800 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Pending Payments</span>
              <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-white mt-2">{pendingPayments.length}</p>
            <p className="text-[11px] text-violet-400 font-medium mt-1">
              <Link to="/admin/payments" className="underline hover:text-white">
                Awaiting manual UTR audit →
              </Link>
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-navy-900/90 border border-navy-800 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Awaiting Review</span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-white mt-2">{totalAwaitingReview}</p>
            <p className="text-[11px] text-amber-400 font-medium mt-1">
              {revisions.length} edits • {pendingListings.length} new
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-navy-900/90 border border-navy-800 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Published Publicly</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-white mt-2">{publishedListings.length}</p>
            <p className="text-[11px] text-emerald-400 font-medium mt-1">Live in student search directory</p>
          </div>

          <div className="p-5 rounded-2xl bg-navy-900/90 border border-navy-800 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Verified Properties</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-white mt-2">{verifiedListings.length}</p>
            <p className="text-[11px] text-indigo-300 font-medium mt-1">Passed physical site inspection</p>
          </div>
        </div>

        {/* Two-Column Section: Pending Queue Quick Glance + Audit Trail */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Pending Properties Quick Glance (5 cols) */}
          <div className="lg:col-span-5 bg-navy-900 border border-navy-750 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-navy-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Pending Moderation Queue</h3>
              </div>
              <Link to="/admin/listings" className="text-xs text-brand-400 hover:text-brand-300 font-semibold">
                View All ({totalAwaitingReview}) →
              </Link>
            </div>

            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading queue...</div>
            ) : totalAwaitingReview === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2 border border-dashed border-navy-800 rounded-2xl">
                <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
                <p className="text-slate-300 font-semibold">Queue is clear</p>
                <p>No listings or revisions currently awaiting review.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Pending Revisions first */}
                {revisions.slice(0, 3).map(rev => (
                  <div
                    key={rev.id}
                    className="p-3.5 rounded-2xl bg-violet-950/30 border border-violet-500/30 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                          Property Edit
                        </span>
                        <h4 className="font-bold text-white text-xs line-clamp-1">
                          {rev.proposed_changes.name || rev.listing?.name || 'Property'}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        By {rev.proposed_changes.owner_name || rev.listing?.owner_name} • {new Date(rev.submission_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <Link to="/admin/listings">
                      <Button variant="glow" size="sm" className="text-xs shrink-0">
                        Review Diff
                      </Button>
                    </Link>
                  </div>
                ))}

                {/* Pending New Listings */}
                {pendingListings.slice(0, 3).map(item => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-navy-950/70 border border-navy-800 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          New Listing
                        </span>
                        <h4 className="font-bold text-white text-xs line-clamp-1">{item.name}</h4>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {item.locality}, {item.city} • By {item.owner_name}
                      </p>
                    </div>
                    <Link to="/admin/listings">
                      <Button variant="ghost" size="sm" className="text-xs shrink-0">
                        Review
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Security Audit Log (7 cols) */}
          <div className="lg:col-span-7 bg-navy-900 border border-navy-750 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-navy-800">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-brand-400" />
                <h3 className="text-sm font-bold text-white">Administrative Audit Trail</h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {auditLogs.length} immutable records
              </span>
            </div>

            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading audit trail...</div>
            ) : auditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2 border border-dashed border-navy-800 rounded-2xl">
                <Activity className="w-7 h-7 text-slate-500 mx-auto" />
                <p className="text-slate-300 font-semibold">No audit logs recorded yet</p>
                <p>Administrative approvals, rejections, and verification actions will be recorded here.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                {auditLogs.slice(0, 10).map(log => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl bg-navy-950/80 border border-navy-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white capitalize">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(log.created_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px]">{log.details}</p>
                    {log.rejection_reason && (
                      <p className="text-red-300 text-[11px] bg-red-500/10 p-1.5 rounded-lg border border-red-500/20">
                        Reason: {log.rejection_reason}
                      </p>
                    )}
                    <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
                      <span>Moderator: {log.admin_email}</span>
                      {log.listing_name && <span>Target: {log.listing_name}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
