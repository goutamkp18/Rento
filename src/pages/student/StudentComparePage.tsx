import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Scale,
  X,
  Plus,
  Check,
  AlertCircle,
  MapPin,
  Utensils,
  ShieldCheck,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { useCompare } from '../../context/CompareContext';
import { PGListing } from '../../types';
import { listingsService } from '../../services/listingsService';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

export const StudentComparePage: React.FC = () => {
  const { compareListings, removeFromCompare, clearCompare, addToCompare } = useCompare();
  const [allListings, setAllListings] = useState<PGListing[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    listingsService.getListings().then(data => setAllListings(data));
  }, []);

  const availableToAdd = allListings.filter(
    l => !compareListings.some(item => item.id === l.id)
  );

  const calculateUpfrontCost = (listing: PGListing): string => {
    if (!listing.min_monthly_rent || !listing.security_deposit) return 'Not provided';
    const maint = listing.maintenance_charge || 0;
    const total = listing.min_monthly_rent + listing.security_deposit + maint;
    return `₹ ${total.toLocaleString('en-IN')}`;
  };

  const commonAmenitiesList = [
    'High-Speed Wi-Fi',
    'AC Rooms',
    'Homestyle Meals',
    'Attached Washroom',
    'Power Backup',
    'Daily Housekeeping',
    'Washing Machine',
    'Biometric Access',
    'CCTV Monitoring'
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-800">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-brand-400" />
            <h1 className="text-2xl font-extrabold text-white">Compare Accommodations</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Compare monthly rent, security deposits, room choices, and meal options side-by-side ({compareListings.length}/3 slots)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {compareListings.length < 3 && (
            <div className="relative">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setSelectorOpen(!selectorOpen)}
              >
                Add PG to Compare
              </Button>

              {selectorOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-navy-900 border border-navy-750 rounded-2xl shadow-2xl p-2 z-50">
                  <div className="px-3 py-2 text-xs font-bold text-slate-400 border-b border-navy-800 uppercase tracking-wider">
                    Select a PG to add
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1 mt-1">
                    {availableToAdd.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          addToCompare(item);
                          setSelectorOpen(false);
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-navy-800 text-xs flex items-center justify-between transition-colors"
                      >
                        <div className="truncate pr-2">
                          <p className="font-semibold text-white truncate">{item.name}</p>
                          <p className="text-slate-400 text-[10px]">{item.locality}</p>
                        </div>
                        <span className="text-brand-300 font-bold shrink-0">
                          ₹{item.min_monthly_rent}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {compareListings.length > 0 && (
            <button
              onClick={clearCompare}
              className="text-xs text-slate-400 hover:text-red-400 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Comparison Board or Empty State */}
      {compareListings.length === 0 ? (
        <div className="bg-navy-900/50 border border-dashed border-navy-800 rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto">
            <Scale className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white">No properties selected</h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Select up to 3 PGs from the search listings to view a complete side-by-side comparison of rent, food, deposit, and amenities.
          </p>
          <div className="pt-2">
            <Link to="/pgs">
              <Button variant="glow" size="md">
                Browse Student PGs
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto pb-6">
          <div className="min-w-[700px] bg-navy-900/90 border border-navy-800 rounded-3xl overflow-hidden shadow-2xl">
            
            {/* Table Header: Property Cards */}
            <div className="grid grid-cols-4 p-4 border-b border-navy-800 bg-navy-950/60">
              <div className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center">
                Property Details
              </div>
              {compareListings.map(listing => (
                <div key={listing.id} className="p-3 relative space-y-2">
                  <button
                    onClick={() => removeFromCompare(listing.id)}
                    className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white hover:bg-navy-800 rounded-full"
                    title="Remove from comparison"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <img
                    src={listing.images[0]?.image_url}
                    alt={listing.name}
                    className="w-full h-28 object-cover rounded-xl border border-navy-800"
                  />
                  <div>
                    <Badge variant={listing.gender_preference} size="sm" />
                    <h3 className="font-bold text-sm text-white mt-1 line-clamp-1">
                      {listing.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{listing.locality}</p>
                  </div>
                  <Link
                    to={`/pgs/${listing.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-400 hover:text-brand-300"
                  >
                    <span>View Property</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              ))}
              {/* Empty placeholder slot if < 3 */}
              {Array.from({ length: 3 - compareListings.length }).map((_, idx) => (
                <div
                  key={idx}
                  className="p-3 border border-dashed border-navy-800 rounded-2xl flex flex-col items-center justify-center text-center m-2 min-h-[160px]"
                >
                  <Plus className="w-6 h-6 text-slate-600 mb-1" />
                  <p className="text-xs text-slate-500 font-medium">Empty Slot</p>
                  <p className="text-[10px] text-slate-600">Add another PG to compare</p>
                </div>
              ))}
            </div>

            {/* Row: Monthly Rent */}
            <div className="grid grid-cols-4 p-4 border-b border-navy-800/80 items-center text-xs">
              <span className="font-semibold text-slate-300">Monthly Rent (from)</span>
              {compareListings.map(l => (
                <div key={l.id} className="p-2 font-black text-white text-base">
                  ₹ {l.min_monthly_rent.toLocaleString('en-IN')}
                  <span className="text-[10px] font-normal text-slate-400"> /mo</span>
                </div>
              ))}
              {Array.from({ length: 3 - compareListings.length }).map((_, idx) => (
                <div key={idx} className="p-2 text-slate-600">-</div>
              ))}
            </div>

            {/* Row: Refundable Security Deposit */}
            <div className="grid grid-cols-4 p-4 border-b border-navy-800/80 items-center text-xs bg-navy-950/30">
              <span className="font-semibold text-slate-300">Security Deposit</span>
              {compareListings.map(l => (
                <div key={l.id} className="p-2 text-slate-200 font-medium">
                  {l.security_deposit ? `₹ ${l.security_deposit.toLocaleString('en-IN')}` : 'Not provided'}
                </div>
              ))}
              {Array.from({ length: 3 - compareListings.length }).map((_, idx) => (
                <div key={idx} className="p-2 text-slate-600">-</div>
              ))}
            </div>

            {/* Row: Estimated Upfront Move-in Cost */}
            <div className="grid grid-cols-4 p-4 border-b border-navy-800/80 items-center text-xs">
              <div>
                <span className="font-semibold text-white">Estimated Upfront Cost</span>
                <p className="text-[10px] text-slate-400">Rent + Deposit + Maint.</p>
              </div>
              {compareListings.map(l => (
                <div key={l.id} className="p-2 font-bold text-emerald-400 text-sm">
                  {calculateUpfrontCost(l)}
                </div>
              ))}
              {Array.from({ length: 3 - compareListings.length }).map((_, idx) => (
                <div key={idx} className="p-2 text-slate-600">-</div>
              ))}
            </div>

            {/* Row: Room Types Available */}
            <div className="grid grid-cols-4 p-4 border-b border-navy-800/80 items-center text-xs bg-navy-950/30">
              <span className="font-semibold text-slate-300">Room Sharing Types</span>
              {compareListings.map(l => (
                <div key={l.id} className="p-2 text-slate-300 space-y-1">
                  {l.rooms.map(r => (
                    <div key={r.id} className="capitalize">
                      • {r.room_type} (₹{r.rent_per_bed})
                    </div>
                  ))}
                </div>
              ))}
              {Array.from({ length: 3 - compareListings.length }).map((_, idx) => (
                <div key={idx} className="p-2 text-slate-600">-</div>
              ))}
            </div>

            {/* Row: Food & Meals */}
            <div className="grid grid-cols-4 p-4 border-b border-navy-800/80 items-center text-xs">
              <span className="font-semibold text-slate-300">Food & Dining</span>
              {compareListings.map(l => (
                <div key={l.id} className="p-2 text-slate-300 space-y-1">
                  <p className="font-medium text-white capitalize">{l.food_type} Food</p>
                  <p className="text-[10px] text-slate-400">Meals: {l.meals_provided.join(', ')}</p>
                </div>
              ))}
              {Array.from({ length: 3 - compareListings.length }).map((_, idx) => (
                <div key={idx} className="p-2 text-slate-600">-</div>
              ))}
            </div>

            {/* Row: College Distance */}
            <div className="grid grid-cols-4 p-4 border-b border-navy-800/80 items-center text-xs bg-navy-950/30">
              <span className="font-semibold text-slate-300">Nearest College</span>
              {compareListings.map(l => (
                <div key={l.id} className="p-2 text-slate-300">
                  {l.nearby_colleges[0] ? (
                    <div>
                      <p className="font-medium text-white">{l.nearby_colleges[0].distance_km} km</p>
                      <p className="text-[10px] text-slate-400">{l.nearby_colleges[0].college_name}</p>
                    </div>
                  ) : (
                    'Not provided'
                  )}
                </div>
              ))}
              {Array.from({ length: 3 - compareListings.length }).map((_, idx) => (
                <div key={idx} className="p-2 text-slate-600">-</div>
              ))}
            </div>

            {/* Row: Verification Status */}
            <div className="grid grid-cols-4 p-4 border-b border-navy-800/80 items-center text-xs">
              <span className="font-semibold text-slate-300">Verification</span>
              {compareListings.map(l => (
                <div key={l.id} className="p-2">
                  <Badge variant={l.verification_status} size="sm" />
                </div>
              ))}
              {Array.from({ length: 3 - compareListings.length }).map((_, idx) => (
                <div key={idx} className="p-2 text-slate-600">-</div>
              ))}
            </div>

            {/* Row: Amenities Checklist */}
            <div className="p-4 border-b border-navy-800/80 bg-navy-950/40">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-400 block mb-3">
                Key Amenities Comparison
              </span>
              <div className="space-y-2">
                {commonAmenitiesList.map(amenity => (
                  <div key={amenity} className="grid grid-cols-4 text-xs py-1 border-t border-navy-800/40">
                    <span className="text-slate-400">{amenity}</span>
                    {compareListings.map(l => {
                      const has = l.amenities.some(a =>
                        a.toLowerCase().includes(amenity.toLowerCase())
                      );
                      return (
                        <div key={l.id} className="p-1">
                          {has ? (
                            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                              <Check className="w-3.5 h-3.5" />
                              <span>Yes</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">No</span>
                          )}
                        </div>
                      );
                    })}
                    {Array.from({ length: 3 - compareListings.length }).map((_, idx) => (
                      <div key={idx} className="p-1 text-slate-600">-</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
