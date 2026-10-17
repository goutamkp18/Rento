import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Heart,
  Scale,
  Calendar,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Clock,
  Sparkles,
  BedDouble,
  Building2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStudentSubscription } from '../../context/StudentSubscriptionContext';
import { useFavourites } from '../../context/FavouritesContext';
import { useCompare } from '../../context/CompareContext';
import { PGListing, Enquiry, Booking } from '../../types';
import { listingsService } from '../../services/listingsService';
import { favouritesService } from '../../services/favouritesService';
import { enquiriesService } from '../../services/enquiriesService';
import { bookingService } from '../../services/bookingService';
import { downloadBookingPdf, formatINR } from '../../utils/receiptGenerator';
import { ListingCard } from '../../components/listings/ListingCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Download, FileText, CheckCircle2 as CheckCircleIcon, Loader2, Lock, Unlock, Zap } from 'lucide-react';

export const StudentDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { hasStudentSubscription, openPaywall } = useStudentSubscription();
  const { favouriteCount } = useFavourites();
  const { compareCount } = useCompare();
  const navigate = useNavigate();

  const [savedListings, setSavedListings] = useState<PGListing[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<PGListing[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) return;

    // Load user's confirmed bookings
    bookingService.getStudentBookings(user.id).then(data => {
      setBookings(data);
    });

    // Load user's enquiries
    enquiriesService.getStudentEnquiries(user.id).then(data => {
      setEnquiries(data);
    });

    // Load user's favourite listings
    favouritesService.getFavouriteListings().then(favs => {
      setSavedListings(favs);
    });

    // Smart recommendations based on user's college or genuine published listings
    listingsService.getListings().then(all => {
      const userCollege = user.college?.toLowerCase().trim();
      const recs = userCollege
        ? all.filter(l => l.nearby_colleges.some(c => c.college_name.toLowerCase().includes(userCollege)))
        : all;
      setRecommendations(recs.length > 0 ? recs : all);
    });
  }, [user]);

  const handleDownloadPdf = async (booking: Booking) => {
    setDownloadingId(booking.id);
    try {
      await downloadBookingPdf(booking);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/pgs?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const scheduledVisits = enquiries.filter(
    e => e.enquiry_type === 'visit_request' && (e.status === 'visit_confirmed' || e.status === 'submitted')
  );

  return (
    <div className="space-y-8">
      
      {/* Welcome Banner */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-brand-950 via-navy-900 to-navy-900 border border-brand-500/20 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-300 text-xs font-semibold border border-brand-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Student Accommodation Dashboard</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Student'}! 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Here is your active accommodation summary, scheduled room visits, and personalized PG recommendations.
          </p>
        </div>

        {/* Quick Search Shortcut */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-sm w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by college or locality..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-navy-950 border border-navy-750 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>
          <Button type="submit" variant="primary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {/* Student Pass Status Banner */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
        hasStudentSubscription
          ? 'bg-emerald-950/40 border-emerald-500/30 text-white'
          : 'bg-amber-950/30 border-amber-500/30 text-white'
      }`}>
        <div className="flex items-start sm:items-center gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            hasStudentSubscription
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}>
            {hasStudentSubscription ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white">
                {hasStudentSubscription ? '₹9 Student All-Access Pass: ACTIVE' : 'Free Explorer Mode (Limited Features)'}
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                hasStudentSubscription
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {hasStudentSubscription ? 'Unlocked' : 'Locked Features'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">
              {hasStudentSubscription
                ? 'You have unlocked direct PG bookings, enquiries, live GPS / Google Maps locations, and side-by-side PG comparisons.'
                : 'Queries, instant booking, live PG location / directions, and PG comparisons are locked. Unlock everything for just ₹9 (₹7.63 + 18% GST).'}
            </p>
          </div>
        </div>

        {!hasStudentSubscription && (
          <Button
            size="sm"
            variant="primary"
            className="shrink-0 text-xs font-bold shadow-md shadow-brand-500/20"
            onClick={() => openPaywall('unlock booking, direct enquiries, compare PGs, and live PG location')}
            leftIcon={<Zap className="w-3.5 h-3.5" />}
          >
            Unlock All for ₹9
          </Button>
        )}
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-2xl bg-navy-900/90 border border-navy-800 hover:border-brand-500/40 transition-all shadow-md group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Bed Bookings</span>
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
              <BedDouble className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white mt-2">{bookings.length}</p>
          <p className="text-[11px] text-brand-400 font-medium mt-1 flex items-center gap-1">
            <span>{bookings.length > 0 ? 'Confirmed reservations' : 'No bookings yet'}</span>
          </p>
        </div>

        <Link
          to="/student/favourites"
          className="p-5 rounded-2xl bg-navy-900/90 border border-navy-800 hover:border-brand-500/40 transition-all shadow-md group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Saved PGs</span>
            <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center">
              <Heart className="w-4 h-4 fill-current" />
            </div>
          </div>
          <p className="text-2xl font-black text-white mt-2">{favouriteCount || savedListings.length}</p>
          <p className="text-[11px] text-brand-400 font-medium mt-1 flex items-center gap-1">
            <span>View saved stays</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </p>
        </Link>

        <Link
          to="/student/enquiries"
          className="p-5 rounded-2xl bg-navy-900/90 border border-navy-800 hover:border-violet-500/40 transition-all shadow-md group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Active Enquiries</span>
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white mt-2">{enquiries.length}</p>
          <p className="text-[11px] text-violet-400 font-medium mt-1 flex items-center gap-1">
            <span>Check manager responses</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </p>
        </Link>

        <Link
          to="/student/enquiries"
          className="p-5 rounded-2xl bg-navy-900/90 border border-navy-800 hover:border-emerald-500/40 transition-all shadow-md group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Scheduled Visits</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white mt-2">{scheduledVisits.length}</p>
          <p className="text-[11px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <span>Confirmed appointments</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </p>
        </Link>

      </div>

      {/* Confirmed Bed Bookings & Downloadable Invoices */}
      {bookings.length > 0 && (
        <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">My Confirmed Bed Bookings</h2>
                <p className="text-xs text-slate-400">
                  Official advance payment receipts and bed reservation vouchers
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {bookings.length} {bookings.length === 1 ? 'Booking' : 'Bookings'} Confirmed
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {bookings.map(b => (
              <div
                key={b.id}
                className="p-5 rounded-2xl bg-navy-950/80 border border-navy-800 hover:border-brand-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-white text-base truncate">
                      {b.pg_name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 font-mono border border-brand-500/20">
                      {b.id}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                      PAID • CONFIRMED
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    <span className="font-medium text-white">{b.room_or_bed}</span>
                    {b.check_in_date && (
                      <span className="text-slate-400"> • Move-in: {b.check_in_date}</span>
                    )}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>Advance Fee: <strong className="text-emerald-400 font-bold">{formatINR(b.total_paid_inr)}</strong></span>
                    <span>•</span>
                    <span>Receipt: <span className="font-mono text-slate-300">{b.receipt_number}</span></span>
                    <span>•</span>
                    <span className="text-amber-300 text-[11px] font-medium">{b.monthly_rent_notice}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
                  <Link to={`/pgs/${b.listing_id}`}>
                    <Button variant="ghost" size="sm" className="text-xs">
                      View PG
                    </Button>
                  </Link>

                  <Button
                    variant="primary"
                    size="sm"
                    className="text-xs font-bold shadow-md shadow-brand-500/20"
                    leftIcon={
                      downloadingId === b.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )
                    }
                    onClick={() => handleDownloadPdf(b)}
                    disabled={downloadingId === b.id}
                  >
                    <span>{downloadingId === b.id ? 'Generating...' : 'Download PDF Receipt'}</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Enquiries / Scheduled Visits Preview */}
      <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-400" />
            <h2 className="text-base font-bold text-white">Upcoming Visits & Enquiries</h2>
          </div>
          <Link
            to="/student/enquiries"
            className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
          >
            View All ({enquiries.length})
          </Link>
        </div>

        {enquiries.length === 0 ? (
          <div className="p-8 rounded-2xl bg-navy-950/40 border border-dashed border-navy-800 text-center space-y-3">
            <MessageSquare className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No enquiries or visit requests yet</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Explore verified PGs to schedule physical room visits or message property managers directly.
            </p>
            <Link to="/pgs">
              <Button variant="outline" size="sm" className="mt-2 text-xs">
                Explore Stays
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {enquiries.slice(0, 3).map(enq => (
              <div
                key={enq.id}
                className="p-4 rounded-2xl bg-navy-950/70 border border-navy-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <img
                    src={enq.listing_image}
                    alt={enq.listing_name}
                    className="w-12 h-12 rounded-xl object-cover shrink-0"
                  />
                  <div>
                    <h4 className="font-bold text-white text-sm">{enq.listing_name}</h4>
                    <p className="text-xs text-slate-400">
                      {enq.requested_visit_date
                        ? `Visit: ${enq.requested_visit_date} (${enq.requested_visit_time_slot})`
                        : enq.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={enq.status} />
                  <Link to={`/pgs/${enq.listing_id}`}>
                    <Button variant="ghost" size="sm" className="text-xs">
                      View PG
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommended for You */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Recommended for {user?.college || 'You'}</h2>
            <p className="text-xs text-slate-400">
              {user?.college ? `Verified stays near ${user.college}` : 'Verified student accommodations in Bangalore'}
            </p>
          </div>
          <Link to="/pgs" className="text-xs text-brand-400 hover:text-brand-300 font-semibold">
            See More
          </Link>
        </div>

        {recommendations.length === 0 ? (
          <div className="p-8 rounded-2xl bg-navy-950/40 border border-dashed border-navy-800 text-center space-y-2">
            <Building2 className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No PG listings available yet</p>
            <p className="text-xs text-slate-400">
              Check back soon as property managers publish verified accommodations in this area.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.slice(0, 3).map(listing => (
              <ListingCard key={listing.id} listing={listing} layout="grid" />
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
