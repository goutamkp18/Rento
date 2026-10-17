import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Search,
  Heart,
  Scale,
  Menu,
  X,
  User,
  LogOut,
  Building2,
  GraduationCap,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFavourites } from '../../context/FavouritesContext';
import { useCompare } from '../../context/CompareContext';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../ui/ThemeToggle';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { favouriteCount } = useFavourites();
  const { compareCount } = useCompare();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [demoRoleDropdownOpen, setDemoRoleDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'PGs', path: '/pgs' },
    { name: 'How it Works', path: '/how-it-works' },
    { name: 'For Owners', path: '/owners' },
    { name: 'Pricing', path: '/pricing' },
  ];

  const handleLogout = async () => {
    await logout();
    setUserDropdownOpen(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-navy-950/85 border-b border-navy-800/80 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        
        {/* Brand Logo */}
        <Link to="/" className="flex items-center group shrink-0" aria-label="Rento - Student Stays">
          <img
            src="/rento-logo-light.png"
            alt="Rento Student Stays"
            className="h-10 sm:h-11 w-auto object-contain dark:hidden transition-transform duration-200 group-hover:scale-[1.02]"
          />
          <img
            src="/rento-logo-dark.png"
            alt="Rento Student Stays"
            className="h-10 sm:h-11 w-auto object-contain hidden dark:block transition-transform duration-200 group-hover:scale-[1.02]"
          />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navLinks.map(link => (
            <NavLink
              key={link.name}
              to={link.path}
              className={({ isActive }) =>
                `px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-white bg-navy-800/90 shadow-inner text-brand-300'
                    : 'text-slate-300 hover:text-white hover:bg-navy-900/60'
                }`
              }
            >
              {link.name}
            </NavLink>
          ))}
        </nav>

        {/* Right Actions & Utilities */}
        <div className="hidden md:flex items-center gap-3">
          {/* Compare Shortcut Pill */}
          <Link
            to="/student/compare"
            className="relative p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-navy-800 transition-colors border border-navy-800/60"
            title="Compare PGs"
          >
            <Scale className="w-4 h-4" />
            {compareCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                {compareCount}
              </span>
            )}
          </Link>

          {/* Favourites Shortcut Pill */}
          <Link
            to="/student/favourites"
            className="relative p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-navy-800 transition-colors border border-navy-800/60"
            title="Saved Favourites"
          >
            <Heart className="w-4 h-4" />
            {favouriteCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-violet-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                {favouriteCount}
              </span>
            )}
          </Link>

          {/* Light / Dark Mode Toggle */}
          <ThemeToggle />

          {/* User Account / Auth Actions */}
          {isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 pl-3 rounded-full bg-navy-900 border border-navy-750 hover:border-navy-600 transition-colors"
              >
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-200 max-w-[120px] truncate">
                    {user.full_name}
                  </span>
                  <span className="text-[10px] text-brand-400 capitalize font-medium">
                    {user.role}
                  </span>
                </div>
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name}
                    className="w-7 h-7 rounded-full object-cover border border-brand-500/40"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">
                    {user.full_name.charAt(0)}
                  </div>
                )}
              </button>

              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-navy-900 border border-navy-750 rounded-xl shadow-2xl p-1.5 z-50 text-xs"
                  onMouseLeave={() => setUserDropdownOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-navy-800">
                    <p className="font-semibold text-white">{user.full_name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                  </div>

                  {user.role === 'student' && (
                    <Link
                      to="/student/dashboard"
                      onClick={() => setUserDropdownOpen(false)}
                      className="block px-3 py-2 rounded-lg hover:bg-navy-800 text-slate-200"
                    >
                      Student Portal
                    </Link>
                  )}

                  {user.role === 'owner' && (
                    <Link
                      to="/owner/dashboard"
                      onClick={() => setUserDropdownOpen(false)}
                      className="block px-3 py-2 rounded-lg hover:bg-navy-800 text-slate-200"
                    >
                      Owner Dashboard
                    </Link>
                  )}

                  {user.role === 'admin' && (
                    <Link
                      to="/admin/listings"
                      onClick={() => setUserDropdownOpen(false)}
                      className="block px-3 py-2 rounded-lg hover:bg-navy-800 text-slate-200"
                    >
                      Admin Review Queue
                    </Link>
                  )}

                  <Link
                    to={user.role === 'owner' ? '/owner/settings' : '/student/profile'}
                    onClick={() => setUserDropdownOpen(false)}
                    className="block px-3 py-2 rounded-lg hover:bg-navy-800 text-slate-200"
                  >
                    Profile & Settings
                  </Link>

                  <div className="border-t border-navy-800 my-1" />

                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-400 flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Login
                </Button>
              </Link>
              <Link to="/signup">
                <Button variant="primary" size="sm">
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-1.5">
          <ThemeToggle />
          <Link
            to="/student/favourites"
            className="p-2 text-slate-300 hover:text-white"
            aria-label="Favourites"
          >
            <Heart className="w-5 h-5" />
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-navy-900 border border-navy-800 text-slate-300 hover:text-white"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-navy-800 bg-navy-950 px-4 pt-2 pb-6 space-y-3">
          <div className="flex flex-col space-y-1">
            {navLinks.map(link => (
              <NavLink
                key={link.name}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2.5 rounded-xl text-sm font-medium ${
                    isActive ? 'bg-brand-600/20 text-brand-300 font-semibold' : 'text-slate-300 hover:text-white'
                  }`
                }
              >
                {link.name}
              </NavLink>
            ))}
            <Link
              to="/student/compare"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 flex items-center justify-between"
            >
              <span>Compare Accommodations</span>
              {compareCount > 0 && (
                <span className="bg-brand-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {compareCount}
                </span>
              )}
            </Link>
          </div>

          <div className="pt-3 border-t border-navy-800 space-y-2">
            {isAuthenticated && user ? (
              <>
                <div className="px-3 py-2 bg-navy-900 rounded-xl">
                  <p className="text-sm font-bold text-white">{user.full_name}</p>
                  <p className="text-xs text-brand-400 capitalize">{user.role} Account</p>
                </div>
                <Link
                  to={user.role === 'owner' ? '/owner/dashboard' : '/student/dashboard'}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full py-2.5 text-center rounded-xl bg-brand-600 text-white font-medium text-sm"
                >
                  Go to Dashboard
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full py-2.5 text-center rounded-xl bg-navy-900 border border-navy-800 text-red-400 font-medium text-sm"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 text-center rounded-xl bg-navy-900 border border-navy-800 text-slate-200 text-sm font-medium"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 text-center rounded-xl bg-brand-600 text-white text-sm font-medium"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
