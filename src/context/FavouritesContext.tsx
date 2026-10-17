import React, { createContext, useContext, useState, useEffect } from 'react';
import { favouritesService } from '../services/favouritesService';
import { useToast } from './ToastContext';

interface FavouritesContextType {
  favouriteIds: string[];
  isFavourite: (listingId: string) => boolean;
  toggleFavourite: (listingId: string, listingName?: string) => boolean;
  favouriteCount: number;
}

const FavouritesContext = createContext<FavouritesContextType | undefined>(undefined);

export const FavouritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    favouritesService.getFavouriteIds().then(ids => {
      setFavouriteIds(ids);
    });
  }, []);

  const isFavourite = (listingId: string): boolean => {
    return favouriteIds.includes(listingId);
  };

  const toggleFavourite = (listingId: string, listingName?: string): boolean => {
    const exists = favouriteIds.includes(listingId);
    const updated = exists ? favouriteIds.filter(id => id !== listingId) : [...favouriteIds, listingId];
    setFavouriteIds(updated);

    favouritesService.toggleFavourite(listingId).then(isAdded => {
      if (isAdded) {
        showToast({
          type: 'success',
          title: 'Saved to Favourites',
          message: listingName ? `${listingName} added to your saved stays` : 'Listing saved',
          isMockPersisted: true,
        });
      } else {
        showToast({
          type: 'info',
          title: 'Removed from Favourites',
          message: listingName ? `${listingName} removed from saved stays` : 'Listing removed',
          isMockPersisted: true,
        });
      }
    });

    return !exists;
  };

  return (
    <FavouritesContext.Provider
      value={{
        favouriteIds,
        isFavourite,
        toggleFavourite,
        favouriteCount: favouriteIds.length,
      }}
    >
      {children}
    </FavouritesContext.Provider>
  );
};

export function useFavourites(): FavouritesContextType {
  const context = useContext(FavouritesContext);
  if (!context) {
    throw new Error('useFavourites must be used within a FavouritesProvider');
  }
  return context;
}
