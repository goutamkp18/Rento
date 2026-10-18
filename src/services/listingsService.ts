import { PGListing, FilterState, ListingPublicationStatus, ListingVerificationStatus, ListingRevision, RevisionStatus, UserProfile, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { authService, getStoredUser } from './authService';
import { subscriptionService } from './subscriptionService';
import { storageService } from './storageService';
import { auditService } from './auditService';

const REVISIONS_STORAGE_KEY = 'rento_listing_revisions';

function getLocalRevisions(): ListingRevision[] {
  try {
    const raw = localStorage.getItem(REVISIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalRevisions(revisions: ListingRevision[]): void {
  try {
    localStorage.setItem(REVISIONS_STORAGE_KEY, JSON.stringify(revisions));
  } catch (e) {
    console.error('Failed to save local revisions:', e);
  }
}

export function mapListingFromDb(raw: any): PGListing {
  const images =
    raw.listing_images && Array.isArray(raw.listing_images) && raw.listing_images.length > 0
      ? raw.listing_images
      : Array.isArray(raw.images)
      ? raw.images
      : [];
  const rooms = Array.isArray(raw.rooms) ? raw.rooms : [];
  return {
    ...raw,
    images,
    rooms,
  } as PGListing;
}

export const listingsService = {
  async getListings(filter?: Partial<FilterState>, includeUnpublished = false): Promise<PGListing[]> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured. Please check your environment variables.');
    }

    let query = supabase
      .from('pg_listings')
      .select('*, rooms(*), listing_images(*)');

    if (!includeUnpublished) {
      query = query.eq('publication_status', 'published');
    }

    const { data, error } = await query;
    if (error) {
      console.error('Supabase getListings error:', error);
      throw new Error(error.message || 'Failed to load property listings from database.');
    }

    let results: PGListing[] = (data || []).map(mapListingFromDb);

    if (filter) {
      if (filter.searchQuery && filter.searchQuery.trim() !== '') {
        const query = filter.searchQuery.toLowerCase().trim();
        results = results.filter(
          l =>
            l.name.toLowerCase().includes(query) ||
            l.locality.toLowerCase().includes(query) ||
            l.city.toLowerCase().includes(query) ||
            l.nearby_colleges.some(c => c.college_name.toLowerCase().includes(query))
        );
      }

      if (filter.city && filter.city !== 'all') {
        results = results.filter(l => l.city.toLowerCase() === filter.city?.toLowerCase());
      }

      if (filter.locality && filter.locality !== 'all') {
        results = results.filter(l => l.locality.toLowerCase() === filter.locality?.toLowerCase());
      }

      if (filter.college && filter.college !== 'all') {
        results = results.filter(l =>
          l.nearby_colleges.some(c => c.college_name.toLowerCase().includes(filter.college!.toLowerCase()))
        );
      }

      if (filter.minPrice !== undefined && filter.minPrice > 0) {
        results = results.filter(l => l.min_monthly_rent >= filter.minPrice!);
      }

      if (filter.maxPrice !== undefined && filter.maxPrice > 0) {
        results = results.filter(l => l.min_monthly_rent <= filter.maxPrice!);
      }

      if (filter.gender && filter.gender !== 'all') {
        results = results.filter(
          l => l.gender_preference === filter.gender || l.gender_preference === 'unisex'
        );
      }

      if (filter.foodType && filter.foodType !== 'all') {
        results = results.filter(l => l.food_type === filter.foodType || l.food_type === 'both');
      }

      if (filter.roomTypes && filter.roomTypes.length > 0) {
        results = results.filter(l =>
          l.rooms.some(r => filter.roomTypes!.includes(r.room_type))
        );
      }

      if (filter.amenities && filter.amenities.length > 0) {
        results = results.filter(l =>
          filter.amenities!.every(reqAmenity =>
            l.amenities.some(a => a.toLowerCase().includes(reqAmenity.toLowerCase()))
          )
        );
      }

      if (filter.verifiedOnly) {
        results = results.filter(l => l.verification_status === 'verified');
      }

      if (filter.availableOnly) {
        results = results.filter(l =>
          l.rooms.some(r => r.available_beds > 0) && l.publication_status === 'published'
        );
      }

      // Sorting
      if (filter.sortBy === 'price_asc') {
        results.sort((a, b) => a.min_monthly_rent - b.min_monthly_rent);
      } else if (filter.sortBy === 'price_desc') {
        results.sort((a, b) => b.min_monthly_rent - a.min_monthly_rent);
      } else if (filter.sortBy === 'rating') {
        results.sort((a, b) => b.rating - a.rating);
      } else if (filter.sortBy === 'newest') {
        results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    }

    return results;
  },

  async getListingById(id: string): Promise<PGListing | null> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Database connection required.');
    }

    const { data, error } = await supabase
      .from('pg_listings')
      .select('*, rooms(*), listing_images(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Supabase getListingById error:', error);
      throw new Error(error.message);
    }

    if (!data) return null;

    const listing = mapListingFromDb(data);
    try {
      const rev = await this.getListingRevision(id);
      if (rev) {
        listing.has_pending_revision = rev.status === 'pending_review' || rev.status === 'under_review';
        listing.pending_revision_id = rev.id;
        listing.pending_revision = rev;
      }
    } catch {}

    return listing;
  },

  async getFeaturedListings(): Promise<PGListing[]> {
    const all = await this.getListings(undefined, false);
    return all.filter(l => l.featured && l.publication_status === 'published');
  },

  async getOwnerListings(ownerId: string): Promise<PGListing[]> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Database connection required.');
    }

    const { data, error } = await supabase
      .from('pg_listings')
      .select('*, rooms(*), listing_images(*)')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase getOwnerListings error:', error);
      throw new Error(error.message);
    }
    const listings = (data || []).map(mapListingFromDb);

    try {
      const revisions = await this.getOwnerRevisions(ownerId);
      for (const listing of listings) {
        const activeRev = revisions.find(
          r => r.listing_id === listing.id && (r.status === 'pending_review' || r.status === 'under_review' || r.status === 'draft' || r.status === 'rejected')
        );
        if (activeRev) {
          listing.has_pending_revision = activeRev.status === 'pending_review' || activeRev.status === 'under_review';
          listing.pending_revision_id = activeRev.id;
          listing.pending_revision = activeRev;
        }
      }
    } catch {
      // Non-fatal enhancement
    }

    return listings;
  },


  async createListing(listingData: Partial<PGListing>, callerUser?: UserProfile | null): Promise<PGListing> {
    let resolvedOwnerId = '';
    let ownerName = listingData.owner_name || '';
    let ownerEmail = listingData.owner_email || '';
    let ownerPhone = listingData.owner_phone || '';
    let ownerType = listingData.owner_type || 'individual';
    let businessName = listingData.business_name || '';

    let currentUser = callerUser || authService.getCurrentUser() || getStoredUser();

    // Verify authenticated user directly from Supabase session if available
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        let authUser: any = sessionData.session?.user;
        if (!authUser) {
          const { data: userData } = await supabase.auth.getUser();
          authUser = userData?.user;
        }

        if (authUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

          resolvedOwnerId = authUser.id;
          ownerName = profile?.full_name || authUser.email?.split('@')[0] || ownerName;
          ownerEmail = authUser.email || profile?.email || ownerEmail;
          ownerPhone = profile?.phone || ownerPhone;
          ownerType = profile?.owner_type || ownerType;
          businessName = profile?.business_name || businessName;

          currentUser = {
            id: authUser.id,
            email: ownerEmail,
            full_name: ownerName,
            role: profile?.role || (authUser.app_metadata?.role as UserRole) || 'owner',
            phone: ownerPhone,
            owner_type: ownerType,
            business_name: businessName,
            created_at: authUser.created_at || new Date().toISOString(),
          };
          authService.saveSession(currentUser);
        }
      } catch (authErr) {
        console.warn('Supabase auth check notice in createListing:', authErr);
      }
    }

    if (!resolvedOwnerId && currentUser) {
      resolvedOwnerId = currentUser.id;
      ownerName = ownerName || currentUser.full_name;
      ownerEmail = ownerEmail || currentUser.email;
      ownerPhone = ownerPhone || currentUser.phone || '';
      ownerType = ownerType || currentUser.owner_type || 'individual';
      businessName = businessName || currentUser.business_name || '';
    }

    if (!resolvedOwnerId) {
      throw new Error('Authentication required to create a property listing. Please sign in.');
    }

    if (currentUser && currentUser.role !== 'owner' && currentUser.role !== 'admin') {
      throw new Error('Access Denied: Only registered PG Owners can create listings.');
    }

    // Enforce subscription listing limit for owners (Admins bypass capacity constraints)
    const isAdmin = currentUser?.role === 'admin' || (await authService.verifyAdminPrivileges(currentUser));
    if (!isAdmin) {
      const ownerListings = await this.getOwnerListings(resolvedOwnerId);
      const capacityCheck = await subscriptionService.checkListingCapacity(resolvedOwnerId, ownerListings.length);

      if (!capacityCheck.hasActiveSubscription) {
        throw new Error('Active PG Owner subscription required before creating property listings.');
      }

      if (!capacityCheck.canAdd) {
        throw new Error(
          capacityCheck.reason ||
            `Subscription listing limit reached (${ownerListings.length}/${capacityCheck.limit}). Please upgrade your plan to register additional properties.`
        );
      }
    }

    const newListing: PGListing = {
      id: listingData.id || `pg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      owner_id: resolvedOwnerId,
      owner_name: ownerName,
      owner_phone: ownerPhone,
      owner_email: ownerEmail,
      owner_type: (ownerType as 'individual' | 'property_manager') || 'individual',
      business_name: businessName,
      name: listingData.name || '',
      tagline: listingData.tagline || '',
      description: listingData.description || '',
      property_type: listingData.property_type || 'pg',
      gender_preference: listingData.gender_preference || 'unisex',
      address: listingData.address || '',
      locality: listingData.locality || '',
      city: listingData.city || 'Bangalore',
      state: listingData.state || 'Karnataka',
      postal_code: listingData.postal_code || '',
      landmark: listingData.landmark || '',
      google_maps_url: listingData.google_maps_url || '',
      nearby_colleges: listingData.nearby_colleges || [],
      min_monthly_rent: Number(listingData.min_monthly_rent) || 0,
      max_monthly_rent: Number(listingData.max_monthly_rent) || 0,
      security_deposit: Number(listingData.security_deposit) || 0,
      maintenance_charge: Number(listingData.maintenance_charge) || 0,
      electricity_policy: listingData.electricity_policy || '',
      notice_period_days: Number(listingData.notice_period_days) || 30,
      lock_in_months: Number(listingData.lock_in_months) || 1,
      food_type: listingData.food_type || 'both',
      meals_provided: listingData.meals_provided || [],
      food_description: listingData.food_description || '',
      amenities: listingData.amenities || [],
      house_rules: listingData.house_rules || [],
      publication_status: listingData.publication_status || 'pending_review',
      verification_status: 'pending_verification',
      rating: 0,
      reviews_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rooms: listingData.rooms || [],
      images: listingData.images || [],
      documents: listingData.documents || [],
      featured: false,
    };

    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database connection required to save listing.');
    }

    const insertPayload: any = {
      id: newListing.id,
      owner_id: newListing.owner_id,
      owner_name: newListing.owner_name,
      owner_phone: newListing.owner_phone,
      owner_email: newListing.owner_email,
      name: newListing.name,
      tagline: newListing.tagline,
      description: newListing.description,
      property_type: newListing.property_type,
      gender_preference: newListing.gender_preference,
      address: newListing.address,
      locality: newListing.locality,
      city: newListing.city,
      state: newListing.state,
      postal_code: newListing.postal_code,
      landmark: newListing.landmark,
      google_maps_url: newListing.google_maps_url || null,
      min_monthly_rent: newListing.min_monthly_rent,
      max_monthly_rent: newListing.max_monthly_rent,
      security_deposit: newListing.security_deposit,
      maintenance_charge: newListing.maintenance_charge,
      electricity_policy: newListing.electricity_policy,
      notice_period_days: newListing.notice_period_days,
      lock_in_months: newListing.lock_in_months,
      food_type: newListing.food_type,
      meals_provided: newListing.meals_provided,
      food_description: newListing.food_description,
      amenities: newListing.amenities,
      house_rules: newListing.house_rules,
      nearby_colleges: newListing.nearby_colleges,
      publication_status: newListing.publication_status,
      verification_status: newListing.verification_status,
    };

    let listingErr: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await supabase.from('pg_listings').insert([insertPayload]);
      listingErr = res.error;
      if (!listingErr) break;

      const missingColMatch =
        listingErr.message?.match(/Could not find the '([^']+)' column of 'pg_listings'/i) ||
        listingErr.message?.match(/column "([^"]+)" of relation "pg_listings" does not exist/i) ||
        listingErr.message?.match(/column pg_listings\.([^ ]+) does not exist/i);

      if (missingColMatch && missingColMatch[1]) {
        console.warn(`[Auto-Recovery] Removing missing column '${missingColMatch[1]}' from pg_listings insert payload and retrying.`);
        delete insertPayload[missingColMatch[1]];
        continue;
      }

      if (listingErr.message?.includes('google_maps_url')) {
        delete insertPayload.google_maps_url;
        continue;
      }
      if (listingErr.message?.includes('business_name')) {
        delete insertPayload.business_name;
        continue;
      }
      if (listingErr.message?.includes('owner_type')) {
        delete insertPayload.owner_type;
        continue;
      }
      break;
    }

    if (listingErr) {
      console.error('Supabase pg_listings insert error:', listingErr);
      throw new Error(`Failed to save property listing: ${listingErr.message}`);
    }

    // Insert rooms into rooms table
    if (newListing.rooms && newListing.rooms.length > 0) {
      const roomsToInsert = newListing.rooms.map(r => ({
        id: r.id || `rm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        listing_id: newListing.id,
        room_type: r.room_type,
        room_name: r.room_name,
        monthly_rent: r.rent_per_bed,
        rent_per_bed: r.rent_per_bed,
        deposit_amount: r.deposit_amount,
        total_capacity: r.total_capacity,
        available_beds: r.available_beds,
        has_attached_washroom: r.has_attached_washroom,
        is_air_conditioned: r.is_air_conditioned,
        has_balcony: r.has_balcony,
        room_amenities: r.room_amenities || [],
      }));
      const { error: roomsErr } = await supabase.from('rooms').insert(roomsToInsert);
      if (roomsErr) {
        console.warn('Rooms insert notice:', roomsErr.message);
      }
    }

    // Insert listing images into listing_images table
    if (newListing.images && newListing.images.length > 0) {
      await this.saveListingImages(newListing.id, newListing.images);
    }

    return newListing;
  },

  async saveListingImages(
    listingId: string,
    images: {
      id?: string;
      image_url: string;
      caption?: string;
      category?: string;
      is_primary?: boolean;
      display_order?: number;
    }[]
  ): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    const { error: delErr } = await supabase
      .from('listing_images')
      .delete()
      .eq('listing_id', listingId);
    if (delErr) {
      console.warn('Listing images cleanup notice:', delErr.message);
    }

    if (!images || images.length === 0) return;

    const imagesToInsert = images.map((img, idx) => ({
      id: img.id || `img_${Date.now()}_${idx}`,
      listing_id: listingId,
      image_url: img.image_url,
      caption: img.caption || '',
      category: img.category || 'common',
      is_primary: img.is_primary ?? idx === 0,
      display_order: img.display_order ?? idx + 1,
    }));

    const { error: insErr } = await supabase.from('listing_images').insert(imagesToInsert);
    if (insErr) {
      console.error('Failed to insert listing images:', insErr);
      throw new Error(`Failed to save property image records: ${insErr.message}`);
    }
  },

  async updateListing(
    id: string,
    updates: Partial<PGListing>,
    callerUser?: UserProfile | null
  ): Promise<PGListing> {
    let currentUser = callerUser || authService.getCurrentUser();

    // Fallback: If not found in localStorage, verify directly from active Supabase session
    if (!currentUser && isSupabaseConfigured && supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        let authUser: any = sessionData.session?.user;
        if (!authUser) {
          const { data: userData } = await supabase.auth.getUser();
          authUser = userData?.user;
        }

        if (authUser) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

          currentUser = {
            id: authUser.id,
            email: authUser.email || prof?.email || '',
            full_name: prof?.full_name || authUser.email?.split('@')[0] || 'User',
            role: prof?.role || (authUser.app_metadata?.role as UserRole) || 'owner',
            phone: prof?.phone || '',
            owner_type: prof?.owner_type,
            business_name: prof?.business_name,
            created_at: prof?.created_at || authUser.created_at || new Date().toISOString(),
          };
          authService.saveSession(currentUser);
        }
      } catch (authErr) {
        console.warn('Fallback user resolution notice in updateListing:', authErr);
      }
    }

    if (!currentUser) {
      currentUser = getStoredUser();
    }

    if (!currentUser) {
      throw new Error('Authentication required to modify property listings.');
    }

    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Database connection required.');
    }

    const existing = await this.getListingById(id);
    if (!existing) throw new Error(`Listing with ID ${id} not found in database.`);

    const isAdmin = await authService.verifyAdminPrivileges(currentUser);

    // BOLA / IDOR Check: Ensure caller owns the listing or is a verified admin
    if (!isAdmin && existing.owner_id !== currentUser.id) {
      throw new Error('Access Denied: You do not have permission to modify another owner\'s property.');
    }

    // Role Escalation Check: Prevent owners from approving or verifying own property
    if (!isAdmin) {
      if (updates.verification_status && updates.verification_status !== existing.verification_status) {
        throw new Error('Unauthorized: Only administrators can modify property verification status.');
      }
      // Allow owners to resume their own paused listings without re-review
      if (
        updates.publication_status === 'published' &&
        existing.publication_status !== 'published' &&
        existing.publication_status !== 'paused'
      ) {
        throw new Error('Unauthorized: Listings require administrator approval to be published.');
      }
    }

    const sanitizedUpdates: any = { ...updates };
    const imagesToUpdate = sanitizedUpdates.images;

    // Synchronize business_name and owner_type to profiles table if present
    if (isSupabaseConfigured && supabase && existing.owner_id && (sanitizedUpdates.business_name || sanitizedUpdates.owner_type)) {
      try {
        const profUpdates: any = {};
        if (sanitizedUpdates.business_name !== undefined) profUpdates.business_name = sanitizedUpdates.business_name;
        if (sanitizedUpdates.owner_type !== undefined) profUpdates.owner_type = sanitizedUpdates.owner_type;
        await supabase.from('profiles').update(profUpdates).eq('id', existing.owner_id);
      } catch (profErr) {
        console.warn('Profile business_name sync notice:', profErr);
      }
    }

    // Strip non-table or joined properties from the pg_listings update payload
    delete sanitizedUpdates.rooms;
    delete sanitizedUpdates.images;
    delete sanitizedUpdates.documents;
    delete sanitizedUpdates.listing_images;
    delete sanitizedUpdates.pending_revision;
    delete sanitizedUpdates.business_name;
    delete sanitizedUpdates.owner_type;
    delete sanitizedUpdates.reviews_count;

    if (sanitizedUpdates.featured !== undefined && sanitizedUpdates.is_featured === undefined) {
      sanitizedUpdates.is_featured = sanitizedUpdates.featured;
    }
    delete sanitizedUpdates.featured;

    let payload: any = {
      ...sanitizedUpdates,
      updated_at: new Date().toISOString(),
    };

    let data: any = null;
    let error: any = null;

    // Resilient update loop: automatically strips any missing schema cache columns reported by Supabase
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await supabase
        .from('pg_listings')
        .update(payload)
        .eq('id', id)
        .select('*, rooms(*), listing_images(*)')
        .maybeSingle();

      data = res.data;
      error = res.error;

      if (!error) break;

      // Check if error is due to missing column in Supabase schema cache
      const missingColMatch =
        error.message?.match(/Could not find the '([^']+)' column of 'pg_listings'/i) ||
        error.message?.match(/column "([^"]+)" of relation "pg_listings" does not exist/i) ||
        error.message?.match(/column pg_listings\.([^ ]+) does not exist/i);

      if (missingColMatch && missingColMatch[1]) {
        const missingCol = missingColMatch[1];
        console.warn(`[Auto-Recovery] Removing missing column '${missingCol}' from pg_listings payload and retrying update.`);
        delete payload[missingCol];
        continue;
      }

      if (error.message?.includes('has_pending_revision') || error.message?.includes('pending_revision_id')) {
        delete payload.has_pending_revision;
        delete payload.pending_revision_id;
        continue;
      }

      if (error.message?.includes('rejection_reason')) {
        const reason = payload.rejection_reason;
        delete payload.rejection_reason;
        if (reason) payload.verification_notes = reason;
        continue;
      }

      if (error.message?.includes('google_maps_url')) {
        delete payload.google_maps_url;
        continue;
      }

      break;
    }

    if (error) {
      console.error('Supabase updateListing error after recovery attempts:', error);
      throw new Error(`Failed to update listing: ${error.message}`);
    }

    if (imagesToUpdate && Array.isArray(imagesToUpdate)) {
      await this.saveListingImages(id, imagesToUpdate);
    }

    if (!data) {
      return {
        ...existing,
        ...updates,
      } as PGListing;
    }

    return mapListingFromDb(data);
  },


  async updateListingStatus(
    id: string,
    status: ListingPublicationStatus,
    callerUser?: UserProfile | null
  ): Promise<PGListing> {
    return this.updateListing(id, { publication_status: status }, callerUser);
  },

  async updateListingVerification(
    id: string,
    status: ListingVerificationStatus,
    notes?: string,
    callerUser?: UserProfile | null
  ): Promise<PGListing> {
    const isAdmin = await authService.verifyAdminPrivileges(callerUser);
    if (!isAdmin) {
      throw new Error('Unauthorized: Administrator privileges required to modify verification status.');
    }

    const updates: Partial<PGListing> = {
      verification_status: status,
      verification_notes: notes,
      verified_at: status === 'verified' ? new Date().toISOString() : undefined,
    };
    return this.updateListing(id, updates, callerUser);
  },

  async getAdminPendingListings(callerUser?: UserProfile | null): Promise<PGListing[]> {
    const isAdmin = await authService.verifyAdminPrivileges(callerUser);
    if (!isAdmin) {
      throw new Error('Unauthorized: Administrator privileges required to access the moderation review queue.');
    }

    const all = await this.getListings(undefined, true);
    return all.filter(
      l =>
        l.publication_status === 'pending_review' ||
        l.publication_status === 'under_review' ||
        l.verification_status === 'pending_verification' ||
        l.verification_status === 'in_progress'
    );
  },

  async getAllListingsForAdmin(callerUser?: UserProfile | null): Promise<PGListing[]> {
    const isAdmin = await authService.verifyAdminPrivileges(callerUser);
    if (!isAdmin) {
      throw new Error('Unauthorized: Administrator privileges required to access all listings.');
    }

    return this.getListings(undefined, true);
  },

  /**
   * Delete a listing completely from both Supabase database and storage
   */
  async deleteListing(id: string, callerUser?: UserProfile | null): Promise<boolean> {
    let currentUser = callerUser || authService.getCurrentUser() || getStoredUser();
    if (!currentUser && isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          currentUser = {
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.email?.split('@')[0] || 'User',
            role: (session.user.app_metadata?.role as UserRole) || 'owner',
            created_at: session.user.created_at || new Date().toISOString(),
          };
        }
      } catch {}
    }
    if (!currentUser) {
      throw new Error('Authentication required to delete a property listing.');
    }

    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database connection required.');
    }

    const existing = await this.getListingById(id);
    if (!existing) {
      throw new Error(`Listing with ID "${id}" not found.`);
    }

    const isAdmin = await authService.verifyAdminPrivileges(currentUser);

    // IDOR check: Only owner or verified admin can delete the listing
    if (!isAdmin && existing.owner_id !== currentUser.id) {
      throw new Error('Unauthorized: You can only delete your own property listings.');
    }

    // 1. Delete all images from Supabase Storage bucket 'property-images'
    try {
      await storageService.deleteListingFolder(existing.owner_id, id);
      const imageUrls = existing.images.map(img => img.image_url);
      if (imageUrls.length > 0) {
        await storageService.deleteImagesByUrls(imageUrls);
      }
    } catch (storageErr) {
      console.warn('Storage images cleanup warning:', storageErr);
    }

    // 2. Explicitly remove all child records from related tables
    try {
      await supabase.from('favourites').delete().eq('listing_id', id);
    } catch (_) {}

    try {
      await supabase.from('enquiries').delete().eq('listing_id', id);
    } catch (_) {}

    try {
      await supabase.from('listing_images').delete().eq('listing_id', id);
    } catch (_) {}

    try {
      await supabase.from('rooms').delete().eq('listing_id', id);
    } catch (_) {}

    // 3. Delete the parent listing from public.pg_listings
    const { data: deletedRows, error: delError } = await supabase
      .from('pg_listings')
      .delete()
      .eq('id', id)
      .select();

    if (delError) {
      console.error('Supabase pg_listings delete error:', delError);
      throw new Error(`Failed to delete listing from database: ${delError.message}`);
    }

    if (!deletedRows || deletedRows.length === 0) {
      console.error('Supabase returned 0 deleted rows for listing id:', id);
      throw new Error(
        'Database Row-Level Security (RLS) blocked the deletion. Please run the DELETE policy SQL in your Supabase SQL Editor to allow permanent deletion.'
      );
    }

    return true;
  },

  /**
   * Get any active pending or draft revision for a specific listing
   */
  async getListingRevision(listingId: string): Promise<ListingRevision | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('listing_revisions')
          .select('*')
          .eq('listing_id', listingId)
          .order('submission_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          return data as ListingRevision;
        }
      } catch (e) {
        console.warn('Supabase getListingRevision notice:', e);
      }
    }

    const locals = getLocalRevisions();
    return locals.find(r => r.listing_id === listingId) || null;
  },

  /**
   * Get all revisions submitted by a specific property owner
   */
  async getOwnerRevisions(ownerId: string): Promise<ListingRevision[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('listing_revisions')
          .select('*')
          .eq('owner_id', ownerId)
          .order('submission_date', { ascending: false });

        if (!error && data) {
          return data as ListingRevision[];
        }
      } catch (e) {
        console.warn('Supabase getOwnerRevisions notice:', e);
      }
    }

    return getLocalRevisions().filter(r => r.owner_id === ownerId);
  },

  /**
   * Admin: Get all pending property revisions awaiting review with current live details
   */
  async getAllPendingRevisionsForAdmin(callerUser?: UserProfile | null): Promise<(ListingRevision & { listing?: PGListing })[]> {
    const isAdmin = await authService.verifyAdminPrivileges(callerUser);
    if (!isAdmin) {
      throw new Error('Unauthorized: Administrator privileges required to access listing revisions.');
    }

    let revisions: ListingRevision[] = [];
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('listing_revisions')
          .select('*')
          .in('status', ['pending_review', 'under_review'])
          .order('submission_date', { ascending: false });

        if (!error && data) {
          revisions = data as ListingRevision[];
        }
      } catch (e) {
        console.warn('Supabase getAllPendingRevisionsForAdmin notice:', e);
      }
    }

    if (revisions.length === 0) {
      revisions = getLocalRevisions().filter(r => r.status === 'pending_review' || r.status === 'under_review');
    }

    const results: (ListingRevision & { listing?: PGListing })[] = [];
    for (const rev of revisions) {
      try {
        const currentListing = await this.getListingById(rev.listing_id);
        results.push({ ...rev, listing: currentListing || undefined });
      } catch {
        results.push(rev);
      }
    }

    return results;
  },

  /**
   * Owner: Save unfinished edits as a draft without submitting to admin verification queue
   */
  async saveListingDraft(
    listingId: string,
    proposedChanges: Partial<PGListing>,
    callerUser?: UserProfile | null
  ): Promise<{ listing: PGListing; revision?: ListingRevision }> {
    const currentUser = callerUser || authService.getCurrentUser() || getStoredUser();
    if (!currentUser) {
      throw new Error('Authentication required to save draft.');
    }

    const existing = await this.getListingById(listingId);
    if (!existing) {
      throw new Error(`Listing "${listingId}" not found in database.`);
    }

    const isAdmin = await authService.verifyAdminPrivileges(currentUser);
    if (!isAdmin && existing.owner_id !== currentUser.id) {
      throw new Error('Unauthorized: You can only edit your own property.');
    }

    // If listing is not yet published (e.g. draft, rejected), save directly to pg_listings
    if (existing.publication_status !== 'published') {
      const updated = await this.updateListing(listingId, {
        ...proposedChanges,
        publication_status: 'draft',
      }, currentUser);
      return { listing: updated };
    }

    // If listing IS published, do NOT touch public data; save proposed changes as a draft revision
    const revisionId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowTimestamp = new Date().toISOString();

    const revision: ListingRevision = {
      id: revisionId,
      listing_id: listingId,
      owner_id: existing.owner_id,
      status: 'draft',
      proposed_changes: proposedChanges,
      submission_date: nowTimestamp,
      created_at: nowTimestamp,
      updated_at: nowTimestamp,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('listing_revisions').upsert([
          {
            id: revision.id,
            listing_id: revision.listing_id,
            owner_id: revision.owner_id,
            status: revision.status,
            proposed_changes: revision.proposed_changes,
            submission_date: revision.submission_date,
            created_at: revision.created_at,
            updated_at: revision.updated_at,
          }
        ]);
      } catch (err) {
        console.warn('Supabase saveListingDraft notice:', err);
      }
    }

    const locals = getLocalRevisions().filter(r => !(r.listing_id === listingId && r.status === 'draft'));
    locals.unshift(revision);
    saveLocalRevisions(locals);

    return { listing: existing, revision };
  },

  /**
   * Owner: Submit changes for admin verification.
   * If published, keeps the current live approved version intact for students until admin approves!
   */
  async submitListingChangesForVerification(
    listingId: string,
    proposedChanges: Partial<PGListing>,
    callerUser?: UserProfile | null
  ): Promise<{ listing: PGListing; revision?: ListingRevision }> {
    const currentUser = callerUser || authService.getCurrentUser() || getStoredUser();
    if (!currentUser) {
      throw new Error('Authentication required to submit changes for verification.');
    }

    const existing = await this.getListingById(listingId);
    if (!existing) {
      throw new Error(`Listing "${listingId}" not found in database.`);
    }

    const isAdmin = await authService.verifyAdminPrivileges(currentUser);
    if (!isAdmin && existing.owner_id !== currentUser.id) {
      throw new Error('Unauthorized: You can only edit your own property.');
    }

    // If not yet published, update listing directly to pending_review
    if (existing.publication_status !== 'published') {
      const updated = await this.updateListing(listingId, {
        ...proposedChanges,
        publication_status: 'pending_review',
        verification_status: 'pending_verification',
      }, currentUser);
      return { listing: updated };
    }

    // If currently published, preserve published data for students and create a pending revision!
    const revisionId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const submissionTimestamp = new Date().toISOString();

    const revision: ListingRevision = {
      id: revisionId,
      listing_id: listingId,
      owner_id: existing.owner_id,
      status: 'pending_review',
      proposed_changes: proposedChanges,
      submission_date: submissionTimestamp,
      created_at: submissionTimestamp,
      updated_at: submissionTimestamp,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('listing_revisions').insert([
          {
            id: revision.id,
            listing_id: revision.listing_id,
            owner_id: revision.owner_id,
            status: revision.status,
            proposed_changes: revision.proposed_changes,
            submission_date: revision.submission_date,
            created_at: revision.created_at,
            updated_at: revision.updated_at,
          }
        ]);

        // Flag has_pending_revision on pg_listings without altering publication_status!
        await supabase
          .from('pg_listings')
          .update({
            has_pending_revision: true,
            pending_revision_id: revision.id,
          })
          .eq('id', listingId);
      } catch (err) {
        console.warn('Supabase submitListingChanges notice:', err);
      }
    }

    const locals = getLocalRevisions().filter(r => !(r.listing_id === listingId && (r.status === 'draft' || r.status === 'pending_review')));
    locals.unshift(revision);
    saveLocalRevisions(locals);

    const updatedListing: PGListing = {
      ...existing,
      has_pending_revision: true,
      pending_revision_id: revision.id,
      pending_revision: revision,
    };

    return { listing: updatedListing, revision };
  },

  /**
   * Admin: Approve a pending property revision and atomically update live public listing
   */
  async approveRevision(
    revisionId: string,
    reviewerId?: string,
    callerUser?: UserProfile | null
  ): Promise<PGListing> {
    const isAdmin = await authService.verifyAdminPrivileges(callerUser);
    if (!isAdmin) {
      throw new Error('Unauthorized: Administrator privileges required to approve revisions.');
    }

    let revision: ListingRevision | null = null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('listing_revisions')
          .select('*')
          .eq('id', revisionId)
          .maybeSingle();
        if (!error && data) revision = data as ListingRevision;
      } catch (e) {
        console.warn('Supabase query revision notice:', e);
      }
    }

    if (!revision) {
      const local = getLocalRevisions().find(r => r.id === revisionId);
      if (local) revision = local;
    }

    if (!revision) {
      throw new Error(`Revision "${revisionId}" not found.`);
    }

    const listingId = revision.listing_id;
    const changes = revision.proposed_changes;
    const currentAdmin = callerUser || authService.getCurrentUser() || getStoredUser();
    const effectiveReviewer = reviewerId || currentAdmin?.id || 'usr_admin_ops';
    const approvalTimestamp = new Date().toISOString();

    // 1. Try atomic RPC if available
    let rpcSuccess = false;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('apply_approved_listing_revision', {
          p_revision_id: revisionId,
          p_admin_id: effectiveReviewer,
        });
        if (!rpcError && rpcData?.success) {
          rpcSuccess = true;
        }
      } catch (rpcErr) {
        console.warn('RPC apply_approved_listing_revision notice:', rpcErr);
      }
    }

    // 2. If RPC not available, perform application update
    if (!rpcSuccess) {
      const payloadToUpdate: any = {
        ...changes,
        publication_status: 'published',
        has_pending_revision: false,
        pending_revision_id: null,
        rejection_reason: null,
        updated_at: approvalTimestamp,
      };

      delete payloadToUpdate.rooms;
      delete payloadToUpdate.images;
      delete payloadToUpdate.documents;
      delete payloadToUpdate.listing_images;
      delete payloadToUpdate.business_name;
      delete payloadToUpdate.owner_type;
      delete payloadToUpdate.pending_revision;

      // Sync business_name and owner_type to the owner's profile
      if (revision.owner_id && (changes.business_name || changes.owner_type)) {
        if (isSupabaseConfigured && supabase) {
          try {
            const profUpdates: any = {};
            if (changes.business_name !== undefined) profUpdates.business_name = changes.business_name;
            if (changes.owner_type !== undefined) profUpdates.owner_type = changes.owner_type;
            await supabase.from('profiles').update(profUpdates).eq('id', revision.owner_id);
          } catch (pErr) {
            console.warn('Profile business_name sync notice on approval:', pErr);
          }
        }
      }

      await this.updateListing(listingId, payloadToUpdate, callerUser || currentAdmin);

      // Apply rooms if present in changes
      if (changes.rooms && Array.isArray(changes.rooms) && changes.rooms.length > 0) {
        if (isSupabaseConfigured && supabase) {
          try {
            await supabase.from('rooms').delete().eq('listing_id', listingId);
            const roomsToInsert = changes.rooms.map(r => ({
              id: r.id || `rm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              listing_id: listingId,
              room_type: r.room_type,
              room_name: r.room_name,
              monthly_rent: r.rent_per_bed,
              rent_per_bed: r.rent_per_bed,
              deposit_amount: r.deposit_amount,
              total_capacity: r.total_capacity,
              available_beds: r.available_beds,
              has_attached_washroom: r.has_attached_washroom,
              is_air_conditioned: r.is_air_conditioned,
              has_balcony: r.has_balcony,
              room_amenities: r.room_amenities || [],
            }));
            await supabase.from('rooms').insert(roomsToInsert);
          } catch (rErr) {
            console.warn('Rooms update notice:', rErr);
          }
        }
      }

      // Apply images if present in changes
      if (changes.images && Array.isArray(changes.images) && changes.images.length > 0) {
        await this.saveListingImages(listingId, changes.images);
      }

      if (isSupabaseConfigured && supabase) {
          try {
            await supabase
              .from('listing_revisions')
              .update({
                status: 'approved',
                reviewed_at: approvalTimestamp,
                reviewed_by: effectiveReviewer,
                updated_at: approvalTimestamp,
              })
              .eq('id', revisionId);
          } catch (revErr) {
            console.warn('Update revision status notice:', revErr);
          }

          try {
            await supabase
              .from('pg_listings')
              .update({ has_pending_revision: false, pending_revision_id: null, rejection_reason: null })
              .eq('id', listingId);
          } catch (pgFlagErr) {
            console.warn('Pending revision flag update notice on pg_listings:', pgFlagErr);
          }
        }
    }

    // Update local storage
    const locals = getLocalRevisions();
    const index = locals.findIndex(r => r.id === revisionId);
    if (index !== -1) {
      locals[index] = {
        ...locals[index],
        status: 'approved',
        reviewed_at: approvalTimestamp,
        reviewed_by: effectiveReviewer,
        updated_at: approvalTimestamp,
      };
      saveLocalRevisions(locals);
    }

    const updatedListing = await this.getListingById(listingId);

    await auditService.logAction({
      action: 'approve_revision',
      listing_id: listingId,
      listing_name: updatedListing?.name || changes.name || 'Property',
      details: `Approved proposed revisions for "${updatedListing?.name}". Updated property details, room inventories, and photos are now live for students.`,
    });

    return updatedListing!;
  },

  /**
   * Admin: Reject a proposed property revision with mandatory feedback for the owner
   */
  async rejectRevision(
    revisionId: string,
    rejectionReason: string,
    reviewerId?: string,
    callerUser?: UserProfile | null
  ): Promise<ListingRevision> {
    const isAdmin = await authService.verifyAdminPrivileges(callerUser);
    if (!isAdmin) {
      throw new Error('Unauthorized: Administrator privileges required to reject revisions.');
    }

    if (!rejectionReason || !rejectionReason.trim()) {
      throw new Error('Rejection reason is mandatory when declining proposed property changes.');
    }

    let revision: ListingRevision | null = null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('listing_revisions')
          .select('*')
          .eq('id', revisionId)
          .maybeSingle();
        if (!error && data) revision = data as ListingRevision;
      } catch (e) {
        console.warn('Supabase query revision notice:', e);
      }
    }

    if (!revision) {
      const local = getLocalRevisions().find(r => r.id === revisionId);
      if (local) revision = local;
    }

    if (!revision) {
      throw new Error(`Revision "${revisionId}" not found.`);
    }

    const currentAdmin = authService.getCurrentUser();
    const effectiveReviewer = reviewerId || currentAdmin?.id || 'usr_admin_ops';
    const rejectionTimestamp = new Date().toISOString();

    const updatedRevision: ListingRevision = {
      ...revision,
      status: 'rejected',
      rejection_reason: rejectionReason.trim(),
      reviewed_at: rejectionTimestamp,
      reviewed_by: effectiveReviewer,
      updated_at: rejectionTimestamp,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('listing_revisions')
          .update({
            status: 'rejected',
            rejection_reason: rejectionReason.trim(),
            reviewed_at: rejectionTimestamp,
            reviewed_by: effectiveReviewer,
            updated_at: rejectionTimestamp,
          })
          .eq('id', revisionId);

        await supabase
          .from('pg_listings')
          .update({
            has_pending_revision: false,
            pending_revision_id: null,
            rejection_reason: rejectionReason.trim(),
          })
          .eq('id', revision.listing_id);
      } catch (err) {
        console.warn('Supabase reject revision notice:', err);
      }
    }

    const locals = getLocalRevisions();
    const idx = locals.findIndex(r => r.id === revisionId);
    if (idx !== -1) {
      locals[idx] = updatedRevision;
    } else {
      locals.unshift(updatedRevision);
    }
    saveLocalRevisions(locals);

    await auditService.logAction({
      action: 'reject_revision',
      listing_id: revision.listing_id,
      listing_name: revision.proposed_changes.name || 'Property',
      details: `Rejected proposed revisions. Reason: ${rejectionReason.trim()}`,
      rejection_reason: rejectionReason.trim(),
    });

    return updatedRevision;
  }
};
