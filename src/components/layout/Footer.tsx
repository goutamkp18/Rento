import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Heart, MapPin, Mail, Phone, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-navy-950 border-t border-navy-850 pt-16 pb-12 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-navy-800">
          
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center group shrink-0" aria-label="Rento - Student Stays">
              <img
                src="/rento-logo-light.png"
                alt="Rento Student Stays"
                className="h-9 w-auto object-contain dark:hidden"
              />
              <img
                src="/rento-logo-dark.png"
                alt="Rento Student Stays"
                className="h-9 w-auto object-contain hidden dark:block"
              />
            </Link>
            <p className="text-sm leading-relaxed max-w-sm text-slate-400">
              Find your stay. Manage your space. India's premier student accommodation marketplace and PG management SaaS platform.
            </p>
            <div className="flex items-center gap-3 pt-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                Physical Inspection & Verified PGs
              </span>
            </div>
          </div>

          {/* Student Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">For Students</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/pgs" className="hover:text-white transition-colors">
                  Explore PGs Near Colleges
                </Link>
              </li>
              <li>
                <Link to="/student/compare" className="hover:text-white transition-colors">
                  Compare PGs Side-by-Side
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="hover:text-white transition-colors">
                  How Rento Works
                </Link>
              </li>
              <li>
                <Link to="/student/favourites" className="hover:text-white transition-colors">
                  Saved Favourites
                </Link>
              </li>
              <li>
                <Link to="/student/dashboard" className="hover:text-white transition-colors">
                  Student Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Owner Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">For PG Owners</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/owners" className="hover:text-white transition-colors">
                  List Your Property
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-white transition-colors">
                  Proposed Pricing Plans
                </Link>
              </li>
              <li>
                <Link to="/owner/dashboard" className="hover:text-white transition-colors">
                  Owner SaaS Portal
                </Link>
              </li>
              <li>
                <Link to="/owner/listings/new" className="hover:text-white transition-colors">
                  Create Listing Draft
                </Link>
              </li>
              <li>
                <Link to="/owner/enquiries" className="hover:text-white transition-colors">
                  Student Enquiry Inbox
                </Link>
              </li>
            </ul>
          </div>

          {/* Popular Localities & Help */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Top Hubs (Bangalore)</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/pgs?locality=Jayanagar" className="hover:text-white transition-colors">
                  Jayanagar (Near RVCE/NMKRV)
                </Link>
              </li>
              <li>
                <Link to="/pgs?locality=Basavanagudi" className="hover:text-white transition-colors">
                  Basavanagudi (Near BMSCE)
                </Link>
              </li>
              <li>
                <Link to="/pgs?locality=Koramangala" className="hover:text-white transition-colors">
                  Koramangala (Near St. Johns)
                </Link>
              </li>
              <li>
                <Link to="/pgs?locality=Bannerghatta+Road" className="hover:text-white transition-colors">
                  Bannerghatta (Near Christ)
                </Link>
              </li>
              <li>
                <Link to="/admin/listings" className="text-brand-400 hover:text-brand-300 font-medium inline-flex items-center gap-1">
                  <span>Admin Review Queue</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Disclaimers and Copyright */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Rento Platforms India. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span>Built with React, Vite, Tailwind CSS & Supabase Client</span>
            <span className="text-slate-600">|</span>
            <span>Frontend Architecture Demo</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
