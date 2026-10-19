import { StudentSubscription, PaymentRequest } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { STUDENT_SUBSCRIPTION_PLAN } from '../utils/pricing';
import { paymentService } from './paymentService';

// Legacy keys slated for immediate purge so they NEVER unlock premium access
const LEGACY_KEYS = [
  'rento_student_all_access_unlocked',
  'rento_student_active_pass_data',
  'rento_guest_student_pass',
];

/**
 * Purges any legacy local storage unlock markers from previous versions.
 * Guarantees that local storage can NEVER grant premium access.
 */
export function purgeLegacyStudentFlags(): void {
  try {
    LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
    // Also remove any key starting with rento_student_sub_
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('rento_student_sub_') || k.startsWith('rento_student_sub_email_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch {
    // Safe ignore
  }
}

// Execute purge immediately on module load
purgeLegacyStudentFlags();

export const studentSubscriptionService = {
  /**
   * Purges all legacy local storage keys.
   */
  purgeLegacyFlags(): void {
    purgeLegacyStudentFlags();
  },

  /**
   * Fetches active student subscription entitlement authoritatively from Supabase.
   * Returns null if no active subscription exists or if payment is still pending.
   * NEVER reads or relies on local storage unlock flags.
   */
  async getStudentSubscription(studentId: string, email?: string): Promise<StudentSubscription | null> {
    if (!studentId && !email) {
      return null;
    }

    if (!isSupabaseConfigured || !supabase) {
      console.warn('[studentSubscriptionService] Supabase is not configured.');
      return null;
    }

    try {
      let query = supabase
        .from('student_subscriptions')
        .select('*');

      if (studentId) {
        query = query.eq('student_id', studentId);
      } else if (email) {
        query = query.eq('student_email', email.trim().toLowerCase());
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.warn('[studentSubscriptionService] Supabase getStudentSubscription error:', error.message);
        return null;
      }

      if (data) {
        const isProvisionalValid =
          Boolean(data.is_provisional) &&
          Boolean(data.provisional_access_until) &&
          new Date(data.provisional_access_until).getTime() > Date.now();

        if (data.status === 'active' || isProvisionalValid) {
          const sub: StudentSubscription = {
            id: data.id,
            student_id: data.student_id,
            student_name: data.student_name,
            student_email: data.student_email,
            plan_id: 'student_pass',
            status: data.status,
            entitlement_type: 'lifetime',
            amount_paise: data.amount_paise || 900,
            base_price: Number(data.base_price) || STUDENT_SUBSCRIPTION_PLAN.basePrice,
            gst_amount: Number(data.gst_amount) || STUDENT_SUBSCRIPTION_PLAN.gstAmount,
            total_price: Number(data.total_price) || STUDENT_SUBSCRIPTION_PLAN.totalPrice,
            payment_method: data.payment_method || 'upi',
            payment_reference: data.payment_reference,
            payment_request_id: data.payment_request_id,
            receipt_storage_path: data.receipt_storage_path,
            is_provisional: data.is_provisional,
            provisional_access_until: data.provisional_access_until,
            start_date: data.start_date || data.created_at,
            activated_at: data.activated_at,
            verified_at: data.verified_at,
            verified_by: data.verified_by,
            created_at: data.created_at,
            updated_at: data.updated_at,
          };
          return sub;
        }
      }
    } catch (err: any) {
      console.warn('[studentSubscriptionService] Supabase entitlement check error:', err?.message || err);
    }

    return null;
  },

  /**
   * Checks whether the student has an ACTIVE, server-verified ₹9 access pass in Supabase,
   * or a valid provisional access window while verification is pending.
   */
  async hasActiveSubscription(studentId?: string, email?: string): Promise<boolean> {
    if (!studentId && !email) return false;
    const sub = await this.getStudentSubscription(studentId || '', email);
    if (!sub) return false;
    if (sub.status === 'active') return true;
    if (sub.is_provisional && sub.provisional_access_until && new Date(sub.provisional_access_until).getTime() > Date.now()) {
      return true;
    }
    return false;
  },

  /**
   * Retrieves pending or rejected payment requests for this student.
   * Used to show real-time verification status in the UI.
   */
  async getPaymentStatus(studentId: string): Promise<{
    activeSubscription: StudentSubscription | null;
    pendingRequest: PaymentRequest | null;
    rejectedRequest: PaymentRequest | null;
  }> {
    return paymentService.getStudentPaymentStatus(studentId);
  },

  /**
   * Submits a ₹9 Student Lifetime Access Pass payment request.
   * Persists the request to Supabase in 'pending' status.
   * Entitlement remains LOCKED until verified and approved by admin.
   */
  async submitStudentPaymentRequest(params: {
    studentId: string;
    studentName: string;
    studentEmail: string;
    utr: string;
    receiptFile?: File | null;
  }): Promise<{ request: PaymentRequest; isPending: boolean }> {
    return paymentService.submitStudentPayment(params);
  },

  /**
   * Allows student to submit a dispute for a rejected payment request.
   */
  async disputePayment(paymentId: string, reason: string): Promise<PaymentRequest> {
    return paymentService.disputePayment(paymentId, reason);
  },
};

