import React, { useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Lock,
  CheckCircle2,
  QrCode,
  CreditCard,
  Building2,
  AlertCircle,
  X,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { studentSubscriptionService } from '../../services/studentSubscriptionService';
import { STUDENT_SUBSCRIPTION_PLAN, formatINR } from '../../utils/pricing';

interface StudentPaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
  onSuccess?: () => void;
}

export const StudentPaywallModal: React.FC<StudentPaywallModalProps> = ({
  isOpen,
  onClose,
  reason = 'access premium PG booking, direct enquiries, compare tools and live locations',
  onSuccess,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('student@oksbi');
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayAndUnlock = async () => {
    setIsProcessing(true);
    try {
      const studentId = user?.id || `guest_stu_${Date.now()}`;
      await studentSubscriptionService.createStudentSubscription({
        studentId,
        studentName: user?.full_name || 'Student Resident',
        studentEmail: user?.email || '',
        paymentMethod,
      });

      showToast({
        type: 'success',
        title: '🎉 Student Pass Activated!',
        message: 'All PG booking, enquiry, live location, and compare features are now completely unlocked for your account.',
      });

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Payment Failed',
        message: err?.message || 'Could not process subscription. Please try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidth="md"
    >
      <div className="space-y-5 -mt-2">
        
        {/* Header Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-brand-500/20 to-violet-500/20 text-brand-300 text-xs font-bold border border-brand-500/30">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>Rento Student Access Pass</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Unlock Full Access for Just <span className="text-gradient-brand">₹ 9</span>
          </h2>

          <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
            Without a student subscription, only basic PG info is visible. To <strong className="text-white">{reason}</strong>, activate your ₹ 9 pass below.
          </p>
        </div>

        {/* What gets unlocked checklist */}
        <div className="p-4 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-2 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400 block mb-1">
            Included with ₹ 9 Student Pass:
          </span>
          <div className="grid grid-cols-1 gap-2 text-slate-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Send direct enquiries &amp; chat with PG owners</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Schedule free in-person room visits</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Reserve beds &amp; pay advance booking online</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>View exact address, landmark &amp; live Google Maps directions</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Compare multiple PGs side-by-side</span>
            </div>
          </div>
        </div>

        {/* Transparent Tax Breakdown */}
        <div className="p-3.5 rounded-xl bg-navy-900 border border-navy-750 text-xs space-y-1.5">
          <div className="flex justify-between text-slate-400">
            <span>Base Access Pass</span>
            <span className="font-semibold text-white">₹ 7.63</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>GST (18%)</span>
            <span className="font-semibold text-white">₹ 1.37</span>
          </div>
          <div className="pt-2 border-t border-navy-800 flex justify-between items-baseline font-bold">
            <span className="text-white">Total Amount Due</span>
            <span className="text-xl font-black text-emerald-400">₹ 9.00</span>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Select Payment Method
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('upi')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                paymentMethod === 'upi'
                  ? 'bg-brand-500/20 border-brand-500 text-white shadow-sm'
                  : 'bg-navy-950 border-navy-800 text-slate-400 hover:text-white'
              }`}
            >
              <QrCode className="w-4 h-4 text-brand-400" />
              <span>UPI / QR</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                paymentMethod === 'card'
                  ? 'bg-brand-500/20 border-brand-500 text-white shadow-sm'
                  : 'bg-navy-950 border-navy-800 text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4 text-brand-400" />
              <span>Card</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('netbanking')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                paymentMethod === 'netbanking'
                  ? 'bg-brand-500/20 border-brand-500 text-white shadow-sm'
                  : 'bg-navy-950 border-navy-800 text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4 text-brand-400" />
              <span>Netbanking</span>
            </button>
          </div>

          {paymentMethod === 'upi' && (
            <div className="pt-1">
              <Input
                label="UPI ID"
                value={upiId}
                onChange={e => setUpiId(e.target.value)}
                placeholder="username@okaxis"
              />
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="space-y-2 pt-1">
          <Button
            variant="glow"
            size="lg"
            className="w-full font-bold py-3.5 shadow-xl shadow-brand-500/25 flex items-center justify-center gap-2"
            onClick={handlePayAndUnlock}
            isLoading={isProcessing}
            disabled={isProcessing}
          >
            <Lock className="w-4 h-4" />
            <span>Pay ₹ 9 &amp; Unlock Everything Now</span>
          </Button>

          <p className="text-[11px] text-center text-slate-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Instant activation saved securely in Supabase DB</span>
          </p>
        </div>

      </div>
    </Modal>
  );
};
