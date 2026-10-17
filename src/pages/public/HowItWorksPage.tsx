import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Calendar,
  Key,
  ShieldCheck,
  Building2,
  Users,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ClipboardCheck,
  Laptop,
  CreditCard
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const HowItWorksPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'student' | 'owner'>('student');

  return (
    <div className="min-h-screen bg-navy-950 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Transparent & Direct</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            How Rento Works
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Whether you are a university student searching for a safe stay or a PG owner managing rooms, Rento simplifies every step.
          </p>

          {/* Persona View Switcher */}
          <div className="inline-flex p-1.5 bg-navy-900 rounded-2xl border border-navy-800 shadow-lg">
            <button
              onClick={() => setActiveTab('student')}
              className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'student'
                  ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              For University Students
            </button>
            <button
              onClick={() => setActiveTab('owner')}
              className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'owner'
                  ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              For PG Owners & Managers
            </button>
          </div>
        </div>

        {/* Student Workflow */}
        {activeTab === 'student' ? (
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              
              <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-6 relative flex flex-col justify-between">
                <div>
                  <span className="w-8 h-8 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center mb-4">
                    1
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center mb-4">
                    <Search className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">College Filter Search</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Filter stays by walking distance to RVCE, BMSCE, Christ, PES, or your exact campus. Set your monthly budget and food preferences.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-navy-800 text-[11px] text-brand-300 font-semibold">
                  100% Free • Zero Brokerage
                </div>
              </div>

              <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-6 relative flex flex-col justify-between">
                <div>
                  <span className="w-8 h-8 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center mb-4">
                    2
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center mb-4">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">Check Verified Audits</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Review physical inspection reports, security camera coverage, Wi-Fi speed benchmarks, and pure veg/non-veg menu schedules.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-navy-800 text-[11px] text-emerald-400 font-semibold">
                  Physical Premise Verified
                </div>
              </div>

              <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-6 relative flex flex-col justify-between">
                <div>
                  <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mb-4">
                    3
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">Book Free In-Person Visit</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Select a morning or weekend window. The owner confirms your schedule and welcomes you and your guardians directly.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-navy-800 text-[11px] text-indigo-300 font-semibold">
                  1-Click Appointment
                </div>
              </div>

              <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-6 relative flex flex-col justify-between">
                <div>
                  <span className="w-8 h-8 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center mb-4">
                    4
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                    <Key className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">Move In Seamlessly</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Pay rent and refundable security deposits directly to the owner with documented house rules and transparent electricity terms.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-navy-800 text-[11px] text-teal-300 font-semibold">
                  Direct Owner Agreement
                </div>
              </div>

            </div>

            <div className="text-center pt-6">
              <Link to="/pgs">
                <Button variant="glow" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Explore Student PGs Now
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Owner Workflow */
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              
              <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-6 relative flex flex-col justify-between">
                <div>
                  <span className="w-8 h-8 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center mb-4">
                    1
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center mb-4">
                    <Laptop className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">List Your Property</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Add photos, address, nearby colleges, room types (single, double, triple), meal details, and house rules.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-navy-800 text-[11px] text-brand-300 font-semibold">
                  Multi-Section Form
                </div>
              </div>

              <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-6 relative flex flex-col justify-between">
                <div>
                  <span className="w-8 h-8 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center mb-4">
                    2
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center mb-4">
                    <ClipboardCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">Rento Verification Audit</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Our city ops team verifies ownership, facilities, and premise security to award your property the Rento Verified trust badge.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-navy-800 text-[11px] text-emerald-400 font-semibold">
                  Boosts Student Inquiries
                </div>
              </div>

              <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-6 relative flex flex-col justify-between">
                <div>
                  <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mb-4">
                    3
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">Manage Student Leads</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Receive verified student inquiries, approve scheduled visit times, and communicate directly through the owner inbox.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-navy-800 text-[11px] text-indigo-300 font-semibold">
                  Zero Spam • Serious Inquiries
                </div>
              </div>

              <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-6 relative flex flex-col justify-between">
                <div>
                  <span className="w-8 h-8 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center mb-4">
                    4
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">Track Beds & Vacancies</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Maintain real-time capacity and bed availability so students always see accurate vacancies without confusing phone calls.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-navy-800 text-[11px] text-teal-300 font-semibold">
                  Live SaaS Inventory
                </div>
              </div>

            </div>

            <div className="text-center pt-6">
              <Link to="/owners">
                <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Learn More About Owner Tools
                </Button>
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
