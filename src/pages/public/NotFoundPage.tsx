import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Compass, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-6">
        <div className="text-7xl font-black text-brand-500/80">404</div>
        <h1 className="text-2xl font-bold text-white">Page Not Found</h1>
        <p className="text-xs sm:text-sm text-slate-400">
          The page or accommodation you are trying to reach doesn't exist or has moved.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link to="/">
            <Button variant="secondary" size="md" leftIcon={<Home className="w-4 h-4" />}>
              Home
            </Button>
          </Link>
          <Link to="/pgs">
            <Button variant="primary" size="md" leftIcon={<Compass className="w-4 h-4" />}>
              Explore PGs
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
