import React, { useState, useEffect } from 'react';
import { PGListing, Room, Booking } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { bookingService } from '../../services/bookingService';
import { formatINR } from '../../utils/receiptGenerator';
import {
  CreditCard,
  QrCode,
  ShieldCheck,
  Building2,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  Lock,
  Loader2
} from 'lucide-react';

interface BookingCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: PGListing;
  initialRoom?: Room | null;
  onSuccess: (booking: Booking) => void;
}

export const BookingCheckoutModal: React.FC<BookingCheckoutModalProps> = ({
  isOpen,
  onClose,
  listing,
  initialRoom,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(initialRoom || listing.rooms[0] || null);
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

  useEffect(() => {
    if (initialRoom) {
      setSelectedRoom(initialRoom);
    } else if (listing.rooms && listing.rooms.length > 0 && !selectedRoom) {
      setSelectedRoom(listing.rooms[0]);
    }
  }, [initialRoom, listing]);

  useEffect(() => {
    if (user) {
      if (!studentName && user.full_name) setStudentName(user.full_name);
      if (!studentEmail && user.email) setStudentEmail(user.email);
      if (!studentPhone && user.phone) setStudentPhone(user.phone);
    }
  }, [user]);

  const bookingFee = bookingService.getAuthoritativeBookingFee(listing);

  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!studentName.trim()) errs.name = 'Full name is required';
    if (!studentEmail.trim()) errs.email = 'Email address is required';
    if (!studentPhone.trim()) errs.phone = 'Phone number is required';
    if (!checkInDate) errs.checkInDate = 'Planned check-in date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePayAdvance = async (simulateFailure = false) => {
    if (!validate()) return;

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
        message: `Your bed reservation at ${listing.name} is confirmed. Booking Reference: ${booking.id}`,
      });

      onClose();
      onSuccess(booking);
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reserve Bed — Pay Advance"
      description={`Lock your accommodation at ${listing.name} (${listing.locality})`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        
        {/* Room Selection Pills */}
        {listing.rooms && listing.rooms.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Select Room Option &amp; Sharing
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {listing.rooms.map(room => {
                const isSelected = selectedRoom?.id === room.id;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setSelectedRoom(room)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-brand-500/10 border-brand-500 ring-1 ring-brand-500'
                        : 'bg-navy-950/70 border-navy-800 hover:border-navy-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">
                        {room.room_name || `${room.room_type.toUpperCase()} Room`}
                      </span>
                      <span className="text-[11px] font-bold text-brand-400">
                        ₹ {room.rent_per_bed.toLocaleString('en-IN')}/mo
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                      <span className="capitalize">{room.room_type} sharing</span>
                      <span>•</span>
                      <span>{room.available_beds > 0 ? `${room.available_beds} beds left` : 'Occupied'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Student Contact Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Your Full Name"
            value={studentName}
            onChange={e => setStudentName(e.target.value)}
            error={errors.name}
            required
          />
          <Input
            label="Phone Number"
            value={studentPhone}
            onChange={e => setStudentPhone(e.target.value)}
            error={errors.phone}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Email Address"
            type="email"
            value={studentEmail}
            onChange={e => setStudentEmail(e.target.value)}
            error={errors.email}
            required
          />
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Planned Check-in Date *
            </label>
            <div className="relative">
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={checkInDate}
                onChange={e => setCheckInDate(e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            {errors.checkInDate && (
              <p className="text-xs text-red-400 mt-1">{errors.checkInDate}</p>
            )}
          </div>
        </div>

        {/* Payment Method Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Payment Gateway &amp; Method
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('upi')}
              className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                paymentMethod === 'upi'
                  ? 'bg-brand-500/10 border-brand-500 text-brand-300'
                  : 'bg-navy-950/70 border-navy-800 text-slate-400 hover:text-white'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>UPI / QR</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                paymentMethod === 'card'
                  ? 'bg-brand-500/10 border-brand-500 text-brand-300'
                  : 'bg-navy-950/70 border-navy-800 text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Debit / Credit</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('netbanking')}
              className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                paymentMethod === 'netbanking'
                  ? 'bg-brand-500/10 border-brand-500 text-brand-300'
                  : 'bg-navy-950/70 border-navy-800 text-slate-400 hover:text-white'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Netbanking</span>
            </button>
          </div>
        </div>

        {paymentMethod === 'upi' && (
          <div className="p-3 bg-navy-950/60 rounded-xl border border-navy-800 space-y-1.5">
            <label className="text-[11px] text-slate-400">Enter UPI ID (GPay, PhonePe, Paytm)</label>
            <input
              type="text"
              value={upiId}
              onChange={e => setUpiId(e.target.value)}
              placeholder="username@okhdfcbank"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500"
            />
          </div>
        )}

        {/* Transparent Cost Breakdown */}
        <div className="p-4 rounded-2xl bg-navy-950 border border-navy-800 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Bed Reservation Advance (Booking Fee)</span>
            <span className="font-extrabold text-white text-sm">{formatINR(bookingFee)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Monthly Rent ({selectedRoom ? `${selectedRoom.room_type} sharing` : 'from'})</span>
            <span className="font-medium text-amber-300/90">
              {formatINR(selectedRoom ? selectedRoom.rent_per_bed : listing.min_monthly_rent)}/mo (Payable Later)
            </span>
          </div>
          <div className="pt-2 border-t border-navy-800 flex items-center justify-between">
            <span className="font-bold text-white">TOTAL PAYABLE NOW</span>
            <span className="font-black text-brand-400 text-base">{formatINR(bookingFee)}</span>
          </div>
        </div>

        {/* Mandatory Prominent Notice */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-200/90 leading-relaxed">
            <strong className="text-amber-300 font-semibold block">Monthly rent has to be paid later.</strong>
            This payment of {formatINR(bookingFee)} is only the booking reservation fee to lock your bed. Monthly rent is paid directly under the PG's agreed terms.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-navy-800">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handlePayAdvance(true)}
            className="text-[11px] text-red-400/80 hover:text-red-300 underline cursor-pointer"
          >
            Simulate Gateway Failure
          </button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="glow"
              disabled={isProcessing}
              onClick={() => handlePayAdvance(false)}
              leftIcon={
                isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )
              }
              className="font-bold px-6"
            >
              {isProcessing ? 'Verifying Payment...' : `Pay ${formatINR(bookingFee)} & Reserve Bed`}
            </Button>
          </div>
        </div>

      </div>
    </Modal>
  );
};
