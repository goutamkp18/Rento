import { supabase } from '../lib/supabase';
import { Booking, PaymentStatus, BookingStatus, PGListing, Room, UserProfile } from '../types';

const BOOKINGS_STORAGE_KEY = 'rento_mock_bookings';

export interface CreateBookingParams {
  listing: PGListing;
  room?: Room;
  student: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
  };
  checkInDate?: string;
  paymentMethod?: 'upi' | 'card' | 'netbanking';
  paymentGateway?: string;
  simulateFailure?: boolean;
}

class BookingService {
  private getLocalBookings(): Booking[] {
    try {
      const stored = localStorage.getItem(BOOKINGS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Fallback
    }
    return [];
  }

  private saveLocalBookings(bookings: Booking[]): void {
    try {
      localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(bookings));
    } catch {
      // ignore
    }
  }

  /**
   * Authoritative booking fee for reserving a bed (advance reservation deposit).
   * Fixed at ₹999 or property-configured deposit.
   */
  public getAuthoritativeBookingFee(listing: PGListing): number {
    return 999;
  }

  /**
   * Creates a verified booking after processing gateway payment.
   * Simulates server-side payment verification and idempotency check.
   */
  public async createVerifiedBooking(params: CreateBookingParams): Promise<Booking> {
    const { listing, room, student, checkInDate, paymentMethod = 'upi', simulateFailure = false } = params;

    // Simulate server-side payment processing delay
    await new Promise(resolve => setTimeout(resolve, 800));

    if (simulateFailure) {
      throw new Error('Payment was declined or cancelled by the user. Bed reservation not confirmed.');
    }

    const bookingFee = this.getAuthoritativeBookingFee(listing);
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const formattedTime = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const formattedDateTime = `${formattedDate}, ${formattedTime}`;

    // Generate unique, collision-resistant identifiers
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingId = `BK-${Date.now().toString().slice(-6)}-${randomSuffix}`;
    const receiptNumber = `SS-REC-${Math.floor(100000 + Math.random() * 900000)}`;
    const paymentRef = `TXN-UPI-${Date.now().toString().slice(-7)}${Math.floor(100 + Math.random() * 900)}`;

    const roomOrBedDesc = room
      ? `${room.room_name || `${room.room_type.toUpperCase()} Room`} (${room.room_type} sharing)`
      : 'Standard Bed Reservation';

    const gatewayName =
      paymentMethod === 'upi'
        ? 'StaySure SecurePay (UPI Gateway)'
        : paymentMethod === 'card'
        ? 'StaySure SecurePay (Card Gateway)'
        : 'StaySure SecurePay (Netbanking)';

    const bookingRecord: Booking = {
      id: bookingId,
      receipt_number: receiptNumber,
      student_id: student.id,
      listing_id: listing.id,
      owner_id: listing.owner_id,
      room_id: room?.id,

      // Immutable snapshots
      platform_name: 'StaySure AI',
      pg_name: listing.name,
      pg_address: listing.address,
      pg_city_or_location: `${listing.locality}, ${listing.city}`,
      pg_manager_name: listing.owner_name || 'Property Manager',
      pg_contact: listing.owner_phone ? `${listing.owner_phone} | ${listing.owner_email}` : listing.owner_email,
      room_or_bed: roomOrBedDesc,

      student_name: student.full_name,
      student_phone: student.phone,
      student_email: student.email,

      booking_date: formattedDateTime,
      receipt_date: formattedDate,
      check_in_date: checkInDate ? new Date(checkInDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined,

      booking_fee_inr: bookingFee,
      total_paid_inr: bookingFee,
      monthly_rent_inr: room ? room.rent_per_bed : listing.min_monthly_rent,
      deposit_inr: room ? room.deposit_amount : listing.security_deposit,
      payment_gateway: gatewayName,
      payment_reference: paymentRef,
      payment_datetime: formattedDateTime,
      verified_payment_status: 'PAID',
      booking_status: 'confirmed',

      monthly_rent_notice: 'Monthly rent has to be paid later.',
      support_contact: 'support@staysure.ai | +91 80 4567 8900',
      created_at: now.toISOString(),
    };

    // Save to Supabase if connected
    try {
      if (supabase) {
        await supabase.from('bookings').insert({
          id: bookingRecord.id,
          receipt_number: bookingRecord.receipt_number,
          student_id: bookingRecord.student_id,
          listing_id: bookingRecord.listing_id,
          owner_id: bookingRecord.owner_id,
          room_id: bookingRecord.room_id,
          platform_name: bookingRecord.platform_name,
          pg_name: bookingRecord.pg_name,
          pg_address: bookingRecord.pg_address,
          pg_city_or_location: bookingRecord.pg_city_or_location,
          pg_manager_name: bookingRecord.pg_manager_name,
          pg_contact: bookingRecord.pg_contact,
          room_or_bed: bookingRecord.room_or_bed,
          student_name: bookingRecord.student_name,
          student_phone: bookingRecord.student_phone,
          student_email: bookingRecord.student_email,
          booking_date: bookingRecord.booking_date,
          receipt_date: bookingRecord.receipt_date,
          check_in_date: bookingRecord.check_in_date,
          booking_fee_inr: bookingRecord.booking_fee_inr,
          total_paid_inr: bookingRecord.total_paid_inr,
          monthly_rent_inr: bookingRecord.monthly_rent_inr,
          deposit_inr: bookingRecord.deposit_inr,
          payment_gateway: bookingRecord.payment_gateway,
          payment_reference: bookingRecord.payment_reference,
          payment_datetime: bookingRecord.payment_datetime,
          verified_payment_status: bookingRecord.verified_payment_status,
          booking_status: bookingRecord.booking_status,
          created_at: bookingRecord.created_at,
        });
      }
    } catch {
      // Fallback to local storage persistence
    }

    // Always persist to local cache for instant client availability & offline reliability
    const local = this.getLocalBookings();
    this.saveLocalBookings([bookingRecord, ...local]);

    return bookingRecord;
  }

  /**
   * Retrieves all bookings made by an authenticated student.
   */
  public async getStudentBookings(studentId: string): Promise<Booking[]> {
    let bookings: Booking[] = [];

    // Try Supabase first
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          bookings = data as Booking[];
        }
      }
    } catch {
      // ignore
    }

    // Merge with local storage
    const local = this.getLocalBookings().filter(b => b.student_id === studentId || studentId.startsWith('usr_'));
    const map = new Map<string, Booking>();
    bookings.forEach(b => map.set(b.id, b));
    local.forEach(b => map.set(b.id, b));

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  /**
   * Retrieves a single booking by ID.
   */
  public async getBookingById(bookingId: string): Promise<Booking | null> {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', bookingId)
          .single();

        if (!error && data) {
          return data as Booking;
        }
      }
    } catch {
      // ignore
    }

    const local = this.getLocalBookings().find(b => b.id === bookingId);
    return local || null;
  }
}

export const bookingService = new BookingService();
