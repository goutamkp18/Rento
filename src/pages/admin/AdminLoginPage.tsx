import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ShieldCheck, Lock, AlertCircle, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { authService } from '../../services/authService';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Client-side rate-limiting / brute-force lockout protection
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);

  const rawRedirect = searchParams.get('redirect');
  const safeRedirect = authService.sanitizeRedirectUrl(rawRedirect, '/admin/listings');

  // If already authenticated as admin, redirect immediately
  React.useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      navigate(safeRedirect, { replace: true });
    }
  }, [isAuthenticated, user, navigate, safeRedirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Check if locked out
    if (lockoutTime && Date.now() < lockoutTime) {
      const secondsLeft = Math.ceil((lockoutTime - Date.now()) / 1000);
      setErrorMessage(`Too many failed login attempts. Gateway locked for ${secondsLeft} seconds.`);
      return;
    }

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your official administrator email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const loggedUser = await login(email.trim(), password, 'admin');

      if (loggedUser.role !== 'admin') {
        setErrorMessage('Access Denied: This account does not possess administrator privileges.');
        return;
      }

      setFailedAttempts(0);
      setLockoutTime(null);

      showToast({
        type: 'success',
        title: 'Administrator Verified',
        message: 'Security credentials confirmed. Welcome to Rento Operations.',
      });

      navigate(safeRedirect, { replace: true });
    } catch (err: any) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);

      if (newAttempts >= 5) {
        // 60-second rate-limiting lockout
        setLockoutTime(Date.now() + 60 * 1000);
        setErrorMessage('Too many failed authentication attempts. Access locked for 60 seconds.');
      } else {
        setErrorMessage(err?.message || 'Invalid administrator credentials. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        {/* Security Badge */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-brand-400" />
            <span>Restricted Internal Access</span>
          </div>
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-3xl font-black text-white tracking-tight">Rento Operations Portal</h1>
          <p className="text-xs text-slate-400">
            Authorized administrative verification & property audit gateway
          </p>
        </div>

        {/* Login Card */}
        <div className="mt-8 bg-navy-900 border border-navy-750 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Administrator Email"
              type="email"
              placeholder="admin@rento.dev"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={isLoading || (lockoutTime !== null && Date.now() < lockoutTime)}
            />

            <div className="relative">
              <Input
                label="Security Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={isLoading || (lockoutTime !== null && Date.now() < lockoutTime)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[34px] text-slate-400 hover:text-white transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center text-sm py-3"
                isLoading={isLoading}
                disabled={lockoutTime !== null && Date.now() < lockoutTime}
                leftIcon={<Lock className="w-4 h-4" />}
              >
                Authenticate & Access Console
              </Button>
            </div>
          </form>

          {/* Quick-fill helper */}
          <div className="p-3.5 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-xs space-y-2.5">
            <div className="flex items-center justify-between text-brand-300 font-medium">
              <span>Quick-Fill Administrator Credentials</span>
              <span className="text-[10px] text-brand-400/80 uppercase tracking-wider">Click to fill</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@rento.com');
                  setPassword('Admin@Rento2025!');
                  setErrorMessage(null);
                  setLockoutTime(null);
                  setFailedAttempts(0);
                }}
                className="text-left px-3 py-2 rounded-xl bg-navy-800/80 hover:bg-navy-800 border border-navy-700 hover:border-brand-500/50 transition-all group"
              >
                <div className="text-white font-mono text-[11px] group-hover:text-brand-300 font-semibold">
                  admin@rento.com
                </div>
                <div className="text-[10px] text-slate-400 font-mono">Admin@Rento2025!</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('admin@rento.dev');
                  setPassword('admin123');
                  setErrorMessage(null);
                  setLockoutTime(null);
                  setFailedAttempts(0);
                }}
                className="text-left px-3 py-2 rounded-xl bg-navy-800/80 hover:bg-navy-800 border border-navy-700 hover:border-brand-500/50 transition-all group"
              >
                <div className="text-white font-mono text-[11px] group-hover:text-brand-300 font-semibold">
                  admin@rento.dev
                </div>
                <div className="text-[10px] text-slate-400 font-mono">admin123</div>
              </button>
            </div>
          </div>

          {/* Security Notice */}
          <div className="pt-2 text-[11px] text-slate-400 text-center space-y-1">
            <p>All administrative sessions are signed, logged, and monitored for integrity.</p>
          </div>
        </div>

        {/* Back to public site */}
        <div className="text-center mt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Rento Public Website</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
