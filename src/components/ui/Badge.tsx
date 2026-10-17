import React from 'react';
import { CheckCircle2, ShieldCheck, Clock, AlertCircle, Sparkles, User, Users, FileCheck } from 'lucide-react';
import { ListingPublicationStatus, ListingVerificationStatus } from '../../types';

export type BadgeVariant =
  | ListingPublicationStatus
  | ListingVerificationStatus
  | 'popular'
  | 'new'
  | 'boys'
  | 'girls'
  | 'unisex'
  | 'submitted'
  | 'responded'
  | 'visit_confirmed'
  | 'visit_declined'
  | 'closed'
  | 'success'
  | 'glow'
  | 'outline'
  | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
  children?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  label,
  size = 'md',
  className = '',
  children,
}) => {
  const sizeClasses = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  let config = {
    bg: 'bg-slate-800 text-slate-300 border-slate-700',
    icon: null as React.ReactNode,
    defaultLabel: 'Badge',
  };

  switch (variant) {
    case 'verified':
      config = {
        bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
        icon: <ShieldCheck className="w-3.5 h-3.5 shrink-0" />,
        defaultLabel: 'Verified',
      };
      break;
    case 'in_progress':
    case 'pending_verification':
      config = {
        bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
        icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
        defaultLabel: 'Pending Verification',
      };
      break;
    case 'owner_submitted':
      config = {
        bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
        icon: <FileCheck className="w-3.5 h-3.5 shrink-0" />,
        defaultLabel: 'Owner Submitted',
      };
      break;
    case 'unverified':
      config = {
        bg: 'bg-navy-800 text-slate-600 dark:text-slate-400 border-navy-700',
        icon: <AlertCircle className="w-3.5 h-3.5 shrink-0" />,
        defaultLabel: 'Unverified',
      };
      break;
    case 'popular':
      config = {
        bg: 'bg-brand-500/15 text-brand-700 dark:text-brand-300 border-brand-500/30',
        icon: <Sparkles className="w-3.5 h-3.5 shrink-0" />,
        defaultLabel: 'Popular',
      };
      break;
    case 'new':
      config = {
        bg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
        icon: <Sparkles className="w-3.5 h-3.5 shrink-0" />,
        defaultLabel: 'New',
      };
      break;
    case 'boys':
      config = {
        bg: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
        icon: <User className="w-3 h-3 shrink-0" />,
        defaultLabel: 'Boys Only',
      };
      break;
    case 'girls':
      config = {
        bg: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30',
        icon: <User className="w-3 h-3 shrink-0" />,
        defaultLabel: 'Girls Only',
      };
      break;
    case 'unisex':
      config = {
        bg: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
        icon: <Users className="w-3 h-3 shrink-0" />,
        defaultLabel: 'Co-Ed / Unisex',
      };
      break;
    case 'published':
      config = {
        bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
        defaultLabel: 'Published',
      };
      break;
    case 'pending_review':
    case 'under_review':
      config = {
        bg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
        defaultLabel: 'Pending Review',
      };
      break;
    case 'draft':
      config = {
        bg: 'bg-navy-800 text-slate-600 dark:text-slate-300 border-navy-700',
        icon: null,
        defaultLabel: 'Draft',
      };
      break;
    case 'paused':
      config = {
        bg: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
        icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
        defaultLabel: 'Paused',
      };
      break;
    case 'rejected':
      config = {
        bg: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
        icon: <AlertCircle className="w-3.5 h-3.5 shrink-0" />,
        defaultLabel: 'Rejected',
      };
      break;
    case 'submitted':
      config = {
        bg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
        icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
        defaultLabel: 'Submitted',
      };
      break;
    case 'responded':
      config = {
        bg: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
        icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
        defaultLabel: 'Responded',
      };
      break;
    case 'visit_confirmed':
      config = {
        bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
        defaultLabel: 'Visit Confirmed',
      };
      break;
    case 'visit_declined':
      config = {
        bg: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
        icon: <AlertCircle className="w-3.5 h-3.5 shrink-0" />,
        defaultLabel: 'Visit Declined',
      };
      break;
    case 'closed':
      config = {
        bg: 'bg-navy-800 text-slate-500 dark:text-slate-400 border-navy-700',
        icon: null,
        defaultLabel: 'Closed',
      };
      break;
    case 'success':
      config = {
        bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
        icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
        defaultLabel: 'Success',
      };
      break;
    case 'glow':
      config = {
        bg: 'bg-brand-500/20 text-brand-700 dark:text-brand-300 border-brand-500/40 shadow-sm shadow-brand-500/20',
        icon: <Sparkles className="w-3.5 h-3.5 shrink-0" />,
        defaultLabel: 'Recommended',
      };
      break;
    case 'outline':
      config = {
        bg: 'bg-navy-900 text-slate-700 dark:text-slate-300 border-navy-700',
        icon: null,
        defaultLabel: 'Standard',
      };
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${config.bg} ${sizeClasses} ${className}`}
    >
      {config.icon}
      <span>{children || label || config.defaultLabel}</span>
    </span>
  );
};
