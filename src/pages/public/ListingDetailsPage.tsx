import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  MapPin,
  ShieldCheck,
  Heart,
  Scale,
  Calendar,
  MessageSquare,
  Share2,
  ChevronLeft,
  ChevronRight,
  Utensils,
  Wifi,
  Wind,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Info,
  DollarSign,
  BedDouble,
  Users,
  Maximize2,
  Eye,
  X,
  ExternalLink
} from 'lucide-react';
import { PGListing, Room, Booking } from '../../types';
import { listingsService } from '../../services/listingsService';
import { useFavourites } from '../../context/FavouritesContext';
import { useCompare } from '../../context/CompareContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EnquiryModal } from '../../components/listings/EnquiryModal';
import { BookingCheckoutModal } from '../../components/booking/BookingCheckoutModal';
import { BookingSuccessModal } from '../../components/booking/BookingSuccessModal';

export const ListingDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, setIntendedDestination } = useAuth();
  const { isFavourite, toggleFavourite } = useFavourites();
  const { isComparing, addToCompare, removeFromCompare } = useCompare();
  const { showToast } = useToast();

  const [listing, setListing] = useState<PGListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isEnquiryOpen, setIsEnquiryOpen] = useState(false);
  const [enquiryMode, setEnquiryMode] = useState<'general' | 'visit_request'>('visit_request');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedBookingRoom, setSelectedBookingRoom] = useState<Room | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const openBookingModal = (room?: Room | null) => {
    setSelectedBookingRoom(room || null);
    setIsBookingModalOpen(true);
  };

  const handleBookingSuccess = (booking: Booking) => {
    setConfirmedBooking(booking);
    setIsSuccessModalOpen(true);
  };

  const imageCount = listing?.images?.length || 1;

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    listingsService.getListingById(id).then(data => {
      setListing(data);
      setIsLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      } else if (e.key === 'ArrowLeft') {
        setSelectedImageIndex(prev => (prev === 0 ? Math.max(0, imageCount - 1) : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setSelectedImageIndex(prev => (prev >= imageCount - 1 ? 0 : prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, imageCount]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400">Loading accommodation details...</p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-navy-900 border border-navy-800 rounded-2xl p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Listing Not Found</h2>
          <p className="text-sm text-slate-400">
            The property listing you requested could not be located or has been archived.
          </p>
          <Button variant="secondary" onClick={() => navigate('/pgs')}>
            Browse All PGs
          </Button>
        </div>
      </div>
    );
  }

  const isFav = isFavourite(listing.id);
  const isComp = isComparing(listing.id);

  const images = listing.images.length > 0 ? listing.images : [
    {
      id: 'default',
      listing_id: listing.id,
      image_url: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80',
      caption: 'Main View',
      display_order: 1,
      is_primary: true
    }
  ];

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    showToast({
      type: 'info',
      title: 'Link copied',
      message: 'Property URL copied to clipboard',
    });
  };

  const handleCompareClick = () => {
    if (isComp) {
      removeFromCompare(listing.id);
    } else {
      addToCompare(listing);
    }
  };

  const openVisitModal = () => {
    if (!isAuthenticated) {
      setIntendedDestination(`/pgs/${listing.id}`);
      navigate(`/login?role=student&redirect=/pgs/${listing.id}`);
      return;
    }
    setEnquiryMode('visit_request');
    setIsEnquiryOpen(true);
  };

  const openEnquiryModal = () => {
    if (!isAuthenticated) {
      setIntendedDestination(`/pgs/${listing.id}`);
      navigate(`/login?role=student&redirect=/pgs/${listing.id}`);
      return;
    }
    setEnquiryMode('general');
    setIsEnquiryOpen(true);
  };

  const handleToggleFav = () => {
    if (!isAuthenticated) {
      setIntendedDestination(`/pgs/${listing.id}`);
      navigate(`/login?role=student&redirect=/pgs/${listing.id}`);
      return;
    }
    toggleFavourite(listing.id, listing.name);
  };

  return (
    <div className="min-h-screen bg-navy-950 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link to="/pgs" className="hover:text-white transition-colors">PGs</Link>
            <span>/</span>
            <span className="text-white font-medium truncate max-w-[200px] sm:max-w-xs">
              {listing.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 rounded-xl bg-navy-900 border border-navy-800 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
              title="Share listing"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Share</span>
            </button>
            <button
              onClick={handleCompareClick}
              className={`p-2 rounded-xl border transition-colors flex items-center gap-1.5 text-xs ${
                isComp
                  ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
                  : 'bg-navy-900 border-navy-800 text-slate-300 hover:text-white'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span className="hidden sm:inline">{isComp ? 'Comparing' : 'Compare'}</span>
            </button>
            <button
              onClick={handleToggleFav}
              className={`p-2 rounded-xl border transition-colors ${
                isFav
                  ? 'bg-red-500/20 border-red-500/40 text-red-400'
                  : 'bg-navy-900 border-navy-800 text-slate-300 hover:text-white'
              }`}
              title={isFav ? 'Remove favourite' : 'Save favourite'}
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Property Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-navy-850">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <Badge variant={listing.verification_status} />
              <Badge variant={listing.gender_preference} />
              <span className="text-xs px-2.5 py-1 rounded-full bg-navy-800 text-slate-300 capitalize border border-navy-700">
                {listing.property_type}
              </span>
              {listing.publication_status !== 'published' && (
                <Badge variant={listing.publication_status} />
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              {listing.name}
            </h1>
            <p className="text-sm text-slate-300 mt-1">{listing.tagline}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <span>{listing.address}, {listing.locality}, {listing.city} - {listing.postal_code}</span>
              </p>
              <a
                href={
                  listing.google_maps_url ||
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${listing.name}, ${listing.address}, ${listing.locality}, ${listing.city}`
                  )}`
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-300 border border-brand-500/25 text-xs font-semibold transition-all hover:scale-105"
                title="Open location in Google Maps"
              >
                <span>Google Maps</span>
                <ExternalLink className="w-3 h-3 text-brand-400" />
              </a>
            </div>
          </div>

          <div className="text-left lg:text-right shrink-0 bg-navy-900/60 p-4 rounded-2xl border border-navy-800">
            <span className="text-xs text-slate-400">Monthly Rent from</span>
            <div className="flex items-baseline gap-1 lg:justify-end">
              <span className="text-3xl font-black text-white">
                ₹ {listing.min_monthly_rent.toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-slate-400">/bed</span>
            </div>
            <p className="text-[11px] text-emerald-400 mt-1 font-medium">
              Refundable Deposit: ₹ {listing.security_deposit.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Photo Gallery with Thumbnail selector & Accurate View System */}
        <div className="space-y-3">
          <div className="relative w-full h-80 sm:h-[480px] lg:h-[520px] rounded-3xl overflow-hidden border border-navy-800 bg-navy-950 shadow-2xl flex items-center justify-center group select-none">
            {/* Ambient Blurred Aura Matching Room's Dominant Colors */}
            <div
              className="absolute inset-0 bg-cover bg-center blur-2xl opacity-25 scale-110 pointer-events-none transition-all duration-700"
              style={{ backgroundImage: `url(${images[selectedImageIndex]?.image_url})` }}
            />
            <div className="absolute inset-0 bg-navy-950/40 pointer-events-none" />

            {/* Main Foreground Image - Shows 100% authentic proportions with zero stretching */}
            <img
              src={images[selectedImageIndex]?.image_url}
              alt={images[selectedImageIndex]?.caption || listing.name}
              className={`relative z-10 transition-all duration-300 cursor-zoom-in ${
                fitMode === 'contain'
                  ? 'w-full h-full max-h-[480px] lg:max-h-[520px] object-contain drop-shadow-xl p-1 sm:p-2'
                  : 'w-full h-full object-cover'
              }`}
              onClick={() => setIsLightboxOpen(true)}
              title="Click to view full screen accurate size"
            />

            {/* Subtle bottom gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-transparent to-transparent pointer-events-none z-10" />

            {/* Top Bar Controls: Photo Count Pill & Fit/Full Mode Buttons */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto">
                <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-navy-950/80 text-white backdrop-blur-md border border-white/10 shadow-lg flex items-center gap-1.5">
                  <span>Photo {selectedImageIndex + 1} of {images.length}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-brand-300 font-medium">
                    {fitMode === 'contain' ? 'Accurate Fit' : 'Full Frame'}
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-2 pointer-events-auto">
                {/* Fit Mode Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFitMode(prev => prev === 'contain' ? 'cover' : 'contain');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-navy-950/80 hover:bg-navy-900 text-slate-200 hover:text-white backdrop-blur-md border border-white/10 text-xs font-medium transition-all flex items-center gap-1.5 shadow-lg"
                  title={fitMode === 'contain' ? 'Switch to Fill Frame' : 'Switch to Accurate Scale'}
                >
                  <Eye className="w-3.5 h-3.5 text-brand-400" />
                  <span>{fitMode === 'contain' ? 'Accurate View' : 'Fill View'}</span>
                </button>

                {/* Lightbox Trigger */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLightboxOpen(true);
                  }}
                  className="p-2 rounded-xl bg-navy-950/80 hover:bg-navy-900 text-slate-200 hover:text-white backdrop-blur-md border border-white/10 transition-all shadow-lg"
                  title="Expand to full screen"
                  aria-label="Expand to full screen"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Image caption */}
            {images[selectedImageIndex]?.caption && (
              <div className="absolute bottom-4 left-4 z-20 bg-navy-950/85 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 text-xs text-white max-w-[80%] truncate shadow-lg">
                {images[selectedImageIndex]?.caption}
              </div>
            )}

            {/* Gallery Navigation Controls */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-navy-950/80 hover:bg-navy-900 text-white backdrop-blur-md border border-white/15 transition-all z-20 shadow-xl"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-navy-950/80 hover:bg-navy-900 text-white backdrop-blur-md border border-white/15 transition-all z-20 shadow-xl"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails strip */}
          {images.length > 1 && (
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
              {images.map((img, index) => (
                <button
                  type="button"
                  key={img.id || index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`relative w-24 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all bg-navy-950 ${
                    selectedImageIndex === index
                      ? 'border-brand-500 scale-105 shadow-md shadow-brand-500/25 ring-2 ring-brand-500/50'
                      : 'border-navy-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img.image_url} alt="thumbnail" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Columns: Left details, Right Booking / Sticky Action Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Details (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Description */}
            <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-6 sm:p-8 space-y-4">
              <h2 className="text-lg font-bold text-white">About this Accommodation</h2>
              <p className="text-sm text-slate-300 leading-relaxed font-normal">
                {listing.description}
              </p>

              {/* Nearby Colleges Proximity */}
              {listing.nearby_colleges.length > 0 && (
                <div className="mt-4 pt-4 border-t border-navy-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-400 mb-3">
                    Proximity to Universities
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {listing.nearby_colleges.map((col, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-navy-950/70 border border-navy-800 text-xs"
                      >
                        <span className="text-white font-medium">{col.college_name}</span>
                        <span className="text-brand-300 font-bold bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
                          {col.distance_km} km
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Location & Directions Button */}
              <div className="mt-4 pt-4 border-t border-navy-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-navy-950/70 border border-navy-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Live Location &amp; Directions</h4>
                    <p className="text-[11px] text-slate-400 truncate max-w-xs sm:max-w-md">
                      {listing.landmark ? `${listing.landmark} • ` : ''}{listing.locality}, {listing.city}
                    </p>
                  </div>
                </div>

                <a
                  href={
                    listing.google_maps_url ||
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${listing.name}, ${listing.address}, ${listing.locality}, ${listing.city}`
                    )}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition-all shrink-0"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Open in Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                </a>
              </div>
            </div>

            {/* Room Types & Pricing Table */}
            <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Available Room Options &amp; Sharing</h2>
                <span className="text-xs text-brand-400 font-semibold hidden sm:inline-block">
                  Click any option to pay advance &amp; reserve
                </span>
              </div>
              <div className="space-y-3">
                {listing.rooms.map(room => (
                  <div
                    key={room.id}
                    onClick={() => {
                      if (room.available_beds > 0) {
                        navigate(`/book/${listing.id}?room=${room.id}`);
                      }
                    }}
                    className={`p-4 rounded-2xl bg-navy-950/80 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${
                      room.available_beds > 0
                        ? 'border-navy-800 hover:border-brand-500/60 hover:bg-navy-900/90 cursor-pointer shadow-sm hover:shadow-md'
                        : 'border-navy-800/40 opacity-70 cursor-not-allowed'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base group-hover:text-brand-300 transition-colors">
                          {room.room_name || `${room.room_type.toUpperCase()} Room`}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20 capitalize">
                          {room.room_type} sharing
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
                        <span>Total: {room.total_capacity} beds</span>
                        <span>•</span>
                        <span
                          className={
                            room.available_beds > 0 ? 'text-emerald-400 font-semibold' : 'text-red-400'
                          }
                        >
                          {room.available_beds > 0
                            ? `${room.available_beds} beds available now`
                            : 'Fully occupied'}
                        </span>
                        <span>•</span>
                        <span>Attached Bath: {room.has_attached_washroom ? 'Yes' : 'Common'}</span>
                        <span>•</span>
                        <span>AC: {room.is_air_conditioned ? 'Yes' : 'Non-AC'}</span>
                      </div>
                    </div>

                    <div className="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-2.5">
                      <div>
                        <div className="text-lg font-extrabold text-white">
                          ₹ {room.rent_per_bed.toLocaleString('en-IN')}{' '}
                          <span className="text-xs text-slate-400 font-normal">/bed</span>
                        </div>
                        <p className="text-[11px] text-slate-400">Deposit: ₹ {room.deposit_amount.toLocaleString('en-IN')}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={room.available_beds > 0 ? 'glow' : 'outline'}
                        className="text-xs font-bold py-1.5 px-3.5"
                        disabled={room.available_beds <= 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (room.available_beds > 0) {
                            navigate(`/book/${listing.id}?room=${room.id}`);
                          }
                        }}
                      >
                        {room.available_beds > 0 ? 'Pay Advance & Book' : 'Full'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Amenities Grid */}
            <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-6 sm:p-8 space-y-4">
              <h2 className="text-lg font-bold text-white">Amenities & Facilities</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {listing.amenities.map((amenity, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-navy-950/60 border border-navy-800 text-xs text-slate-200"
                  >
                    <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Food & Dining Details */}
            <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Food & Dining Policy</h2>
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 capitalize font-medium">
                  {listing.food_type === 'veg'
                    ? 'Pure Vegetarian'
                    : listing.food_type === 'both'
                    ? 'Veg & Non-Veg'
                    : 'Self-Cooking'}
                </span>
              </div>
              <p className="text-sm text-slate-300">
                {listing.food_description ||
                  'Freshly prepared homestyle meals with clean drinking water and scheduled meal timings.'}
              </p>
              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs text-slate-400 font-semibold">Meals Included:</span>
                {listing.meals_provided.map((meal, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2.5 py-1 rounded-lg bg-navy-950 border border-navy-800 text-slate-300 capitalize"
                  >
                    ✓ {meal}
                  </span>
                ))}
              </div>
            </div>

            {/* House Rules */}
            <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-6 sm:p-8 space-y-4">
              <h2 className="text-lg font-bold text-white">House Rules & Terms</h2>
              <ul className="space-y-2.5 text-sm text-slate-300">
                {listing.house_rules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-2 shrink-0"></span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Right Action & Cost Breakdown Sidebar (4 cols) */}
          <div className="lg:col-span-4 space-y-6 sticky top-28">
            
            {/* Quick Action Card */}
            <div className="bg-navy-900 border border-navy-750 rounded-3xl p-6 shadow-2xl space-y-5">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-400">
                  Ready to check it out?
                </span>
                <h3 className="text-xl font-bold text-white">Visit or Contact Owner</h3>
                <p className="text-xs text-slate-400">
                  Connect with {listing.owner_name} without brokerage fee.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  variant="glow"
                  className="w-full font-bold shadow-lg shadow-brand-500/25 py-3"
                  size="lg"
                  leftIcon={<ShieldCheck className="w-5 h-5 text-white" />}
                  onClick={() => {
                    const firstAvailable = listing.rooms.find(r => r.available_beds > 0) || listing.rooms[0];
                    navigate(firstAvailable ? `/book/${listing.id}?room=${firstAvailable.id}` : `/book/${listing.id}`);
                  }}
                >
                  Reserve Bed (Pay ₹ 999 Advance)
                </Button>

                <Button
                  variant="secondary"
                  className="w-full font-semibold"
                  size="md"
                  leftIcon={<Calendar className="w-4 h-4" />}
                  onClick={openVisitModal}
                >
                  Request a Free Visit
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  leftIcon={<MessageSquare className="w-4 h-4" />}
                  onClick={openEnquiryModal}
                >
                  Send an Enquiry
                </Button>
              </div>

              {/* Transparent Cost Breakdown */}
              <div className="pt-5 border-t border-navy-800 space-y-3 text-xs">
                <h4 className="font-bold text-white uppercase tracking-wider">
                  Transparent Cost Breakdown
                </h4>
                <div className="space-y-2 text-slate-300">
                  <div className="flex justify-between">
                    <span>Monthly Rent (from)</span>
                    <span className="font-semibold text-white">
                      ₹ {listing.min_monthly_rent.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Refundable Deposit</span>
                    <span className="font-semibold text-white">
                      ₹ {listing.security_deposit.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Maintenance Charge</span>
                    <span className="font-semibold text-white">
                      {listing.maintenance_charge && listing.maintenance_charge > 0
                        ? `₹ ${listing.maintenance_charge.toLocaleString('en-IN')}/mo`
                        : 'Included in rent'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Notice Period</span>
                    <span className="font-semibold text-white">{listing.notice_period_days} Days</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-navy-950/80 border border-navy-800 text-[11px] text-slate-400 leading-relaxed">
                  <p className="font-semibold text-slate-300 mb-0.5">Electricity Policy:</p>
                  <p>{listing.electricity_policy}</p>
                </div>
              </div>

              {/* Verification & Trust Callout */}
              <div className="pt-4 border-t border-navy-800 flex items-start gap-2.5 text-xs">
                {listing.verification_status === 'verified' ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-emerald-300">
                      Audited listing. Physical inspection and safety measures verified by Rento operations.
                    </p>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-amber-300">
                      Pending physical verification audit by Rento operations team.
                    </p>
                  </>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Enquiry / Visit Modal */}
      <EnquiryModal
        isOpen={isEnquiryOpen}
        onClose={() => setIsEnquiryOpen(false)}
        listing={listing}
        initialType={enquiryMode}
      />

      {/* Booking Checkout Modal (Pay Advance) */}
      <BookingCheckoutModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        listing={listing}
        initialRoom={selectedBookingRoom}
        onSuccess={handleBookingSuccess}
      />

      {/* Booking Success Modal (Invoice PDF Download) */}
      <BookingSuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        booking={confirmedBooking}
      />

      {/* Fullscreen Accurate Lightbox Modal */}
      {isLightboxOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col justify-between p-4 sm:p-6 animate-fadeIn"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Top Bar */}
          <div 
            className="flex items-center justify-between text-white pb-3 border-b border-navy-800"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-md">
                {listing.name}
              </h3>
              <p className="text-xs text-slate-400">
                Photo {selectedImageIndex + 1} of {images.length} • Accurate Proportions
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="p-2 rounded-xl bg-navy-900 hover:bg-navy-800 border border-navy-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs"
                aria-label="Close full screen view"
              >
                <X className="w-5 h-5" />
                <span className="hidden sm:inline">Close (Esc)</span>
              </button>
            </div>
          </div>

          {/* Center Image Viewport */}
          <div 
            className="relative flex-1 flex items-center justify-center my-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={images[selectedImageIndex]?.image_url}
              alt={images[selectedImageIndex]?.caption || listing.name}
              className="max-h-[75vh] max-w-[92vw] object-contain rounded-2xl shadow-2xl border border-white/10"
            />

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
                  }}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-navy-900/80 hover:bg-navy-800 text-white backdrop-blur-md border border-white/10 transition-colors shadow-xl"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
                  }}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-navy-900/80 hover:bg-navy-800 text-white backdrop-blur-md border border-white/10 transition-colors shadow-xl"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Bottom Thumbnails */}
          <div 
            className="flex items-center justify-center gap-2 overflow-x-auto py-2"
            onClick={e => e.stopPropagation()}
          >
            {images.map((img, idx) => (
              <button
                type="button"
                key={img.id || idx}
                onClick={() => setSelectedImageIndex(idx)}
                className={`w-16 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 bg-navy-900 ${
                  selectedImageIndex === idx
                    ? 'border-brand-500 scale-105 shadow-md shadow-brand-500/40 ring-1 ring-brand-400'
                    : 'border-navy-800 opacity-50 hover:opacity-100'
                }`}
              >
                <img src={img.image_url} alt="thumbnail" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
