import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  AlertCircle,
  Building2,
  MapPin,
  Calendar,
  Check,
  X,
  GitCompare,
  ArrowRight,
  Sparkles,
  Layers,
  BedDouble,
  DollarSign,
  ImageIcon,
  UserCheck,
  FileText
} from 'lucide-react';
import { PGListing, ListingRevision, ListingVerificationStatus } from '../../types';
import { listingsService } from '../../services/listingsService';
import { auditService } from '../../services/auditService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

type QueueTab = 'revisions' | 'new_submissions' | 'all';

export const AdminListingsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<QueueTab>('revisions');
  const [listings, setListings] = useState<PGListing[]>([]);
  const [revisions, setRevisions] = useState<(ListingRevision & { listing?: PGListing })[]>([]);
  const [selectedListing, setSelectedListing] = useState<PGListing | null>(null);
  const [selectedRevision, setSelectedRevision] = useState<(ListingRevision & { listing?: PGListing }) | null>(null);

  // Listing rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Revision rejection modal
  const [rejectRevisionModalOpen, setRejectRevisionModalOpen] = useState(false);
  const [rejectRevisionReason, setRejectRevisionReason] = useState('');

  const [verifyNotes, setVerifyNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allListings, allRevisions] = await Promise.all([
        listingsService.getAllListingsForAdmin(),
        listingsService.getAllPendingRevisionsForAdmin(),
      ]);

      setListings(allListings);
      setRevisions(allRevisions);

      // Default selection based on pending revisions first
      if (allRevisions.length > 0) {
        setSelectedRevision(prev =>
          prev && allRevisions.some(r => r.id === prev.id) ? prev : allRevisions[0]
        );
      } else {
        setSelectedRevision(null);
      }

      if (allListings.length > 0) {
        setSelectedListing(prev =>
          prev && allListings.some(l => l.id === prev.id) ? prev : allListings[0]
        );
      } else {
        setSelectedListing(null);
      }

      // If no pending revisions but pending listings exist, switch to new_submissions tab
      if (allRevisions.length === 0 && allListings.some(l => l.publication_status === 'pending_review' || l.publication_status === 'under_review')) {
        setActiveTab('new_submissions');
      }
    } catch (err: any) {
      console.error('Error loading admin queue:', err);
      showToast({ type: 'error', title: 'Data Load Error', message: err?.message || 'Could not load review queue' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter listings for tabs
  const newSubmissions = listings.filter(
    l => l.publication_status === 'pending_review' || l.publication_status === 'under_review'
  );

  // 1. APPROVE REVISION
  const handleApproveRevision = async (revId: string) => {
    if (!revId) return;
    setIsProcessing(true);
    try {
      const updatedListing = await listingsService.approveRevision(revId, user?.id);

      showToast({
        type: 'success',
        title: 'Changes Approved & Published',
        message: `Proposed modifications for "${updatedListing.name}" have been verified and applied live!`,
      });

      await loadData();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Approval Failed', message: err?.message || 'Could not approve revision.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. REJECT REVISION
  const handleRejectRevision = async () => {
    if (!selectedRevision || !rejectRevisionReason.trim()) return;
    setIsProcessing(true);
    try {
      await listingsService.rejectRevision(selectedRevision.id, rejectRevisionReason.trim(), user?.id);

      showToast({
        type: 'info',
        title: 'Revision Rejected',
        message: `Proposed changes rejected. Rejection reason recorded for owner. Live published listing remains unchanged.`,
      });

      setRejectRevisionModalOpen(false);
      setRejectRevisionReason('');
      await loadData();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Rejection Failed', message: err?.message || 'Could not reject revision.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. APPROVE NEW LISTING PUBLICATION
  const handleApprovePublication = async (listingId: string) => {
    try {
      const updated = await listingsService.updateListingStatus(listingId, 'published');
      setListings(prev => prev.map(l => (l.id === listingId ? updated : l)));
      if (selectedListing?.id === listingId) setSelectedListing(updated);

      await auditService.logAction({
        action: 'approve_publication',
        listing_id: updated.id,
        listing_name: updated.name,
        details: `Approved publication for "${updated.name}" (${updated.locality}, ${updated.city}). Listing is now publicly visible.`,
      });

      showToast({
        type: 'success',
        title: 'Listing Approved & Published',
        message: `${updated.name} is now live and discoverable by students.`,
      });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Approval Failed', message: err?.message });
    }
  };

  // 4. REJECT NEW LISTING PUBLICATION
  const handleRejectListing = async () => {
    if (!selectedListing || !rejectReason.trim()) return;

    try {
      const updated = await listingsService.updateListing(selectedListing.id, {
        publication_status: 'rejected',
        verification_notes: `Rejection notice: ${rejectReason.trim()}`,
        rejection_reason: rejectReason.trim(),
      });

      setListings(prev => prev.map(l => (l.id === updated.id ? updated : l)));
      setSelectedListing(updated);
      setRejectModalOpen(false);

      await auditService.logAction({
        action: 'reject_publication',
        listing_id: updated.id,
        listing_name: updated.name,
        details: `Rejected publication for "${updated.name}".`,
        rejection_reason: rejectReason.trim(),
      });

      setRejectReason('');

      showToast({
        type: 'info',
        title: 'Listing Rejected',
        message: `Rejection notice recorded with reason.`,
      });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Rejection Failed', message: err?.message });
    }
  };

  // 5. UPDATE PHYSICAL VERIFICATION STATUS
  const handleSetVerification = async (
    listingId: string,
    status: ListingVerificationStatus
  ) => {
    try {
      const notes = verifyNotes.trim() || 'Physical inspection and safety audit completed.';
      const updated = await listingsService.updateListingVerification(listingId, status, notes);

      setListings(prev => prev.map(l => (l.id === listingId ? updated : l)));
      if (selectedListing?.id === listingId) setSelectedListing(updated);

      await auditService.logAction({
        action:
          status === 'verified'
            ? 'verify_property'
            : status === 'in_progress'
            ? 'audit_in_progress'
            : 'reset_unverified',
        listing_id: updated.id,
        listing_name: updated.name,
        details: `Updated verification status to "${status}". Notes: ${notes}`,
      });

      showToast({
        type: 'success',
        title: `Verification Status: ${status.toUpperCase()}`,
        message: `${updated.name} verification record updated and logged to audit trail.`,
        isMockPersisted: true,
      });
      setVerifyNotes('');
    } catch (err: any) {
      showToast({ type: 'error', title: 'Verification update failed', message: err?.message });
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Top Operations Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-800">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white">Listing Review & Verification Queue</h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                Operations Portal
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Verify new property registrations, inspect side-by-side edits from owners, and maintain live data integrity.
            </p>
          </div>

          {/* Queue Filter Tabs */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setActiveTab('revisions')}
              className={`px-3 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${
                activeTab === 'revisions'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 ring-1 ring-violet-400'
                  : 'bg-navy-900 text-slate-400 hover:text-white border border-navy-850'
              }`}
            >
              <GitCompare className="w-4 h-4 text-violet-300" />
              <span>Pending Edits</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'revisions' ? 'bg-white text-violet-900' : 'bg-navy-800 text-violet-300'
              }`}>
                {revisions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('new_submissions')}
              className={`px-3 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${
                activeTab === 'new_submissions'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30 ring-1 ring-amber-400'
                  : 'bg-navy-900 text-slate-400 hover:text-white border border-navy-850'
              }`}
            >
              <Clock className="w-4 h-4 text-amber-300" />
              <span>New Submissions</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'new_submissions' ? 'bg-white text-amber-900' : 'bg-navy-800 text-amber-300'
              }`}>
                {newSubmissions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${
                activeTab === 'all'
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                  : 'bg-navy-900 text-slate-400 hover:text-white border border-navy-850'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>All Listings ({listings.length})</span>
            </button>
          </div>
        </div>

        {/* Two-Pane Review Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* LEFT COLUMN: Queue List (4 cols) */}
          <div className="lg:col-span-4 space-y-3 max-h-[820px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400 animate-pulse">Loading queue records...</div>
            ) : activeTab === 'revisions' ? (
              // PENDING REVISIONS QUEUE
              revisions.length === 0 ? (
                <div className="p-8 rounded-2xl bg-navy-900/40 border border-dashed border-navy-800 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">No Pending Edits</p>
                  <p className="text-xs text-slate-400">
                    All owner proposed changes have been verified and processed.
                  </p>
                </div>
              ) : (
                revisions.map(rev => {
                  const isSelected = selectedRevision?.id === rev.id;
                  const targetListing = rev.listing;
                  const proposed = rev.proposed_changes;

                  return (
                    <div
                      key={rev.id}
                      onClick={() => setSelectedRevision(rev)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-navy-900 border-violet-500 shadow-xl ring-1 ring-violet-500/40'
                          : 'bg-navy-900/60 border-navy-800 hover:border-navy-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                            Property Revision
                          </span>
                          <h3 className="font-bold text-white text-sm line-clamp-1 mt-1">
                            {proposed.name || targetListing?.name || 'Property Edit'}
                          </h3>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Pending Review
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Live Status:</span>
                          <Badge variant={targetListing?.publication_status || 'draft'} size="sm" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Owner:</span>
                          <span className="text-slate-200 font-medium">
                            {proposed.owner_name || targetListing?.owner_name || 'Owner'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-navy-850">
                          <span>Submitted:</span>
                          <span>
                            {new Date(rev.submission_date).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              // NEW SUBMISSIONS OR ALL LISTINGS QUEUE
              (activeTab === 'new_submissions' ? newSubmissions : listings).length === 0 ? (
                <div className="p-8 rounded-2xl bg-navy-900/40 border border-dashed border-navy-800 text-center space-y-2">
                  <Building2 className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">No Listings in Queue</p>
                  <p className="text-xs text-slate-400">
                    No properties match the selected queue filter.
                  </p>
                </div>
              ) : (
                (activeTab === 'new_submissions' ? newSubmissions : listings).map(item => {
                  const isSelected = selectedListing?.id === item.id;
                  const hasRevision = Boolean(item.has_pending_revision || revisions.some(r => r.listing_id === item.id));

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedListing(item)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-navy-900 border-brand-500 shadow-xl ring-1 ring-brand-500/30'
                          : 'bg-navy-900/60 border-navy-800 hover:border-navy-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-bold text-white text-sm line-clamp-1">{item.name}</h3>
                        <Badge variant={item.publication_status} size="sm" />
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Badge variant={item.verification_status} size="sm" />
                        <span>{item.locality}, {item.city}</span>
                      </div>

                      {hasRevision && (
                        <div className="mt-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                          <GitCompare className="w-3 h-3" />
                          <span>Has Pending Edits Awaiting Review</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-navy-850 text-[11px] text-slate-400">
                        <span>Owner: {item.owner_name}</span>
                        <span className="font-semibold text-white">₹{item.min_monthly_rent}/mo</span>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>

          {/* RIGHT COLUMN: Detail Inspector Drawer (8 cols) */}
          <div className="lg:col-span-8 bg-navy-900 border border-navy-750 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">

            {activeTab === 'revisions' && selectedRevision ? (
              // ---------------------------------------------------------
              // SIDE-BY-SIDE REVISION DIFF COMPARISON INSPECTOR
              // ---------------------------------------------------------
              (() => {
                const live = selectedRevision.listing;
                const prop = selectedRevision.proposed_changes;

                const liveRent = live ? `₹${live.min_monthly_rent.toLocaleString()} - ₹${live.max_monthly_rent.toLocaleString()}` : '—';
                const propRent = `₹${(prop.min_monthly_rent || 0).toLocaleString()} - ₹${(prop.max_monthly_rent || 0).toLocaleString()}`;
                const rentChanged = live && (live.min_monthly_rent !== prop.min_monthly_rent || live.max_monthly_rent !== prop.max_monthly_rent);

                const liveRooms = live?.rooms || [];
                const propRooms = prop.rooms || [];
                const liveCap = liveRooms.reduce((acc, r) => acc + (r.total_capacity || 0), 0);
                const propCap = propRooms.reduce((acc, r) => acc + (r.total_capacity || 0), 0);
                const liveAvail = liveRooms.reduce((acc, r) => acc + (r.available_beds || 0), 0);
                const propAvail = propRooms.reduce((acc, r) => acc + (r.available_beds || 0), 0);

                const liveAmenities = new Set(live?.amenities || []);
                const propAmenities = new Set(prop.amenities || []);

                const liveImages = live?.images || [];
                const propImages = prop.images || [];

                return (
                  <div className="space-y-6">
                    {/* Header Banner with Submission Info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-800">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40">
                            Property Revision Review
                          </span>
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Status: Pending Review
                          </span>
                        </div>
                        <h2 className="text-xl font-black text-white">
                          {prop.name || live?.name || 'Property Changes'}
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Owner: <strong className="text-slate-200">{prop.owner_name || live?.owner_name}</strong> ({prop.owner_email || live?.owner_email}) •
                          Submitted on {new Date(selectedRevision.submission_date).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs text-slate-400 block">Current Public State:</span>
                        <Badge variant={live?.publication_status || 'draft'} size="md" />
                      </div>
                    </div>

                    {/* Live Protection Explainer Alert */}
                    <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-xs text-brand-200 space-y-1">
                      <p className="font-bold flex items-center gap-1.5 text-white">
                        <ShieldCheck className="w-4 h-4 text-brand-400" />
                        <span>Live Student Protection Active</span>
                      </p>
                      <p>
                        Students browsing Rento are viewing the <strong>Currently Approved Live Details</strong> on the left.
                        The owner's <strong>Proposed Changes</strong> on the right will only take effect and replace live data after you click <strong>Approve Changes</strong>.
                      </p>
                    </div>

                    {/* Column Headers */}
                    <div className="grid grid-cols-2 gap-4 pb-2 border-b border-navy-800 text-xs font-bold uppercase tracking-wider">
                      <div className="text-slate-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-500" />
                        <span>Currently Approved (Live on Rento)</span>
                      </div>
                      <div className="text-violet-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                        <span>Proposed Changes (Awaiting Verification)</span>
                      </div>
                    </div>

                    {/* SECTION 1: Basic Information & Contact */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-violet-400" />
                        <span>1. Property &amp; Contact Information</span>
                      </h4>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        {/* Live */}
                        <div className="p-3.5 rounded-xl bg-navy-950/70 border border-navy-800 space-y-2">
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-semibold">PG Name</span>
                            <span className="font-semibold text-white">{live?.name || '—'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Host / Contact</span>
                            <p className="text-slate-300">{live?.owner_name || '—'}</p>
                            <p className="text-slate-400">{live?.owner_phone || '—'} • {live?.owner_email || '—'}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Full Address &amp; Locality</span>
                            <p className="text-slate-300">{live?.address || '—'}, {live?.locality || '—'}, {live?.city || '—'} {live?.postal_code ? `- ${live.postal_code}` : ''}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Nearby College</span>
                            <p className="text-slate-300">
                              {live?.nearby_colleges?.[0]?.college_name || '—'} ({live?.nearby_colleges?.[0]?.distance_km || 0} km)
                            </p>
                          </div>
                        </div>

                        {/* Proposed */}
                        <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-2">
                          <div>
                            <span className="text-[10px] text-violet-400 block uppercase font-semibold">PG Name</span>
                            <span className={`font-semibold ${live?.name !== prop.name ? 'text-amber-300 underline font-bold' : 'text-white'}`}>
                              {prop.name || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-violet-400 block uppercase font-semibold">Host / Contact</span>
                            <p className={`${live?.owner_name !== prop.owner_name ? 'text-amber-300 font-bold' : 'text-slate-300'}`}>
                              {prop.owner_name || '—'}
                            </p>
                            <p className="text-slate-400">
                              <span className={live?.owner_phone !== prop.owner_phone ? 'text-amber-300 font-bold' : ''}>{prop.owner_phone || '—'}</span> • <span className={live?.owner_email !== prop.owner_email ? 'text-amber-300 font-bold' : ''}>{prop.owner_email || '—'}</span>
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-violet-400 block uppercase font-semibold">Full Address &amp; Locality</span>
                            <p className={`${live?.address !== prop.address || live?.locality !== prop.locality ? 'text-amber-300 font-bold' : 'text-slate-300'}`}>
                              {prop.address || '—'}, {prop.locality || '—'}, {prop.city || '—'} {prop.postal_code ? `- ${prop.postal_code}` : ''}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-violet-400 block uppercase font-semibold">Nearby College</span>
                            <p className="text-slate-300">
                              {prop.nearby_colleges?.[0]?.college_name || '—'} ({prop.nearby_colleges?.[0]?.distance_km || 0} km)
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: Pricing & Deposit */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-violet-400" />
                        <span>2. Pricing &amp; Security Deposit</span>
                      </h4>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="p-3.5 rounded-xl bg-navy-950/70 border border-navy-800 space-y-1.5">
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Monthly Rent Range</span>
                            <span className="text-base font-bold text-white">{liveRent}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Security Deposit</span>
                            <span className="text-slate-300">₹{live?.security_deposit?.toLocaleString() || '10,000'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Food Type</span>
                            <span className="text-slate-300 capitalize">{live?.food_type || 'veg'}</span>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-1.5">
                          <div>
                            <span className="text-[10px] text-violet-400 block uppercase font-semibold">Monthly Rent Range</span>
                            <span className={`text-base font-bold ${rentChanged ? 'text-emerald-400' : 'text-white'}`}>
                              {propRent}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-violet-400 block uppercase font-semibold">Security Deposit</span>
                            <span className={`${live?.security_deposit !== prop.security_deposit ? 'text-amber-300 font-bold' : 'text-slate-300'}`}>
                              ₹{prop.security_deposit?.toLocaleString() || '10,000'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-violet-400 block uppercase font-semibold">Food Type</span>
                            <span className="text-slate-300 capitalize">{prop.food_type || 'veg'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: Room Inventory & Bed Capacity */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <BedDouble className="w-3.5 h-3.5 text-violet-400" />
                        <span>3. Room Inventory &amp; Bed Capacity</span>
                      </h4>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="p-3.5 rounded-xl bg-navy-950/70 border border-navy-800 space-y-2">
                          <div className="flex items-center justify-between pb-2 border-b border-navy-850">
                            <span>Capacity: <strong className="text-white">{liveCap} beds</strong></span>
                            <span>Vacant: <strong className="text-emerald-400">{liveAvail} beds</strong></span>
                          </div>
                          <div className="space-y-1.5">
                            {liveRooms.map((r, i) => (
                              <div key={i} className="text-[11px] p-2 bg-navy-900 rounded-lg flex items-center justify-between">
                                <div>
                                  <span className="font-semibold text-white capitalize">{r.room_name || `${r.room_type} room`}</span>
                                  <span className="text-slate-400 block">{r.total_capacity} beds ({r.available_beds} vacant)</span>
                                </div>
                                <span className="font-bold text-slate-300">₹{r.rent_per_bed}/mo</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-2">
                          <div className="flex items-center justify-between pb-2 border-b border-violet-500/20">
                            <span>Capacity: <strong className={`${liveCap !== propCap ? 'text-amber-300 font-bold' : 'text-white'}`}>{propCap} beds</strong></span>
                            <span>Vacant: <strong className={`${liveAvail !== propAvail ? 'text-emerald-300 font-bold' : 'text-emerald-400'}`}>{propAvail} beds</strong></span>
                          </div>
                          <div className="space-y-1.5">
                            {propRooms.map((r, i) => (
                              <div key={i} className="text-[11px] p-2 bg-navy-900/90 rounded-lg border border-violet-500/20 flex items-center justify-between">
                                <div>
                                  <span className="font-semibold text-white capitalize">{r.room_name || `${r.room_type} room`}</span>
                                  <span className="text-slate-400 block">{r.total_capacity} beds ({r.available_beds} vacant)</span>
                                </div>
                                <span className="font-bold text-emerald-400">₹{r.rent_per_bed}/mo</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 4: Amenities & House Rules */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-violet-400" />
                        <span>4. Amenities &amp; House Rules</span>
                      </h4>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="p-3.5 rounded-xl bg-navy-950/70 border border-navy-800 space-y-2">
                          <span className="text-[10px] text-slate-500 block uppercase font-semibold">Live Amenities</span>
                          <div className="flex flex-wrap gap-1.5">
                            {live?.amenities?.map((a, i) => (
                              <span key={i} className="px-2 py-0.5 rounded-md bg-navy-900 border border-navy-800 text-[11px] text-slate-300">
                                {a}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-2">
                          <span className="text-[10px] text-violet-400 block uppercase font-semibold">Proposed Amenities</span>
                          <div className="flex flex-wrap gap-1.5">
                            {prop.amenities?.map((a, i) => {
                              const isNewlyAdded = !liveAmenities.has(a);
                              return (
                                <span
                                  key={i}
                                  className={`px-2 py-0.5 rounded-md text-[11px] ${
                                    isNewlyAdded
                                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold'
                                      : 'bg-navy-900 border border-navy-800 text-slate-300'
                                  }`}
                                >
                                  {isNewlyAdded ? '+ ' : ''}{a}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 5: Premise Photographs */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-violet-400" />
                        <span>5. Premise Photographs ({propImages.length} proposed images)</span>
                      </h4>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        {/* Live Photos */}
                        <div className="p-3 rounded-xl bg-navy-950/70 border border-navy-800 space-y-2">
                          <span className="text-[10px] text-slate-500 block uppercase font-semibold">Live Images ({liveImages.length})</span>
                          <div className="grid grid-cols-2 gap-2">
                            {liveImages.map((img, i) => (
                              <div key={i} className="relative rounded-lg overflow-hidden border border-navy-800 h-20 bg-navy-900">
                                <img src={img.image_url} alt="premise" className="w-full h-full object-cover" />
                                {i === 0 && (
                                  <span className="absolute top-1 left-1 bg-black/70 text-white text-[9px] px-1 rounded font-bold">Cover</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Proposed Photos */}
                        <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-2">
                          <span className="text-[10px] text-violet-400 block uppercase font-semibold">Proposed Images ({propImages.length})</span>
                          <div className="grid grid-cols-2 gap-2">
                            {propImages.map((img, i) => (
                              <div key={i} className="relative rounded-lg overflow-hidden border border-violet-500/30 h-20 bg-navy-900 group">
                                <img src={img.image_url} alt="proposed premise" className="w-full h-full object-cover" />
                                {i === 0 && (
                                  <span className="absolute top-1 left-1 bg-violet-600 text-white text-[9px] px-1 rounded font-bold">New Cover</span>
                                )}
                                {img.caption && (
                                  <span className="absolute bottom-1 left-1 right-1 bg-black/80 text-[9px] text-slate-200 px-1 py-0.5 rounded truncate">
                                    {img.caption}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* DECISION ACTION BAR FOR REVISION */}
                    <div className="pt-6 border-t border-navy-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="text-xs text-slate-400">
                        Approving will immediately update the live listing and publish new details to students.
                      </div>

                      <div className="flex items-center gap-3">
                        <Button
                          variant="danger"
                          size="md"
                          disabled={isProcessing}
                          onClick={() => setRejectRevisionModalOpen(true)}
                          leftIcon={<XCircle className="w-4 h-4" />}
                        >
                          Reject Changes
                        </Button>

                        <Button
                          variant="glow"
                          size="md"
                          isLoading={isProcessing}
                          onClick={() => handleApproveRevision(selectedRevision.id)}
                          leftIcon={<CheckCircle2 className="w-4 h-4" />}
                        >
                          Approve Changes
                        </Button>
                      </div>
                    </div>

                  </div>
                );
              })()
            ) : selectedListing ? (
              // ---------------------------------------------------------
              // REGULAR LISTING INSPECTION DRAWER (NEW SUBMISSION / ALL)
              // ---------------------------------------------------------
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-navy-800">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant={selectedListing.publication_status} />
                      <Badge variant={selectedListing.verification_status} />
                      <Badge variant={selectedListing.gender_preference} />
                    </div>
                    <h2 className="text-xl font-bold text-white">{selectedListing.name}</h2>
                    <p className="text-xs text-slate-400">{selectedListing.address}, {selectedListing.locality}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-400">Rent Range</span>
                    <p className="text-lg font-black text-white">
                      ₹{selectedListing.min_monthly_rent.toLocaleString()} - ₹{selectedListing.max_monthly_rent.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Has pending revision alert button */}
                {selectedListing.has_pending_revision && (
                  <div className="p-3.5 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-violet-300">
                      <GitCompare className="w-4 h-4 text-violet-400 shrink-0" />
                      <span>This listing has pending edits submitted by the owner awaiting verification.</span>
                    </div>
                    <Button
                      size="sm"
                      variant="glow"
                      onClick={() => {
                        setActiveTab('revisions');
                        const rev = revisions.find(r => r.listing_id === selectedListing.id);
                        if (rev) setSelectedRevision(rev);
                      }}
                    >
                      Compare Edits
                    </Button>
                  </div>
                )}

                {/* Photos Review */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Submitted Premise Photos ({selectedListing.images.length})
                  </h4>
                  <div className="grid grid-cols-3 gap-2.5">
                    {selectedListing.images.map((img, idx) => (
                      <a
                        key={idx}
                        href={img.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative h-24 rounded-xl overflow-hidden border border-navy-800 bg-navy-950 block"
                      >
                        <img
                          src={img.image_url}
                          alt="premise"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[11px] font-semibold text-white">
                          View full
                        </div>
                      </a>
                    ))}
                  </div>
                </div>

                {/* Details Breakdown */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 bg-navy-950 rounded-xl border border-navy-800 space-y-1">
                    <span className="text-slate-400 block font-semibold">Owner Contact</span>
                    <p className="text-white font-medium">{selectedListing.owner_name}</p>
                    <p className="text-slate-400">{selectedListing.owner_phone}</p>
                    <p className="text-slate-400">{selectedListing.owner_email}</p>
                  </div>

                  <div className="p-3.5 bg-navy-950 rounded-xl border border-navy-800 space-y-1">
                    <span className="text-slate-400 block font-semibold">College Proximity</span>
                    {selectedListing.nearby_colleges.map((col, idx) => (
                      <p key={idx} className="text-white">
                        {col.college_name} ({col.distance_km} km)
                      </p>
                    ))}
                  </div>
                </div>

                {/* Physical Verification Audit Controls */}
                <div className="p-4 rounded-2xl bg-navy-950/90 border border-brand-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Physical On-Site Verification Control</span>
                    </h4>
                    <span className="text-xs font-semibold text-slate-400">
                      Current: {selectedListing.verification_status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSetVerification(selectedListing.id, 'verified')}
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    >
                      Mark as Verified
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSetVerification(selectedListing.id, 'in_progress')}
                      leftIcon={<Clock className="w-3.5 h-3.5 text-amber-400" />}
                    >
                      Audit In Progress
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSetVerification(selectedListing.id, 'unverified')}
                    >
                      Reset to Unverified
                    </Button>
                  </div>
                </div>

                {/* Publication Decision Actions */}
                <div className="pt-4 border-t border-navy-800 flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    Publication status is kept separate from physical verification status.
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setRejectModalOpen(true)}
                      leftIcon={<XCircle className="w-4 h-4" />}
                    >
                      Reject Listing
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApprovePublication(selectedListing.id)}
                      leftIcon={<CheckCircle2 className="w-4 h-4" />}
                    >
                      Approve Publication
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-16 text-center space-y-3">
                <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-sm font-semibold text-slate-300">No Item Selected</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Select a pending property revision or listing submission from the review queue on the left to inspect uploaded images and audit details.
                </p>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* REVISION REJECTION MODAL WITH MANDATORY REASON */}
      <Modal
        isOpen={rejectRevisionModalOpen}
        onClose={() => setRejectRevisionModalOpen(false)}
        title="Reject Proposed Changes"
        description="Provide a clear explanation to the owner detailing what corrections are required."
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
            ℹ️ The owner's currently approved live listing will remain unchanged on Rento. The owner will be notified with your feedback and permitted to edit and resubmit.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Rejection Reason &amp; Owner Feedback <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="e.g. The proposed room capacity of 4 beds exceeds the registered floor plan. Please adjust bed count or provide municipal occupancy endorsement."
              value={rejectRevisionReason}
              onChange={e => setRejectRevisionReason(e.target.value)}
              className="w-full bg-navy-950 border border-navy-750 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setRejectRevisionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!rejectRevisionReason.trim() || isProcessing}
              isLoading={isProcessing}
              onClick={handleRejectRevision}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* NEW LISTING REJECTION MODAL */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Listing Publication"
        description="Provide a clear explanation for the property owner"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Rejection Reason *
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Inadequate room photos uploaded; property address does not match registered trade license..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full bg-navy-950 border border-navy-750 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!rejectReason.trim()}
              onClick={handleRejectListing}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
