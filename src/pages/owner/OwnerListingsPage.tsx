import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  Edit,
  Pause,
  Play,
  BedDouble,
  ShieldCheck,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  CreditCard,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { PGListing, ListingPublicationStatus } from '../../types';
import { listingsService } from '../../services/listingsService';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export const OwnerListingsPage: React.FC = () => {
  const { user } = useAuth();
  const {
    currentPlan,
    hasActiveSubscription,
    canAddListing,
    listingLimit,
    remainingCapacity,
    capacityReason
  } = useSubscription();
  const { showToast } = useToast();
  const [listings, setListings] = useState<PGListing[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | ListingPublicationStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [listingToDelete, setListingToDelete] = useState<PGListing | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    listingsService.getOwnerListings(user.id).then(data => {
      setListings(data);
      setIsLoading(false);
    });
  }, [user]);

  const handleTogglePause = async (listing: PGListing) => {
    const newStatus: ListingPublicationStatus =
      listing.publication_status === 'published' ? 'paused' : 'published';

    await listingsService.updateListingStatus(listing.id, newStatus);
    setListings(prev =>
      prev.map(l => (l.id === listing.id ? { ...l, publication_status: newStatus } : l))
    );

    showToast({
      type: 'info',
      title: newStatus === 'published' ? 'Listing Resumed' : 'Listing Paused',
      message: `${listing.name} is now ${newStatus}.`,
      isMockPersisted: true,
    });
  };

  const handleSubmitForReview = async (listing: PGListing) => {
    await listingsService.updateListingStatus(listing.id, 'under_review');
    setListings(prev =>
      prev.map(l => (l.id === listing.id ? { ...l, publication_status: 'under_review' } : l))
    );

    showToast({
      type: 'success',
      title: 'Submitted for Admin Review',
      message: `${listing.name} sent to Rento operations for verification.`,
      isMockPersisted: true,
    });
  };

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

  const filtered = listings.filter(l => {
    const matchesStatus =
      statusFilter === 'all' ||
      l.publication_status === statusFilter ||
      (statusFilter === 'pending_review' && (l.publication_status === 'under_review' || l.publication_status === 'pending_review'));
    const matchesSearch =
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.locality.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-800">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-violet-400" />
            <h1 className="text-2xl font-extrabold text-white">My PG Properties</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage your listings, room sharing tiers, availability and verification audits
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canAddListing ? (
            <Link to="/owner/listings/new">
              <Button variant="glow" size="md" leftIcon={<Plus className="w-4 h-4" />}>
                Create New Listing
              </Button>
            </Link>
          ) : (
            <div title={capacityReason || 'Listing limit reached. Upgrade to add more.'}>
              <Button
                variant="secondary"
                size="md"
                disabled
                leftIcon={<Plus className="w-4 h-4" />}
                className="opacity-60 cursor-not-allowed"
              >
                Create New Listing (Limit Reached)
              </Button>
            </div>
          )}
          <Link to="/owner/subscription">
            <Button variant="outline" size="md" leftIcon={<TrendingUp className="w-4 h-4 text-violet-400" />}>
              Upgrade Plan
            </Button>
          </Link>
        </div>
      </div>

      {/* Plan Entitlements & Capacity Strip */}
      <div className="p-4 rounded-2xl bg-navy-900 border border-navy-750 shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-violet-400" />
            <span className="text-slate-400">Current Plan:</span>
            <span className="font-bold text-white">
              {currentPlan ? currentPlan.name : 'No Active Plan'}
            </span>
            {hasActiveSubscription ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Active Demo
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                Inactive
              </span>
            )}
          </div>

          <div className="text-slate-400 text-xs">
            <span>Portfolio Usage: </span>
            <strong className="text-white">{listings.length}</strong> of{' '}
            <strong className="text-violet-300">
              {listingLimit === Infinity ? 'Unlimited' : `${listingLimit} PGs`}
            </strong>
            {listingLimit !== Infinity && (
              <span className="ml-1 text-[11px] text-slate-500">
                ({remainingCapacity} slot{remainingCapacity !== 1 ? 's' : ''} left)
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-navy-950 rounded-full h-1.5 overflow-hidden border border-navy-800">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              listingLimit === Infinity
                ? 'bg-gradient-to-r from-violet-500 to-brand-400 w-full'
                : listings.length >= listingLimit
                ? 'bg-amber-500'
                : 'bg-gradient-to-r from-brand-500 to-violet-500'
            }`}
            style={{
              width: `${
                listingLimit === Infinity
                  ? 100
                  : Math.min(100, Math.round((listings.length / listingLimit) * 100))
              }%`,
            }}
          />
        </div>

        {!canAddListing && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                You have reached your listing limit ({listingLimit} PG{listingLimit > 1 ? 's' : ''}). Upgrade to Pro Plus to add more properties.
              </span>
            </div>
            <Link to="/owner/subscription" className="shrink-0 font-bold underline hover:text-white text-[11px]">
              Upgrade Plan →
            </Link>
          </div>
        )}
      </div>

      {/* Control Strip: Search & Filter Tabs */}
      <div className="bg-navy-900/80 border border-navy-800 rounded-2xl p-4 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by property name or locality..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-navy-950 border border-navy-750 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-navy-950 rounded-xl border border-navy-800 text-xs w-full md:w-auto">
          {(['all', 'published', 'pending_review', 'paused', 'draft'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as any)}
              className={`px-3 py-1.5 rounded-lg capitalize font-semibold transition-all ${
                statusFilter === status
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Listings Table / Cards */}
      {isLoading ? (
        <div className="p-12 text-center text-sm text-slate-400">Loading listings...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-navy-900/50 border border-dashed border-navy-800 rounded-3xl p-12 text-center max-w-md mx-auto space-y-3">
          <Building2 className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">No properties match your filter</h3>
          <p className="text-xs text-slate-400">Try switching your status filter or search query.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(item => {
            const totalCapacity = item.rooms.reduce((acc, r) => acc + r.total_capacity, 0);
            const availableBeds = item.rooms.reduce((acc, r) => acc + r.available_beds, 0);

            return (
              <div
                key={item.id}
                className="bg-navy-900/90 border border-navy-800 rounded-3xl p-5 shadow-xl hover:border-navy-750 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                {/* Left: Thumbnail & Info */}
                <div className="flex items-center gap-4">
                  <img
                    src={item.images?.[0]?.image_url || 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=300&q=80'}
                    alt={item.name}
                    className="w-20 h-20 rounded-2xl object-cover border border-navy-750 shrink-0"
                  />

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={item.publication_status} size="sm" />
                      <Badge variant={item.verification_status} size="sm" />
                      <Badge variant={item.gender_preference} size="sm" />
                    </div>
                    <h3 className="text-base font-bold text-white">{item.name}</h3>
                    <p className="text-xs text-slate-400">
                      {item.address}, {item.locality}, {item.city}
                    </p>
                    <p className="text-[11px] text-brand-300 font-semibold">
                      Rent: ₹{item.min_monthly_rent.toLocaleString('en-IN')} - ₹
                      {item.max_monthly_rent.toLocaleString('en-IN')} /mo
                    </p>
                  </div>
                </div>

                {/* Middle: Live Room & Bed Capacity */}
                <div className="flex items-center gap-6 text-xs text-slate-300 px-4 py-3 bg-navy-950/80 rounded-2xl border border-navy-850 shrink-0">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Beds</span>
                    <span className="text-base font-black text-white">{totalCapacity}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Available</span>
                    <span className="text-base font-black text-emerald-400">{availableBeds}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Rooms</span>
                    <span className="text-base font-black text-brand-300">{item.rooms.length}</span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Link to={`/owner/listings/${item.id}/rooms`}>
                    <Button variant="secondary" size="sm" leftIcon={<BedDouble className="w-3.5 h-3.5" />}>
                      Beds
                    </Button>
                  </Link>

                  <Link to={`/owner/listings/${item.id}/edit`}>
                    <Button variant="secondary" size="sm" leftIcon={<Edit className="w-3.5 h-3.5" />}>
                      Edit
                    </Button>
                  </Link>

                  <Link to={`/pgs/${item.id}`} target="_blank">
                    <Button variant="ghost" size="sm" title="Preview public view">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </Link>

                  {item.publication_status === 'published' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTogglePause(item)}
                      title="Pause listing visibility"
                      leftIcon={<Pause className="w-3.5 h-3.5 text-amber-400" />}
                    >
                      Pause
                    </Button>
                  ) : item.publication_status === 'paused' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTogglePause(item)}
                      title="Resume listing visibility"
                      leftIcon={<Play className="w-3.5 h-3.5 text-emerald-400" />}
                    >
                      Resume
                    </Button>
                  ) : item.publication_status === 'draft' ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleSubmitForReview(item)}
                    >
                      Submit
                    </Button>
                  ) : null}

                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setListingToDelete(item)}
                    title="Delete property from website and database"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
