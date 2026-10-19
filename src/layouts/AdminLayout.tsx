import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Building2,
  Users,
  LayoutDashboard,
  LogOut,
  ExternalLink,
  Lock,
  ChevronRight,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { ThemeToggle } from '../components/ui/ThemeToggle';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  const navLinks = [
    {
      to: '/admin/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      active: location.pathname === '/admin/dashboard',
    },
    {
      to: '/admin/listings',
      label: 'Review Queue',
      icon: Building2,
      active: location.pathname.startsWith('/admin/listings'),
    },
    {
      to: '/admin/payments',
      label: 'Payments & Verification',
      icon: CreditCard,
      active: location.pathname === '/admin/payments',
    },
    {
      to: '/admin/users',
      label: 'User & Role Audit',
      icon: Users,
      active: location.pathname === '/admin/users',
    },
  ];

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col text-slate-100">
      {/* Top Admin Security Navbar */}
      <header className="sticky top-0 z-40 bg-navy-900/90 backdrop-blur-md border-b border-brand-500/20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between">
          
          {/* Left: Brand & Admin Tag */}
          <div className="flex items-center gap-6">
            <Link to="/admin/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-white text-base tracking-tight leading-none group-hover:text-brand-300 transition-colors">
                  RENTO
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                  Operations Console
                </span>
              </div>
            </Link>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(link => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      link.active
                        ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-navy-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Security info & logout */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-navy-950/80 border border-navy-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400 font-mono text-[11px] truncate max-w-[150px]">
                {user?.email || 'admin@rento.dev'}
              </span>
              <span className="text-[10px] font-bold uppercase text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">
                Admin
              </span>
            </div>

            <ThemeToggle />

            <Link
              to="/"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 hidden lg:flex"
            >
              <span>Public Website</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-red-400"
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
            >
              Sign Out
            </Button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};
