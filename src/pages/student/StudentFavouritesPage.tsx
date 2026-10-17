import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Compass, Trash2, ArrowRight } from 'lucide-react';
import { useFavourites } from '../../context/FavouritesContext';
import { PGListing } from '../../types';
import { favouritesService } from '../../services/favouritesService';
import { ListingCard } from '../../components/listings/ListingCard';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

export const StudentFavouritesPage: React.FC = () => {
  const { favouriteIds, toggleFavourite } = useFavourites();
  const [favouriteListings, setFavouriteListings] = useState<PGListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    favouritesService.getFavouriteListings().then(data => {
      setFavouriteListings(data);
      setIsLoading(false);
    });
  }, [favouriteIds]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-800">
        <div>
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-400 fill-current" />
            <h1 className="text-2xl font-extrabold text-white">Saved Favourites</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Properties you've bookmarked for your upcoming academic year ({favouriteListings.length} saved)
          </p>
        </div>

        <Link to="/pgs">
          <Button variant="secondary" size="sm" leftIcon={<Compass className="w-4 h-4" />}>
            Explore More PGs
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-sm text-slate-400">Loading saved properties...</div>
      ) : favouriteListings.length === 0 ? (
        <EmptyState
          icon={<Heart className="w-8 h-8" />}
          title="No saved properties yet"
          description="Click the heart icon on any PG card to bookmark accommodations for quick access and comparison."
          actionLabel="Browse Available PGs"
          onAction={() => window.location.assign('/pgs')}
          className="my-8"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {favouriteListings.map(listing => (
            <div key={listing.id} className="relative group/fav">
              <ListingCard listing={listing} layout="grid" />
              <button
                onClick={() => toggleFavourite(listing.id, listing.name)}
                className="absolute top-3 right-12 z-20 p-2 rounded-full bg-navy-950/80 hover:bg-red-500/80 text-slate-300 hover:text-white transition-all text-xs"
                title="Remove from saved"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
