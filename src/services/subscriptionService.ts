import { OwnerSubscription, SubscriptionPlanId, SubscriptionStatus } from '../types';
import { calculatePlanPrice, getSubscriptionPlan } from '../utils/pricing';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const SUBSCRIPTION_STORAGE_KEY = 'rento_owner_subscriptions_db';
const PENDING_PLAN_KEY = 'rento_selected_owner_plan';

function getStoredSubscriptions(): Record<string, OwnerSubscription> {
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
    if (raw) {
      const parsed: Record<string, OwnerSubscription> = JSON.parse(raw);
      delete parsed['usr_owner_01']; // Remove stale dummy owner seed
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse subscriptions from storage', e);
  }

  return {};
}

function saveStoredSubscriptions(subs: Record<string, OwnerSubscription>): void {
  try {
    localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(subs));
  } catch (e) {
    console.error('Failed to save subscriptions to storage', e);
  }
}

export const subscriptionService = {
  /**
   * Retrieves the subscription record for a specific owner.
   */
  async getOwnerSubscription(ownerId: string): Promise<OwnerSubscription | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('owner_id', ownerId)
          .maybeSingle();

        if (!error && data) {
          return {
            owner_id: data.owner_id,
            plan_id: data.plan_id,
            status: data.status,
            base_price: Number(data.base_price) || 0,
            monthly_base_price: Number(data.base_price) || 0,
            gst_rate: 0.18,
            gst_amount: Number(data.gst_amount) || 0,
            total_price: Number(data.total_price) || 0,
            total_monthly_price: Number(data.total_price) || 0,
            start_date: data.current_period_start || data.created_at,
            renewal_date: data.current_period_end || '',
            payment_reference: data.payment_method || 'live_record',
            created_at: data.created_at,
            updated_at: data.updated_at || data.created_at,
          };
        }
      } catch (e) {
        console.warn('Supabase getOwnerSubscription check:', e);
      }
    }

    const subs = getStoredSubscriptions();
    return subs[ownerId] || null;
  },

  /**
   * Checks whether the owner has an active subscription.
   */
  async hasActiveSubscription(ownerId: string): Promise<boolean> {
    const sub = await this.getOwnerSubscription(ownerId);
    return sub !== null && sub.status === 'active';
  },

  /**
   * Saves the owner's selected plan in the current onboarding flow.
   */
  saveSelectedPlan(planId: SubscriptionPlanId): void {
    try {
      localStorage.setItem(PENDING_PLAN_KEY, planId);
    } catch (e) {
      console.error('Failed to save pending plan', e);
    }
  },

  /**
   * Gets the currently selected plan in the flow. Defaults to 'pro'.
   */
  getSelectedPlan(): SubscriptionPlanId {
    try {
      const saved = localStorage.getItem(PENDING_PLAN_KEY) as SubscriptionPlanId | null;
      if (saved && (saved === 'basic' || saved === 'pro' || saved === 'pro_plus')) {
        return saved;
      }
    } catch (e) {
      // Ignore
    }
    return 'pro';
  },

  /**
   * Creates or updates a demo subscription for the owner.
   */
  async createDemoSubscription(
    ownerId: string,
    planId: SubscriptionPlanId,
    status: SubscriptionStatus = 'active',
    paymentRef?: string
  ): Promise<OwnerSubscription> {
    const subs = getStoredSubscriptions();
    const plan = getSubscriptionPlan(planId);
    const price = calculatePlanPrice(plan.basePrice);

    const now = new Date();
    const renewal = new Date();
    renewal.setDate(now.getDate() + 30);

    const ref = paymentRef || (status === 'active' ? `DEMO-PAY-${Date.now().toString().slice(-6)}` : undefined);

    const newSub: OwnerSubscription = {
      owner_id: ownerId,
      plan_id: planId,
      status,
      base_price: price.basePrice,
      monthly_base_price: price.basePrice,
      gst_rate: price.gstRate,
      gst_amount: price.gstAmount,
      total_price: price.totalAmount,
      total_monthly_price: price.totalAmount,
      start_date: now.toISOString(),
      renewal_date: renewal.toISOString(),
      payment_reference: ref,
      demo_payment_reference: ref,
      created_at: subs[ownerId]?.created_at || now.toISOString(),
      updated_at: now.toISOString(),
    };

    subs[ownerId] = newSub;
    saveStoredSubscriptions(subs);
    return newSub;
  },

  /**
   * Updates only the subscription status (e.g. on failed payment or cancellation).
   */
  async updateSubscriptionStatus(
    ownerId: string,
    status: SubscriptionStatus
  ): Promise<OwnerSubscription> {
    const subs = getStoredSubscriptions();
    const existing = subs[ownerId];

    if (!existing) {
      const selectedPlan = this.getSelectedPlan();
      return this.createDemoSubscription(ownerId, selectedPlan, status);
    }

    const updated: OwnerSubscription = {
      ...existing,
      status,
      updated_at: new Date().toISOString(),
    };

    subs[ownerId] = updated;
    saveStoredSubscriptions(subs);
    return updated;
  },

  /**
   * Upgrades the owner's subscription to a new plan.
   */
  async upgradeSubscription(
    ownerId: string,
    newPlanId: SubscriptionPlanId
  ): Promise<OwnerSubscription> {
    return this.createDemoSubscription(ownerId, newPlanId, 'active');
  },

  /**
   * Checks whether the owner can create an additional listing based on their active plan.
   */
  async checkListingCapacity(
    ownerId: string,
    currentCount: number
  ): Promise<{
    canAdd: boolean;
    limit: number;
    current: number;
    remaining: number;
    planId?: SubscriptionPlanId;
    planName: string;
    hasActiveSubscription: boolean;
    reason?: string;
  }> {
    const sub = await this.getOwnerSubscription(ownerId);

    if (!sub || sub.status !== 'active') {
      return {
        canAdd: false,
        limit: 0,
        current: currentCount,
        remaining: 0,
        planName: 'No Active Subscription',
        hasActiveSubscription: false,
        reason: 'A mandatory active subscription is required to list properties on Rento.',
      };
    }

    const plan = getSubscriptionPlan(sub.plan_id);
    const limit = plan.listingLimit;
    const remaining = limit === Infinity ? Infinity : Math.max(0, limit - currentCount);
    const canAdd = limit === Infinity || currentCount < limit;

    return {
      canAdd,
      limit,
      current: currentCount,
      remaining,
      planId: sub.plan_id,
      planName: plan.name,
      hasActiveSubscription: true,
      reason: canAdd
        ? undefined
        : `You have reached the maximum listing capacity (${limit} PG${limit > 1 ? 's' : ''}) for the ${plan.name} plan. Please upgrade to add more properties.`,
    };
  },
};
