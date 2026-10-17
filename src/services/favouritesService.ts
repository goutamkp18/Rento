import { PGListing } from '../types';
import { listingsService } from './listingsService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { authService } from './authService';

const FAVOURITES_KEY = 'rento_student_favourites';

function getStoredFavIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVOURITES_KEY);
    if (!raw) {
      return [];
    }
    const parsed: string[] = JSON.parse(raw);
    return parsed.filter(id => id !== 'pg_sunrise_01' && id !== 'pg_elite_02');
  } catch {
    return [];
  }
}

function saveFavIds(ids: string[]): void {
  try {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error('Failed to save favourites to localStorage', e);
  }
}

export const favouritesService = {
  async getFavouriteIds(): Promise<string[]> {
    const currentUser = authService.getCurrentUser();
    if (isSupabaseConfigured && supabase && currentUser?.id) {
      try {
        const { data, error } = await supabase
          .from('favourites')
          .select('listing_id')
          .eq('student_id', currentUser.id);

        if (!error && data) {
          const ids = data.map(item => item.listing_id);
          saveFavIds(ids);
          return ids;
        }
      } catch (e) {
        console.warn('Supabase getFavouriteIds fetch notice:', e);
      }
    }
    return getStoredFavIds();
  },

  isFavourite(listingId: string): boolean {
    const ids = getStoredFavIds();
    return ids.includes(listingId);
  },

  async toggleFavourite(listingId: string): Promise<boolean> {
    const currentUser = authService.getCurrentUser();
    const ids = getStoredFavIds();
    const exists = ids.includes(listingId);
    let updated: string[];

    if (exists) {
      updated = ids.filter(id => id !== listingId);
    } else {
      updated = [...ids, listingId];
    }

    saveFavIds(updated);

    if (isSupabaseConfigured && supabase && currentUser?.id) {
      try {
        if (exists) {
          await supabase
            .from('favourites')
            .delete()
            .eq('student_id', currentUser.id)
            .eq('listing_id', listingId);
        } else {
          await supabase
            .from('favourites')
            .insert([{ student_id: currentUser.id, listing_id: listingId }]);
        }
      } catch (e) {
        console.warn('Supabase toggleFavourite sync error:', e);
      }
    }

    return !exists; // true if added, false if removed
  },

  async getFavouriteListings(): Promise<PGListing[]> {
    const ids = await this.getFavouriteIds();
    if (ids.length === 0) return [];
    const all = await listingsService.getListings(undefined, true);
    return all.filter(l => ids.includes(l.id));
  }
};

