import React, { useState, useEffect } from 'react';
import {
  Inbox,
  Calendar,
  Clock,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Archive,
  Send,
  User,
  Phone,
  Mail,
  Building2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Enquiry, EnquiryStatus } from '../../types';
import { enquiriesService } from '../../services/enquiriesService';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';

export const OwnerEnquiriesPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [replyText, setReplyText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'visits' | 'pending' | 'resolved'>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modal for responding
  const [actionModalType, setActionModalType] = useState<'reply' | 'confirm_visit' | 'decline_visit' | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const loadEnquiries = () => {
    if (!user) return;
    setIsLoading(true);
    enquiriesService.getOwnerEnquiries(user.id).then(data => {
      setEnquiries(data);
      if (data.length > 0 && !selectedEnquiry) {
        setSelectedEnquiry(data[0]);
      }
      setIsLoading(false);
    });
  };

  useEffect(() => {
    loadEnquiries();
  }, [user]);

  const handleSendResponse = async () => {
    if (!selectedEnquiry || !replyText.trim()) return;

    try {
      const updated = await enquiriesService.respondToEnquiry(
        selectedEnquiry.id,
        replyText.trim(),
        'responded'
      );

      setEnquiries(prev => prev.map(e => (e.id === updated.id ? updated : e)));
      setSelectedEnquiry(updated);
      setReplyText('');
      setActionModalType(null);

      showToast({
        type: 'success',
        title: 'Response Recorded',
        message: `Reply sent to ${updated.student_name}. Stored in local development session.`,
        isMockPersisted: true,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Response Failed',
        message: err?.message,
      });
    }
  };

  const handleConfirmVisit = async () => {
    if (!selectedEnquiry) return;

    try {
      const responseMsg = `Visit confirmed for ${selectedEnquiry.requested_visit_date} during ${selectedEnquiry.requested_visit_time_slot}. Please report to reception.`;
      const updated = await enquiriesService.respondToEnquiry(
        selectedEnquiry.id,
        responseMsg,
        'visit_confirmed'
      );

      setEnquiries(prev => prev.map(e => (e.id === updated.id ? updated : e)));
      setSelectedEnquiry(updated);
      setActionModalType(null);

      showToast({
        type: 'success',
        title: 'Visit Confirmed',
        message: `Appointment confirmed for ${updated.student_name}`,
        isMockPersisted: true,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Confirmation Failed',
        message: err?.message,
      });
    }
  };

  const handleDeclineVisit = async () => {
    if (!selectedEnquiry) return;

    try {
      const reasonMsg = declineReason.trim()
        ? `Visit declined: ${declineReason.trim()}`
        : 'Visit declined: Selected slot is full. Please request another date.';
      const updated = await enquiriesService.respondToEnquiry(
        selectedEnquiry.id,
        reasonMsg,
        'visit_declined'
      );

      setEnquiries(prev => prev.map(e => (e.id === updated.id ? updated : e)));
      setSelectedEnquiry(updated);
      setActionModalType(null);
      setDeclineReason('');

      showToast({
        type: 'info',
        title: 'Visit Request Declined',
        message: `Status updated for ${updated.student_name}`,
        isMockPersisted: true,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Decline Failed',
        message: err?.message,
      });
    }
  };

  const handleCloseEnquiry = async (enquiryId: string) => {
    try {
      const updated = await enquiriesService.updateEnquiryStatus(enquiryId, 'closed');
      setEnquiries(prev => prev.map(e => (e.id === updated.id ? updated : e)));
      if (selectedEnquiry?.id === enquiryId) {
        setSelectedEnquiry(updated);
      }

      showToast({
        type: 'info',
        title: 'Enquiry Closed',
        message: 'Marked as completed and archived.',
        isMockPersisted: true,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Close Failed',
        message: err?.message,
      });
    }
  };

  const filtered = enquiries.filter(e => {
    if (statusFilter === 'visits') return e.enquiry_type === 'visit_request';
    if (statusFilter === 'pending') return e.status === 'submitted';
    if (statusFilter === 'resolved') return e.status !== 'submitted';
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-800">
        <div>
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-violet-400" />
            <h1 className="text-2xl font-extrabold text-white">Student Enquiry Inbox</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Review incoming student queries, confirm scheduled property visits, and dispatch responses
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-navy-900 rounded-xl border border-navy-800 text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              statusFilter === 'all'
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({enquiries.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              statusFilter === 'pending'
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pending ({enquiries.filter(e => e.status === 'submitted').length})
          </button>
          <button
            onClick={() => setStatusFilter('visits')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              statusFilter === 'visits'
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Visits ({enquiries.filter(e => e.enquiry_type === 'visit_request').length})
          </button>
        </div>
      </div>

      {/* Two-Pane Inbox Layout */}
      {isLoading ? (
        <div className="p-12 text-center text-sm text-slate-400">Loading inbox...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="w-8 h-8" />}
          title="No enquiries in this filter"
          description="When students enquire about your PG or book in-person visits, they will arrive here."
          className="my-8"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left: Message Thread List (5 cols) */}
          <div className="lg:col-span-5 space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
            {filtered.map(enq => {
              const isSelected = selectedEnquiry?.id === enq.id;
              return (
                <div
                  key={enq.id}
                  onClick={() => setSelectedEnquiry(enq)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-navy-900 border-violet-500/50 shadow-lg ring-1 ring-violet-500/30'
                      : 'bg-navy-900/60 border-navy-800 hover:border-navy-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-white text-xs truncate max-w-[160px]">
                      {enq.student_name}
                    </span>
                    <Badge variant={enq.status} size="sm" />
                  </div>

                  <p className="text-[11px] font-semibold text-brand-300 truncate">
                    {enq.listing_name}
                  </p>

                  <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                    {enq.message}
                  </p>

                  <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-navy-800 text-[10px] text-slate-500">
                    <span>{new Date(enq.created_at).toLocaleDateString('en-IN')}</span>
                    {enq.requested_visit_date && (
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Visit Request</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Selected Thread Detail & Action Drawer (7 cols) */}
          <div className="lg:col-span-7 bg-navy-900 border border-navy-750 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            {selectedEnquiry ? (
              <>
                {/* Header details */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-navy-800">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant={selectedEnquiry.status} />
                      <span className="text-xs font-semibold text-brand-400 uppercase">
                        {selectedEnquiry.enquiry_type.replace('_', ' ')}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white">{selectedEnquiry.student_name}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {selectedEnquiry.student_email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {selectedEnquiry.student_phone}
                      </span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-xs font-semibold text-white">{selectedEnquiry.listing_name}</p>
                    <p className="text-[11px] text-slate-400">
                      {selectedEnquiry.listing_locality}, {selectedEnquiry.listing_city}
                    </p>
                  </div>
                </div>

                {/* Visit Details Box */}
                {selectedEnquiry.requested_visit_date && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <p className="font-bold text-white">Requested Visit Date:</p>
                        <p>{selectedEnquiry.requested_visit_date} • {selectedEnquiry.requested_visit_time_slot}</p>
                      </div>
                    </div>
                    {selectedEnquiry.status === 'submitted' && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setActionModalType('confirm_visit')}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400"
                          onClick={() => setActionModalType('decline_visit')}
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Student message */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Student Query / Note
                  </h4>
                  <div className="p-4 rounded-2xl bg-navy-950/80 border border-navy-800 text-sm text-slate-200 leading-relaxed">
                    {selectedEnquiry.message}
                  </div>
                </div>

                {/* Owner Reply Thread */}
                {selectedEnquiry.owner_response && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold uppercase tracking-wider text-emerald-400">
                        Your Sent Response
                      </span>
                      {selectedEnquiry.responded_at && (
                        <span className="text-[11px] text-slate-400">
                          {new Date(selectedEnquiry.responded_at).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                    <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-sm text-slate-200 leading-relaxed">
                      {selectedEnquiry.owner_response}
                    </div>
                  </div>
                )}

                {/* Reply Form / Controls */}
                <div className="pt-4 border-t border-navy-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                      Send Reply to Student
                    </h4>
                    {selectedEnquiry.status !== 'closed' && (
                      <button
                        onClick={() => handleCloseEnquiry(selectedEnquiry.id)}
                        className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>Archive & Close</span>
                      </button>
                    )}
                  </div>

                  <textarea
                    rows={3}
                    placeholder="Type your response to the student regarding room availability, visits, or house rules..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-750 rounded-2xl p-3 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                  />

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="glow"
                      size="sm"
                      onClick={handleSendResponse}
                      disabled={!replyText.trim()}
                      rightIcon={<Send className="w-3.5 h-3.5" />}
                    >
                      Send Message
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-xs text-slate-400">
                Select an enquiry from the list to review details.
              </div>
            )}
          </div>

        </div>
      )}

      {/* Confirmation Modals */}
      <Modal
        isOpen={actionModalType === 'confirm_visit'}
        onClose={() => setActionModalType(null)}
        title="Confirm In-Person Visit"
        description={`Confirm physical site visit for ${selectedEnquiry?.student_name}`}
      >
        <div className="space-y-4 text-xs text-slate-300">
          <p>
            You are confirming the appointment for{' '}
            <strong className="text-white">{selectedEnquiry?.requested_visit_date}</strong> during{' '}
            <strong className="text-white">{selectedEnquiry?.requested_visit_time_slot}</strong>.
          </p>
          <div className="flex justify-end gap-3 pt-3">
            <Button variant="ghost" onClick={() => setActionModalType(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmVisit}>
              Confirm Appointment
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={actionModalType === 'decline_visit'}
        onClose={() => setActionModalType(null)}
        title="Decline Visit Request"
        description="Provide a reason for the student"
      >
        <div className="space-y-4 text-xs">
          <textarea
            rows={3}
            placeholder="Reason (e.g. Fully booked on that date, please choose next Tuesday)..."
            value={declineReason}
            onChange={e => setDeclineReason(e.target.value)}
            className="w-full bg-navy-950 border border-navy-750 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setActionModalType(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeclineVisit}>
              Decline Request
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
