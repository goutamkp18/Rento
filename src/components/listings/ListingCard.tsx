import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Utensils,
  Wifi,
  Wind,
  BedDouble,
  Scale,
  Sparkles,
  Users
} from 'lucide-react';
import { PGListing } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useFavourites } from '../../context/FavouritesContext';
import { useCompare } from '../../context/CompareContext';
import { useToast } from '../../context/ToastContext';
import { useStudentSubscription } from '../../context/StudentSubscriptionContext';
import { Badge } from '../ui/Badge';

interface ListingCardProps {
  listing: PGListing;
  layout?: 'grid' | 'list';
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing, layout = 'grid' }) => {
  const navigate = useNavigate();
  const { isAuthenticated, setIntendedDestination } = useAuth();
  const { hasStudentSubscription, openPaywall } = useStudentSubscription();
  const { isFavourite, toggleFavourite } = useFavourites();
  const { isComparing, addToCompare, removeFromCompare } = useCompare();
  const { showToast } = useToast();

  const isFav = isFavourite(listing.id);
  const isComp = isComparing(listing.id);

  const primaryImage =
    listing.images.find(img => img.is_primary)?.image_url ||
    listing.images[0]?.image_url ||
    'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80';

  const nearestCollege = listing.nearby_colleges[0];

  const handleCardNavigate = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      const destination = `/pgs/${listing.id}`;
      setIntendedDestination(destination);
      showToast({
        type: 'info',
        title: 'Sign In to View Stay',
        message: 'Please complete quick simulated login to explore full room details.',
      });
      navigate(`/login?role=student&redirect=${encodeURIComponent(destination)}`);
    } else {
      navigate(`/pgs/${listing.id}`);
    }
  };

  const handleCompareToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!hasStudentSubscription) {
      openPaywall('compare multiple PGs side-by-side', () => {
        addToCompare(listing);
      });
      return;
    }
    if (isComp) {
      removeFromCompare(listing.id);
    } else {
      addToCompare(listing);
    }
  };

  const handleFavToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      const destination = `/pgs/${listing.id}`;
      setIntendedDestination(destination);
      showToast({
        type: 'info',
        title: 'Sign In Required',
        message: 'Sign in to save this PG to your favourites list.',
      });
      navigate(`/login?role=student&redirect=${encodeURIComponent(destination)}`);
      return;
    }
    toggleFavourite(listing.id, listing.name);
  };

  if (layout === 'list') {
    return (
      <div
        onClick={handleCardNavigate}
        className="group bg-navy-900/80 hover:bg-navy-850/90 border border-navy-800 hover:border-brand-500/40 rounded-2xl overflow-hidden transition-all duration-300 shadow-lg hover:shadow-card-hover flex flex-col sm:flex-row cursor-pointer"
      >
        {/* Thumbnail */}
        <div className="relative w-full sm:w-72 md:w-80 h-52 sm:h-auto sm:min-h-[220px] shrink-0 overflow-hidden bg-navy-950">
          <img
            src={primaryImage}
            alt={listing.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-transparent to-black/30 pointer-events-none" />

          {/* Badges on image */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
            {listing.verification_status === 'verified' && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/90 backdrop-blur-sm text-white flex items-center gap-1 shadow-md">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified
              </span>
            )}
            {listing.featured && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-violet-600/90 backdrop-blur-sm text-white flex items-center gap-1 shadow-md">
                <Sparkles className="w-3.5 h-3.5" />
                Popular
              </span>
            )}
          </div>

          {/* Heart button */}
          <button
            onClick={handleFavToggle}
            className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all duration-200 z-10 ${
              isFav
                ? 'bg-red-500/90 text-white shadow-lg shadow-red-500/30 scale-105'
                : 'bg-navy-950/60 text-slate-300 hover:text-white hover:bg-navy-900/90'
            }`}
            aria-label={isFav ? 'Remove from favourites' : 'Save to favourites'}
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={listing.gender_preference} size="sm" />
                  <span className="text-xs text-slate-400 capitalize">{listing.property_type}</span>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-brand-300 transition-colors">
                  {listing.name}
                </h3>
                {nearestCollege && (
                  <p className="text-xs text-brand-400 font-medium flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{nearestCollege.distance_km} km from {nearestCollege.college_name}</span>
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-0.5">{listing.locality}, {listing.city}</p>
              </div>

              {/* Price */}
              <div className="text-right shrink-0">
                <p className="text-xs text-slate-400">Starts from</p>
                <div className="flex items-baseline gap-0.5 justify-end">
                  <span className="text-xl font-extrabold text-white">
                    ₹ {listing.min_monthly_rent.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-slate-400">/mo</span>
                </div>
              </div>
            </div>

            {/* Quick Amenities Chips */}
            <div className="flex flex-wrap gap-2 my-3 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-navy-800/80 border border-navy-750">
                <BedDouble className="w-3.5 h-3.5 text-brand-400" />
                Single / Sharing
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-navy-800/80 border border-navy-750">
                <Utensils className="w-3.5 h-3.5 text-amber-400" />
                Meals Included
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-navy-800/80 border border-navy-750">
                <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                High-Speed Wi-Fi
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-navy-800/80 border border-navy-750">
                <Wind className="w-3.5 h-3.5 text-indigo-400" />
                AC Available
              </span>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-navy-800 flex items-center justify-between">
            <button
              onClick={handleCompareToggle}
              className={`text-xs font-medium flex items-center gap-1.5 transition-colors ${
                isComp ? 'text-brand-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>{isComp ? 'Comparing' : 'Compare'}</span>
            </button>

            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-400 group-hover:text-brand-300 group-hover:translate-x-1 transition-all">
              <span>View Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Grid layout (default)
  return (
    <div
      onClick={handleCardNavigate}
      className="group bg-navy-900/80 hover:bg-navy-850/90 border border-navy-800 hover:border-brand-500/40 rounded-2xl overflow-hidden transition-all duration-300 shadow-lg hover:shadow-card-hover flex flex-col cursor-pointer"
    >
      {/* Thumbnail Card Header */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-navy-950">
        <img
          src={primaryImage}
          alt={listing.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-transparent to-black/30 pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
          {listing.verification_status === 'verified' && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/90 backdrop-blur-sm text-white flex items-center gap-1 shadow-md">
              <ShieldCheck className="w-3.5 h-3.5" />
              Verified
            </span>
          )}
          {listing.featured && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-violet-600/90 backdrop-blur-sm text-white flex items-center gap-1 shadow-md">
              <Sparkles className="w-3.5 h-3.5" />
              Popular
            </span>
          )}
        </div>

        {/* Heart Favorite button */}
        <button
          onClick={handleFavToggle}
          className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all duration-200 z-10 ${
            isFav
              ? 'bg-red-500/90 text-white shadow-lg shadow-red-500/30 scale-105'
              : 'bg-navy-950/60 text-slate-300 hover:text-white hover:bg-navy-900/90'
          }`}
          aria-label={isFav ? 'Remove from favourites' : 'Save to favourites'}
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
        </button>

        {/* Bottom image location strip */}
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-xs text-slate-300 pointer-events-none">
          <span className="truncate max-w-[200px] text-slate-200 font-medium drop-shadow">
            {listing.locality}, {listing.city}
          </span>
          {listing.rating > 0 ? (
            <span className="font-semibold text-amber-300 flex items-center gap-1 drop-shadow">
              ★ {listing.rating.toFixed(1)}
            </span>
          ) : (
            <span className="font-medium text-slate-300 bg-navy-950/70 px-2 py-0.5 rounded-full text-[10px] drop-shadow border border-white/10">
              New Listing
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Badge variant={listing.gender_preference} size="sm" />
            {nearestCollege && (
              <span className="text-[11px] font-medium text-brand-400 truncate max-w-[170px]">
                Near {nearestCollege.college_name.split(' ')[0]} ({nearestCollege.distance_km}km)
              </span>
            )}
          </div>

          <h3 className="text-base font-bold text-white group-hover:text-brand-300 transition-colors line-clamp-1">
            {listing.name}
          </h3>
          <p className="text-xs text-slate-400 mt-1 line-clamp-1">
            {nearestCollege ? `Near ${nearestCollege.college_name}, ${listing.locality}` : listing.address}
          </p>

          {/* Pricing Highlight */}
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-lg font-black text-white">
              ₹ {listing.min_monthly_rent.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-slate-400">/month</span>
          </div>

          {/* Key Amenities Grid */}
          <div className="grid grid-cols-2 gap-1.5 mt-3 pt-3 border-t border-navy-800 text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5 truncate">
              <Users className="w-3.5 h-3.5 text-brand-400 shrink-0" />
              <span className="truncate">Single / Sharing</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <Utensils className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Meals Included</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <Wifi className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">WiFi</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <Wind className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">AC Rooms</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 mt-4 border-t border-navy-800/80 flex items-center justify-between">
          <button
            onClick={handleCompareToggle}
            className={`text-xs font-medium flex items-center gap-1.5 transition-colors ${
              isComp ? 'text-brand-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>{isComp ? 'Comparing' : 'Compare'}</span>
          </button>

          <span className="w-8 h-8 rounded-full bg-navy-800 group-hover:bg-brand-600 text-slate-300 group-hover:text-white flex items-center justify-center transition-colors shadow-sm">
            <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </div>
  );
};
