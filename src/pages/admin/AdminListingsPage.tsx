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
  X
} from 'lucide-react';
import { PGListing, ListingPublicationStatus, ListingVerificationStatus } from '../../types';
import { listingsService } from '../../services/listingsService';
import { auditService } from '../../services/auditService';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

export const AdminListingsPage: React.FC = () => {
  const { showToast } = useToast();
  const [listings, setListings] = useState<PGListing[]>([]);
  const [selectedListing, setSelectedListing] = useState<PGListing | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'under_review' | 'verified'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const loadListings = () => {
    setIsLoading(true);
    listingsService.getAllListingsForAdmin().then(data => {
      setListings(data);
      if (data.length > 0) {
        setSelectedListing(prev => (prev && data.some(d => d.id === prev.id) ? prev : data[0]));
      } else {
        setSelectedListing(null);
      }
      setIsLoading(false);
    });
  };

  useEffect(() => {
    loadListings();
  }, []);

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

  const filtered = listings.filter(l => {
    if (statusFilter === 'under_review') {
      return l.publication_status === 'under_review' || l.publication_status === 'pending_review';
    }
    if (statusFilter === 'verified') return l.verification_status === 'verified';
    return true;
  });

  const pendingReviewCount = listings.filter(
    l => l.publication_status === 'under_review' || l.publication_status === 'pending_review'
  ).length;

  return (
    <div className="min-h-screen bg-navy-950 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Prototype Warning Banner */}
        <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-xs text-brand-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-400 shrink-0" />
            <span>
              <strong>Operations Review Queue:</strong> Prototype interface for internal Rento listing approval and physical verification auditing.
            </span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider bg-navy-900 px-2 py-0.5 rounded border border-brand-500/30">
            Admin Preview
          </span>
        </div>

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-800">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Listing Review & Verification Queue</h1>
            <p className="text-xs text-slate-400 mt-1">
              Audit submitted PG accommodations, review photos, and approve publication status
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-brand-600 text-white'
                  : 'bg-navy-900 text-slate-400 hover:text-white'
              }`}
            >
              All Listings ({listings.length})
            </button>
            <button
              onClick={() => setStatusFilter('under_review')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                statusFilter === 'under_review'
                  ? 'bg-amber-600 text-white'
                  : 'bg-navy-900 text-slate-400 hover:text-white'
              }`}
            >
              Awaiting Review ({pendingReviewCount})
            </button>
          </div>
        </div>

        {/* Two-Pane Review Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left: Queue List (5 cols) */}
          <div className="lg:col-span-5 space-y-3 max-h-[750px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading listings...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 rounded-2xl bg-navy-900/40 border border-dashed border-navy-800 text-center space-y-2">
                <Building2 className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">No listings in this queue</p>
                <p className="text-xs text-slate-400">
                  When owners register their properties, they will appear here for review and publication approval.
                </p>
              </div>
            ) : (
              filtered.map(item => {
                const isSelected = selectedListing?.id === item.id;
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

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <Badge variant={item.verification_status} size="sm" />
                      <span>{item.locality}, {item.city}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-navy-850 text-[11px] text-slate-400">
                      <span>Owner: {item.owner_name}</span>
                      <span className="font-semibold text-white">₹{item.min_monthly_rent}/mo</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Detailed Inspection Drawer (7 cols) */}
          <div className="lg:col-span-7 bg-navy-900 border border-navy-750 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            {selectedListing ? (
              <>
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
                    <span className="text-xs text-slate-400">Rent</span>
                    <p className="text-lg font-black text-white">
                      ₹{selectedListing.min_monthly_rent} - ₹{selectedListing.max_monthly_rent}
                    </p>
                  </div>
                </div>

                {/* Photos Review */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Submitted Premise Photos
                  </h4>
                  <div className="grid grid-cols-3 gap-2.5">
                    {selectedListing.images.map((img, idx) => (
                      <a
                        key={idx}
                        href={img.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative h-24 rounded-xl overflow-hidden border border-navy-800 bg-navy-950 block"
                        title="Click to view full accurate resolution"
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
                  <div className="p-3 bg-navy-950 rounded-xl border border-navy-800 space-y-1">
                    <span className="text-slate-400 block font-semibold">Owner Contact</span>
                    <p className="text-white font-medium">{selectedListing.owner_name}</p>
                    <p className="text-slate-400">{selectedListing.owner_phone}</p>
                    <p className="text-slate-400">{selectedListing.owner_email}</p>
                  </div>

                  <div className="p-3 bg-navy-950 rounded-xl border border-navy-800 space-y-1">
                    <span className="text-slate-400 block font-semibold">College Proximity</span>
                    {selectedListing.nearby_colleges.map((col, idx) => (
                      <p key={idx} className="text-white">
                        {col.college_name} ({col.distance_km} km)
                      </p>
                    ))}
                  </div>
                </div>

                {/* Verification Control Section */}
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
                    Publication status is kept separate from verification status.
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
              </>
            ) : (
              <div className="p-16 text-center space-y-3">
                <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-sm font-semibold text-slate-300">No Listing Selected</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Select a property listing from the review queue on the left to inspect uploaded images, room inventory, college proximities, and audit publication status.
                </p>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Rejection Modal with Mandatory Reason */}
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
