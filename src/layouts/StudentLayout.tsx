import React from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Compass,
  Scale,
  Heart,
  MessageSquare,
  User,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFavourites } from '../context/FavouritesContext';
import { useCompare } from '../context/CompareContext';
import { Navbar } from '../components/layout/Navbar';
import { Button } from '../components/ui/Button';

export const StudentLayout: React.FC = () => {
  const { user, isAuthenticated, logout, setIntendedDestination } = useAuth();
  const { favouriteCount } = useFavourites();
  const { compareCount } = useCompare();
  const navigate = useNavigate();
  const location = useLocation();

  const studentNavItems = [
    { name: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
    { name: 'Explore PGs', path: '/pgs', icon: Compass },
    { name: 'Compare', path: '/student/compare', icon: Scale, badge: compareCount },
    { name: 'Favourites', path: '/student/favourites', icon: Heart, badge: favouriteCount },
    { name: 'My Enquiries', path: '/student/enquiries', icon: MessageSquare },
    { name: 'Profile', path: '/student/profile', icon: User },
  ];

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-navy-900 border border-navy-750 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto">
              <User className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Student Portal Access</h2>
            <p className="text-sm text-slate-400">
              Please sign in with your registered student account to access your saved properties, comparison board, and enquiry history.
            </p>
            <div className="space-y-3 pt-2">
              <Button
                variant="glow"
                className="w-full"
                onClick={() => {
                  setIntendedDestination(location.pathname);
                  navigate('/login?role=student');
                }}
              >
                Sign In to Student Account
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setIntendedDestination(location.pathname);
                  navigate('/signup?role=student');
                }}
              >
                Create New Student Account
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
          {studentNavItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-navy-800'
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.name}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-bold">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Desktop Student Sidebar */}
          <aside className="hidden lg:block lg:col-span-3 bg-navy-900/90 border border-navy-800 rounded-2xl p-5 sticky top-28 shadow-xl">
            {/* Student Profile Card */}
            <div className="flex items-center gap-3 pb-5 mb-5 border-b border-navy-800">
              <img
                src={user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                alt={user.full_name}
                className="w-12 h-12 rounded-xl object-cover border border-brand-500/40"
              />
              <div className="overflow-hidden">
                <h3 className="font-bold text-white text-sm truncate">{user.full_name}</h3>
                <p className="text-xs text-brand-400 font-medium">Student Account</p>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{user.college || 'RVCE Bangalore'}</p>
              </div>
            </div>

            {/* Navigation links */}
            <nav className="space-y-1.5">
              {studentNavItems.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-brand-600/20 text-brand-300 font-semibold border border-brand-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-navy-800/80'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                      <span>{item.name}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* Helpful Box */}
            <div className="mt-8 p-4 rounded-xl bg-navy-850 border border-navy-800 text-xs text-slate-400 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Rento Student Guarantee</span>
              </div>
              <p>Zero brokerage fee. All listed PGs undergo on-site physical verification before listing approval.</p>
            </div>
          </aside>

          {/* Student Content Area */}
          <main className="lg:col-span-9 min-h-[500px] w-full min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
