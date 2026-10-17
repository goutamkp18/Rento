import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { OwnerSubscription, SubscriptionPlan, SubscriptionPlanId, SubscriptionStatus } from '../types';
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
          title: 'Demo Payment Successful',
          message: `Your ${getSubscriptionPlan(selectedPlanId).name} subscription is now active in demo mode.`,
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
        message: 'Your subscription status is updated to cancelled in this demo.',
        isMockPersisted: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Derived properties
  const hasActiveSubscription = subscription !== null && subscription.status === 'active';
  const currentPlan = subscription ? getSubscriptionPlan(subscription.plan_id) : null;
  const selectedPlan = getSubscriptionPlan(selectedPlanId);

  const listingLimit = currentPlan ? currentPlan.listingLimit : 0;
  const remainingCapacity =
    listingLimit === Infinity ? Infinity : Math.max(0, listingLimit - listingCount);
  const canAddListing = hasActiveSubscription && (listingLimit === Infinity || listingCount < listingLimit);

  let capacityReason: string | undefined = undefined;
  if (!hasActiveSubscription) {
    capacityReason = 'An active subscription is required before you can list a PG.';
  } else if (!canAddListing) {
    capacityReason = `You have reached your listing limit (${listingLimit} PG${listingLimit > 1 ? 's' : ''}) on the ${currentPlan?.name} plan. Please upgrade to add more properties.`;
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
