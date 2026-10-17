import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-navy-800/80 rounded-xl ${className}`}
      aria-hidden="true"
    />
  );
};

export const ListingCardSkeleton: React.FC = () => {
  return (
    <div className="bg-navy-900/80 border border-navy-800 rounded-2xl overflow-hidden shadow-lg p-0">
      <Skeleton className="w-full h-52 rounded-none" />
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="w-24 h-5" />
          <Skeleton className="w-16 h-5" />
        </div>
        <Skeleton className="w-4/5 h-6" />
        <Skeleton className="w-1/2 h-4" />
        <div className="pt-2 border-t border-navy-800 flex justify-between items-center">
          <Skeleton className="w-24 h-7" />
          <Skeleton className="w-28 h-9 rounded-xl" />
        </div>
      </div>
    </div>
  );
};
