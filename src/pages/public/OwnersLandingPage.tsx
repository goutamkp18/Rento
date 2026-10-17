import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  BedDouble,
  Inbox,
  ShieldCheck,
  TrendingUp,
  Users,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  BarChart3,
  CalendarCheck,
  HelpCircle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';

export const OwnersLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const handleListProperty = () => {
    if (isAuthenticated && user?.role === 'owner') {
      navigate('/owner/listings/new');
    } else {
      navigate('/signup?role=owner');
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        
        {/* Owner Hero */}
        <div className="text-center max-w-3xl mx-auto space-y-6 pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Dedicated PG Management SaaS</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
            Stop juggling spreadsheets.
            <br />
            <span className="text-gradient-brand">Run your PG smarter.</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Rento gives PG owners and hostel managers modern software to list verified properties, track room & bed vacancies in real time, and manage student visit requests in one organized inbox.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            <Button
              variant="glow"
              size="lg"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={handleListProperty}
            >
              List Your Property
            </Button>
            <Link to="/owner/dashboard">
              <Button variant="secondary" size="lg">
                View Owner Dashboard Demo
              </Button>
            </Link>
          </div>
        </div>

        {/* Key Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-8 space-y-4 hover:border-violet-500/40 transition-all shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center">
              <BedDouble className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Bed-Level Inventory Tracking</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Track single, double, and triple room occupancy with live bed availability. Prevent accidental overbooking and display accurate vacancies to incoming students.
            </p>
          </div>

          <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-8 space-y-4 hover:border-brand-500/40 transition-all shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Centralized Student Inquiry Inbox</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Receive verified student visit requests with date and time slots. Confirm appointments, respond to dietary or room questions, and eliminate chaotic WhatsApp messages.
            </p>
          </div>

          <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-8 space-y-4 hover:border-emerald-500/40 transition-all shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Rento Verified Trust Badge</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Verified properties receive up to 3.8x more serious inquiries from university parents and students who prioritize safety, hygienic food, and transparent pricing.
            </p>
          </div>

        </div>

        {/* Proposed Pricing Section with Honest Prototype Disclosure */}
        <div className="bg-navy-900/50 border border-navy-850 rounded-3xl p-8 sm:p-12 space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              Proposed Pricing Model
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Transparent, Value-Based Plans
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              *Early Access Phase: Actual payment billing is not yet implemented. All owner features are currently accessible for development and testing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            
            {/* Starter Plan */}
            <div className="bg-navy-950 border border-navy-800 rounded-3xl p-8 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">
                  PG Owner Starter
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">₹ 49</span>
                  <span className="text-xs text-slate-400">/month (+ 18% GST)</span>
                </div>
                <p className="text-xs text-slate-400">
                  Ideal for standalone PG owners managing 1 property.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-300 pt-3 border-t border-navy-800">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>1 property listing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Bed & room capacity tracking</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Student visit requests inbox</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Rento Verified badge review</span>
                  </li>
                </ul>
              </div>

              <Button variant="secondary" className="w-full" disabled>
                Starter Tier (₹ 49 + GST)
              </Button>
            </div>

            {/* Pro Plan */}
            <div className="bg-navy-950 border border-violet-500/30 rounded-3xl p-8 space-y-6 flex flex-col justify-between relative shadow-2xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">
                    PG Owner Pro
                  </span>
                  <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2.5 py-0.5 rounded-full font-bold">
                    Multi-Property
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">₹ 99</span>
                  <span className="text-xs text-slate-400">/month (+ 18% GST)</span>
                </div>
                <p className="text-xs text-slate-400">
                  Built for multi-branch PG businesses and coliving operators.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-300 pt-3 border-t border-navy-800">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                    <span>Unlimited property listings</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                    <span>Advanced tenant lease management</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                    <span>Priority student search placement</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                    <span>Analytics on student views & visits</span>
                  </li>
                </ul>
              </div>

              <Button variant="primary" className="w-full" disabled>
                Proposed Pro Tier (Coming Soon)
              </Button>
            </div>

          </div>
        </div>

        {/* CTA Banner */}
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-brand-900/60 to-violet-900/60 border border-brand-500/30 shadow-2xl text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Ready to list your PG on Rento?
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Create your draft property listing in minutes. Our Bangalore operations team will reach out to conduct your free physical verification audit.
          </p>
          <div className="pt-2">
            <Button
              variant="glow"
              size="lg"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={handleListProperty}
            >
              Create Free Property Listing
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};
