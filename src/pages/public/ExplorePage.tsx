import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  Grid,
  List,
  RotateCcw,
  Sparkles,
  Home,
  CheckCircle2,
  X,
  Building2
} from 'lucide-react';
import { FilterSidebar } from '../../components/listings/FilterSidebar';
import { ListingCard } from '../../components/listings/ListingCard';
import { ListingCardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { PGListing, FilterState, RoomType, GenderPreference, FoodType } from '../../types';
import { listingsService } from '../../services/listingsService';

export const ExplorePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState<PGListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [layoutView, setLayoutView] = useState<'grid' | 'list'>('grid');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Initial state derived from query params
  const initialFilters: FilterState = useMemo(() => {
    const q = searchParams.get('q') || '';
    const locality = searchParams.get('locality') || 'all';
    const city = searchParams.get('city') || 'all';
    const budgetParam = searchParams.get('budget');
    let minPrice = 0;
    let maxPrice = 25000;

    if (budgetParam === 'under8k') {
      maxPrice = 8000;
    } else if (budgetParam === '8k-12k') {
      minPrice = 8000;
      maxPrice = 12000;
    } else if (budgetParam === '12k-16k') {
      minPrice = 12000;
      maxPrice = 16000;
    } else if (budgetParam === 'above16k') {
      minPrice = 16000;
      maxPrice = 30000;
    }

    const roomParam = searchParams.get('room');
    const roomTypes: RoomType[] = roomParam && roomParam !== 'all' ? [roomParam as RoomType] : [];

    return {
      searchQuery: q,
      city,
      locality,
      college: 'all',
      minPrice,
      maxPrice,
      roomTypes,
      gender: 'all',
      foodType: 'all',
      amenities: [],
      verifiedOnly: false,
      availableOnly: false,
      sortBy: 'recommended',
    };
  }, [searchParams]);

  const [filters, setFilters] = useState<FilterState>(initialFilters);

  // Sync state if searchParams change externally
  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  // Load listings whenever filters change
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      listingsService.getListings(filters).then(data => {
        setListings(data);
        setIsLoading(false);
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [filters]);

  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  };

  const handleResetFilters = () => {
    const reset: FilterState = {
      searchQuery: '',
      city: 'all',
      locality: 'all',
      college: 'all',
      minPrice: 0,
      maxPrice: 25000,
      roomTypes: [],
      gender: 'all',
      foodType: 'all',
      amenities: [],
      verifiedOnly: false,
      availableOnly: false,
      sortBy: 'recommended',
    };
    setFilters(reset);
    setSearchParams({});
  };

  return (
    <div className="min-h-screen bg-navy-950 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Page Title & Breadcrumb header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Home</span>
            <span>/</span>
            <span className="text-white font-medium">Accommodations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Explore Verified PGs in Bangalore
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Find and compare comfortable student accommodation near your college
          </p>
        </div>

        {/* Top Control Bar: Total count, Search quick input, View layout toggle, Sort */}
        <div className="bg-navy-900/80 border border-navy-800 rounded-2xl p-4 mb-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span>Showing {listings.length} Properties</span>
            </div>

            {/* Mobile Filter Sheet Button */}
            <button
              onClick={() => setMobileFilterOpen(true)}
              className="md:hidden flex items-center gap-2 px-3 py-2 rounded-xl bg-navy-800 text-xs font-semibold text-white border border-navy-700"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-brand-400" />
              <span>Filters</span>
            </button>
          </div>

          {/* Sort & Grid/List toggles */}
          <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-3">
            {/* Sort selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium hidden sm:inline">Sort by:</span>
              <select
                value={filters.sortBy}
                onChange={e =>
                  handleFilterChange({
                    sortBy: e.target.value as FilterState['sortBy'],
                  })
                }
                className="bg-navy-950 border border-navy-750 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="recommended">Recommended</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
                <option value="newest">Recently Added</option>
              </select>
            </div>

            {/* View Layout Switcher */}
            <div className="flex items-center gap-1 p-1 bg-navy-950 rounded-xl border border-navy-800">
              <button
                onClick={() => setLayoutView('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  layoutView === 'grid' ? 'bg-navy-800 text-brand-400' : 'text-slate-400 hover:text-white'
                }`}
                title="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLayoutView('list')}
                className={`p-1.5 rounded-lg transition-colors ${
                  layoutView === 'list' ? 'bg-navy-800 text-brand-400' : 'text-slate-400 hover:text-white'
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Layout: Sidebar + Listings */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Desktop Filter Sidebar */}
          <aside className="hidden md:block md:col-span-4 lg:col-span-3 sticky top-28">
            <FilterSidebar
              filters={filters}
              onChange={handleFilterChange}
              onReset={handleResetFilters}
              totalResultsCount={listings.length}
            />
          </aside>

          {/* Listings Results Column */}
          <div className="col-span-1 md:col-span-8 lg:col-span-9">
            {isLoading ? (
              <div
                className={
                  layoutView === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
                    : 'space-y-4'
                }
              >
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <ListingCardSkeleton key={i} />
                ))}
              </div>
            ) : listings.length === 0 ? (
              <EmptyState
                icon={<Home className="w-8 h-8" />}
                title="No PGs available yet"
                description="No PGs available yet. Check back later or adjust your search. Real PG owners register accommodations through our owner portal."
                actionLabel={
                  filters.searchQuery || filters.city !== 'all' || filters.locality !== 'all' || filters.gender !== 'all'
                    ? 'Clear All Filters'
                    : 'List a PG Property'
                }
                onAction={
                  filters.searchQuery || filters.city !== 'all' || filters.locality !== 'all' || filters.gender !== 'all'
                    ? handleResetFilters
                    : () => navigate('/owner/plans')
                }
                className="my-10"
              />
            ) : (
              <div
                className={
                  layoutView === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
                    : 'space-y-4'
                }
              >
                {listings.map(listing => (
                  <ListingCard key={listing.id} listing={listing} layout={layoutView} />
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Mobile Filters Slide-over / Modal */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex justify-end md:hidden">
          <div
            className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="relative w-full max-w-xs bg-navy-900 h-full p-4 shadow-2xl z-10 overflow-y-auto">
            <FilterSidebar
              filters={filters}
              onChange={handleFilterChange}
              onReset={handleResetFilters}
              isMobileModal={true}
              onCloseMobile={() => setMobileFilterOpen(false)}
              totalResultsCount={listings.length}
            />
          </div>
        </div>
      )}
    </div>
  );
};
