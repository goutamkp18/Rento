import { PGListing, FilterState, ListingPublicationStatus, ListingVerificationStatus } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { authService } from './authService';
import { subscriptionService } from './subscriptionService';
import { storageService } from './storageService';

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
    return data ? mapListingFromDb(data) : null;
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
    return (data || []).map(mapListingFromDb);
  },


  async createListing(listingData: Partial<PGListing>): Promise<PGListing> {
    let resolvedOwnerId = '';
    let ownerName = listingData.owner_name || '';
    let ownerEmail = listingData.owner_email || '';
    let ownerPhone = listingData.owner_phone || '';
    let ownerType = listingData.owner_type || 'individual';
    let businessName = listingData.business_name || '';

    // Verify authenticated user directly from Supabase session
    if (isSupabaseConfigured && supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData.session?.user;

      let authUser = sessionUser;
      if (!authUser) {
        const { data: userData, error: authErr } = await supabase.auth.getUser();
        if (authErr || !userData.user) {
          throw new Error('Your session has expired or is not authenticated in Supabase. Please sign in again.');
        }
        authUser = userData.user;
      }

      // Verify profile from profiles table
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (pErr || !profile) {
        throw new Error('Could not find your owner profile in the database. Please sign in or complete owner registration.');
      }

      if (profile.role !== 'owner' && profile.role !== 'admin') {
        throw new Error('Access Denied: Only registered PG Owners can create listings.');
      }

      resolvedOwnerId = authUser.id;
      ownerName = profile.full_name || authUser.email?.split('@')[0] || '';
      ownerEmail = authUser.email || profile.email || '';
      ownerPhone = profile.phone || '';
      ownerType = profile.owner_type || 'individual';
      businessName = profile.business_name || '';
    } else {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('Authentication required to create a property listing.');
      }
      if (currentUser.role !== 'owner' && currentUser.role !== 'admin') {
        throw new Error('Unauthorized: Only registered PG Owners can create listings.');
      }
      resolvedOwnerId = currentUser.id;
      ownerName = currentUser.full_name;
      ownerEmail = currentUser.email;
      ownerPhone = currentUser.phone || '';
      ownerType = currentUser.owner_type || 'individual';
      businessName = currentUser.business_name || '';
    }

    // Enforce subscription listing limit for owners
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

    let { error: listingErr } = await supabase.from('pg_listings').insert([insertPayload]);

    if (listingErr && listingErr.message?.includes('google_maps_url')) {
      delete insertPayload.google_maps_url;
      const retry = await supabase.from('pg_listings').insert([insertPayload]);
      listingErr = retry.error;
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

  async updateListing(id: string, updates: Partial<PGListing>): Promise<PGListing> {
    const currentUser = authService.getCurrentUser();
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
      if (updates.publication_status === 'published' && existing.publication_status !== 'published') {
        throw new Error('Unauthorized: Listings require administrator approval to be published.');
      }
    }

    const sanitizedUpdates = { ...updates };
    const imagesToUpdate = sanitizedUpdates.images;
    delete (sanitizedUpdates as any).rooms;
    delete (sanitizedUpdates as any).images;
    delete (sanitizedUpdates as any).documents;
    delete (sanitizedUpdates as any).listing_images;

    let { data, error } = await supabase
      .from('pg_listings')
      .update({
        ...sanitizedUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, rooms(*), listing_images(*)')
      .single();

    // If rejection_reason column does not exist on pg_listings, fall back to verification_notes
    if (error && error.message?.includes('rejection_reason')) {
      const reason = sanitizedUpdates.rejection_reason;
      delete sanitizedUpdates.rejection_reason;
      if (reason) {
        sanitizedUpdates.verification_notes = reason;
      }

      const retryRes = await supabase
        .from('pg_listings')
        .update({
          ...sanitizedUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*, rooms(*), listing_images(*)')
        .single();

      data = retryRes.data;
      error = retryRes.error;
    }

    if (error && error.message?.includes('google_maps_url')) {
      delete (sanitizedUpdates as any).google_maps_url;
      const retryRes = await supabase
        .from('pg_listings')
        .update({
          ...sanitizedUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*, rooms(*), listing_images(*)')
        .single();

      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      console.error('Supabase updateListing error:', error);
      throw new Error(`Failed to update listing: ${error.message}`);
    }


    if (imagesToUpdate && Array.isArray(imagesToUpdate)) {
      await this.saveListingImages(id, imagesToUpdate);
    }

    return mapListingFromDb(data);
  },


  async updateListingStatus(id: string, status: ListingPublicationStatus): Promise<PGListing> {
    return this.updateListing(id, { publication_status: status });
  },

  async updateListingVerification(
    id: string,
    status: ListingVerificationStatus,
    notes?: string
  ): Promise<PGListing> {
    const isAdmin = await authService.verifyAdminPrivileges();
    if (!isAdmin) {
      throw new Error('Unauthorized: Administrator privileges required to modify verification status.');
    }

    const updates: Partial<PGListing> = {
      verification_status: status,
      verification_notes: notes,
      verified_at: status === 'verified' ? new Date().toISOString() : undefined,
    };
    return this.updateListing(id, updates);
  },

  async getAdminPendingListings(): Promise<PGListing[]> {
    const isAdmin = await authService.verifyAdminPrivileges();
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

  async getAllListingsForAdmin(): Promise<PGListing[]> {
    const isAdmin = await authService.verifyAdminPrivileges();
    if (!isAdmin) {
      throw new Error('Unauthorized: Administrator privileges required to access all listings.');
    }

    return this.getListings(undefined, true);
  },

  /**
   * Delete a listing completely from both Supabase database and storage
   */
  async deleteListing(id: string): Promise<boolean> {
    const currentUser = authService.getCurrentUser();
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
  }
};
