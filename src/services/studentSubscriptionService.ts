import { StudentSubscription } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { STUDENT_SUBSCRIPTION_PLAN } from '../utils/pricing';

const STUDENT_SUB_PREFIX = 'rento_student_sub_';
const GUEST_STUDENT_SUB_KEY = 'rento_guest_student_pass';

export const studentSubscriptionService = {
  /**
   * Checks local storage for any active cached student pass
   */
  getLocalSubscription(studentId?: string): StudentSubscription | null {
    try {
      if (studentId) {
        const stored = localStorage.getItem(`${STUDENT_SUB_PREFIX}${studentId}`);
        if (stored) {
          const parsed: StudentSubscription = JSON.parse(stored);
          if (parsed && parsed.status === 'active') return parsed;
        }
      }
      // Also check guest pass (if user subscribed before signing in or as guest)
      const guestStored = localStorage.getItem(GUEST_STUDENT_SUB_KEY);
      if (guestStored) {
        const parsed: StudentSubscription = JSON.parse(guestStored);
        if (parsed && parsed.status === 'active') return parsed;
      }
    } catch {
      // Fallback
    }
    return null;
  },

  /**
   * Save subscription locally for immediate offline/synchronous responsiveness
   */
  saveLocalSubscription(sub: StudentSubscription): void {
    try {
      if (sub.student_id) {
        localStorage.setItem(`${STUDENT_SUB_PREFIX}${sub.student_id}`, JSON.stringify(sub));
      }
      localStorage.setItem(GUEST_STUDENT_SUB_KEY, JSON.stringify(sub));
    } catch {
      // Ignore
    }
  },

  /**
   * Fetches active student subscription for a given student ID from Supabase with local fallback
   */
  async getStudentSubscription(studentId: string): Promise<StudentSubscription | null> {
    if (!studentId) {
      return this.getLocalSubscription();
    }

    // Try Supabase first if configured
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('student_subscriptions')
          .select('*')
          .eq('student_id', studentId)
          .eq('status', 'active')
          .maybeSingle();

        if (!error && data) {
          const sub: StudentSubscription = {
            id: data.id,
            student_id: data.student_id,
            student_name: data.student_name,
            student_email: data.student_email,
            plan_id: 'student_pass',
            status: data.status,
            base_price: Number(data.base_price) || STUDENT_SUBSCRIPTION_PLAN.basePrice,
            gst_amount: Number(data.gst_amount) || STUDENT_SUBSCRIPTION_PLAN.gstAmount,
            total_price: Number(data.total_price) || STUDENT_SUBSCRIPTION_PLAN.totalPrice,
            payment_method: data.payment_method,
            payment_reference: data.payment_reference,
            start_date: data.start_date || data.created_at,
            created_at: data.created_at,
            updated_at: data.updated_at,
          };
          this.saveLocalSubscription(sub);
          return sub;
        }
      } catch (err) {
        console.warn('Supabase getStudentSubscription check:', err);
      }
    }

    // Fall back to local storage
    return this.getLocalSubscription(studentId);
  },

  /**
   * Checks whether the student has an active ₹9 access pass
   */
  async hasActiveSubscription(studentId?: string): Promise<boolean> {
    if (!studentId) {
      return this.getLocalSubscription() !== null;
    }
    const sub = await this.getStudentSubscription(studentId);
    return sub !== null && sub.status === 'active';
  },

  /**
   * Creates/activates a ₹9 Student Access Pass in Supabase and local storage
   */
  async createStudentSubscription(params: {
    studentId: string;
    studentName?: string;
    studentEmail?: string;
    paymentMethod?: 'upi' | 'card' | 'netbanking';
  }): Promise<StudentSubscription> {
    const { studentId, studentName = 'Student Customer', studentEmail = '', paymentMethod = 'upi' } = params;

    // Simulate brief payment gateway verification
    await new Promise(resolve => setTimeout(resolve, 600));

    const now = new Date();
    const paymentRef = `TXN-STU-${Date.now().toString().slice(-7)}${Math.floor(100 + Math.random() * 900)}`;

    const newSub: StudentSubscription = {
      student_id: studentId,
      student_name: studentName,
      student_email: studentEmail,
      plan_id: 'student_pass',
      status: 'active',
      base_price: STUDENT_SUBSCRIPTION_PLAN.basePrice,
      gst_amount: STUDENT_SUBSCRIPTION_PLAN.gstAmount,
      total_price: STUDENT_SUBSCRIPTION_PLAN.totalPrice,
      payment_method: paymentMethod,
      payment_reference: paymentRef,
      start_date: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    // Save to local storage for instant access
    this.saveLocalSubscription(newSub);

    // Save to Supabase DB if available
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('student_subscriptions')
          .upsert(
            {
              student_id: studentId,
              student_name: studentName,
              student_email: studentEmail,
              plan_id: 'student_pass',
              status: 'active',
              base_price: newSub.base_price,
              gst_amount: newSub.gst_amount,
              total_price: newSub.total_price,
              payment_method: paymentMethod,
              payment_reference: paymentRef,
              start_date: newSub.start_date,
              created_at: newSub.created_at,
              updated_at: newSub.updated_at,
            },
            { onConflict: 'student_id' }
          );
      } catch (err) {
        console.warn('Supabase student_subscriptions upsert error:', err);
      }
    }

    return newSub;
  },
};
