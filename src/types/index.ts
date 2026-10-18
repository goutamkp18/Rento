export type UserRole = 'student' | 'owner' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  phone?: string;
  avatar_url?: string;
  college?: string;
  city?: string;
  owner_type?: 'individual' | 'property_manager';
  business_name?: string;
  created_at: string;
}

export type ListingPublicationStatus =
  | 'draft'
  | 'pending_review'
  | 'under_review'
  | 'published'
  | 'paused'
  | 'rejected';

export type ListingVerificationStatus =
  | 'owner_submitted'
  | 'pending_verification'
  | 'in_progress'
  | 'unverified'
  | 'verified'
  | 'rejected';

export type RoomType = 'single' | 'double' | 'triple' | 'four_plus' | '1bhk' | '2bhk';
export type GenderPreference = 'boys' | 'girls' | 'unisex';
export type FoodType = 'veg' | 'both' | 'non_veg' | 'none';

export interface Room {
  id: string;
  listing_id: string;
  room_type: RoomType;
  room_name?: string;
  total_capacity: number;
  available_beds: number;
  rent_per_bed: number;
  deposit_amount: number;
  room_amenities: string[];
  has_attached_washroom: boolean;
  has_balcony: boolean;
  is_air_conditioned: boolean;
}

export type PhotoCategory = 'exterior' | 'bedroom' | 'bathroom' | 'common' | 'other';

export interface ListingImage {
  id: string;
  listing_id: string;
  image_url: string;
  caption?: string;
  category?: PhotoCategory;
  display_order: number;
  is_primary: boolean;
}

export interface NearbyCollege {
  college_name: string;
  distance_km: number;
}

export interface OwnerDocument {
  id: string;
  category: 'identity' | 'ownership' | 'address';
  document_name: string;
  title?: string;
  description?: string;
  file_name?: string;
  status: 'pending' | 'uploaded' | 'verified';
  sample_note?: string;
  is_sample?: boolean;
}

export interface PGListing {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  owner_type?: 'individual' | 'property_manager';
  business_name?: string;
  name: string;
  tagline: string;
  description: string;
  property_type: 'pg' | 'hostel' | 'coliving' | 'flat';
  gender_preference: GenderPreference;
  address: string;
  locality: string;
  city: string;
  state: string;
  postal_code: string;
  landmark: string;
  google_maps_url?: string;
  nearby_colleges: NearbyCollege[];
  min_monthly_rent: number;
  max_monthly_rent: number;
  security_deposit: number;
  maintenance_charge?: number;
  electricity_policy: string;
  notice_period_days: number;
  lock_in_months: number;
  food_type: FoodType;
  meals_provided: ('breakfast' | 'lunch' | 'dinner')[];
  food_description?: string;
  amenities: string[];
  house_rules: string[];
  publication_status: ListingPublicationStatus;
  verification_status: ListingVerificationStatus;
  rejection_reason?: string;
  verification_notes?: string;
  verified_at?: string;
  rating: number;
  reviews_count: number;
  created_at: string;
  updated_at: string;
  rooms: Room[];
  images: ListingImage[];
  documents?: OwnerDocument[];
  featured?: boolean;
}

export type EnquiryType = 'general' | 'visit_request' | 'booking_inquiry';
export type EnquiryStatus = 'submitted' | 'responded' | 'visit_confirmed' | 'visit_declined' | 'closed';

export interface Enquiry {
  id: string;
  student_id: string;
  owner_id?: string;
  student_name: string;
  student_email: string;
  student_phone: string;
  listing_id: string;
  listing_name: string;
  listing_locality: string;
  listing_city: string;
  listing_image: string;
  enquiry_type: EnquiryType;
  message: string;
  requested_visit_date?: string;
  requested_visit_time_slot?: string;
  status: EnquiryStatus;
  owner_response?: string;
  responded_at?: string;
  created_at: string;
}

