import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Phone,
  GraduationCap,
  Building2,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  KeyRound,
  RefreshCw,
  Clock,
  Edit3,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { subscriptionService } from '../../services/subscriptionService';
import { UserRole } from '../../types';

interface AuthPageProps {
  initialMode?: 'login' | 'signup';
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login' }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, initiateSignup, verifySignupOtp, resendSignupOtp, intendedDestination, setIntendedDestination } = useAuth();
  const { showToast } = useToast();

  const roleParam = (searchParams.get('role') as UserRole) || 'student';
  const modeParam = searchParams.get('mode') as 'login' | 'signup' | null;
  const redirectParam = searchParams.get('redirect') || intendedDestination || '';

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(modeParam || initialMode);
  const [role, setRole] = useState<UserRole>(roleParam);

  // Signup workflow step: 'form' -> 'otp_verification'
  const [signupStep, setSignupStep] = useState<'form' | 'otp_verification'>('form');

  // Login Form State (Strictly Email/Phone + Password)
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Signup Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [isSubmittingSignup, setIsSubmittingSignup] = useState(false);

  // OTP Verification State (Email Verification only)
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (roleParam) setRole(roleParam);
  }, [roleParam]);

  // Handle countdown timer for Resend OTP
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

  const validateLogin = () => {
    const errs: { [key: string]: string } = {};
    if (!identifier.trim()) {
      errs.identifier = 'Please enter your registered email address or phone number';
    }
    if (!loginPassword) {
      errs.loginPassword = 'Please enter your password';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateSignup = () => {
    const errs: { [key: string]: string } = {};
    if (!firstName.trim()) errs.firstName = 'First name is required';
    if (!lastName.trim()) errs.lastName = 'Last name is required';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!signupEmail.trim() || !emailRegex.test(signupEmail.trim())) {
      errs.signupEmail = 'Please provide a valid email address';
    }

    const cleanPhone = signupPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      errs.signupPhone = 'Please provide a valid 10-digit mobile number';
    }

    if (signupPassword.length < 6) {
      errs.signupPassword = 'Password must be at least 6 characters';
    }
    if (signupPassword !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }
    if (!agreeTerms) {
      errs.agreeTerms = 'You must agree to the Terms of Service & Privacy Policy';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSuccessfulAuth = async (authUser: { id: string; role: UserRole }, isNewSignup: boolean) => {
    // 1. Owner Onboarding Workflow with 30-Day Free Trial:
    if (authUser.role === 'owner') {
      const sub = await subscriptionService.getOwnerSubscription(authUser.id);
      const hasActiveOrTrial =
        sub &&
        (sub.status === 'active' ||
          sub.status === 'trialing' ||
          sub.status === 'trial_eligible' ||
          sub.trial_status === 'eligible' ||
          sub.trial_status === 'active');

      if (redirectParam && redirectParam !== '/owner/plans' && redirectParam !== '/owner/checkout') {
        setIntendedDestination(null);
        navigate(redirectParam);
        return;
      }

      if (isNewSignup) {
        navigate('/owner/plans');
        return;
      } else {
        if (hasActiveOrTrial) {
          navigate('/owner/dashboard');
        } else {
          navigate('/owner/plans');
        }
        return;
      }
    }

    // 2. Non-owner explicit redirect destination
    if (redirectParam) {
      setIntendedDestination(null);
      navigate(redirectParam);
      return;
    }

    if (authUser.role === 'admin') {
      navigate('/admin/listings');
    } else {
      navigate('/student/dashboard');
    }
  };

  // 1. Sign In (Email + Password only)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!validateLogin()) return;

    setIsLoggingIn(true);
    try {
      const user = await login(identifier, loginPassword, role);
      await handleSuccessfulAuth({ id: user.id, role: user.role }, false);
    } catch (err: any) {
      setErrors({ form: err?.message || 'Login failed. Please check your credentials.' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 2. Signup Step 1: Initiate signup & dispatch email verification OTP
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!validateSignup()) return;

    setIsSubmittingSignup(true);
    setOtpError(null);
    try {
      await initiateSignup({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: signupEmail.trim(),
        phone: signupPhone.trim(),
        password: signupPassword,
        role: role === 'owner' ? 'owner' : 'student',
      });
      // Advance to OTP verification step
      setSignupStep('otp_verification');
      setResendCooldown(60);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    } catch (err: any) {
      setErrors({ form: err?.message || 'Failed to initiate signup. Please try again.' });
    } finally {
      setIsSubmittingSignup(false);
    }
  };

  // 3. Signup Step 2: Verify OTP via "Continue" button or auto-trigger on 6th digit
  const executeVerifySignupOtp = async (tokenOverride?: string) => {
    const token = (tokenOverride || otpDigits.join('')).trim();
    if (token.length !== 6) {
      setOtpError('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const verifiedProfile = await verifySignupOtp(
        signupEmail.trim().toLowerCase(),
        token,
        {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: signupPhone.trim(),
          role: role === 'owner' ? 'owner' : 'student',
        }
      );
      await handleSuccessfulAuth({ id: verifiedProfile.id, role: verifiedProfile.role }, true);
    } catch (err: any) {
      setOtpError(
        err?.message || 'Invalid or expired verification code. Please check your email or request a new code.'
      );
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Resend Signup OTP
  const handleResendSignupOtp = async () => {
    if (resendCooldown > 0 || isResendingOtp) return;
    setOtpError(null);
    setIsResendingOtp(true);
    try {
      await resendSignupOtp(signupEmail.trim().toLowerCase());
      setResendCooldown(60);
    } catch (err: any) {
      setOtpError(err?.message || 'Failed to resend verification code. Please try again.');
    } finally {
      setIsResendingOtp(false);
    }
  };

  // 6-digit input keyboard & paste management
  const handleDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    const char = clean.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);
    if (otpError) setOtpError(null);

    if (char && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-verify if all 6 digits are typed
    if (char && index === 5) {
      const fullCode = newDigits.join('');
      if (fullCode.length === 6) {
        executeVerifySignupOtp(fullCode);
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
        executeVerifySignupOtp(token);
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
    if (otpError) setOtpError(null);
    const lastFilledIndex = Math.min(pastedData.length - 1, 5);
    const targetToFocus = lastFilledIndex < 5 ? lastFilledIndex + 1 : 5;
    otpInputRefs.current[targetToFocus]?.focus();
    if (pastedData.length === 6) {
      executeVerifySignupOtp(pastedData);
    }
  };

  const isOwnerFlow = role === 'owner';

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

        {/* Portal Subtitle based on role */}
        <div className="mt-4 text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-md shadow-sm">
            {isOwnerFlow ? (
              <span className="bg-violet-500/10 border-violet-500/30 text-violet-300 inline-flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-violet-400" />
                <span>PG Owner & Property Manager Portal</span>
              </span>
            ) : (
              <span className="bg-brand-500/10 border-brand-500/30 text-brand-300 inline-flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-brand-400" />
                <span>Student Accommodation Portal</span>
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {activeTab === 'login'
              ? 'Sign in with Email & Password'
              : signupStep === 'otp_verification'
              ? 'Verify Your Email Address'
              : 'Create your Rento account'}
          </h2>
          {redirectParam && (
            <p className="text-xs text-brand-400 font-medium">
              Sign in to proceed to your selected accommodation
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-navy-900 border border-navy-750 py-7 px-5 sm:px-10 rounded-3xl shadow-2xl space-y-5">
          {/* TWO TABS: Log In / Create Account */}
          <div className="grid grid-cols-2 p-1 bg-navy-950 rounded-2xl border border-navy-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrors({});
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'login'
                  ? isOwnerFlow
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setErrors({});
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'signup'
                  ? isOwnerFlow
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {errors.form && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors.form}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: LOG IN FORM (Strictly Email & Password)                            */}
          {/* ========================================================================= */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <Input
                label="Email Address or Mobile Number"
                type="text"
                placeholder={isOwnerFlow ? 'owner@rento.dev or 9845012345' : 'student@rento.dev or 9876543210'}
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                error={errors.identifier}
                leftIcon={<User className="w-4 h-4" />}
                required
              />

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-brand-400 hover:text-brand-300 font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  type={showLoginPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  error={errors.loginPassword}
                  leftIcon={<Lock className="w-4 h-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="p-1 text-slate-400 hover:text-white"
                      aria-label="Toggle password visibility"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  required
                />
              </div>

              <Button
                type="submit"
                variant={isOwnerFlow ? 'primary' : 'glow'}
                size="lg"
                className="w-full font-bold mt-2"
                isLoading={isLoggingIn}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {isOwnerFlow ? 'Access Owner Dashboard' : 'Sign In as Student'}
              </Button>

              <div className="pt-2 text-center">
                <Link
                  to="/admin/login"
                  className="text-[11px] text-slate-500 hover:text-brand-400 transition-colors inline-flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
                  <span>Authorized staff or operations? Go to Admin Gateway</span>
                </Link>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: SIGNUP WORKFLOW                                                    */}
          {/* ========================================================================= */}
          {activeTab === 'signup' && (
            <>
              {/* STEP 1: FILL IN ALL DETAILS */}
              {signupStep === 'form' ? (
                <form onSubmit={handleSignupSubmit} className="space-y-3.5">
                  {/* Role Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Account Type
                    </label>
                    <div className="grid grid-cols-2 p-1 bg-navy-950 rounded-xl border border-navy-800 text-xs">
                      <button
                        type="button"
                        onClick={() => setRole('student')}
                        className={`py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                          role === 'student'
                            ? 'bg-brand-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>Student</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('owner')}
                        className={`py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                          role === 'owner'
                            ? 'bg-violet-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>PG Owner</span>
                      </button>
                    </div>
                  </div>

                  {/* Name Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="First Name"
                      placeholder="e.g. Sahana"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      error={errors.firstName}
                      required
                    />
                    <Input
                      label="Last Name"
                      placeholder="e.g. Ramesh"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      error={errors.lastName}
                      required
                    />
                  </div>

                  {/* Email Field */}
                  <Input
                    label="Email Address (OTP will be sent here)"
                    type="email"
                    placeholder="you@example.com"
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    error={errors.signupEmail}
                    leftIcon={<Mail className="w-4 h-4" />}
                    required
                  />

                  {/* Phone Field */}
                  <Input
                    label="Phone Number (10 Digits)"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={signupPhone}
                    onChange={e => setSignupPhone(e.target.value)}
                    error={errors.signupPhone}
                    leftIcon={<Phone className="w-4 h-4" />}
                    required
                  />

                  {/* Password & Confirm */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Input
                        label="Password"
                        type={showSignupPassword ? 'text' : 'password'}
                        placeholder="Min 6 chars"
                        value={signupPassword}
                        onChange={e => setSignupPassword(e.target.value)}
                        error={errors.signupPassword}
                        leftIcon={<Lock className="w-4 h-4" />}
                        required
                      />
                    </div>
                    <div>
                      <Input
                        label="Confirm Password"
                        type={showSignupPassword ? 'text' : 'password'}
                        placeholder="Repeat password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        error={errors.confirmPassword}
                        leftIcon={<Lock className="w-4 h-4" />}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showSignupPassword}
                        onChange={e => setShowSignupPassword(e.target.checked)}
                        className="rounded border-navy-700 bg-navy-950 text-brand-600"
                      />
                      <span>Show password characters</span>
                    </label>
                  </div>

                  {/* Terms agreement */}
                  <div>
                    <label className="flex items-start gap-2.5 text-xs text-slate-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={e => setAgreeTerms(e.target.checked)}
                        className="mt-0.5 rounded border-navy-700 bg-navy-950 text-brand-600"
                      />
                      <span>
                        I agree to Rento's Terms of Service and Privacy Notice.
                      </span>
                    </label>
                    {errors.agreeTerms && (
                      <p className="text-xs text-red-400 mt-1">{errors.agreeTerms}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    variant={isOwnerFlow ? 'primary' : 'glow'}
                    size="lg"
                    className="w-full font-bold mt-2"
                    isLoading={isSubmittingSignup}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    {isSubmittingSignup ? 'Sending Verification Code...' : 'Continue to Email Verification'}
                  </Button>
                </form>
              ) : (
                /* STEP 2: ENTER OTP & CLICK CONTINUE */
                <div className="space-y-4">
                  <div className="text-center space-y-1 pb-1">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-2 shadow-sm">
                      <KeyRound className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Verify Your Email</h3>
                    <p className="text-xs text-slate-400">
                      Enter the 6-digit verification code sent to:
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-950 border border-navy-800 text-xs font-semibold text-brand-300">
                      <Mail className="w-3.5 h-3.5 text-brand-400" />
                      <span>{signupEmail}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSignupStep('form');
                          setOtpError(null);
                        }}
                        className="text-[11px] text-slate-400 hover:text-white underline ml-1.5 flex items-center gap-1 font-normal"
                        title="Edit email address or signup details"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>

                  {otpError && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{otpError}</span>
                    </div>
                  )}

                  {/* 6-DIGIT SEGMENTED INPUT BOXES */}
                  <div>
                    <label className="block text-center text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Enter 6-Digit Code
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
                                ? isOwnerFlow
                                  ? 'border-violet-500 ring-2 ring-violet-500/20'
                                  : 'border-brand-500 ring-2 ring-brand-500/20'
                                : 'border-navy-750 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
                            }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* MANDATORY CONTINUE BUTTON */}
                  <Button
                    type="button"
                    onClick={() => executeVerifySignupOtp()}
                    variant={isOwnerFlow ? 'primary' : 'glow'}
                    size="lg"
                    className="w-full font-bold mt-2"
                    isLoading={isVerifyingOtp}
                    disabled={otpDigits.join('').length !== 6 || isVerifyingOtp}
                    rightIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    {isVerifyingOtp ? 'Verifying Code...' : 'Continue'}
                  </Button>

                  {/* RESEND COOLDOWN TIMER & ACTIONS */}
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
                        onClick={handleResendSignupOtp}
                        disabled={isResendingOtp}
                        className="text-xs text-brand-400 hover:text-brand-300 font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isResendingOtp ? 'animate-spin' : ''}`} />
                        <span>{isResendingOtp ? 'Resending...' : 'Resend Verification Code'}</span>
                      </button>
                    )}

                    <div className="flex items-center gap-4 text-xs pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSignupStep('form');
                          setOtpError(null);
                        }}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        Back to Details
                      </button>
                      <span className="text-slate-700">•</span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('login');
                          setErrors({});
                        }}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        Already verified? Log In
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="text-center pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Rento Home</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
