import React from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  BedDouble,
  Inbox,
  Users,
  Wrench,
  BarChart3,
  CreditCard,
  Settings,
  Plus,
  ShieldAlert,
  ExternalLink,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { Navbar } from '../components/layout/Navbar';
import { Button } from '../components/ui/Button';

export const OwnerLayout: React.FC = () => {
  const { user, isAuthenticated, setIntendedDestination } = useAuth();
  const {
    currentPlan,
    hasActiveSubscription,
    canAddListing,
    listingCount,
    listingLimit,
    remainingCapacity,
    trialInfo,
    isTrialActive,
    isTrialEligible,
    isTrialExpired,
  } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();

  const ownerNavItems = [
    { name: 'Overview', path: '/owner/dashboard', icon: LayoutDashboard },
    { name: 'My Properties', path: '/owner/listings', icon: Building2 },
    { name: 'Rooms & Beds', path: '/owner/rooms', icon: BedDouble },
    { name: 'Enquiries', path: '/owner/enquiries', icon: Inbox },
    { name: 'Tenants & Rent', path: '/owner/tenants', icon: Users, isPlaceholder: true },
    { name: 'Maintenance', path: '/owner/maintenance', icon: Wrench, isPlaceholder: true },
    { name: 'Analytics', path: '/owner/analytics', icon: BarChart3, isPlaceholder: true },
    { name: 'Subscription', path: '/owner/subscription', icon: CreditCard },
    { name: 'Settings', path: '/owner/settings', icon: Settings },
  ];

  if (!isAuthenticated || user?.role !== 'owner') {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-navy-900 border border-navy-750 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mx-auto">
              <Building2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white">PG Owner Portal</h2>
            <p className="text-sm text-slate-400">
              Access property listings, manage beds, review student enquiry inbox, and track occupancy.
            </p>
            <div className="space-y-3 pt-2">
              <Button
                variant="glow"
                className="w-full"
                onClick={() => {
                  setIntendedDestination(location.pathname);
                  navigate('/login?role=owner');
                }}
              >
                Sign In as PG Owner
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setIntendedDestination(location.pathname);
                  navigate('/signup?role=owner');
                }}
              >
                Register as New PG Owner
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col">
      <Navbar />

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1">
        {/* Mobile Horizontal Navigation Tabs */}
        <nav className="lg:hidden flex overflow-x-auto gap-1.5 p-1.5 bg-navy-900 border border-navy-800 rounded-2xl mb-6 scrollbar-none text-xs font-semibold">
          {ownerNavItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-navy-800'
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.name}</span>
                {item.isPlaceholder && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-slate-300">
                    SaaS
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Desktop Owner Sidebar Navigation */}
          <aside className="hidden lg:block lg:col-span-3 bg-navy-900/90 border border-navy-800 rounded-2xl p-5 sticky top-28 shadow-xl">
            {/* Owner Business Header */}
            <div className="pb-5 mb-5 border-b border-navy-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                  PG Manager SaaS
                </span>
                <h3 className="font-bold text-white text-base mt-1.5 truncate">Sunrise Hospitality</h3>
                <p className="text-xs text-slate-400">{user.full_name}</p>
              </div>
              {canAddListing ? (
                <Link to="/owner/listings/new">
                  <button
                    className="p-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-500/20 transition-all"
                    title="Create New Listing"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </Link>
              ) : (
                <Link to="/owner/subscription">
                  <button
                    className="p-2 rounded-xl bg-navy-800 text-slate-500 hover:text-white transition-all"
                    title="Listing limit reached. Click to upgrade"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </Link>
              )}
            </div>

            {/* Navigation links */}
            <nav className="space-y-1">
              {ownerNavItems.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-violet-600/20 text-violet-300 font-semibold border border-violet-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-navy-800/80'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                      <span>{item.name}</span>
                    </div>
                    {item.isPlaceholder && (
                      <span className="text-[10px] uppercase font-medium px-1.5 py-0.5 rounded bg-navy-800 text-slate-400">
                        SaaS
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* Quick Action Box */}
            <div className="mt-6 pt-5 border-t border-navy-800 space-y-2">
              {canAddListing ? (
                <Link to="/owner/listings/new" className="block w-full">
                  <Button variant="primary" size="sm" className="w-full text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    List New Property
                  </Button>
                </Link>
              ) : (
                <Link to="/owner/subscription" className="block w-full">
                  <Button variant="outline" size="sm" className="w-full text-xs text-amber-300 border-amber-500/30 hover:bg-amber-500/10">
                    <TrendingUp className="w-3.5 h-3.5 mr-1" />
                    Upgrade Plan (Limit Reached)
                  </Button>
                </Link>
              )}
              <div className="p-3 rounded-xl bg-navy-950/80 border border-navy-800 text-[11px] text-slate-400">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-300">
                    {isTrialActive
                      ? '30-Day Free Trial'
                      : isTrialEligible
                      ? '30-Day Free Trial'
                      : isTrialExpired
                      ? 'Free Basic Plan'
                      : `Plan: ${currentPlan ? currentPlan.name : 'No Active Plan'}`}
                  </p>
                  {isTrialActive ? (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                        trialInfo.reminderStage === '1_day'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse'
                          : trialInfo.reminderStage === '3_days'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                      }`}
                    >
                      {trialInfo.daysRemaining}d left
                    </span>
                  ) : isTrialEligible ? (
                    <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">
                      Eligible
                    </span>
                  ) : isTrialExpired ? (
                    <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                      Expired
                    </span>
                  ) : hasActiveSubscription ? (
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                      Active
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-slate-400">
                  {listingCount} of {listingLimit === Infinity ? 'Unlimited' : `${listingLimit} PGs`} used
                  {listingLimit !== Infinity && remainingCapacity > 0 ? ` (${remainingCapacity} left)` : ''}
                </p>
              </div>
            </div>
          </aside>

          {/* Owner Main View */}
          <main className="lg:col-span-9 min-h-[500px] w-full min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
