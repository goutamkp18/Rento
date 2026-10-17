import React, { useState } from 'react';
import { Booking } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { downloadBookingPdf, openReceiptWindow, formatINR } from '../../utils/receiptGenerator';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  ShieldCheck,
  Building2,
  Calendar,
  AlertCircle,
  FileText,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BookingSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
}

export const BookingSuccessModal: React.FC<BookingSuccessModalProps> = ({
  isOpen,
  onClose,
  booking,
}) => {
  const navigate = useNavigate();
  const [isDownloading, setIsDownloading] = useState(false);

  if (!booking) return null;

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      await downloadBookingPdf(booking);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      // Fallback: open printable window
      openReceiptWindow(booking);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleViewDetails = () => {
    onClose();
    navigate('/student/dashboard');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidth="lg"
    >
      <div className="text-center space-y-5 py-2">
        
        {/* Animated Success Badge */}
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-in zoom-in-75 duration-300">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        {/* Mandatory Heading */}
        <div className="space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Congratulations on Your Booking!
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Your bed reservation at <span className="font-bold text-brand-400">{booking.pg_name}</span> has been confirmed.
          </p>
        </div>

        {/* Booking Summary Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-navy-950/80 border border-navy-800 text-left space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-navy-800">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Booking Reference
              </span>
              <p className="text-sm font-mono font-bold text-brand-300">{booking.id}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Receipt Number
              </span>
              <p className="text-xs font-mono text-slate-300">{booking.receipt_number}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Reserved Room / Bed:</span>
              <span className="font-semibold text-white">{booking.room_or_bed}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Booking Date:</span>
              <span className="font-semibold text-white">{booking.booking_date}</span>
            </div>
            {booking.check_in_date && (
              <div>
                <span className="text-slate-400 block text-[11px]">Planned Check-in:</span>
                <span className="font-semibold text-white">{booking.check_in_date}</span>
              </div>
            )}
            <div>
              <span className="text-slate-400 block text-[11px]">Verified Payment Status:</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {booking.verified_payment_status} ({formatINR(booking.total_paid_inr)})
              </span>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Transaction Ref: <span className="font-mono text-slate-300">{booking.payment_reference}</span></span>
            <span className="text-[10px] bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded">
              {booking.payment_gateway}
            </span>
          </div>
        </div>

        {/* Mandatory Prominent Notice */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-left flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed">
            <strong className="text-amber-300 font-bold block mb-0.5">
              Monthly rent has to be paid later.
            </strong>
            This receipt records only the booking reservation fee shown above. Monthly rent is not included in this payment and must be paid separately under the PG's agreed payment terms.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="order-3 sm:order-1 text-xs"
          >
            Close
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleViewDetails}
            leftIcon={<ExternalLink className="w-4 h-4" />}
            className="order-2 text-xs"
          >
            View Booking Details
          </Button>

          <Button
            type="button"
            variant="glow"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            leftIcon={
              isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )
            }
            className="order-1 sm:order-3 font-bold text-xs"
          >
            {isDownloading ? 'Generating PDF...' : 'Download PDF Invoice'}
          </Button>
        </div>

      </div>
    </Modal>
  );
};
