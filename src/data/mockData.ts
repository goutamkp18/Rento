import { PGListing, Enquiry, UserProfile } from '../types';

/**
 * RENTO DATA SOURCE
 * Fabricated listings, dummy accounts, and fake enquiries have been removed.
 * Real data is created by actual PG owners and students via the application
 * and persisted to the connected backend (Supabase or local persistent database).
 */

export const MOCK_USERS: Record<string, UserProfile> = {};

export const MOCK_LISTINGS: PGListing[] = [];

export const MOCK_ENQUIRIES: Enquiry[] = [];

/**
 * Standard configuration constants for Bangalore university hubs & localities
 */
export const POPULAR_COLLEGES = [
  'RV College of Engineering (RVCE)',
  'BMS College of Engineering (BMSCE)',
  'Christ University (Central Campus)',
  'PES University (RR Campus)',
  'St. Joseph’s University',
  'MS Ramaiah Institute of Technology',
  'Mount Carmel College',
  'NIFT Bangalore',
  'IIM Bangalore'
];

export const POPULAR_LOCALITIES = [
  'Jayanagar',
  'Basavanagudi',
  'Koramangala',
  'Indiranagar',
  'HSR Layout',
  'Bannerghatta Road',
  'BTM Layout',
  'Electronic City'
];
