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
  const { login, signup, sendEmailOtp, verifyEmailOtp, intendedDestination, setIntendedDestination } = useAuth();
  const { showToast } = useToast();

  const roleParam = (searchParams.get('role') as UserRole) || 'student';
  const modeParam = searchParams.get('mode') as 'login' | 'signup' | null;
  const redirectParam = searchParams.get('redirect') || intendedDestination || '';

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(modeParam || initialMode);
  const [role, setRole] = useState<UserRole>(roleParam);

  // Authentication mode: traditional password vs passwordless OTP
  const [authMethod, setAuthMethod] = useState<'password' | 'otp'>('password');
  const [otpStep, setOtpStep] = useState<'email' | 'verify'>('email');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Password Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [identifier, setIdentifier] = useState(''); // Email or phone
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
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
    if (!password) {
      errs.password = 'Please enter your password';
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

    if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }
    if (password !== confirmPassword) {
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

  const executeLogin = async () => {
    setIsLoading(true);
    try {
      const user = await login(identifier, password, role);
      await handleSuccessfulAuth({ id: user.id, role: user.role }, false);
    } catch (err: any) {
      setErrors({ form: err?.message || 'Login failed. Please check credentials.' });
    } finally {
      setIsLoading(false);
    }
  };

  const executeSignup = async () => {
    setIsLoading(true);
    try {
      const user = await signup({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: signupEmail.trim(),
        phone: signupPhone.trim(),
        password,
        role: role === 'owner' ? 'owner' : 'student',
      });
      await handleSuccessfulAuth({ id: user.id, role: user.role }, true);
    } catch (err: any) {
      setErrors({ form: err?.message || 'Account registration failed.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!validateLogin()) return;
    executeLogin();
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!validateSignup()) return;
    executeSignup();
  };

  // Switch to OTP mode, pre-populating email if already typed
  const handleSwitchToOtp = () => {
    const candidateEmail = identifier.includes('@')
      ? identifier.trim()
      : signupEmail.includes('@')
      ? signupEmail.trim()
      : '';
    if (candidateEmail && !otpEmail) {
      setOtpEmail(candidateEmail);
    }
    setAuthMethod('otp');
    setOtpStep('email');
    setErrors({});
    setOtpError(null);
  };

  // Send Email OTP Code
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setOtpError(null);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = otpEmail.trim().toLowerCase();

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setOtpError('Please enter a valid email address.');
      return;
    }

    setIsSendingOtp(true);
    try {
      await sendEmailOtp(cleanEmail);
      setOtpStep('verify');
      setResendCooldown(60);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    } catch (err: any) {
      setOtpError(err?.message || 'Failed to dispatch verification code. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Resend OTP Code
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isSendingOtp) return;
    setOtpError(null);
    setIsSendingOtp(true);
    try {
      await sendEmailOtp(otpEmail.trim().toLowerCase());
      setResendCooldown(60);
    } catch (err: any) {
      setOtpError(err?.message || 'Failed to resend verification code. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Verify 6-digit OTP Code
  const executeVerifyOtp = async (tokenOverride?: string) => {
    const token = (tokenOverride || otpDigits.join('')).trim();
    if (token.length !== 6) {
      setOtpError('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const verifiedProfile = await verifyEmailOtp(otpEmail.trim().toLowerCase(), token, role);
      const isNewUser = (verifiedProfile as any).isNewUser ?? false;
      await handleSuccessfulAuth({ id: verifiedProfile.id, role: verifiedProfile.role }, isNewUser);
    } catch (err: any) {
      setOtpError(
        err?.message || 'Invalid or expired verification code. Please check your email or request a new code.'
      );
    } finally {
      setIsVerifyingOtp(false);
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
        executeVerifyOtp(token);
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
      executeVerifyOtp(pastedData);
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
            {authMethod === 'otp'
              ? otpStep === 'email'
                ? 'Sign in with Email OTP'
                : 'Verify Verification Code'
              : activeTab === 'login'
              ? 'Sign in to your account'
              : 'Create your account'}
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
          
          {/* ========================================================================= */}
          {/* PASSWORD AUTHENTICATION FLOW                                              */}
          {/* ========================================================================= */}
          {authMethod === 'password' && (
            <>
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

              {/* TAB 1: LOG IN FORM */}
              {activeTab === 'login' ? (
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
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      error={errors.password}
                      leftIcon={<Lock className="w-4 h-4" />}
                      rightIcon={
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1 text-slate-400 hover:text-white"
                          aria-label="Toggle password visibility"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                    isLoading={isLoading}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    {isOwnerFlow ? 'Access Owner Dashboard' : 'Sign In as Student'}
                  </Button>
                </form>
              ) : (
                /* TAB 2: CREATE ACCOUNT FORM */
                <form onSubmit={handleSignupSubmit} className="space-y-3.5">
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

                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="you@example.com"
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    error={errors.signupEmail}
                    leftIcon={<Mail className="w-4 h-4" />}
                    required
                  />

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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Input
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min 6 chars"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        error={errors.password}
                        leftIcon={<Lock className="w-4 h-4" />}
                        required
                      />
                    </div>
                    <div>
                      <Input
                        label="Confirm Password"
                        type={showPassword ? 'text' : 'password'}
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
                        checked={showPassword}
                        onChange={e => setShowPassword(e.target.checked)}
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
                    isLoading={isLoading}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    {isOwnerFlow ? 'Register & Onboard PG' : 'Create Student Account'}
                  </Button>
                </form>
              )}

              {/* DIVIDER */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-navy-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-navy-900 px-3 text-slate-500 font-medium">Or continue with</span>
                </div>
              </div>

              {/* CLEARLY VISIBLE "CONTINUE WITH EMAIL OTP" BUTTON */}
              <button
                type="button"
                onClick={handleSwitchToOtp}
                className="w-full py-2.5 px-4 rounded-xl border border-navy-750 bg-navy-950/70 hover:bg-navy-800/80 hover:border-brand-500/50 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2.5 shadow-sm group"
              >
                <div className="w-6 h-6 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <span>Continue with Email OTP</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-brand-500/20 text-brand-300 font-semibold uppercase tracking-wider">
                  Passwordless
                </span>
              </button>

              {activeTab === 'login' && (
                <div className="pt-2 text-center">
                  <Link
                    to="/admin/login"
                    className="text-[11px] text-slate-500 hover:text-brand-400 transition-colors inline-flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
                    <span>Authorized staff or operations? Go to Admin Gateway</span>
                  </Link>
                </div>
              )}
            </>
          )}

          {/* ========================================================================= */}
          {/* EMAIL OTP AUTHENTICATION FLOW                                             */}
          {/* ========================================================================= */}
          {authMethod === 'otp' && (
            <div className="space-y-4">
              {/* STEP 1: COLLECT EMAIL ADDRESS */}
              {otpStep === 'email' ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  {/* Account Type Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Select Account Portal
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

                  {/* Email Input */}
                  <Input
                    label="Email Address"
                    type="email"
                    placeholder={isOwnerFlow ? 'owner@rento.dev' : 'student@rento.dev'}
                    value={otpEmail}
                    onChange={e => {
                      setOtpEmail(e.target.value);
                      if (otpError) setOtpError(null);
                    }}
                    error={otpError && !otpError.includes('SMTP') && !otpError.includes('Brevo') && !otpError.includes('confirmation email') ? otpError : undefined}
                    leftIcon={<Mail className="w-4 h-4" />}
                    autoFocus
                    required
                  />

                  {otpError && (otpError.includes('SMTP') || otpError.includes('Brevo') || otpError.includes('confirmation email')) && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2.5">
                      <div className="flex items-start gap-2 text-amber-300 font-bold text-sm">
                        <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                        <span>Supabase SMTP Delivery Notice</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-xs">
                        Supabase rejected the outgoing email with <strong className="text-red-400 font-mono">Error sending confirmation email</strong>.
                      </p>
                      <div className="space-y-1.5 text-[11px] text-slate-300 pt-1 border-t border-amber-500/20">
                        <p className="font-semibold text-white">How to resolve this in Supabase &amp; Brevo:</p>
                        <ul className="space-y-1.5 list-disc pl-4 text-slate-300">
                          <li><strong>Sender Email Mismatch:</strong> In Supabase <em>Settings → Authentication → SMTP Settings</em>, the <strong>"Sender email"</strong> must exactly match a verified sender address in Brevo (<em>app.brevo.com/senders</em>).</li>
                          <li><strong>SMTP Key:</strong> In Brevo, go to <em>SMTP &amp; API → SMTP tab</em> and click <strong>"Generate a new SMTP key"</strong>. Use that key as the Supabase SMTP Password (do not use your account login password or v3 API key).</li>
                          <li><strong>Host &amp; Port:</strong> Host should be <code className="bg-navy-950 px-1 py-0.5 rounded text-brand-300 font-mono">smtp-relay.brevo.com</code> and Port <code className="bg-navy-950 px-1 py-0.5 rounded text-brand-300 font-mono">587</code>.</li>
                          <li><strong>Email Template:</strong> In Supabase <em>Authentication → Email Templates → Magic Link</em>, ensure <code className="bg-navy-950 px-1 py-0.5 rounded text-brand-300 font-mono">&#123;&#123; .Token &#125;&#125;</code> is present.</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-navy-950/60 border border-navy-800 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                    <span>
                      A 6-digit one-time code will be dispatched to your email via Brevo SMTP. Supabase Auth will securely verify your account without a password.
                    </span>
                  </div>

                  <Button
                    type="submit"
                    variant={isOwnerFlow ? 'primary' : 'glow'}
                    size="lg"
                    className="w-full font-bold"
                    isLoading={isSendingOtp}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    {isSendingOtp ? 'Sending OTP Code...' : 'Send OTP Code'}
                  </Button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMethod('password');
                        setOtpError(null);
                      }}
                      className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5 font-medium"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Return to Password Sign In</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* STEP 2: SIX-DIGIT OTP VERIFICATION */
                <div className="space-y-4">
                  <div className="text-center space-y-1 pb-1">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-2">
                      <KeyRound className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Enter Verification Code</h3>
                    <p className="text-xs text-slate-400">
                      Enter the 6-digit verification code sent to:
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-navy-950 border border-navy-800 text-xs font-semibold text-brand-300">
                      <span>{otpEmail}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpStep('email');
                          setOtpError(null);
                        }}
                        className="text-[10px] text-slate-400 hover:text-white underline ml-1"
                      >
                        Change
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
                                ? isOwnerFlow
                                  ? 'border-violet-500 ring-2 ring-violet-500/20'
                                  : 'border-brand-500 ring-2 ring-brand-500/20'
                                : 'border-navy-750 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
                            }`}
                        />
                      ))}
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => executeVerifyOtp()}
                    variant={isOwnerFlow ? 'primary' : 'glow'}
                    size="lg"
                    className="w-full font-bold"
                    isLoading={isVerifyingOtp}
                    disabled={otpDigits.join('').length !== 6 || isVerifyingOtp}
                    rightIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    {isVerifyingOtp ? 'Verifying Code...' : 'Verify & Continue'}
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
                        onClick={handleResendOtp}
                        disabled={isSendingOtp}
                        className="text-xs text-brand-400 hover:text-brand-300 font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSendingOtp ? 'animate-spin' : ''}`} />
                        <span>{isSendingOtp ? 'Resending...' : 'Resend Verification Code'}</span>
                      </button>
                    )}

                    <div className="flex items-center gap-4 text-xs pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setOtpStep('email');
                          setOtpError(null);
                        }}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        Change Email
                      </button>
                      <span className="text-slate-700">•</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMethod('password');
                          setOtpError(null);
                        }}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        Return to Password Login
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
