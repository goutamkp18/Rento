import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { studentSubscriptionService } from '../services/studentSubscriptionService';
import { StudentPaywallModal } from '../components/subscription/StudentPaywallModal';
import { StudentSubscription, PaymentRequest } from '../types';

interface StudentSubscriptionContextType {
  hasStudentSubscription: boolean;
  studentSubscription: StudentSubscription | null;
  pendingPayment: PaymentRequest | null;
  rejectedPayment: PaymentRequest | null;
  isLoading: boolean;
  openPaywall: (reason?: string, onSuccess?: () => void) => void;
  closePaywall: () => void;
  refreshSubscription: () => Promise<void>;
}

const StudentSubscriptionContext = createContext<StudentSubscriptionContextType | undefined>(undefined);

export const StudentSubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Authoritative default: locked (false) until verified directly by Supabase
  const [hasStudentSubscription, setHasStudentSubscription] = useState<boolean>(false);
  const [studentSubscription, setStudentSubscription] = useState<StudentSubscription | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PaymentRequest | null>(null);
  const [rejectedPayment, setRejectedPayment] = useState<PaymentRequest | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPaywallOpen, setIsPaywallOpen] = useState<boolean>(false);
  const [paywallReason, setPaywallReason] = useState<string>('access full PG features');
  const [pendingSuccessCallback, setPendingSuccessCallback] = useState<(() => void) | null>(null);

  const checkSubscription = useCallback(async () => {
    // If not logged in, ensure state is completely cleared
    if (!user) {
      setHasStudentSubscription(false);
      setStudentSubscription(null);
      setPendingPayment(null);
      setRejectedPayment(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const { activeSubscription, pendingRequest, rejectedRequest } =
        await studentSubscriptionService.getPaymentStatus(user.id);

      const isProvisionalValid =
        activeSubscription &&
        Boolean(activeSubscription.is_provisional) &&
        Boolean(activeSubscription.provisional_access_until) &&
        new Date(activeSubscription.provisional_access_until!).getTime() > Date.now();

      if (activeSubscription && (activeSubscription.status === 'active' || isProvisionalValid)) {
        setHasStudentSubscription(true);
        setStudentSubscription(activeSubscription);
        setPendingPayment(pendingRequest);
        setRejectedPayment(null);
      } else {
        setHasStudentSubscription(false);
        setStudentSubscription(null);
        setPendingPayment(pendingRequest);
        setRejectedPayment(rejectedRequest);
      }
    } catch (err) {
      console.warn('[StudentSubscriptionContext] Entitlement check error:', err);
      // On error, guarantee locked state rather than phantom unlocking
      setHasStudentSubscription(false);
      setStudentSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  const openPaywall = (reason?: string, onSuccess?: () => void) => {
    // Only bypass if Supabase confirms active entitlement
    if (hasStudentSubscription) {
      if (onSuccess) {
        onSuccess();
      }
      return;
    }

    if (reason) setPaywallReason(reason);
    if (onSuccess) setPendingSuccessCallback(() => onSuccess);
    setIsPaywallOpen(true);
  };

  const closePaywall = () => {
    setIsPaywallOpen(false);
    setPendingSuccessCallback(null);
  };

  const handlePaywallSuccess = async () => {
    // Re-verify from Supabase database
    await checkSubscription();
    if (hasStudentSubscription && pendingSuccessCallback) {
      pendingSuccessCallback();
    }
  };

  return (
    <StudentSubscriptionContext.Provider
      value={{
        hasStudentSubscription,
        studentSubscription,
        pendingPayment,
        rejectedPayment,
        isLoading,
        openPaywall,
        closePaywall,
        refreshSubscription: checkSubscription,
      }}
    >
      {children}

      <StudentPaywallModal
        isOpen={isPaywallOpen}
        onClose={closePaywall}
        reason={paywallReason}
        onSuccess={handlePaywallSuccess}
      />
    </StudentSubscriptionContext.Provider>
  );
};

export const useStudentSubscription = (): StudentSubscriptionContextType => {
  const context = useContext(StudentSubscriptionContext);
  if (!context) {
    throw new Error('useStudentSubscription must be used within a StudentSubscriptionProvider');
  }
  return context;
};
