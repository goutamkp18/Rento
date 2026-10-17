import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PGListing, EnquiryType } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useStudentSubscription } from '../../context/StudentSubscriptionContext';
import { enquiriesService } from '../../services/enquiriesService';
import { Calendar, Clock, MessageSquare, Send, ShieldCheck, ArrowRight, Lock } from 'lucide-react';

interface EnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: PGListing;
  initialType?: EnquiryType;
}

export const EnquiryModal: React.FC<EnquiryModalProps> = ({
  isOpen,
  onClose,
  listing,
  initialType = 'general',
}) => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { hasStudentSubscription, openPaywall } = useStudentSubscription();

  const [enquiryType, setEnquiryType] = useState<EnquiryType>(initialType);
  const [studentName, setStudentName] = useState(user?.full_name || '');
  const [studentEmail, setStudentEmail] = useState(user?.email || '');
  const [studentPhone, setStudentPhone] = useState(user?.phone || '');
  const [message, setMessage] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('11:00 AM - 01:00 PM');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  React.useEffect(() => {
    if (user) {
      if (user.full_name && !studentName) setStudentName(user.full_name);
      if (user.email && !studentEmail) setStudentEmail(user.email);
      if (user.phone && !studentPhone) setStudentPhone(user.phone);
    }
  }, [user]);

  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!studentName.trim()) errs.name = 'Full name is required';
    if (!studentEmail.trim()) errs.email = 'Email address is required';
    if (!studentPhone.trim()) errs.phone = 'Phone number is required';
    if (!message.trim()) errs.message = 'Please provide details or a question';
    if (enquiryType === 'visit_request' && !visitDate) {
      errs.visitDate = 'Please select a preferred visit date';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasStudentSubscription) {
      onClose();
      openPaywall('send direct queries and visit requests to PG owners');
      return;
    }

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await enquiriesService.submitEnquiry({
        student_id: user?.id || `usr_${Date.now()}`,
        owner_id: listing.owner_id,
        student_name: studentName.trim(),
        student_email: studentEmail.trim(),
        student_phone: studentPhone.trim(),
        listing_id: listing.id,
        listing_name: listing.name,
        listing_locality: listing.locality,
        listing_city: listing.city,
        listing_image: listing.images[0]?.image_url || '',
        enquiry_type: enquiryType,
        message: message.trim(),
        requested_visit_date: enquiryType === 'visit_request' ? visitDate : undefined,
        requested_visit_time_slot: enquiryType === 'visit_request' ? timeSlot : undefined,
      });

      showToast({
        type: 'success',
        title: enquiryType === 'visit_request' ? 'Visit Request Submitted' : 'Enquiry Sent to PG Owner',
        message: `Your request for "${listing.name}" has been recorded and delivered to the property manager's inbox.`,
        isMockPersisted: true,
      });

      onClose();
      setMessage('');
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Submission failed',
        message: err?.message || 'Could not send enquiry. Please check required fields.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={enquiryType === 'visit_request' ? 'Request a PG Visit' : 'Send an Enquiry'}
      description={`Contact property manager for ${listing.name} (${listing.locality})`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Enquiry Type Selector Tabs */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Inquiry Category
          </label>
          <div className="grid grid-cols-3 gap-2 p-1 bg-navy-950 rounded-xl border border-navy-800">
            <button
              type="button"
              onClick={() => setEnquiryType('visit_request')}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                enquiryType === 'visit_request'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Schedule Visit</span>
            </button>
            <button
              type="button"
              onClick={() => setEnquiryType('general')}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                enquiryType === 'general'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Ask Question</span>
            </button>
            <button
              type="button"
              onClick={() => setEnquiryType('booking_inquiry')}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                enquiryType === 'booking_inquiry'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Reserve Bed</span>
            </button>
          </div>
        </div>

        {/* Direct Pay Advance Callout for instant bed reservation */}
        {enquiryType === 'booking_inquiry' && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-brand-950/80 to-navy-900 border border-brand-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-brand-300 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Instant Bed Reservation Available</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Lock your bed now with authoritative ₹ 999 advance payment. Monthly rent paid later.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (!hasStudentSubscription) {
                  openPaywall('unlock instant bed booking and reservation');
                } else {
                  navigate(`/book/${listing.id}`);
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md transition-all shrink-0"
            >
              <span>{hasStudentSubscription ? 'Pay Advance & Book' : 'Unlock & Pay Advance'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Contact Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Your Name"
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

        <Input
          label="Email Address"
          type="email"
          value={studentEmail}
          onChange={e => setStudentEmail(e.target.value)}
          error={errors.email}
          required
        />

        {/* Visit specific scheduling fields */}
        {enquiryType === 'visit_request' && (
          <div className="p-3.5 bg-navy-950/80 border border-brand-500/20 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-brand-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Preferred In-Person Visit Schedule</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Visit Date *
                </label>
                <input
                  type="date"
                  value={visitDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setVisitDate(e.target.value)}
                  className="w-full bg-navy-900 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
                {errors.visitDate && <p className="text-xs text-red-400 mt-1">{errors.visitDate}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Time Window
                </label>
                <select
                  value={timeSlot}
                  onChange={e => setTimeSlot(e.target.value)}
                  className="w-full bg-navy-900 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="09:00 AM - 11:00 AM">Morning: 09:00 AM - 11:00 AM</option>
                  <option value="11:00 AM - 01:00 PM">Midday: 11:00 AM - 01:00 PM</option>
                  <option value="02:00 PM - 04:00 PM">Afternoon: 02:00 PM - 04:00 PM</option>
                  <option value="04:00 PM - 06:30 PM">Evening: 04:00 PM - 06:30 PM</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Message Area */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Message or Specific Queries *
          </label>
          <textarea
            rows={3}
            placeholder={
              enquiryType === 'visit_request'
                ? 'e.g. I will be visiting with my parents to see the double sharing room with AC...'
                : 'e.g. Is double sharing room available from 1st of next month? Are pure vegetarian meals provided?'
            }
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="w-full bg-navy-900 border border-navy-700 rounded-xl p-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
          {errors.message && <p className="text-xs text-red-400 mt-1">{errors.message}</p>}
        </div>

        {/* Action Buttons */}
        <div className="pt-3 flex items-center justify-end gap-3 border-t border-navy-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            rightIcon={hasStudentSubscription ? <Send className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          >
            {hasStudentSubscription ? 'Submit Enquiry' : 'Unlock ₹ 9 Pass to Submit'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
