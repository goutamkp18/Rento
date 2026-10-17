import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  ExternalLink,
  User,
  Inbox
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Enquiry, EnquiryStatus } from '../../types';
import { enquiriesService } from '../../services/enquiriesService';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

export const StudentEnquiriesPage: React.FC = () => {
  const { user } = useAuth();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'visits' | 'general'>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    enquiriesService.getStudentEnquiries(user.id).then(data => {
      setEnquiries(data);
      setIsLoading(false);
    });
  }, [user]);

  const filteredEnquiries = enquiries.filter(e => {
    if (selectedFilter === 'visits') return e.enquiry_type === 'visit_request';
    if (selectedFilter === 'general') return e.enquiry_type !== 'visit_request';
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-800">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-brand-400" />
            <h1 className="text-2xl font-extrabold text-white">My Enquiries & Visits</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track communication and scheduled physical property visits with PG owners
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-navy-900 rounded-xl border border-navy-800 text-xs">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              selectedFilter === 'all'
                ? 'bg-brand-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({enquiries.length})
          </button>
          <button
            onClick={() => setSelectedFilter('visits')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              selectedFilter === 'visits'
                ? 'bg-brand-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Visits Only ({enquiries.filter(e => e.enquiry_type === 'visit_request').length})
          </button>
          <button
            onClick={() => setSelectedFilter('general')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              selectedFilter === 'general'
                ? 'bg-brand-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            General Inquiries ({enquiries.filter(e => e.enquiry_type !== 'visit_request').length})
          </button>
        </div>
      </div>

      {/* Enquiries Feed */}
      {isLoading ? (
        <div className="p-12 text-center text-sm text-slate-400">Loading enquiries...</div>
      ) : filteredEnquiries.length === 0 ? (
        <EmptyState
          icon={<Inbox className="w-8 h-8" />}
          title="No enquiries found"
          description="When you enquire about a PG or request an in-person room visit, the status will show here."
          actionLabel="Explore PGs Near Colleges"
          onAction={() => window.location.assign('/pgs')}
          className="my-8"
        />
      ) : (
        <div className="space-y-4">
          {filteredEnquiries.map(enq => (
            <div
              key={enq.id}
              className="bg-navy-900/90 border border-navy-800 rounded-3xl p-6 shadow-xl space-y-4 hover:border-navy-750 transition-colors"
            >
              {/* Header: PG Name, image, status, time */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-800">
                <div className="flex items-center gap-3.5">
                  <img
                    src={enq.listing_image}
                    alt={enq.listing_name}
                    className="w-14 h-14 rounded-2xl object-cover border border-navy-750"
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={enq.status} />
                      <span className="text-[11px] text-slate-400 uppercase font-semibold">
                        {enq.enquiry_type === 'visit_request' ? 'Physical Visit Request' : 'Question'}
                      </span>
                    </div>
                    <Link to={`/pgs/${enq.listing_id}`}>
                      <h3 className="font-bold text-white text-base hover:text-brand-300 transition-colors">
                        {enq.listing_name}
                      </h3>
                    </Link>
                    <p className="text-xs text-slate-400">{enq.listing_locality}, {enq.listing_city}</p>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span className="text-[11px] text-slate-400 block">
                    Submitted on {new Date(enq.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                  <Link
                    to={`/pgs/${enq.listing_id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 mt-1"
                  >
                    <span>View Listing</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Message from Student */}
              <div className="p-3.5 rounded-2xl bg-navy-950/80 border border-navy-800 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-400 font-semibold mb-1">
                  <span>Your Message:</span>
                  {enq.requested_visit_date && (
                    <span className="text-brand-300 flex items-center gap-1 font-bold">
                      <Calendar className="w-3.5 h-3.5" />
                      Visit: {enq.requested_visit_date} ({enq.requested_visit_time_slot})
                    </span>
                  )}
                </div>
                <p className="text-slate-200 leading-relaxed">{enq.message}</p>
              </div>

              {/* Owner Response if present */}
              {enq.owner_response ? (
                <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-xs space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Property Manager Response</span>
                    </span>
                    {enq.responded_at && (
                      <span className="text-[10px] text-slate-400">
                        {new Date(enq.responded_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-200 leading-relaxed">{enq.owner_response}</p>
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Awaiting property manager response...</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
