import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LogOut, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';

export const UnauthorizedPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const getDashboardLink = () => {
    if (!user) return '/login';
    if (user.role === 'admin') return '/admin/dashboard';
    if (user.role === 'owner') return '/owner/dashboard';
    return '/student/dashboard';
  };

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
          <h1 className="text-2xl font-black text-white">Access Denied</h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            You do not have the required security permissions to access this screen.
            {user && (
              <span className="block mt-2 text-slate-400">
                Current session role: <strong className="text-white uppercase">{user.role}</strong> ({user.email})
              </span>
            )}
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-3">
          <Link to={getDashboardLink()}>
            <Button variant="primary" className="w-full justify-center text-xs" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Return to Your Authorized Dashboard
            </Button>
          </Link>

          <Link to="/">
            <Button variant="outline" className="w-full justify-center text-xs" leftIcon={<Home className="w-4 h-4" />}>
              Go to Public Homepage
            </Button>
          </Link>

          {user && (
            <Button
              variant="ghost"
              className="w-full justify-center text-xs text-slate-400 hover:text-white"
              onClick={handleLogout}
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Sign Out & Switch Account
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
