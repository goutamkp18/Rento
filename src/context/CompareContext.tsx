import React, { createContext, useContext, useState, useEffect } from 'react';
import { PGListing } from '../types';
import { useToast } from './ToastContext';

interface CompareContextType {
  compareListings: PGListing[];
  addToCompare: (listing: PGListing) => boolean;
  removeFromCompare: (listingId: string) => void;
  clearCompare: () => void;
  isComparing: (listingId: string) => boolean;
  compareCount: number;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

const COMPARE_STORAGE_KEY = 'rento_compare_items';

export const CompareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [compareListings, setCompareListings] = useState<PGListing[]>(() => {
    try {
      const saved = localStorage.getItem(COMPARE_STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed)
        ? parsed.filter(
            (l: any) =>
              l?.id &&
              !l.id.startsWith('pg_mock_') &&
              l.id !== 'pg_sunrise_01' &&
              l.id !== 'pg_elite_02'
          )
        : [];
    } catch {
      return [];
    }
  });

  const { showToast } = useToast();

  useEffect(() => {
    try {
      localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(compareListings));
    } catch (e) {
      console.error(e);
    }
  }, [compareListings]);

  const isComparing = (listingId: string): boolean => {
    return compareListings.some(l => l.id === listingId);
  };

  const addToCompare = (listing: PGListing): boolean => {
    if (isComparing(listing.id)) {
      showToast({
        type: 'info',
        title: 'Already in comparison',
        message: `${listing.name} is already in your comparison list`,
      });
      return false;
    }

    if (compareListings.length >= 3) {
      showToast({
        type: 'warning',
        title: 'Comparison limit reached',
        message: 'You can compare up to 3 PGs at a time. Please remove one first.',
      });
      return false;
    }

    setCompareListings(prev => [...prev, listing]);
    showToast({
      type: 'success',
      title: 'Added to compare',
      message: `${listing.name} added. (${compareListings.length + 1}/3 slots used)`,
      isMockPersisted: true,
    });
    return true;
  };

  const removeFromCompare = (listingId: string): void => {
    setCompareListings(prev => prev.filter(l => l.id !== listingId));
    showToast({
      type: 'info',
      title: 'Removed from compare',
      message: 'Property removed from comparison tray',
    });
  };

  const clearCompare = (): void => {
    setCompareListings([]);
    showToast({
      type: 'info',
      title: 'Comparison cleared',
      message: 'All properties removed from comparison',
    });
  };

  return (
    <CompareContext.Provider
      value={{
        compareListings,
        addToCompare,
        removeFromCompare,
        clearCompare,
        isComparing,
        compareCount: compareListings.length,
      }}
    >
      {children}
    </CompareContext.Provider>
  );
};

export function useCompare(): CompareContextType {
  const context = useContext(CompareContext);
  if (!context) {
    throw new Error('useCompare must be used within a CompareProvider');
  }
  return context;
}
