import { StudentSubscription } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { STUDENT_SUBSCRIPTION_PLAN } from '../utils/pricing';

const STUDENT_SUB_PREFIX = 'rento_student_sub_';
const GUEST_STUDENT_SUB_KEY = 'rento_guest_student_pass';
const UNIVERSAL_STUDENT_UNLOCKED_KEY = 'rento_student_all_access_unlocked';
const UNIVERSAL_STUDENT_PASS_KEY = 'rento_student_active_pass_data';
const EMAIL_STUDENT_SUB_PREFIX = 'rento_student_sub_email_';

export const studentSubscriptionService = {
  /**
   * Returns true if a ₹9 pass was EVER paid and unlocked on this device/browser
   */
  isLocallyUnlocked(studentId?: string, email?: string): boolean {
    try {
      // 1. Universal unlocked flag
      if (localStorage.getItem(UNIVERSAL_STUDENT_UNLOCKED_KEY) === 'true') {
        return true;
      }
      // 2. Specific student ID
      if (studentId) {
        const stored = localStorage.getItem(`${STUDENT_SUB_PREFIX}${studentId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.status === 'active') return true;
        }
      }
      // 3. Email
      if (email) {
        const cleanEmail = email.toLowerCase().trim();
        const storedEmail = localStorage.getItem(`${EMAIL_STUDENT_SUB_PREFIX}${cleanEmail}`);
        if (storedEmail) {
          const parsed = JSON.parse(storedEmail);
          if (parsed && parsed.status === 'active') return true;
        }
      }
      // 4. Guest / Universal data
      const universal =
        localStorage.getItem(UNIVERSAL_STUDENT_PASS_KEY) ||
        localStorage.getItem(GUEST_STUDENT_SUB_KEY);
      if (universal) {
        const parsed = JSON.parse(universal);
        if (parsed && parsed.status === 'active') return true;
      }
    } catch {
      // Fallback
    }
    return false;
  },

  /**
   * Checks local storage for any active cached student pass
   */
  getLocalSubscription(studentId?: string, email?: string): StudentSubscription | null {
    try {
      if (studentId) {
        const stored = localStorage.getItem(`${STUDENT_SUB_PREFIX}${studentId}`);
        if (stored) {
          const parsed: StudentSubscription = JSON.parse(stored);
          if (parsed && parsed.status === 'active') return parsed;
        }
      }
      if (email) {
        const cleanEmail = email.toLowerCase().trim();
        const storedEmail = localStorage.getItem(`${EMAIL_STUDENT_SUB_PREFIX}${cleanEmail}`);
        if (storedEmail) {
          const parsed: StudentSubscription = JSON.parse(storedEmail);
          if (parsed && parsed.status === 'active') return parsed;
        }
      }
      const universal =
        localStorage.getItem(UNIVERSAL_STUDENT_PASS_KEY) ||
        localStorage.getItem(GUEST_STUDENT_SUB_KEY);
      if (universal) {
        const parsed: StudentSubscription = JSON.parse(universal);
        if (parsed && parsed.status === 'active') return parsed;
      }

      // If unlocked flag is present, synthesize full active subscription object
      if (localStorage.getItem(UNIVERSAL_STUDENT_UNLOCKED_KEY) === 'true') {
        const fallbackSub: StudentSubscription = {
          id: `sub_local_stu_${Date.now()}`,
          student_id: studentId || 'current_student',
          student_name: 'Verified Student Resident',
          student_email: email || '',
          plan_id: 'student_pass',
          status: 'active',
          base_price: STUDENT_SUBSCRIPTION_PLAN.basePrice,
          gst_amount: STUDENT_SUBSCRIPTION_PLAN.gstAmount,
          total_price: STUDENT_SUBSCRIPTION_PLAN.totalPrice,
          payment_method: 'upi',
          payment_reference: `TXN-STU-${Date.now().toString().slice(-7)}`,
          start_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return fallbackSub;
      }
    } catch {
      // Fallback
    }
    return null;
  },

  /**
   * Save subscription locally across all keys for permanent offline preservation
   */
  saveLocalSubscription(sub: StudentSubscription, email?: string): void {
    try {
      // Set permanent unlock markers
      localStorage.setItem(UNIVERSAL_STUDENT_UNLOCKED_KEY, 'true');
      localStorage.setItem(UNIVERSAL_STUDENT_PASS_KEY, JSON.stringify(sub));
      localStorage.setItem(GUEST_STUDENT_SUB_KEY, JSON.stringify(sub));

      if (sub.student_id) {
        localStorage.setItem(`${STUDENT_SUB_PREFIX}${sub.student_id}`, JSON.stringify(sub));
      }

      const targetEmail = (sub.student_email || email || '').toLowerCase().trim();
      if (targetEmail) {
        localStorage.setItem(`${EMAIL_STUDENT_SUB_PREFIX}${targetEmail}`, JSON.stringify(sub));
      }
    } catch {
      // Ignore
    }
  },

  /**
   * Fetches active student subscription from Supabase or local storage.
   * If found locally, NEVER resets or wipes out the active pass.
   */
  async getStudentSubscription(studentId: string, email?: string): Promise<StudentSubscription | null> {
    const local = this.getLocalSubscription(studentId, email);

    // Try Supabase first if configured
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('student_subscriptions')
          .select('*')
          .eq('status', 'active');

        if (studentId) {
          query = query.eq('student_id', studentId);
        } else if (email) {
          query = query.eq('student_email', email.trim());
        }

        const { data, error } = await query.maybeSingle();

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
          this.saveLocalSubscription(sub, email);
          return sub;
        }
      } catch (err) {
        console.warn('Supabase getStudentSubscription check:', err);
      }
    }

    // Return active local pass if present
    if (local && local.status === 'active') {
      if (isSupabaseConfigured && supabase && studentId) {
        this.syncToSupabase(local, studentId, email).catch(() => {});
      }
      return local;
    }

    return null;
  },

  /**
   * Syncs active local pass up to Supabase database in background
   */
  async syncToSupabase(sub: StudentSubscription, studentId: string, email?: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !studentId) return;
    try {
      await supabase.from('student_subscriptions').upsert(
        {
          student_id: studentId,
          student_name: sub.student_name || 'Student Resident',
          student_email: sub.student_email || email || '',
          plan_id: 'student_pass',
          status: 'active',
          base_price: sub.base_price,
          gst_amount: sub.gst_amount,
          total_price: sub.total_price,
          payment_method: sub.payment_method || 'upi',
          payment_reference: sub.payment_reference || 'LOCAL-SYNCED',
          start_date: sub.start_date || new Date().toISOString(),
          created_at: sub.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id' }
      );
    } catch (e) {
      console.warn('Supabase auto-sync pass:', e);
    }
  },

  /**
   * Checks whether the student has an active ₹9 access pass
   */
  async hasActiveSubscription(studentId?: string, email?: string): Promise<boolean> {
    if (this.isLocallyUnlocked(studentId, email)) {
      return true;
    }
    const sub = await this.getStudentSubscription(studentId || '', email);
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
    const {
      studentId,
      studentName = 'Student Resident',
      studentEmail = '',
      paymentMethod = 'upi',
    } = params;

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

    // Save to all local storage keys immediately
    this.saveLocalSubscription(newSub, studentEmail);

    // Persist to Supabase DB if available
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
