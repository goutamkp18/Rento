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
  
  // Synchronous initial check so there is zero delay or flash of locked state
  const [hasStudentSubscription, setHasStudentSubscription] = useState<boolean>(() => {
    return studentSubscriptionService.isLocallyUnlocked(user?.id, user?.email);
  });
  
  const [studentSubscription, setStudentSubscription] = useState<StudentSubscription | null>(() => {
    return studentSubscriptionService.getLocalSubscription(user?.id, user?.email);
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPaywallOpen, setIsPaywallOpen] = useState<boolean>(false);
  const [paywallReason, setPaywallReason] = useState<string>('access full PG features');
  const [pendingSuccessCallback, setPendingSuccessCallback] = useState<(() => void) | null>(null);

  const checkSubscription = useCallback(async () => {
    const studentId = user?.id || '';
    const studentEmail = user?.email || '';

    // If already locally unlocked, immediately guarantee active status
    if (studentSubscriptionService.isLocallyUnlocked(studentId, studentEmail)) {
      setHasStudentSubscription(true);
      const local = studentSubscriptionService.getLocalSubscription(studentId, studentEmail);
      if (local) setStudentSubscription(local);
    }

    try {
      const sub = await studentSubscriptionService.getStudentSubscription(studentId, studentEmail);
      if (sub && sub.status === 'active') {
        setHasStudentSubscription(true);
        setStudentSubscription(sub);
      } else {
        // Only set to false if NOT locally unlocked
        if (!studentSubscriptionService.isLocallyUnlocked(studentId, studentEmail)) {
          setHasStudentSubscription(false);
          setStudentSubscription(null);
        }
      }
    } catch (err) {
      console.warn('Student subscription check error:', err);
      if (studentSubscriptionService.isLocallyUnlocked(studentId, studentEmail)) {
        setHasStudentSubscription(true);
        setStudentSubscription(studentSubscriptionService.getLocalSubscription(studentId, studentEmail));
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  const openPaywall = (reason?: string, onSuccess?: () => void) => {
    // CRITICAL: If the customer already paid and pass is active, NEVER show paywall again!
    if (hasStudentSubscription || studentSubscriptionService.isLocallyUnlocked(user?.id, user?.email)) {
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
    setHasStudentSubscription(true);
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
