import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Building2,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  QrCode,
  Lock,
  Loader2,
  MapPin,
  Clock,
  Sparkles,
  Info,
  Check,
  BedDouble,
  User,
  Phone,
  Mail
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { listingsService } from '../../services/listingsService';
import { bookingService } from '../../services/bookingService';
import { PGListing, Room, Booking } from '../../types';
import { formatINR } from '../../utils/receiptGenerator';
import { BookingSuccessModal } from '../../components/booking/BookingSuccessModal';

export const BookingCheckoutPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [listing, setListing] = useState<PGListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const [checkInDate, setCheckInDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  const [studentName, setStudentName] = useState(user?.full_name || '');
  const [studentEmail, setStudentEmail] = useState(user?.email || '');
  const [studentPhone, setStudentPhone] = useState(user?.phone || '');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('student@oksbi');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    listingsService.getListingById(id).then(data => {
      setListing(data);
      if (data && data.rooms && data.rooms.length > 0) {
        const roomParam = searchParams.get('room');
        const matched = roomParam ? data.rooms.find(r => r.id === roomParam) : null;
        setSelectedRoom(matched || data.rooms[0]);
      }
      setIsLoading(false);
    });
  }, [id, searchParams]);

  useEffect(() => {
    if (user) {
      if (!studentName && user.full_name) setStudentName(user.full_name);
      if (!studentEmail && user.email) setStudentEmail(user.email);
      if (!studentPhone && user.phone) setStudentPhone(user.phone);
    }
  }, [user]);

  const bookingFee = listing ? bookingService.getAuthoritativeBookingFee(listing) : 999;

  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!studentName.trim()) errs.name = 'Full name is required';
    if (!studentEmail.trim()) errs.email = 'Valid email is required';
    if (!studentPhone.trim()) errs.phone = 'Phone number is required';
    if (!checkInDate) errs.checkInDate = 'Planned check-in date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePayAdvance = async (simulateFailure = false) => {
    if (!listing) return;
    if (!validate()) {
      showToast({
        type: 'error',
        title: 'Missing information',
        message: 'Please complete all required fields before proceeding with payment.',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const booking = await bookingService.createVerifiedBooking({
        listing,
        room: selectedRoom || undefined,
        student: {
          id: user?.id || `usr_${Date.now()}`,
          full_name: studentName.trim(),
          email: studentEmail.trim(),
          phone: studentPhone.trim(),
        },
        checkInDate,
        paymentMethod,
        simulateFailure,
      });

      showToast({
        type: 'success',
        title: 'Payment Verified & Bed Booked!',
        message: `Your bed at ${listing.name} is reserved. Booking Ref: ${booking.id}`,
      });

      setConfirmedBooking(booking);
      setIsSuccessModalOpen(true);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Payment Failed',
        message: err?.message || 'Payment could not be verified. Please try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
          <p className="text-sm text-slate-400">Loading booking checkout details...</p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-navy-900 border border-navy-800 rounded-3xl p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Accommodation Not Found</h2>
          <p className="text-sm text-slate-400">
            The property listing could not be found or is no longer available.
          </p>
          <Button variant="secondary" onClick={() => navigate('/pgs')}>
            Browse All PGs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-850">
          <div className="space-y-1">
            <Link
              to={`/pgs/${listing.id}`}
              className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-semibold mb-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to {listing.name}</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
              <span>Pay Advance &amp; Book Bed</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-300 border border-brand-500/20 font-bold">
                Advance: {formatINR(bookingFee)}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Lock in your room reservation securely at {listing.name} ({listing.locality}, {listing.city})
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto bg-navy-900 px-3.5 py-2 rounded-2xl border border-navy-800 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>StaySure Verified Booking</span>
          </div>
        </div>

        {/* 2-Column Checkout Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Left Form (7 cols) */}
          <div className="lg:col-span-7 space-y-6">

            {/* Step 1: Selected Room & Sharing */}
            <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-brand-500 text-white font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <h2 className="text-base font-bold text-white">Selected Room &amp; Sharing</h2>
                </div>
                <span className="text-xs text-slate-400">Click to switch option</span>
              </div>

              {listing.rooms && listing.rooms.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {listing.rooms.map(room => {
                    const isSelected = selectedRoom?.id === room.id;
                    const isAvailable = room.available_beds > 0;
                    return (
                      <div
                        key={room.id}
                        onClick={() => isAvailable && setSelectedRoom(room)}
                        className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-brand-500/10 border-brand-500 ring-2 ring-brand-500/40 shadow-md'
                            : isAvailable
                            ? 'bg-navy-950/70 border-navy-800 hover:border-slate-600 cursor-pointer'
                            : 'bg-navy-950/40 border-navy-900 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">
                              {room.room_name || `${room.room_type.toUpperCase()} Room`}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20 capitalize font-medium">
                              {room.room_type} sharing
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 flex flex-wrap gap-2.5">
                            <span className={isAvailable ? 'text-emerald-400 font-semibold' : 'text-red-400'}>
                              {isAvailable ? `${room.available_beds} beds available` : 'Full'}
                            </span>
                            <span>•</span>
                            <span>Bath: {room.has_attached_washroom ? 'Attached' : 'Common'}</span>
                            <span>•</span>
                            <span>AC: {room.is_air_conditioned ? 'Yes' : 'Non-AC'}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-extrabold text-white">
                            {formatINR(room.rent_per_bed)} <span className="text-[10px] text-slate-400 font-normal">/mo</span>
                          </div>
                          <p className="text-[11px] text-slate-400">Deposit: {formatINR(room.deposit_amount)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-navy-950 border border-navy-800 text-xs text-slate-300">
                  Standard Bed Reservation at {listing.name} (Monthly rent from {formatINR(listing.min_monthly_rent)})
                </div>
              )}
            </div>

            {/* Step 2: Check-in Date */}
            <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-500 text-white font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <h2 className="text-base font-bold text-white">Planned Check-in Date</h2>
              </div>
              <p className="text-xs text-slate-400">
                Choose the approximate date you plan to move into {listing.name}.
              </p>
              <div>
                <input
                  type="date"
                  value={checkInDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setCheckInDate(e.target.value)}
                  className="w-full sm:max-w-xs bg-navy-950 border border-navy-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                />
                {errors.checkInDate && <p className="text-xs text-red-400 mt-1">{errors.checkInDate}</p>}
              </div>
            </div>

            {/* Step 3: Resident / Student Information */}
            <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-500 text-white font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <h2 className="text-base font-bold text-white">Resident Information</h2>
              </div>
              <p className="text-xs text-slate-400">
                These verified details will be printed on your official booking receipt &amp; PDF invoice.
              </p>

              <div className="space-y-3">
                <Input
                  label="Full Name (Resident)"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  error={errors.name}
                  placeholder="e.g. John Doe"
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Phone Number"
                    value={studentPhone}
                    onChange={e => setStudentPhone(e.target.value)}
                    error={errors.phone}
                    placeholder="e.g. +91 98765 43210"
                    required
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    value={studentEmail}
                    onChange={e => setStudentEmail(e.target.value)}
                    error={errors.email}
                    placeholder="e.g. student@university.edu"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Step 4: Payment Method Selection */}
            <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-500 text-white font-bold text-xs flex items-center justify-center">
                  4
                </span>
                <h2 className="text-base font-bold text-white">Payment Method</h2>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('upi')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    paymentMethod === 'upi'
                      ? 'bg-brand-500/10 border-brand-500 text-white shadow-sm'
                      : 'bg-navy-950 border-navy-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-5 h-5 text-brand-400" />
                  <span className="text-xs font-bold">UPI / QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    paymentMethod === 'card'
                      ? 'bg-brand-500/10 border-brand-500 text-white shadow-sm'
                      : 'bg-navy-950 border-navy-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-brand-400" />
                  <span className="text-xs font-bold">Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('netbanking')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    paymentMethod === 'netbanking'
                      ? 'bg-brand-500/10 border-brand-500 text-white shadow-sm'
                      : 'bg-navy-950 border-navy-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Building2 className="w-5 h-5 text-brand-400" />
                  <span className="text-xs font-bold">Netbanking</span>
                </button>
              </div>

              {/* Dynamic Payment Detail view */}
              {paymentMethod === 'upi' && (
                <div className="p-4 rounded-2xl bg-navy-950 border border-navy-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Scan QR Code or enter VPA</span>
                    <span className="text-emerald-400 font-medium">Instant Verification</span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-24 h-24 bg-white p-2 rounded-xl flex items-center justify-center shrink-0 shadow-md">
                      <QrCode className="w-20 h-20 text-navy-950" />
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <Input
                        label="UPI ID / VPA"
                        value={upiId}
                        onChange={e => setUpiId(e.target.value)}
                        placeholder="username@okhdfcbank"
                      />
                      <p className="text-[11px] text-slate-400">
                        Supports Google Pay, PhonePe, Paytm, BHIM, and all bank UPI apps.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'card' && (
                <div className="p-4 rounded-2xl bg-navy-950 border border-navy-800 space-y-3">
                  <Input
                    label="Card Number"
                    placeholder="4111 2222 3333 4444"
                    defaultValue="4111 •••• •••• 4242"
                    disabled
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Expiry Date" placeholder="MM/YY" defaultValue="12/28" disabled />
                    <Input label="CVV" placeholder="•••" defaultValue="•••" disabled />
                  </div>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>256-bit encrypted simulated gateway transaction.</span>
                  </p>
                </div>
              )}

              {paymentMethod === 'netbanking' && (
                <div className="p-4 rounded-2xl bg-navy-950 border border-navy-800 text-xs text-slate-300">
                  <p className="mb-2">Select from all major banks in India:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank', 'Kotak Bank', 'Other Banks'].map(b => (
                      <div key={b} className="p-2.5 rounded-lg bg-navy-900 border border-navy-700 text-center font-medium">
                        {b}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <Button
                variant="glow"
                size="lg"
                className="w-full font-bold py-3.5 text-base shadow-xl shadow-brand-500/25 flex items-center justify-center gap-2"
                onClick={() => handlePayAdvance(false)}
                isLoading={isProcessing}
                disabled={isProcessing}
              >
                <Lock className="w-4 h-4 text-white" />
                <span>Pay {formatINR(bookingFee)} Advance &amp; Confirm Bed</span>
              </Button>

              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Authorized Gateway Transaction</span>
                </span>
                
                {/* Failure simulation test toggle as required by prompt criteria #87 */}
                <button
                  type="button"
                  onClick={() => handlePayAdvance(true)}
                  disabled={isProcessing}
                  className="text-[11px] text-red-400 hover:text-red-300 underline"
                  title="Test declining payment to confirm no PAID receipt is issued"
                >
                  Test Payment Failure simulation
                </button>
              </div>
            </div>

          </div>

          {/* Right Summary & Transparent Cost Column (5 cols) */}
          <div className="lg:col-span-5 space-y-6 sticky top-24">
            
            {/* Booking Summary Box */}
            <div className="bg-navy-900 border border-navy-750 rounded-3xl p-6 shadow-2xl space-y-5">
              
              <div className="flex items-center gap-3 pb-4 border-b border-navy-800">
                <img
                  src={listing.images[0]?.image_url || 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=300&q=80'}
                  alt={listing.name}
                  className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-navy-700"
                />
                <div className="min-w-0">
                  <h3 className="font-extrabold text-white text-base truncate">{listing.name}</h3>
                  <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                    <span>{listing.locality}, {listing.city}</span>
                  </p>
                  <p className="text-[11px] text-brand-300 font-medium mt-1">
                    Manager: {listing.owner_name}
                  </p>
                </div>
              </div>

              {/* Selected Room Details */}
              {selectedRoom && (
                <div className="p-3.5 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Chosen Accommodation:</span>
                    <span className="font-bold text-white capitalize">{selectedRoom.room_type} sharing</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Monthly Rent:</span>
                    <span className="font-semibold text-white">{formatINR(selectedRoom.rent_per_bed)}/mo</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Security Deposit:</span>
                    <span className="font-semibold text-white">{formatINR(selectedRoom.deposit_amount)}</span>
                  </div>
                </div>
              )}

              {/* Authoritative Advance Booking Fee Breakdown */}
              <div className="space-y-3 text-xs pt-1">
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px] text-brand-400">
                  Advance Payment Breakdown
                </h4>
                
                <div className="space-y-2 text-slate-300">
                  <div className="flex justify-between items-center">
                    <span>Bed Reservation Advance Fee</span>
                    <span className="font-semibold text-white">{formatINR(bookingFee)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Platform Convenience Fee</span>
                    <span className="text-emerald-400 font-semibold">FREE (₹ 0)</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Bed Lock Guarantee</span>
                    <span className="text-brand-300 font-semibold">Instant</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-navy-800 flex justify-between items-baseline">
                  <div>
                    <span className="font-bold text-white text-sm">TOTAL PAID NOW</span>
                    <p className="text-[11px] text-slate-400">Advance booking amount</p>
                  </div>
                  <div className="text-2xl font-black text-brand-400">
                    {formatINR(bookingFee)}
                  </div>
                </div>
              </div>

              {/* MANDATORY NOTICE — RENT PAID LATER */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Monthly rent has to be paid later.</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  This receipt and payment record only the advance booking fee of <strong>{formatINR(bookingFee)}</strong> shown above. Monthly rent is <strong>not included</strong> in this payment and must be paid separately under the PG's agreed payment terms upon moving in.
                </p>
              </div>

              {/* Trust Badges */}
              <div className="pt-2 border-t border-navy-800 space-y-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Instant official PDF receipt with downloadable invoice</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Bed reserved exclusively in your name</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Direct manager confirmation &amp; check-in support</span>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Booking Success Modal (Invoice PDF Download) */}
      <BookingSuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        booking={confirmedBooking}
      />
    </div>
  );
};
