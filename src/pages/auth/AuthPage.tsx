import React, { useState, useEffect } from 'react';
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
  ArrowLeft
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
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
  const { login, signup, intendedDestination, setIntendedDestination } = useAuth();
  const { showToast } = useToast();

  const roleParam = (searchParams.get('role') as UserRole) || 'student';
  const modeParam = searchParams.get('mode') as 'login' | 'signup' | null;
  const redirectParam = searchParams.get('redirect') || intendedDestination || '';

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(modeParam || initialMode);
  const [role, setRole] = useState<UserRole>(roleParam);

  // Form Fields
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
    // 1. Mandatory Owner Onboarding Workflow:
    // Landing Page → Register a PG → Owner Login/Signup → Choose Subscription Plan → Checkout → Demo Payment → Property Registration → Owner Dashboard.
    if (authUser.role === 'owner') {
      if (isNewSignup) {
        navigate('/owner/plans');
        return;
      } else {
        // Existing owner login must check the stored demo subscription status
        const sub = await subscriptionService.getOwnerSubscription(authUser.id);
        const hasActive = sub && sub.status === 'active';

        if (hasActive) {
          if (redirectParam && redirectParam !== '/owner/plans' && redirectParam !== '/owner/checkout') {
            setIntendedDestination(null);
            navigate(redirectParam);
          } else {
            navigate('/owner/dashboard');
          }
        } else {
          // If no active plan, direct to mandatory subscription plan selection
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

        {/* Portal Subtitle based on locked role */}
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
            {activeTab === 'login' ? 'Sign in to your account' : 'Create your account'}
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
