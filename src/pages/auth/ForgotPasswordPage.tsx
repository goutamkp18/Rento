import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  RefreshCw,
  Clock,
  Edit3,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { authService } from '../../services/authService';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

type ResetStep = 'email' | 'otp' | 'new_password' | 'success';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [resendCooldown, setResendCooldown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-detect if user came from a recovery link or recovery session
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      // 1. Check existing session with recovery
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user && (window.location.hash.includes('type=recovery') || window.location.href.includes('recovery'))) {
          setStep('new_password');
        }
      });

      // 2. Listen to PASSWORD_RECOVERY event
      const { data: listener } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setStep('new_password');
        }
      });

      return () => {
        listener.subscription.unsubscribe();
      };
    }
  }, []);

  // Cooldown timer for Resend OTP
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendCooldown]);

  // Step 1: Submit Email and verify existence in DB
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError('Please provide a valid registered email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await authService.requestPasswordResetOtp(cleanEmail);
      showToast({
        type: 'success',
        title: 'Recovery Code Dispatched',
        message: res.message,
      });
      setStep('otp');
      setResendCooldown(60);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch password recovery code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (tokenOverride?: string) => {
    const token = (tokenOverride || otpDigits.join('')).trim();
    if (token.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authService.verifyPasswordResetOtp(email.trim().toLowerCase(), token);
      showToast({
        type: 'success',
        title: 'Code Verified',
        message: 'Please set your new password.',
      });
      setStep('new_password');
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired verification code. Please request a new code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setError(null);
    setIsLoading(true);

    try {
      const res = await authService.requestPasswordResetOtp(email.trim().toLowerCase());
      setResendCooldown(60);
      showToast({
        type: 'success',
        title: 'New Code Dispatched',
        message: res.message,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to resend recovery code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 6-digit input keyboard & paste management
  const handleDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    const char = clean.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);
    if (error) setError(null);

    if (char && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-verify if all 6 digits are typed
    if (char && index === 5) {
      const fullCode = newDigits.join('');
      if (fullCode.length === 6) {
        handleVerifyOtp(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        otpInputRefs.current[index - 1]?.focus();
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
      } else {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      const token = otpDigits.join('');
      if (token.length === 6) {
        handleVerifyOtp(token);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pastedData[i] || '';
    }
    setOtpDigits(newDigits);
    if (error) setError(null);
    const lastFilledIndex = Math.min(pastedData.length - 1, 5);
    const targetToFocus = lastFilledIndex < 5 ? lastFilledIndex + 1 : 5;
    otpInputRefs.current[targetToFocus]?.focus();
    if (pastedData.length === 6) {
      handleVerifyOtp(pastedData);
    }
  };

  // Step 3: Set and Confirm New Password (user fills 2 times)
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please enter the same password in both fields.');
      return;
    }

    setIsLoading(true);

    try {
      await authService.completePasswordReset(newPassword);
      showToast({
        type: 'success',
        title: 'Password Updated!',
        message: 'Your new password has been saved. Please sign in.',
      });
      setStep('success');
    } catch (err: any) {
      setError(err?.message || 'Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-x-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Header */}
        <Link to="/" className="flex items-center justify-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/25 group-hover:scale-105 transition-all">
            <span className="text-white font-extrabold text-xl">R</span>
          </div>
          <span className="text-2xl font-black text-white group-hover:text-brand-300 transition-colors">
            Rento
          </span>
        </Link>

        <h2 className="mt-5 text-center text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {step === 'email' && 'Reset your password'}
          {step === 'otp' && 'Verify Your Email'}
          {step === 'new_password' && 'Set New Password'}
          {step === 'success' && 'Password Reset Complete'}
        </h2>

        <p className="mt-2 text-center text-xs sm:text-sm text-slate-400">
          {step === 'email' && 'Enter your registered email address to receive a 6-digit recovery OTP.'}
          {step === 'otp' && 'Enter the 6-digit verification code sent to your email.'}
          {step === 'new_password' && 'Enter and confirm your new password below.'}
          {step === 'success' && 'Your password has been successfully updated.'}
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-navy-900 border border-navy-750 py-8 px-6 sm:px-10 rounded-3xl shadow-2xl space-y-6">

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 1: ENTER REGISTERED EMAIL                                           */}
          {/* ========================================================================= */}
          {step === 'email' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <Input
                label="Registered Email Address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                leftIcon={<Mail className="w-4 h-4" />}
                required
                autoFocus
              />

              <Button
                type="submit"
                variant="glow"
                size="lg"
                className="w-full font-bold"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {isLoading ? 'Verifying Account...' : 'Send Recovery OTP'}
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/auth?mode=login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: ENTER 6-DIGIT RECOVERY OTP                                       */}
          {/* ========================================================================= */}
          {step === 'otp' && (
            <div className="space-y-4">
              <div className="text-center space-y-1 pb-1">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-2 shadow-sm">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Enter 6-Digit Code</h3>
                <p className="text-xs text-slate-400">
                  We've sent a recovery code to:
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-950 border border-navy-800 text-xs font-semibold text-brand-300">
                  <Mail className="w-3.5 h-3.5 text-brand-400" />
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setError(null);
                    }}
                    className="text-[11px] text-slate-400 hover:text-white underline ml-1.5 flex items-center gap-1 font-normal"
                    title="Change email"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>

              {/* 6-DIGIT SEGMENTED INPUT BOXES */}
              <div>
                <label className="block text-center text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Verification Code
                </label>
                <div className="flex items-center justify-center gap-2 sm:gap-2.5 my-2">
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={el => {
                        otpInputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleDigitChange(index, e.target.value)}
                      onKeyDown={e => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      aria-label={`Digit ${index + 1} of 6`}
                      className={`w-11 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-black rounded-xl
                        bg-navy-950 border text-white tracking-wider outline-none transition-all shadow-inner
                        ${
                          digit
                            ? 'border-brand-500 ring-2 ring-brand-500/20'
                            : 'border-navy-750 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
                        }`}
                    />
                  ))}
                </div>
              </div>

              {/* CONTINUE BUTTON */}
              <Button
                type="button"
                onClick={() => handleVerifyOtp()}
                variant="glow"
                size="lg"
                className="w-full font-bold mt-2"
                isLoading={isLoading}
                disabled={otpDigits.join('').length !== 6 || isLoading}
                rightIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                {isLoading ? 'Verifying Code...' : 'Continue'}
              </Button>

              {/* RESEND TIMER & ACTIONS */}
              <div className="flex flex-col items-center gap-2 pt-1 text-center">
                {resendCooldown > 0 ? (
                  <span className="text-xs text-slate-400 flex items-center gap-1.5 select-none">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      Resend code in <strong className="text-slate-300 font-mono">{resendCooldown}s</strong>
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isLoading}
                    className="text-xs text-brand-400 hover:text-brand-300 font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Resend Recovery Code</span>
                  </button>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setError(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Back to Email Step
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: SET NEW PASSWORD & CONFIRM (Filled 2 times)                      */}
          {/* ========================================================================= */}
          {step === 'new_password' && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="text-center space-y-1 pb-1">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-2 shadow-sm">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Create New Password</h3>
                <p className="text-xs text-slate-400">
                  Choose a secure password with at least 6 characters.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password (min 6 chars)"
                  value={newPassword}
                  onChange={e => {
                    setNewPassword(e.target.value);
                    setError(null);
                  }}
                  leftIcon={<Lock className="w-4 h-4" />}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Confirm New Password
                </label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    setError(null);
                  }}
                  leftIcon={<Lock className="w-4 h-4" />}
                  required
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={e => setShowPassword(e.target.checked)}
                    className="rounded border-navy-700 bg-navy-950 text-brand-600"
                  />
                  <span>Show password characters</span>
                </label>
              </div>

              <Button
                type="submit"
                variant="glow"
                size="lg"
                className="w-full font-bold mt-2"
                isLoading={isLoading}
                rightIcon={<ShieldCheck className="w-4 h-4" />}
              >
                {isLoading ? 'Updating Password...' : 'Update Password'}
              </Button>
            </form>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: SUCCESS CONFIRMATION                                             */}
          {/* ========================================================================= */}
          {step === 'success' && (
            <div className="text-center space-y-4 py-2">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="text-xl font-extrabold text-white">Password Updated!</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Your password has been successfully updated in the database. You can now sign in using your email and your new password.
              </p>
              <div className="pt-3">
                <Button
                  type="button"
                  onClick={() => navigate('/auth?mode=login')}
                  variant="glow"
                  size="lg"
                  className="w-full font-bold"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Sign In with New Password
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
