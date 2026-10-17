import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Building2,
  GraduationCap,
  ShieldCheck,
  MapPin,
  Sparkles,
  ArrowRight,
  Shield,
  IndianRupee,
  Headphones,
  CheckCircle2,
  Calendar,
  Home as HomeIcon,
  ChevronRight,
  Star,
  HelpCircle,
  ChevronDown
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ListingCard } from '../../components/listings/ListingCard';
import { PGListing } from '../../types';
import { listingsService } from '../../services/listingsService';
import { POPULAR_COLLEGES, POPULAR_LOCALITIES } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [featuredListings, setFeaturedListings] = useState<PGListing[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBudget, setSelectedBudget] = useState('all');
  const [selectedRoomType, setSelectedRoomType] = useState('all');
  const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(0);

  useEffect(() => {
    listingsService.getFeaturedListings().then(listings => {
      setFeaturedListings(listings);
    });
  }, []);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append('q', searchQuery.trim());
    if (selectedBudget !== 'all') params.append('budget', selectedBudget);
    if (selectedRoomType !== 'all') params.append('room', selectedRoomType);
    navigate(`/pgs?${params.toString()}`);
  };

  const handleTagClick = (tag: string) => {
    navigate(`/pgs?q=${encodeURIComponent(tag)}`);
  };

  const handleFindPGClick = () => {
    if (isAuthenticated && user?.role === 'student') {
      navigate('/pgs');
    } else {
      navigate('/login?role=student');
    }
  };

  const handleRegisterPGClick = () => {
    if (isAuthenticated && user?.role === 'owner') {
      navigate('/owner/listings/new');
    } else {
      navigate('/signup?role=owner');
    }
  };

  const faqs = [
    {
      q: 'How does Rento verify student PG accommodations?',
      a: 'Every PG marked with the Verified badge undergoes a physical ground audit by the Rento operations team. We inspect premise cleanliness, Wi-Fi speeds, electrical safety, biometric/CCTV security, and food hygiene certificates before approving the listing.',
    },
    {
      q: 'Are there any brokerage or hidden charges for students?',
      a: 'No. Rento is completely free for students. You connect directly with verified PG owners and managers without paying brokerage or discovery commissions.',
    },
    {
      q: 'Can I schedule a physical visit before booking a bed?',
      a: 'Yes! Simply click "Request a Visit" on any property page, select your preferred date and time window, and the owner will confirm your appointment instantly.',
    },
    {
      q: 'How does Rento help PG owners and property managers?',
      a: 'Rento provides a specialized SaaS suite: real-time bed inventory tracking, student inquiry management, rent tracking, digital lease records, and verified listing placement to reach university students.',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-navy-950 overflow-x-hidden">
      
      {/* HERO SECTION */}
      <section className="relative pt-8 pb-20 lg:pt-14 lg:pb-28 hero-glow-bg border-b border-navy-850">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Hero Content */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Trust Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/25 text-brand-300 text-xs font-semibold backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Physical Audit Verifications &amp; Zero Brokerage</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.12]">
                Find <span className="text-gradient-brand">your stay.</span>
                <br />
                Manage your space.
              </h1>

              {/* Supporting Subtitle */}
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl font-normal">
                Rento connects university students with physically verified PG accommodations and empowers PG owners with an intuitive property management SaaS.
              </p>

              {/* Role Toggle Switch Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleFindPGClick}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-md shadow-brand-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <GraduationCap className="w-4 h-4 text-white" />
                  <span>Find a PG</span>
                </button>
                <button
                  type="button"
                  onClick={handleRegisterPGClick}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy-900 border border-navy-750 text-slate-100 font-semibold text-sm hover:bg-navy-800 transition-all cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-brand-400" />
                  <span>Register a PG</span>
                </button>
              </div>

              {/* Prominent Search Bar Form */}
              <form
                onSubmit={handleHeroSearch}
                className="mt-6 p-2 rounded-2xl bg-navy-900/90 border border-navy-700/80 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-stretch gap-2"
              >
                {/* Location Search Input */}
                <div className="flex-1 flex items-center gap-2.5 px-3 py-2 bg-navy-950/60 rounded-xl border border-navy-800">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search by city, locality or college..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  />
                </div>

                {/* Budget Dropdown */}
                <div className="w-full md:w-36 flex items-center px-3 py-2 bg-navy-950/60 rounded-xl border border-navy-800 text-xs">
                  <select
                    value={selectedBudget}
                    onChange={e => setSelectedBudget(e.target.value)}
                    className="w-full bg-transparent text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="all" className="bg-navy-900 text-slate-100">₹ Budget</option>
                    <option value="under8k" className="bg-navy-900 text-slate-100">Under ₹8,000</option>
                    <option value="8k-12k" className="bg-navy-900 text-slate-100">₹8,000 - ₹12,000</option>
                    <option value="12k-16k" className="bg-navy-900 text-slate-100">₹12,000 - ₹16,000</option>
                    <option value="above16k" className="bg-navy-900 text-slate-100">Above ₹16,000</option>
                  </select>
                </div>

                {/* Room Type Dropdown */}
                <div className="w-full md:w-36 flex items-center px-3 py-2 bg-navy-950/60 rounded-xl border border-navy-800 text-xs">
                  <select
                    value={selectedRoomType}
                    onChange={e => setSelectedRoomType(e.target.value)}
                    className="w-full bg-transparent text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="all" className="bg-navy-900 text-slate-100">Room Type</option>
                    <option value="single" className="bg-navy-900 text-slate-100">Single Room</option>
                    <option value="double" className="bg-navy-900 text-slate-100">Double Sharing</option>
                    <option value="triple" className="bg-navy-900 text-slate-100">Triple Sharing</option>
                  </select>
                </div>

                {/* Search Button */}
                <Button
                  type="submit"
                  variant="glow"
                  size="md"
                  className="shrink-0 px-6 font-bold"
                  leftIcon={<Search className="w-4 h-4" />}
                >
                  Search
                </Button>
              </form>

              {/* Popular Search Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
                <span className="font-semibold text-slate-300">Popular:</span>
                {['Bangalore', 'RVCE', 'BMSCE', 'Jayanagar', 'Indiranagar', 'HSR Layout'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagClick(tag)}
                    className="px-2.5 py-1 rounded-lg bg-navy-900/80 border border-navy-800 hover:border-brand-500/50 hover:text-white transition-all"
                  >
                    {tag}
                  </button>
                ))}
              </div>

            </div>

            {/* Right Hero Image & Floating Badges */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                {/* Glow Backdrop */}
                <div className="absolute -inset-1 bg-gradient-to-r from-brand-500 to-brand-600 rounded-3xl blur-2xl opacity-25 animate-pulse"></div>

                {/* Main Hero Building Photo */}
                <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-navy-900 aspect-[4/5] sm:aspect-[4/4.5]">
                  <img
                    src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80"
                    alt="Modern student apartment building at night"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/20 to-transparent"></div>

                  {/* Top Quote Badge */}
                  <div className="absolute top-5 left-5 px-3 py-1.5 rounded-full bg-navy-950/80 backdrop-blur-md border border-white/10 text-xs font-semibold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                    <span>More than just a PG</span>
                  </div>

                  {/* Floating Badge 1: Safe & Secure */}
                  <div className="absolute top-12 -right-3 sm:right-4 p-3 rounded-2xl bg-navy-900/90 backdrop-blur-md border border-brand-500/30 text-white shadow-xl flex items-center gap-3 animate-in fade-in duration-500">
                    <div className="w-8 h-8 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Safe & Secure</p>
                      <p className="text-[10px] text-slate-400">24/7 biometric & CCTV</p>
                    </div>
                  </div>

                  {/* Floating Badge 2: Verified Listings */}
                  <div className="absolute top-44 -right-2 sm:right-3 p-3 rounded-2xl bg-navy-900/90 backdrop-blur-md border border-emerald-500/30 text-white shadow-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-300">Verified Listings</p>
                      <p className="text-[10px] text-slate-400">Audited premises</p>
                    </div>
                  </div>

                  {/* Floating Badge 3: Student Friendly */}
                  <div className="absolute bottom-16 -right-2 sm:right-4 p-3 rounded-2xl bg-navy-900/90 backdrop-blur-md border border-indigo-500/30 text-white shadow-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Student Friendly</p>
                      <p className="text-[10px] text-slate-400">Zero brokerage fee</p>
                    </div>
                  </div>

                  {/* Bottom Location Indicator */}
                  <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-navy-900/80 backdrop-blur-md border border-white/10 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-brand-400" />
                      <span className="font-semibold text-white">Bangalore University Hubs</span>
                    </div>
                    <span className="text-emerald-400 font-bold">Active Stays</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* VALUE PROPOSITIONS ICON STRIP */}
      <section className="py-10 bg-navy-900/40 border-b border-navy-850">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            
            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-navy-900/50 border border-navy-800">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 shrink-0">
                <HomeIcon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Verified PGs</h4>
                <p className="text-[11px] text-slate-400">Quality checked listings</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-navy-900/50 border border-navy-800">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Prime Locations</h4>
                <p className="text-[11px] text-slate-400">Near colleges & transit</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-navy-900/50 border border-navy-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Safe & Secure</h4>
                <p className="text-[11px] text-slate-400">Student first approach</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-navy-900/50 border border-navy-800">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Affordable Options</h4>
                <p className="text-[11px] text-slate-400">For every budget</p>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 flex items-center gap-3.5 p-3 rounded-xl bg-navy-900/50 border border-navy-800">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Dedicated Support</h4>
                <p className="text-[11px] text-slate-400">Always here to help</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* FEATURED LISTINGS: "POPULAR PGS NEAR YOU" */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-brand-400">
              Featured Listings
            </span>
            <h2 className="text-3xl font-extrabold text-white mt-1">
              Popular PGs <span className="text-gradient-brand">Near You</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1.5">
              Handpicked student accommodations audited for safety, hygienic meals and quiet study environments
            </p>
          </div>

          <Link
            to="/pgs"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-400 hover:text-brand-300 transition-colors"
          >
            <span>View All ({featuredListings.length})</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Listings Grid or Honest Empty State */}
        {featuredListings.length === 0 ? (
          <div className="bg-navy-900/60 border border-navy-800 rounded-3xl p-10 text-center max-w-md mx-auto space-y-3">
            <Building2 className="w-10 h-10 text-brand-400 mx-auto" />
            <h3 className="text-base font-bold text-white">No Featured PGs Yet</h3>
            <p className="text-xs text-slate-400">
              Eligible published listings reviewed by Rento operations will appear here.
            </p>
            <div className="pt-2">
              <Link to="/pgs">
                <Button variant="outline" size="sm">
                  Explore All Properties
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredListings.slice(0, 4).map(listing => (
              <ListingCard key={listing.id} listing={listing} layout="grid" />
            ))}
          </div>
        )}
      </section>

      {/* HOW RENTO WORKS SECTION */}
      <section className="py-16 lg:py-24 bg-navy-900/50 border-y border-navy-850">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-14">
            <h2 className="text-3xl font-extrabold text-white">How Rento Works</h2>
            <p className="text-sm text-slate-400 mt-2">
              A simple, transparent and zero-brokerage accommodation process for university students
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Step 1 */}
            <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-8 relative flex flex-col items-center text-center shadow-lg group hover:border-brand-500/40 transition-all">
              <div className="w-10 h-10 rounded-full bg-brand-600 text-white font-bold text-sm flex items-center justify-center absolute -top-5 shadow-lg">
                1
              </div>
              <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mt-3 mb-6">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Search & Explore</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Filter by your university, walking distance, budget, food options, and room sharing preferences.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-8 relative flex flex-col items-center text-center shadow-lg group hover:border-violet-500/40 transition-all">
              <div className="w-10 h-10 rounded-full bg-violet-600 text-white font-bold text-sm flex items-center justify-center absolute -top-5 shadow-lg">
                2
              </div>
              <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mt-3 mb-6">
                <Calendar className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Enquire & Visit</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Send messages directly to property managers or schedule an in-person physical visit in 1 click.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-navy-900/80 border border-navy-800 rounded-3xl p-8 relative flex flex-col items-center text-center shadow-lg group hover:border-emerald-500/40 transition-all">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center absolute -top-5 shadow-lg">
                3
              </div>
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mt-3 mb-6">
                <HomeIcon className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Move In & Stay</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Review transparent costs, sign straightforward agreements, and settle into your verified student home.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* DUAL CTA CARDS: FOR STUDENTS & FOR PG OWNERS */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Card 1: For Students */}
          <div className="rounded-3xl p-8 sm:p-10 bg-gradient-to-br from-brand-900/80 via-navy-900 to-navy-950 border border-brand-500/30 shadow-2xl flex flex-col justify-between relative overflow-hidden">
            <div className="space-y-4 relative z-10">
              <span className="text-xs font-bold text-brand-300 uppercase tracking-widest bg-brand-500/20 px-3 py-1 rounded-full border border-brand-500/30">
                For Students
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                Find your perfect PG near your college.
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Browse verified accommodations near RVCE, BMSCE, Christ, PES, and top Bangalore institutions with zero brokerage.
              </p>
            </div>
            <div className="pt-8 relative z-10">
              <Button
                variant="primary"
                size="lg"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={handleFindPGClick}
              >
                Find a PG
              </Button>
            </div>
          </div>

          {/* Card 2: For PG Owners */}
          <div className="rounded-3xl p-8 sm:p-10 bg-gradient-to-br from-violet-950/80 via-navy-900 to-navy-950 border border-violet-500/30 shadow-2xl flex flex-col justify-between relative overflow-hidden">
            <div className="space-y-4 relative z-10">
              <span className="text-xs font-bold text-violet-300 uppercase tracking-widest bg-violet-500/20 px-3 py-1 rounded-full border border-violet-500/30">
                For PG Owners
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                List and manage your properties with powerful tools.
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Gain verified student inquiries, track room and bed vacancy in real-time, and streamline owner operations effortlessly.
              </p>
            </div>
            <div className="pt-8 relative z-10">
              <Button
                variant="glow"
                size="lg"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={handleRegisterPGClick}
              >
                Register a PG
              </Button>
            </div>
          </div>

        </div>
      </section>

      {/* PRICING SECTION: STUDENT FREE & OWNER SUBSCRIPTION */}
      <section className="py-16 lg:py-24 bg-navy-900/60 border-t border-navy-850">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="text-xs font-bold text-brand-400 uppercase tracking-widest bg-brand-500/10 px-3.5 py-1.5 rounded-full border border-brand-500/20">
              Transparent Pricing Plans
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Built for Students &amp; PG Owners
            </h2>
            <p className="text-sm text-slate-300">
              Free forever for students discovering verified stays. Fair, proposed SaaS subscription for PG owners.
            </p>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 max-w-lg mx-auto">
              <strong>Frontend Demo Notice:</strong> Paid billing is not yet implemented. All amounts shown below are proposed pricing subject to market validation.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
            {/* Student Free Plan */}
            <div className="bg-navy-900/90 border border-brand-500/30 rounded-3xl p-8 flex flex-col justify-between shadow-2xl relative">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                    Students &amp; Parents
                  </span>
                  <span className="text-xs text-slate-400">100% Free Forever</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">Student Free Access</h3>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Full access to PG search, comparison, and direct owner visit scheduling.
                  </p>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-extrabold text-white">₹0</span>
                  <span className="text-xs text-slate-400">/ zero brokerage</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-navy-800">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Browse all verified student PGs</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Side-by-side accommodation comparison</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Free in-person visit scheduling</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Save unlimited favourite stays</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Direct contact with verified owners</span>
                  </li>
                </ul>
              </div>
              <div className="pt-8">
                <Button
                  variant="primary"
                  className="w-full font-bold"
                  size="md"
                  onClick={handleFindPGClick}
                >
                  Find a PG
                </Button>
              </div>
            </div>

            {/* Owner Subscription Plan */}
            <div className="bg-navy-900/90 border border-violet-500/30 rounded-3xl p-8 flex flex-col justify-between shadow-2xl relative">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-violet-400 uppercase tracking-wider bg-violet-500/10 px-2.5 py-1 rounded-md border border-violet-500/20">
                    PG Owners &amp; Managers
                  </span>
                  <span className="text-xs text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                    Proposed Tier
                  </span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">Owner Starter</h3>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Essential software suite for owners managing up to 2 student properties.
                  </p>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-extrabold text-white">₹499</span>
                  <span className="text-xs text-slate-400">/ month (proposed)</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-navy-800">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                    <span>Real-time bed vacancy management</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                    <span>Centralized student visit request inbox</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                    <span>Multi-step property registration wizard</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                    <span>Physical verification audit eligibility</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                    <span>Free trial during current prototype phase</span>
                  </li>
                </ul>
              </div>
              <div className="pt-8">
                <Button
                  variant="glow"
                  className="w-full font-bold"
                  size="md"
                  onClick={handleRegisterPGClick}
                >
                  Register a PG
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RENTO TRUST PILLARS & REVIEWS POLICY */}
      <section className="py-16 bg-navy-950 border-t border-navy-850">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Core Commitments */}
            <div className="lg:col-span-7 space-y-5">
              <p className="text-xs font-bold text-brand-400 uppercase tracking-widest">
                Rento Transparency &amp; Safety Commitments
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Built for authenticity. No brokers, no fake ratings.
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2">
                <div className="p-4 rounded-2xl bg-navy-900/60 border border-navy-800 space-y-1.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-sm font-bold text-white">Physical Audits</h4>
                  <p className="text-xs text-slate-400">Ground inspection of CCTV, biometric entry, and food hygiene certificates.</p>
                </div>
                <div className="p-4 rounded-2xl bg-navy-900/60 border border-navy-800 space-y-1.5">
                  <IndianRupee className="w-5 h-5 text-brand-400" />
                  <h4 className="text-sm font-bold text-white">Zero Brokerage</h4>
                  <p className="text-xs text-slate-400">Connect directly with actual PG owners. No discovery charges or hidden fees.</p>
                </div>
                <div className="p-4 rounded-2xl bg-navy-900/60 border border-navy-800 space-y-1.5">
                  <CheckCircle2 className="w-5 h-5 text-violet-400" />
                  <h4 className="text-sm font-bold text-white">Live Bed Vacancies</h4>
                  <p className="text-xs text-slate-400">Inventory updated directly by property managers in real time.</p>
                </div>
              </div>
            </div>

            {/* Right Genuine Reviews Policy Notice */}
            <div className="lg:col-span-5 bg-navy-900/90 border border-navy-800 rounded-3xl p-6 shadow-xl relative space-y-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <h3 className="text-sm font-bold text-white">Authentic Student Reviews Policy</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Rento never displays fabricated testimonials, invented ratings, or artificial social proof. Student reviews and ratings become visible only when verified student residents complete physical stays at confirmed properties.
              </p>
              <div className="pt-2 border-t border-navy-800 flex items-center justify-between text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified Review System
                </span>
                <span>Active for verified stays</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Frequently Asked Questions</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Everything you need to know about student accommodations and PG management
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = faqOpenIndex === idx;
            return (
              <div
                key={idx}
                className="bg-navy-900/80 border border-navy-800 rounded-2xl overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setFaqOpenIndex(isOpen ? null : idx)}
                  className="w-full text-left p-5 flex items-center justify-between gap-4 font-semibold text-white text-sm hover:text-brand-300"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      isOpen ? 'rotate-180 text-brand-400' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-navy-800/60">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
};
