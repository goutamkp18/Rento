import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { authService } from '../services/authService';
import { useToast } from './ToastContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  intendedDestination: string | null;
  setIntendedDestination: (path: string | null) => void;
  login: (identifier: string, password?: string, role?: UserRole) => Promise<UserProfile>;
  signup: (data: {
    email: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    role: 'student' | 'owner';
    phone?: string;
    password?: string;
    owner_type?: 'individual' | 'property_manager';
    business_name?: string;
  }) => Promise<UserProfile>;
  initiateSignup: (data: {
    email: string;
    password: string;
    role: 'student' | 'owner';
    first_name?: string;
    last_name?: string;
    full_name?: string;
    phone?: string;
    owner_type?: 'individual' | 'property_manager';
    business_name?: string;
  }) => Promise<{ success: boolean; email: string; message: string }>;
  verifySignupOtp: (
    email: string,
    token: string,
    signupData?: any
  ) => Promise<UserProfile>;
  resendSignupOtp: (email: string) => Promise<{ success: boolean; message: string }>;
  sendEmailOtp: (email: string) => Promise<{ success: boolean; message: string }>;
  verifyEmailOtp: (email: string, token: string, requestedRole?: UserRole) => Promise<UserProfile>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>;
  verifyAdminPrivileges: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [intendedDestination, setIntendedDestination] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let isMounted = true;

    const loadProfileForUser = async (authUser: { id: string; email?: string; created_at?: string }) => {
      if (!supabase) return null;
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (profile) {
          const userProfile = {
            id: authUser.id,
            email: authUser.email || profile.email,
            full_name: profile.full_name || authUser.email?.split('@')[0] || 'User',
            first_name: profile.first_name,
            last_name: profile.last_name,
            role: profile.role,
            phone: profile.phone,
            owner_type: profile.owner_type,
            business_name: profile.business_name,
            college: profile.college,
            city: profile.city,
            avatar_url: profile.avatar_url,
            created_at: profile.created_at || authUser.created_at || new Date().toISOString(),
          } as UserProfile;
          if (userProfile.role === 'admin') {
            authService.issueAdminSessionToken();
          }
          return userProfile;
        }

        // Fallback for immediate sign-in before profile row is fetched or for newly created OTP users
        const stored = authService.getCurrentUser();
        if (stored && stored.id === authUser.id) {
          return stored;
        }

        return {
          id: authUser.id,
          email: authUser.email || '',
          full_name: authUser.email?.split('@')[0] || 'User',
          role: 'student',
          created_at: authUser.created_at || new Date().toISOString(),
        } as UserProfile;
      } catch (e) {
        console.warn('Profile load notice:', e);
      }
      return null;
    };

    const initAuth = async () => {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const profile = await loadProfileForUser(session.user);
            if (isMounted && profile) {
              authService.saveSession(profile);
              setUser(profile);
              setIsLoading(false);
              return;
            }
          }
        }

        const stored = authService.getCurrentUser();
        if (stored && stored.role === 'admin') {
          const isVerified = await authService.verifyAdminPrivileges(stored);
          if (!isVerified) {
            if (isMounted) setUser(null);
            if (isMounted) setIsLoading(false);
            return;
          }
        }
        if (isMounted) setUser(stored);
      } catch {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initAuth();

    // Listen to real-time Supabase Auth state changes
    let subscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured && supabase) {
      const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session?.user) {
            const profile = await loadProfileForUser(session.user);
            if (isMounted && profile) {
              authService.saveSession(profile);
              setUser(profile);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          // If not admin operations gateway, clear user
          const current = authService.getCurrentUser();
          if (current?.role !== 'admin') {
            if (isMounted) setUser(null);
          }
        }
      });
      subscription = listener.subscription;
    }

    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const verifyAdminPrivileges = async (): Promise<boolean> => {
    return authService.verifyAdminPrivileges(user);
  };

  const login = async (identifier: string, password?: string, requestedRole?: UserRole): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const profile = await authService.login(identifier, password, requestedRole);
      setUser(profile);
      showToast({
        type: 'success',
        title: `Welcome back, ${profile.full_name}!`,
        message: `Signed in as ${profile.role.toUpperCase()}`,
      });
      return profile;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: {
    email: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    role: 'student' | 'owner';
    phone?: string;
    password?: string;
    owner_type?: 'individual' | 'property_manager';
    business_name?: string;
  }): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const profile = await authService.signup(data);
      setUser(profile);
      showToast({
        type: 'success',
        title: 'Account created successfully!',
        message: `Welcome to Rento, ${profile.full_name}`,
      });
      return profile;
    } finally {
      setIsLoading(false);
    }
  };

  const initiateSignup = async (data: {
    email: string;
    password: string;
    role: 'student' | 'owner';
    first_name?: string;
    last_name?: string;
    full_name?: string;
    phone?: string;
    owner_type?: 'individual' | 'property_manager';
    business_name?: string;
  }): Promise<{ success: boolean; email: string; message: string }> => {
    setIsLoading(true);
    try {
      const res = await authService.initiateSignup(data);
      showToast({
        type: 'success',
        title: 'Verification Code Sent',
        message: res.message,
      });
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const verifySignupOtp = async (
    email: string,
    token: string,
    signupData?: any
  ): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const profile = await authService.completeSignupWithOtp(email, token, signupData);
      setUser(profile);
      showToast({
        type: 'success',
        title: `Welcome to Rento, ${profile.full_name}!`,
        message: `Email verified successfully as ${profile.role.toUpperCase()}`,
      });
      return profile;
    } finally {
      setIsLoading(false);
    }
  };

  const resendSignupOtp = async (email: string): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    try {
      const res = await authService.resendSignupOtp(email);
      showToast({
        type: 'success',
        title: 'New Code Dispatched',
        message: res.message,
      });
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const sendEmailOtp = async (email: string): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    try {
      const res = await authService.sendEmailOtp(email);
      showToast({
        type: 'success',
        title: 'Verification Code Dispatched',
        message: res.message,
      });
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyEmailOtp = async (
    email: string,
    token: string,
    requestedRole?: UserRole
  ): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const profile = await authService.verifyEmailOtp(email, token, requestedRole);
      setUser(profile);
      showToast({
        type: 'success',
        title: `Welcome, ${profile.full_name}!`,
        message: `Successfully verified as ${profile.role.toUpperCase()}`,
      });
      return profile;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<UserProfile> => {
    const updated = await authService.updateProfile(updates);
    setUser(updated);
    return updated;
  };

  const logout = async (): Promise<void> => {
    await authService.logout();
    setUser(null);
    showToast({
      type: 'info',
      title: 'Signed out',
      message: 'You have been safely signed out.',
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isAuthenticated: Boolean(user),
        isLoading,
        intendedDestination,
        setIntendedDestination,
        login,
        signup,
        initiateSignup,
        verifySignupOtp,
        resendSignupOtp,
        sendEmailOtp,
        verifyEmailOtp,
        updateProfile,
        verifyAdminPrivileges,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
