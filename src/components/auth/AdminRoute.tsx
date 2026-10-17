import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { ShieldAlert, ShieldCheck, Lock, ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading, verifyAdminPrivileges, logout } = useAuth();
  const location = useLocation();

  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const performAuthorizationCheck = async () => {
      if (isLoading) return;

      // 1. Check if authenticated at all
      if (!isAuthenticated || !user) {
        if (isMounted) {
          setIsVerifying(false);
          setIsAuthorized(false);
        }
        return;
      }

      // 2. Reject non-admin roles immediately
      if (user.role !== 'admin') {
        if (isMounted) {
          setIsVerifying(false);
          setIsAuthorized(false);
        }
        return;
      }

      // 3. Cryptographically / backend verify admin role
      try {
        const verified = await verifyAdminPrivileges();
        if (isMounted) {
          if (verified) {
            setIsAuthorized(true);
            setVerificationError(null);
          } else {
            setIsAuthorized(false);
            setVerificationError('Session verification failed. Administrative privileges could not be confirmed.');
          }
          setIsVerifying(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setIsAuthorized(false);
          setVerificationError(err?.message || 'Security check failed');
          setIsVerifying(false);
        }
      }
    };

    performAuthorizationCheck();

    return () => {
      isMounted = false;
    };
  }, [user, isAuthenticated, isLoading, verifyAdminPrivileges]);

  // Loading state: Never flash protected content
  if (isLoading || isVerifying) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-4">
        <div className="p-8 rounded-3xl bg-navy-900 border border-brand-500/30 shadow-2xl max-w-sm w-full text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
            <Lock className="w-8 h-8 animate-pulse text-brand-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Verifying Authorization</h3>
            <p className="text-xs text-slate-400 mt-1">
              Validating administrator session security signatures...
            </p>
          </div>
          <div className="w-full bg-navy-950 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-brand-500 to-violet-500 h-full w-2/3 animate-[pulse_1s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated: Redirect to /admin/login
  if (!isAuthenticated || !user) {
    const redirectParam = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/admin/login?redirect=${redirectParam}`} replace />;
  }

  // Authenticated as Student: Explicit denial
  if (user.role === 'student') {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-navy-900 border border-red-500/30 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
              403 Forbidden
            </span>
            <h2 className="text-xl font-extrabold text-white">Administrator Access Denied</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your account is authenticated as a <strong>Student</strong> (<span className="text-white font-mono">{user.email}</span>). Student profiles are not authorized to view the Rento Operations review queue or administrative systems.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2.5">
            <Link to="/student/dashboard">
              <Button variant="primary" className="w-full justify-center text-xs" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Go to Student Dashboard
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-center text-xs text-slate-400 hover:text-white"
              onClick={() => logout()}
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Sign Out & Switch Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated as PG Owner: Explicit denial
  if (user.role === 'owner') {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-navy-900 border border-amber-500/30 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              403 Forbidden
            </span>
            <h2 className="text-xl font-extrabold text-white">Administrator Access Denied</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your account is registered as a <strong>PG Owner</strong> (<span className="text-white font-mono">{user.email}</span>). Property managers cannot access listing publication approval queues or verification controls.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2.5">
            <Link to="/owner/dashboard">
              <Button variant="primary" className="w-full justify-center text-xs" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Go to Owner Management Dashboard
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-center text-xs text-slate-400 hover:text-white"
              onClick={() => logout()}
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Sign Out & Switch Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // If role is claimed admin, but failed verification check
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-navy-900 border border-red-500/30 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-white">Security Verification Failed</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              {verificationError || 'Your administrative session signature could not be verified by the security layer. Please log in directly through the administrator security portal.'}
            </p>
          </div>
          <div className="pt-2">
            <Button
              variant="danger"
              className="w-full justify-center text-xs"
              onClick={async () => {
                await logout();
                window.location.assign('/admin/login');
              }}
            >
              Re-authenticate as Administrator
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Authorized Admin: Render protected route
  return <>{children}</>;
};
