import React from 'react';
import { FilterState, RoomType, GenderPreference, FoodType } from '../../types';
import { Search, RotateCcw, X, Check, SlidersHorizontal, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';

interface FilterSidebarProps {
  filters: FilterState;
  onChange: (updatedFilters: Partial<FilterState>) => void;
  onReset: () => void;
  isMobileModal?: boolean;
  onCloseMobile?: () => void;
  totalResultsCount?: number;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  filters,
  onChange,
  onReset,
  isMobileModal = false,
  onCloseMobile,
  totalResultsCount,
}) => {
  const roomTypeOptions: { label: string; value: RoomType }[] = [
    { label: 'Single Room', value: 'single' },
    { label: 'Double Sharing', value: 'double' },
    { label: 'Triple Sharing', value: 'triple' },
    { label: '4+ Sharing', value: 'four_plus' },
  ];

  const amenityOptions = [
    'Wi-Fi',
    'AC Rooms',
    'Meals Included',
    'Attached Washroom',
    'Daily Housekeeping',
    'Power Backup',
    'Washing Machine',
    'Biometric Access',
    'Gym',
  ];

  const handleRoomTypeToggle = (type: RoomType) => {
    const exists = filters.roomTypes.includes(type);
    const updated = exists
      ? filters.roomTypes.filter(t => t !== type)
      : [...filters.roomTypes, type];
    onChange({ roomTypes: updated });
  };

  const handleAmenityToggle = (amenity: string) => {
    const exists = filters.amenities.includes(amenity);
    const updated = exists
      ? filters.amenities.filter(a => a !== amenity)
      : [...filters.amenities, amenity];
    onChange({ amenities: updated });
  };

  return (
    <div
      className={`bg-navy-900/95 border border-navy-800 rounded-2xl p-5 ${
        isMobileModal ? 'h-full overflow-y-auto' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-navy-800 mb-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-brand-400" />
          <h3 className="font-bold text-white text-base">Filter Properties</h3>
          {totalResultsCount !== undefined && (
            <span className="text-xs bg-navy-800 text-slate-300 px-2 py-0.5 rounded-full font-medium">
              {totalResultsCount} found
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 font-medium transition-colors"
            title="Reset all filters"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear</span>
          </button>
          {isMobileModal && (
            <button
              onClick={onCloseMobile}
              className="p-1 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Search Query Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Location, Landmark or College
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="e.g. RVCE, Jayanagar, BMSCE..."
              value={filters.searchQuery}
              onChange={e => onChange({ searchQuery: e.target.value })}
              className="w-full bg-navy-950/80 border border-navy-750 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Gender / Resident Preference */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Tenant Type
          </label>
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-navy-950/90 rounded-xl border border-navy-800">
            {(['all', 'boys', 'girls', 'unisex'] as const).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => onChange({ gender: option })}
                className={`py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                  filters.gender === option
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {option === 'all' ? 'All' : option}
              </button>
            ))}
          </div>
        </div>

        {/* Monthly Budget Range */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Monthly Budget (₹)
            </label>
            <span className="text-xs text-brand-300 font-bold">
              ₹ {filters.minPrice.toLocaleString()} - ₹ {filters.maxPrice.toLocaleString()}
            </span>
          </div>

          <div className="space-y-3 pt-1">
            <input
              type="range"
              min="5000"
              max="25000"
              step="500"
              value={filters.maxPrice}
              onChange={e => onChange({ maxPrice: Number(e.target.value) })}
              className="w-full accent-brand-500 bg-navy-950 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex items-center gap-2 text-xs">
              <div className="flex-1">
                <span className="text-[10px] text-slate-400 block mb-1">Min (₹)</span>
                <input
                  type="number"
                  value={filters.minPrice}
                  onChange={e => onChange({ minPrice: Number(e.target.value) })}
                  className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <span className="text-slate-500 pt-3">-</span>
              <div className="flex-1">
                <span className="text-[10px] text-slate-400 block mb-1">Max (₹)</span>
                <input
                  type="number"
                  value={filters.maxPrice}
                  onChange={e => onChange({ maxPrice: Number(e.target.value) })}
                  className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Room Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Room Sharing Option
          </label>
          <div className="space-y-2">
            {roomTypeOptions.map(option => {
              const checked = filters.roomTypes.includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex items-center gap-2.5 text-xs text-slate-300 hover:text-white cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleRoomTypeToggle(option.value)}
                    className="w-4 h-4 rounded border-navy-700 bg-navy-950 text-brand-600 focus:ring-brand-500 cursor-pointer accent-brand-500"
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Food Availability */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Food Preference
          </label>
          <select
            value={filters.foodType}
            onChange={e => onChange({ foodType: e.target.value as 'all' | FoodType })}
            className="w-full bg-navy-950 border border-navy-750 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="all">Any Food Option</option>
            <option value="veg">Pure Vegetarian Food</option>
            <option value="both">Veg & Non-Veg Available</option>
            <option value="none">Self-Cooking / Without Food</option>
          </select>
        </div>

        {/* Amenities Checklist */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Key Amenities
          </label>
          <div className="grid grid-cols-2 gap-2">
            {amenityOptions.map(amenity => {
              const checked = filters.amenities.includes(amenity);
              return (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => handleAmenityToggle(amenity)}
                  className={`text-left text-xs px-2.5 py-1.5 rounded-lg border transition-all truncate flex items-center gap-1.5 ${
                    checked
                      ? 'bg-brand-600/20 text-brand-300 border-brand-500/40 font-medium'
                      : 'bg-navy-950/60 text-slate-400 border-navy-800 hover:border-navy-700'
                  }`}
                >
                  {checked && <Check className="w-3 h-3 shrink-0 text-brand-400" />}
                  <span className="truncate">{amenity}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Verification & Instant Availability Toggles */}
        <div className="pt-2 border-t border-navy-800 space-y-3">
          <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer select-none">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Verified Listings Only</span>
            </span>
            <input
              type="checkbox"
              checked={filters.verifiedOnly}
              onChange={e => onChange({ verifiedOnly: e.target.checked })}
              className="w-4 h-4 rounded border-navy-700 bg-navy-950 accent-emerald-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer select-none">
            <span>Only with Available Beds Now</span>
            <input
              type="checkbox"
              checked={filters.availableOnly}
              onChange={e => onChange({ availableOnly: e.target.checked })}
              className="w-4 h-4 rounded border-navy-700 bg-navy-950 accent-brand-500 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {isMobileModal && (
        <div className="mt-8 pt-4 border-t border-navy-800 sticky bottom-0 bg-navy-900">
          <Button variant="primary" className="w-full" onClick={onCloseMobile}>
            Apply Filters ({totalResultsCount || 0} Results)
          </Button>
        </div>
      )}
    </div>
  );
};
