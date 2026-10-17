import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { studentSubscriptionService } from '../services/studentSubscriptionService';
import { StudentPaywallModal } from '../components/subscription/StudentPaywallModal';
import { StudentSubscription } from '../types';

interface StudentSubscriptionContextType {
  hasStudentSubscription: boolean;
  studentSubscription: StudentSubscription | null;
  isLoading: boolean;
  openPaywall: (reason?: string, onSuccess?: () => void) => void;
  closePaywall: () => void;
  refreshSubscription: () => Promise<void>;
}

const StudentSubscriptionContext = createContext<StudentSubscriptionContextType | undefined>(undefined);

export const StudentSubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [hasStudentSubscription, setHasStudentSubscription] = useState<boolean>(false);
  const [studentSubscription, setStudentSubscription] = useState<StudentSubscription | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPaywallOpen, setIsPaywallOpen] = useState<boolean>(false);
  const [paywallReason, setPaywallReason] = useState<string>('access full PG features');
  const [pendingSuccessCallback, setPendingSuccessCallback] = useState<(() => void) | null>(null);

  const checkSubscription = useCallback(async () => {
    setIsLoading(true);
    try {
      const studentId = user?.id;
      const sub = await studentSubscriptionService.getStudentSubscription(studentId || '');
      if (sub && sub.status === 'active') {
        setHasStudentSubscription(true);
        setStudentSubscription(sub);
      } else {
        setHasStudentSubscription(false);
        setStudentSubscription(null);
      }
    } catch (err) {
      console.warn('Student subscription check error:', err);
      // Check local cache
      const local = studentSubscriptionService.getLocalSubscription(user?.id);
      if (local && local.status === 'active') {
        setHasStudentSubscription(true);
        setStudentSubscription(local);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  const openPaywall = (reason?: string, onSuccess?: () => void) => {
    if (reason) setPaywallReason(reason);
    if (onSuccess) setPendingSuccessCallback(() => onSuccess);
    setIsPaywallOpen(true);
  };

  const closePaywall = () => {
    setIsPaywallOpen(false);
    setPendingSuccessCallback(null);
  };

  const handlePaywallSuccess = async () => {
    await checkSubscription();
    if (pendingSuccessCallback) {
      pendingSuccessCallback();
    }
  };

  return (
    <StudentSubscriptionContext.Provider
      value={{
        hasStudentSubscription,
        studentSubscription,
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
