import { OwnerSubscription, SubscriptionPlanId, SubscriptionStatus, TrialInfo, TrialStatus } from '../types';
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
   * Computes derived TrialInfo with exact authoritative calculations.
   */
  getTrialInfo(sub: OwnerSubscription | null): TrialInfo {
    if (!sub) {
      return {
        isEligible: true,
        isActive: false,
        isExpired: false,
        isConverted: false,
        hasStarted: false,
        startDate: null,
        endDate: null,
        daysRemaining: 30,
        hoursRemaining: 720,
        minutesRemaining: 0,
        trialPlanId: 'pro',
        trialListingLimit: 3,
        reminderStage: null,
      };
    }

    const hasStarted = Boolean(sub.trial_start);
    const startDate = sub.trial_start || null;
    const endDate = sub.trial_end || null;
    const isConverted = sub.trial_status === 'converted';

    let isExpired = sub.trial_status === 'expired' || sub.status === 'expired';
    let isActive = (sub.trial_status === 'active' || sub.status === 'trialing') && hasStarted && !isConverted;

    let daysRemaining = 0;
    let hoursRemaining = 0;
    let minutesRemaining = 0;
    let reminderStage: '7_days' | '3_days' | '1_day' | null = null;

    if (isActive && endDate) {
      const endMs = new Date(endDate).getTime();
      const nowMs = Date.now();
      const diffMs = endMs - nowMs;

      if (diffMs <= 0) {
        isActive = false;
        isExpired = true;
        daysRemaining = 0;
        hoursRemaining = 0;
        minutesRemaining = 0;
      } else {
        daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        hoursRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
        minutesRemaining = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));

        if (daysRemaining <= 1 || hoursRemaining <= 24) {
          reminderStage = '1_day';
        } else if (daysRemaining <= 3) {
          reminderStage = '3_days';
        } else if (daysRemaining <= 7) {
          reminderStage = '7_days';
        }
      }
    }

    const isEligible = !hasStarted && !isConverted && !isExpired && sub.trial_status !== 'active';

    return {
      isEligible,
      isActive,
      isExpired,
      isConverted,
      hasStarted,
      startDate,
      endDate,
      daysRemaining: hasStarted ? daysRemaining : 30,
      hoursRemaining: hasStarted ? hoursRemaining : 720,
      minutesRemaining,
      trialPlanId: sub.trial_plan_id || 'pro',
      trialListingLimit: sub.trial_listing_limit || 3,
      reminderStage,
    };
  },

  /**
   * Retrieves the subscription record for a specific owner.
   * Authoritative: automatically transitions expired trials to the free Basic plan
   * without auto-charging.
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
          const rawTrialStart = data.trial_start || (data.status === 'trialing' ? data.current_period_start : null);
          const rawTrialEnd = data.trial_end || (data.status === 'trialing' ? data.current_period_end : null);
          const rawTrialStatus: TrialStatus =
            data.trial_status ||
            (data.status === 'trialing' ? 'active' : data.status === 'expired' ? 'expired' : data.status === 'active' ? 'converted' : 'eligible');

          const sub: OwnerSubscription = {
            owner_id: data.owner_id,
            plan_id: data.plan_id || 'pro',
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
            trial_status: rawTrialStatus,
            trial_start: rawTrialStart,
            trial_end: rawTrialEnd,
            trial_plan_id: data.trial_plan_id || 'pro',
            trial_listing_limit: Number(data.trial_listing_limit) || 3,
            selected_plan_id: data.selected_plan_id || data.plan_id,
            payment_status: data.payment_status || (data.status === 'active' ? 'paid' : 'none'),
            active_listing_id: data.active_listing_id,
          };

          // Authoritative Server/Database check: Expire trial if past deadline
          if (
            (sub.status === 'trialing' || sub.trial_status === 'active') &&
            sub.trial_end &&
            new Date(sub.trial_end).getTime() <= Date.now()
          ) {
            sub.status = 'expired';
            sub.trial_status = 'expired';
            sub.plan_id = 'basic'; // Switch to free Basic plan
            sub.listing_limit = 1; // Enforce free plan listing limit
            sub.updated_at = new Date().toISOString();

            // Persist expiration change safely to Supabase
            try {
              await supabase
                .from('subscriptions')
                .update({
                  status: 'expired',
                  trial_status: 'expired',
                  plan_id: 'basic',
                  listing_limit: 1,
                  updated_at: sub.updated_at,
                })
                .eq('owner_id', ownerId);
            } catch (updateErr) {
              console.warn('Could not update expired subscription in Supabase:', updateErr);
            }
          }

          const subs = getStoredSubscriptions();
          subs[ownerId] = sub;
          saveStoredSubscriptions(subs);
          return sub;
        }
      } catch (e) {
        console.warn('Supabase getOwnerSubscription check:', e);
      }
    }

    // Fallback to persistent storage
    const subs = getStoredSubscriptions();
    let localSub = subs[ownerId] || null;

    if (localSub) {
      // Check expiration on local record
      if (
        (localSub.status === 'trialing' || localSub.trial_status === 'active') &&
        localSub.trial_end &&
        new Date(localSub.trial_end).getTime() <= Date.now()
      ) {
        localSub = {
          ...localSub,
          status: 'expired',
          trial_status: 'expired',
          plan_id: 'basic',
          listing_limit: 1,
          updated_at: new Date().toISOString(),
        };
        subs[ownerId] = localSub;
        saveStoredSubscriptions(subs);
      }
      return localSub;
    }

    // New eligible PG owner: Initialize 30-day free trial state
    const defaultTrialSub: OwnerSubscription = {
      owner_id: ownerId,
      plan_id: 'pro',
      status: 'trial_eligible',
      base_price: 0,
      monthly_base_price: 0,
      gst_rate: 0.18,
      gst_amount: 0,
      total_price: 0,
      total_monthly_price: 0,
      listing_limit: 3,
      start_date: '',
      renewal_date: '',
      payment_reference: 'free_trial_eligible',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      trial_status: 'eligible',
      trial_start: null,
      trial_end: null,
      trial_plan_id: 'pro',
      trial_listing_limit: 3,
      selected_plan_id: 'pro',
      payment_status: 'none',
    };

    subs[ownerId] = defaultTrialSub;
    saveStoredSubscriptions(subs);

    // If Supabase configured, attempt to save initial record
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('subscriptions').upsert(
          {
            owner_id: ownerId,
            plan_id: 'pro',
            status: 'trialing',
            base_price: 0,
            gst_amount: 0,
            total_price: 0,
            listing_limit: 3,
            payment_method: 'free_trial',
            created_at: defaultTrialSub.created_at,
            updated_at: defaultTrialSub.updated_at,
          },
          { onConflict: 'owner_id' }
        );
      } catch (e) {
        // Safe ignore
      }
    }

    return defaultTrialSub;
  },

  /**
   * Starts the 30-day trial countdown when the owner submits their first valid PG listing for review.
   * Strictly enforces ONE trial per owner account; will not reset if already started.
   */
  async startTrialOnFirstListing(ownerId: string): Promise<OwnerSubscription> {
    const currentSub = await this.getOwnerSubscription(ownerId);

    // If trial has already started or owner has paid plan, do NOT restart or overwrite
    if (
      currentSub &&
      (
        (currentSub.status === 'active' && currentSub.payment_status === 'paid') ||
        currentSub.trial_status === 'converted' ||
        (currentSub.status === 'active' && currentSub.payment_reference && !currentSub.payment_reference.startsWith('free_trial')) ||
        (currentSub.trial_start && (currentSub.trial_status === 'active' || currentSub.trial_status === 'expired'))
      )
    ) {
      return currentSub;
    }

    const now = new Date();
    const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const startedSub: OwnerSubscription = {
      ...(currentSub || {}),
      owner_id: ownerId,
      plan_id: 'pro',
      status: 'trialing',
      base_price: 0,
      monthly_base_price: 0,
      gst_rate: 0.18,
      gst_amount: 0,
      total_price: 0,
      total_monthly_price: 0,
      start_date: now.toISOString(),
      renewal_date: expiry.toISOString(),
      payment_reference: 'free_trial_activated',
      created_at: currentSub?.created_at || now.toISOString(),
      updated_at: now.toISOString(),
      trial_status: 'active',
      trial_start: now.toISOString(),
      trial_end: expiry.toISOString(),
      trial_plan_id: 'pro',
      trial_listing_limit: 3,
      selected_plan_id: 'pro',
      payment_status: 'none',
    };

    // Save to local storage
    const subs = getStoredSubscriptions();
    subs[ownerId] = startedSub;
    saveStoredSubscriptions(subs);

    // Authoritative Database Sync: Try RPC first, fallback to table update/upsert
    if (isSupabaseConfigured && supabase) {
      try {
        const { error: rpcError } = await supabase.rpc('start_owner_trial', { p_owner_id: ownerId });
        if (rpcError) {
          // Fallback to direct upsert with standard and trial columns
          await supabase.from('subscriptions').upsert(
            {
              owner_id: ownerId,
              plan_id: 'pro',
              status: 'trialing',
              base_price: 0,
              gst_amount: 0,
              total_price: 0,
              listing_limit: 3,
              current_period_start: now.toISOString(),
              current_period_end: expiry.toISOString(),
              payment_method: 'free_trial',
              updated_at: now.toISOString(),
            },
            { onConflict: 'owner_id' }
          );
        }
      } catch (err) {
        console.warn('Could not sync trial activation to Supabase:', err);
      }
    }

    return startedSub;
  },

  /**
   * Checks whether the owner has an active subscription or valid trial.
   */
  async hasActiveSubscription(ownerId: string): Promise<boolean> {
    const sub = await this.getOwnerSubscription(ownerId);
    if (!sub) return false;
    return sub.status === 'active' || sub.status === 'trialing' || sub.status === 'trial_eligible';
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
   * Creates or updates a subscription for the owner (e.g. upon real or simulated payment).
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

    const ref = paymentRef || (status === 'active' ? `PAY-${Date.now().toString().slice(-6)}` : undefined);

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
      trial_status: 'converted', // Successfully converted from trial to paid
      trial_start: subs[ownerId]?.trial_start,
      trial_end: subs[ownerId]?.trial_end,
      selected_plan_id: planId,
      payment_status: status === 'active' ? 'paid' : 'failed',
    };

    subs[ownerId] = newSub;
    saveStoredSubscriptions(subs);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('subscriptions').upsert(
          {
            owner_id: ownerId,
            plan_id: planId,
            status,
            base_price: price.basePrice,
            gst_amount: price.gstAmount,
            total_price: price.totalAmount,
            listing_limit: plan.listingLimit === Infinity ? 9999 : plan.listingLimit,
            current_period_start: now.toISOString(),
            current_period_end: renewal.toISOString(),
            payment_method: ref ? 'upi' : 'none',
            updated_at: now.toISOString(),
          },
          { onConflict: 'owner_id' }
        );
      } catch (err) {
        console.warn('Could not persist paid subscription to Supabase:', err);
      }
    }

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
   * When trial expires and owner has > 1 listing, lets owner select which listing
   * remains active on the Basic plan without deleting any properties or enquiries.
   */
  async setActiveListingForBasicPlan(
    ownerId: string,
    activeListingId: string
  ): Promise<OwnerSubscription> {
    const subs = getStoredSubscriptions();
    const existing = subs[ownerId];

    const updated: OwnerSubscription = {
      ...(existing || {
        owner_id: ownerId,
        plan_id: 'basic',
        status: 'expired',
        base_price: 0,
        gst_rate: 0.18,
        gst_amount: 0,
        total_price: 0,
        start_date: new Date().toISOString(),
        renewal_date: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      active_listing_id: activeListingId,
      updated_at: new Date().toISOString(),
    };

    subs[ownerId] = updated;
    saveStoredSubscriptions(subs);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('subscriptions')
          .update({ active_listing_id: activeListingId, updated_at: updated.updated_at })
          .eq('owner_id', ownerId);
      } catch (e) {
        // Safe ignore
      }
    }

    return updated;
  },

  /**
   * Checks whether the owner can create an additional listing based on their active plan or trial.
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
    isTrial: boolean;
    isTrialExpired: boolean;
    reason?: string;
  }> {
    const sub = await this.getOwnerSubscription(ownerId);
    const trialInfo = this.getTrialInfo(sub);

    // Eligible trial (before first listing submission)
    if (trialInfo.isEligible) {
      const limit = trialInfo.trialListingLimit;
      const remaining = Math.max(0, limit - currentCount);
      const canAdd = currentCount < limit;
      return {
        canAdd,
        limit,
        current: currentCount,
        remaining,
        planId: trialInfo.trialPlanId,
        planName: '30-Day Free Trial (Pro)',
        hasActiveSubscription: true,
        isTrial: true,
        isTrialExpired: false,
        reason: canAdd
          ? undefined
          : `You have reached the maximum listing capacity (${limit} PGs) for the 30-Day Free Trial. Upgrade to Pro Plus for unlimited properties.`,
      };
    }

    // Active 30-day trial (countdown in progress)
    if (trialInfo.isActive) {
      const limit = trialInfo.trialListingLimit;
      const remaining = Math.max(0, limit - currentCount);
      const canAdd = currentCount < limit;
      return {
        canAdd,
        limit,
        current: currentCount,
        remaining,
        planId: trialInfo.trialPlanId,
        planName: '30-Day Free Trial (Pro)',
        hasActiveSubscription: true,
        isTrial: true,
        isTrialExpired: false,
        reason: canAdd
          ? undefined
          : `You have reached the maximum listing capacity (${limit} PGs) for the 30-Day Free Trial. Upgrade to Pro Plus for unlimited properties.`,
      };
    }

    // Expired trial -> Switched to free Basic plan
    if (trialInfo.isExpired || sub?.status === 'expired') {
      const limit = 1; // Basic free plan listing limit
      const remaining = Math.max(0, limit - currentCount);
      const canAdd = currentCount < limit;

      let reason = 'Your 30-day free trial has expired and your account has switched to the free Basic plan (1 PG limit).';
      if (currentCount > 1) {
        reason = `Your 30-day free trial has expired. The free Basic plan allows 1 active listing, but you have ${currentCount} properties saved. Please select which listing remains active or upgrade to Pro to keep all properties active.`;
      } else if (!canAdd) {
        reason = 'The free Basic plan allows 1 active listing. Upgrade to Pro or Pro Plus to list additional accommodations.';
      }

      return {
        canAdd,
        limit,
        current: currentCount,
        remaining,
        planId: 'basic',
        planName: 'Free Basic Plan',
        hasActiveSubscription: false,
        isTrial: false,
        isTrialExpired: true,
        reason,
      };
    }

    // Regular active paid subscription
    if (sub && sub.status === 'active') {
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
        isTrial: false,
        isTrialExpired: false,
        reason: canAdd
          ? undefined
          : `You have reached the maximum listing capacity (${limit} PG${limit > 1 ? 's' : ''}) for the ${plan.name} plan. Please upgrade to add more properties.`,
      };
    }

    // Default: no subscription
    return {
      canAdd: false,
      limit: 0,
      current: currentCount,
      remaining: 0,
      planName: 'No Active Subscription',
      hasActiveSubscription: false,
      isTrial: false,
      isTrialExpired: false,
      reason: 'A subscription or free trial is required to list properties on Rento.',
    };
  },
};
