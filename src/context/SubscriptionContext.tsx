import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { OwnerSubscription, SubscriptionPlan, SubscriptionPlanId, SubscriptionStatus, TrialInfo } from '../types';
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
  // 30-Day Free Trial extensions
  trialInfo: TrialInfo;
  isTrialActive: boolean;
  isTrialEligible: boolean;
  isTrialExpired: boolean;
  activeListingId?: string;
  startTrialOnFirstListing: () => Promise<OwnerSubscription>;
  setActiveListingForBasic: (listingId: string) => Promise<void>;
  selectPlan: (planId: SubscriptionPlanId) => void;
  simulatePayment: (isSuccess: boolean) => Promise<boolean>;
  upgradePlan: (planId: SubscriptionPlanId) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [subscription, setSubscription] = useState<OwnerSubscription | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>('pro');
  const [listingCount, setListingCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadSubscriptionData = useCallback(async () => {
    if (!user || user.role !== 'owner') {
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [sub, listings] = await Promise.all([
        subscriptionService.getOwnerSubscription(user.id),
        listingsService.getOwnerListings(user.id),
      ]);

      setSubscription(sub);
      setListingCount(listings.length);
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
      setSubscription(updated);
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

  const simulatePayment = async (isSuccess: boolean): Promise<boolean> => {
    if (!user) return false;

    setIsLoading(true);
    try {
      if (isSuccess) {
        const activeSub = await subscriptionService.createDemoSubscription(
          user.id,
          selectedPlanId,
          'active'
        );
        setSubscription(activeSub);
        showToast({
          type: 'success',
          title: 'Plan Activated',
          message: `Your ${getSubscriptionPlan(selectedPlanId).name} subscription is now active.`,
          isMockPersisted: true,
        });
        return true;
      } else {
        const failedSub = await subscriptionService.updateSubscriptionStatus(
          user.id,
          'payment_failed'
        );
        setSubscription(failedSub);
        showToast({
          type: 'error',
          title: 'Payment Simulation Failed',
          message: 'The simulated transaction failed. Your subscription remains inactive.',
        });
        return false;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const upgradePlan = async (newPlanId: SubscriptionPlanId) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const updated = await subscriptionService.upgradeSubscription(user.id, newPlanId);
      setSubscription(updated);
      setSelectedPlanId(newPlanId);
      showToast({
        type: 'success',
        title: 'Plan Upgraded',
        message: `Upgraded to ${getSubscriptionPlan(newPlanId).name} plan. Listing limits updated immediately.`,
        isMockPersisted: true,
      });
    } catch (e: any) {
      showToast({
        type: 'error',
        title: 'Upgrade Failed',
        message: e?.message || 'Could not upgrade plan.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSubscription = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const cancelled = await subscriptionService.updateSubscriptionStatus(user.id, 'cancelled');
      setSubscription(cancelled);
      showToast({
        type: 'info',
        title: 'Subscription Cancelled',
        message: 'Your subscription status is updated to cancelled.',
        isMockPersisted: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Derived Trial state
  const trialInfo = subscriptionService.getTrialInfo(subscription);
  const isTrialActive = trialInfo.isActive;
  const isTrialEligible = trialInfo.isEligible;
  const isTrialExpired = trialInfo.isExpired;

  // An owner has active access if they have a paid plan OR an active/eligible trial
  const hasActiveSubscription =
    subscription !== null &&
    (subscription.status === 'active' ||
      subscription.status === 'trialing' ||
      subscription.status === 'trial_eligible' ||
      isTrialActive ||
      isTrialEligible);

  const currentPlan = subscription
    ? isTrialActive || isTrialEligible
      ? getSubscriptionPlan(trialInfo.trialPlanId)
      : isTrialExpired
      ? getSubscriptionPlan('basic')
      : getSubscriptionPlan(subscription.plan_id)
    : null;

  const selectedPlan = getSubscriptionPlan(selectedPlanId);

  // Listing limits
  const listingLimit = isTrialActive || isTrialEligible
    ? trialInfo.trialListingLimit
    : isTrialExpired
    ? 1
    : currentPlan
    ? currentPlan.listingLimit
    : 0;

  const remainingCapacity =
    listingLimit === Infinity ? Infinity : Math.max(0, listingLimit - listingCount);
  const canAddListing = hasActiveSubscription && (listingLimit === Infinity || listingCount < listingLimit);

  let capacityReason: string | undefined = undefined;
  if (isTrialExpired) {
    if (listingCount > 1) {
      capacityReason = `Your 30-day free trial has expired. The free Basic plan permits 1 active listing (${listingCount} properties saved). Select which property remains active or upgrade to Pro.`;
    } else {
      capacityReason = 'The free Basic plan allows 1 active listing. Upgrade to Pro to list additional accommodations.';
    }
  } else if (!hasActiveSubscription) {
    capacityReason = 'An active subscription or 30-day free trial is required before you can list a PG.';
  } else if (!canAddListing) {
    capacityReason = `You have reached your listing limit (${listingLimit} PG${listingLimit > 1 ? 's' : ''}) on the ${currentPlan?.name || 'Trial'} plan. Please upgrade to add more properties.`;
  }

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        currentPlan,
        selectedPlan,
        status: subscription?.status || 'no_subscription',
        isLoading,
        hasActiveSubscription,
        canAddListing,
        listingCount,
        listingLimit,
        remainingCapacity,
        capacityReason,
        trialInfo,
        isTrialActive,
        isTrialEligible,
        isTrialExpired,
        activeListingId: subscription?.active_listing_id,
        startTrialOnFirstListing,
        setActiveListingForBasic,
        selectPlan,
        simulatePayment,
        upgradePlan,
        cancelSubscription,
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
