import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  OwnerSubscription,
  SubscriptionPlan,
  SubscriptionPlanId,
  SubscriptionStatus,
  TrialInfo,
  PaymentRequest
} from '../types';
import { subscriptionService } from '../services/subscriptionService';
import { listingsService } from '../services/listingsService';
import { getSubscriptionPlan } from '../utils/pricing';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface SubscriptionContextType {
  subscription: OwnerSubscription | null;
  currentPlan: SubscriptionPlan | null;
  selectedPlan: SubscriptionPlan;
  status: SubscriptionStatus;
  isLoading: boolean;
  hasActiveSubscription: boolean;
  canAddListing: boolean;
  listingCount: number;
  listingLimit: number;
  remainingCapacity: number;
  capacityReason?: string;
  paymentHistory: PaymentRequest[];
  // 30-Day Free Trial extensions
  trialInfo: TrialInfo;
  isTrialActive: boolean;
  isTrialEligible: boolean;
  isTrialExpired: boolean;
  activeListingId?: string;
  startTrialOnFirstListing: () => Promise<OwnerSubscription>;
  setActiveListingForBasic: (listingId: string) => Promise<void>;
  selectPlan: (planId: SubscriptionPlanId) => void;
  submitPaymentRequest: (utr: string, receiptFile?: File | null) => Promise<PaymentRequest>;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [subscription, setSubscription] = useState<OwnerSubscription | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>('pro');
  const [listingCount, setListingCount] = useState<number>(0);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadSubscriptionData = useCallback(async () => {
    if (!user || user.role !== 'owner') {
      setSubscription(null);
      setPaymentHistory([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [sub, listings, history] = await Promise.all([
        subscriptionService.getOwnerSubscription(user.id),
        listingsService.getOwnerListings(user.id),
        subscriptionService.getPaymentHistory(user.id),
      ]);

      setSubscription(sub);
      setListingCount(listings.length);
      setPaymentHistory(history);
      setSelectedPlanId(subscriptionService.getSelectedPlan());
    } catch (err) {
      console.error('Failed to load subscription data', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSubscriptionData();
  }, [loadSubscriptionData]);

  const selectPlan = (planId: SubscriptionPlanId) => {
    setSelectedPlanId(planId);
    subscriptionService.saveSelectedPlan(planId);
  };

  /**
   * Starts trial countdown when the owner submits their first valid PG listing for review.
   */
  const startTrialOnFirstListing = async (): Promise<OwnerSubscription> => {
    if (!user) throw new Error('Not authenticated');
    const started = await subscriptionService.startTrialOnFirstListing(user.id);
    setSubscription(started);
    return started;
  };

  /**
   * Sets the primary active listing under the free Basic plan upon trial expiration.
   */
  const setActiveListingForBasic = async (listingId: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const updated = await subscriptionService.setActiveListingForBasicPlan(user.id, listingId);
      if (updated) setSubscription(updated);
      showToast({
        type: 'success',
        title: 'Active Property Updated',
        message: 'Your designated property is now the active listing under the free Basic plan.',
      });
    } catch (e: any) {
      showToast({
        type: 'error',
        title: 'Action Failed',
        message: e?.message || 'Could not update active listing.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Submits a renewal or upgrade payment request to Supabase.
   * Enforces server-controlled pricing and marks status 'pending' until admin verification.
   */
  const submitPaymentRequest = async (
    utr: string,
    receiptFile?: File | null
  ): Promise<PaymentRequest> => {
    if (!user) throw new Error('Authentication required');

    setIsLoading(true);
    try {
      const result = await subscriptionService.submitOwnerPaymentRequest({
        ownerId: user.id,
        planId: selectedPlanId,
        utr,
        receiptFile,
      });

      // Reload subscription & history to reflect pending state
      await loadSubscriptionData();

      showToast({
        type: 'success',
        title: 'Payment Submitted for Verification',
        message: `Your ${getSubscriptionPlan(selectedPlanId).name} payment reference has been recorded and is pending admin approval.`,
      });

      return result.request;
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Payment Submission Failed',
        message: err?.message || 'Could not record payment request in Supabase.',
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Derived state calculations
  const status: SubscriptionStatus = subscription?.status || 'no_subscription';
  const planId = subscription?.plan_id || selectedPlanId;
  const currentPlan = subscription ? getSubscriptionPlan(planId) : null;
  const selectedPlan = getSubscriptionPlan(selectedPlanId);

  const trialInfo = subscriptionService.getTrialInfo(subscription);
  const isTrialActive = trialInfo.isActive;
  const isTrialEligible = trialInfo.isEligible;
  const isTrialExpired = trialInfo.isExpired;

  // Authoritative listing limits
  let listingLimit = 1;
  let hasActiveSubscription = false;
  let capacityReason: string | undefined;

  const isProvisionalActive =
    Boolean(subscription?.is_provisional) &&
    Boolean(subscription?.provisional_access_until) &&
    new Date(subscription!.provisional_access_until!).getTime() > Date.now();

  if (isTrialEligible || isTrialActive) {
    listingLimit = trialInfo.trialListingLimit;
    hasActiveSubscription = true;
    if (listingCount >= listingLimit) {
      capacityReason = `You have reached the maximum listing capacity (${listingLimit} PGs) for the 30-Day Free Trial. Upgrade to Pro Plus for unlimited properties.`;
    }
  } else if (status === 'active' || isProvisionalActive) {
    const activePlanId = (isProvisionalActive && subscription?.selected_plan_id) || subscription!.plan_id || 'pro';
    const plan = getSubscriptionPlan(activePlanId);
    listingLimit = plan.listingLimit;
    hasActiveSubscription = true;
    if (listingLimit !== Infinity && listingCount >= listingLimit) {
      capacityReason = `You have reached the maximum listing capacity (${listingLimit} PG${listingLimit > 1 ? 's' : ''}) for the ${plan.name} plan. Please upgrade to add more properties.`;
    }
  } else if (isTrialExpired || status === 'expired') {
    listingLimit = 1;
    hasActiveSubscription = false;
    if (listingCount > 1) {
      capacityReason = `Your 30-day free trial has expired. The free Basic plan allows 1 active listing, but you have ${listingCount} properties saved. Please select which listing remains active or renew/upgrade to Pro.`;
    } else if (listingCount >= 1) {
      capacityReason = 'The free Basic plan allows 1 active listing. Upgrade to Pro or Pro Plus to list additional accommodations.';
    }
  } else {
    listingLimit = 0;
    hasActiveSubscription = false;
    capacityReason = 'A subscription or free trial is required to list properties on Rento.';
  }

  const remainingCapacity =
    listingLimit === Infinity ? Infinity : Math.max(0, listingLimit - listingCount);
  const canAddListing = listingLimit === Infinity || listingCount < listingLimit;

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        currentPlan,
        selectedPlan,
        status,
        isLoading,
        hasActiveSubscription,
        canAddListing,
        listingCount,
        listingLimit,
        remainingCapacity,
        capacityReason,
        paymentHistory,
        trialInfo,
        isTrialActive,
        isTrialEligible,
        isTrialExpired,
        activeListingId: subscription?.active_listing_id,
        startTrialOnFirstListing,
        setActiveListingForBasic,
        selectPlan,
        submitPaymentRequest,
        refreshSubscription: loadSubscriptionData,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