export interface FilterState {
  searchQuery: string;
  city: string;
  locality: string;
  college: string;
  minPrice: number;
  maxPrice: number;
  roomTypes: RoomType[];
  gender: 'all' | GenderPreference;
  foodType: 'all' | FoodType;
  amenities: string[];
  verifiedOnly: boolean;
  availableOnly: boolean;
  sortBy: 'recommended' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  isMockPersisted?: boolean;
}

export type SubscriptionPlanId = 'basic' | 'pro' | 'pro_plus';

export type SubscriptionStatus =
  | 'no_subscription'
  | 'pending_payment'
  | 'active'
  | 'payment_failed'
  | 'expired'
  | 'cancelled'
  | 'trialing'
  | 'trial_eligible';

export type TrialStatus = 'eligible' | 'active' | 'expired' | 'converted';

export interface TrialInfo {
  isEligible: boolean;
  isActive: boolean;
  isExpired: boolean;
  isConverted: boolean;
  hasStarted: boolean;
  startDate: string | null;
  endDate: string | null;
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  trialPlanId: SubscriptionPlanId;
  trialListingLimit: number;
  reminderStage?: '7_days' | '3_days' | '1_day' | null;
}

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  tagline: string;
  description?: string;
  basePrice: number;
  billingInterval: 'month';
  listingLimit: number;
  features: string[];
  isRecommended?: boolean;
  badge?: string;
}

export interface PriceBreakdown {
  basePrice: number;
  gstRate: number;
  gstPercentage: number;
  gstRatePercent: number;
  gstAmount: number;
  totalAmount: number;
  totalMonthlyPrice: number;
}

export interface OwnerSubscription {
  owner_id: string;
  plan_id: SubscriptionPlanId;
  status: SubscriptionStatus;
  base_price: number;
  monthly_base_price?: number;
  gst_rate: number;
  gst_amount: number;
  total_price: number;
  total_monthly_price?: number;
  listing_limit?: number;
  start_date: string;
  renewal_date: string;
  payment_reference?: string;
  demo_payment_reference?: string;
  created_at: string;
  updated_at: string;

  // 30-Day Free Trial fields
  trial_status?: TrialStatus;
  trial_start?: string | null;
  trial_end?: string | null;
  trial_plan_id?: SubscriptionPlanId;
  trial_listing_limit?: number;
  selected_plan_id?: SubscriptionPlanId;
  payment_status?: 'none' | 'pending' | 'paid' | 'failed';
  active_listing_id?: string;
}

export interface StudentSubscription {
  id?: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  plan_id: 'student_pass';
  status: 'active' | 'expired' | 'cancelled' | 'payment_failed';
  base_price: number;
  gst_amount: number;
  total_price: number;
  payment_method?: string;
  payment_reference?: string;
  start_date: string;
  created_at: string;
  updated_at?: string;
}

export type BookingStatus = 'confirmed' | 'pending' | 'cancelled';
export type PaymentStatus = 'PAID' | 'PENDING' | 'FAILED';

export interface Booking {
  id: string;
  receipt_number: string;
  student_id: string;
  listing_id: string;
  owner_id?: string;
  room_id?: string;

  // Snapshotted Property Information
  platform_name: string;
  pg_name: string;
  pg_address: string;
  pg_city_or_location: string;
  pg_manager_name: string;
  pg_contact: string;
  room_or_bed: string;

  // Snapshotted Student Information
  student_name: string;
  student_phone: string;
  student_email: string;

  // Dates
  booking_date: string;
  receipt_date: string;
  check_in_date?: string;

  // Financial & Verification
  booking_fee_inr: number;
  total_paid_inr: number;
  monthly_rent_inr?: number;
  deposit_inr?: number;
  payment_gateway: string;
  payment_reference: string;
  payment_datetime: string;
  verified_payment_status: PaymentStatus;
  booking_status: BookingStatus;

  // Mandatory Payment Notice
  monthly_rent_notice: string;
  support_contact?: string;
  created_at: string;
}


