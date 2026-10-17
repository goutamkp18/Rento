import { Enquiry, EnquiryStatus } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { listingsService } from './listingsService';
import { authService } from './authService';

export const enquiriesService = {
  async getStudentEnquiries(studentId: string): Promise<Enquiry[]> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) throw new Error('Authentication required.');

    // IDOR check: Student can only access their own enquiries
    if (currentUser.id !== studentId && currentUser.role !== 'admin') {
      throw new Error('Access Denied: You cannot view another student\'s private enquiries.');
    }

    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Database connection required.');
    }

    const { data, error } = await supabase
      .from('enquiries')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase getStudentEnquiries error:', error);
      throw new Error(error.message);
    }
    return (data || []) as Enquiry[];
  },

  async getOwnerEnquiries(ownerId: string): Promise<Enquiry[]> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) throw new Error('Authentication required.');

    // IDOR check: Owner can only access enquiries for their own properties
    if (currentUser.id !== ownerId && currentUser.role !== 'admin') {
      throw new Error('Access Denied: You cannot view another property owner\'s enquiries.');
    }

    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Database connection required.');
    }

    const { data, error } = await supabase
      .from('enquiries')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase getOwnerEnquiries error:', error);
      throw new Error(error.message);
    }
    return (data || []) as Enquiry[];
  },

  async submitEnquiry(
    enquiryData: Omit<Enquiry, 'id' | 'status' | 'created_at' | 'owner_response' | 'responded_at'>
  ): Promise<Enquiry> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Database connection required to submit enquiry.');
    }

    let resolvedOwnerId = enquiryData.owner_id;
    if (!resolvedOwnerId && enquiryData.listing_id) {
      const listing = await listingsService.getListingById(enquiryData.listing_id);
      if (listing) {
        resolvedOwnerId = listing.owner_id;
      }
    }

    const newEnquiry: Enquiry = {
      ...enquiryData,
      owner_id: resolvedOwnerId,
      id: `enq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: 'submitted',
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('enquiries').insert([
      {
        id: newEnquiry.id,
        student_id: newEnquiry.student_id,
        owner_id: newEnquiry.owner_id,
        student_name: newEnquiry.student_name,
        student_email: newEnquiry.student_email,
        student_phone: newEnquiry.student_phone,
        listing_id: newEnquiry.listing_id,
        listing_name: newEnquiry.listing_name,
        listing_locality: newEnquiry.listing_locality,
        listing_city: newEnquiry.listing_city,
        listing_image: newEnquiry.listing_image,
        enquiry_type: newEnquiry.enquiry_type,
        message: newEnquiry.message,
        requested_visit_date: newEnquiry.requested_visit_date,
        requested_visit_time_slot: newEnquiry.requested_visit_time_slot,
        status: newEnquiry.status,
      }
    ]);

    if (error) {
      console.error('Supabase submitEnquiry error:', error);
      throw new Error(`Failed to submit enquiry: ${error.message}`);
    }

    return newEnquiry;
  },

  async respondToEnquiry(
    id: string,
    response: string,
    newStatus: EnquiryStatus
  ): Promise<Enquiry> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) throw new Error('Authentication required.');

    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Database connection required.');
    }

    const { data, error } = await supabase
      .from('enquiries')
      .update({
        owner_response: response,
        status: newStatus,
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Supabase respondToEnquiry error:', error);
      throw new Error(`Failed to update enquiry: ${error.message}`);
    }

    return data as Enquiry;
  },

  async updateEnquiryStatus(id: string, status: EnquiryStatus): Promise<Enquiry> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) throw new Error('Authentication required.');

    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Database connection required.');
    }

    const { data, error } = await supabase
      .from('enquiries')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Supabase updateEnquiryStatus error:', error);
      throw new Error(`Failed to update enquiry status: ${error.message}`);
    }

    return data as Enquiry;
  }
};
