import { Room } from '../types';
import { listingsService } from './listingsService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const roomsService = {
  async getRoomsByListingId(listingId: string): Promise<Room[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('listing_id', listingId);
        if (!error && data) return data as Room[];
      } catch (e) {
        console.warn('Supabase rooms query notice:', e);
      }
    }
    const listing = await listingsService.getListingById(listingId);
    return listing?.rooms || [];
  },

  async addRoom(listingId: string, newRoomData: Omit<Room, 'id' | 'listing_id'>): Promise<Room> {
    if (newRoomData.total_capacity < 1) {
      throw new Error('Total capacity must be at least 1');
    }
    if (newRoomData.available_beds > newRoomData.total_capacity) {
      throw new Error('Available beds cannot exceed total capacity');
    }
    if (newRoomData.rent_per_bed < 0) {
      throw new Error('Rent per bed cannot be negative');
    }

    const listing = await listingsService.getListingById(listingId);
    if (!listing) throw new Error('Listing not found');

    const room: Room = {
      ...newRoomData,
      id: `rm_${Date.now()}`,
      listing_id: listingId,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('rooms').insert([
          {
            id: room.id,
            listing_id: room.listing_id,
            room_type: room.room_type,
            room_name: room.room_name,
            monthly_rent: room.rent_per_bed,
            rent_per_bed: room.rent_per_bed,
            deposit_amount: room.deposit_amount,
            total_capacity: room.total_capacity,
            available_beds: room.available_beds,
            has_attached_washroom: room.has_attached_washroom,
            is_air_conditioned: room.is_air_conditioned,
            has_balcony: room.has_balcony,
            room_amenities: room.room_amenities,
          }
        ]);
      } catch (err) {
        console.warn('Supabase addRoom insert notice:', err);
      }
    }

    const updatedRooms = [...listing.rooms, room];
    await listingsService.updateListing(listingId, { rooms: updatedRooms });
    return room;
  },

  async updateRoom(listingId: string, roomId: string, updates: Partial<Room>): Promise<Room> {
    const listing = await listingsService.getListingById(listingId);
    if (!listing) throw new Error('Listing not found');

    const index = listing.rooms.findIndex(r => r.id === roomId);
    if (index === -1) throw new Error('Room not found');

    const current = listing.rooms[index];
    const updated: Room = { ...current, ...updates };

    if (updated.total_capacity < 1) {
      throw new Error('Total capacity must be at least 1');
    }
    if (updated.available_beds > updated.total_capacity) {
      throw new Error('Available beds cannot exceed total capacity');
    }
    if (updated.rent_per_bed < 0) {
      throw new Error('Rent cannot be negative');
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('rooms')
          .update({
            room_type: updated.room_type,
            room_name: updated.room_name,
            monthly_rent: updated.rent_per_bed,
            rent_per_bed: updated.rent_per_bed,
            deposit_amount: updated.deposit_amount,
            total_capacity: updated.total_capacity,
            available_beds: updated.available_beds,
            has_attached_washroom: updated.has_attached_washroom,
            is_air_conditioned: updated.is_air_conditioned,
            has_balcony: updated.has_balcony,
            room_amenities: updated.room_amenities,
          })
          .eq('id', roomId);
      } catch (err) {
        console.warn('Supabase updateRoom notice:', err);
      }
    }

    listing.rooms[index] = updated;
    await listingsService.updateListing(listingId, { rooms: listing.rooms });
    return updated;
  },

  async deleteRoom(listingId: string, roomId: string): Promise<boolean> {
    const listing = await listingsService.getListingById(listingId);
    if (!listing) return false;

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('rooms').delete().eq('id', roomId);
      } catch (err) {
        console.warn('Supabase deleteRoom notice:', err);
      }
    }

    const filtered = listing.rooms.filter(r => r.id !== roomId);
    await listingsService.updateListing(listingId, { rooms: filtered });
    return true;
  }
};
