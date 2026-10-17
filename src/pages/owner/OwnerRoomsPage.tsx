import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BedDouble,
  Plus,
  ArrowLeft,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users,
  Wind,
  Bath,
  Home
} from 'lucide-react';
import { Room, RoomType, PGListing } from '../../types';
import { listingsService } from '../../services/listingsService';
import { roomsService } from '../../services/roomsService';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';

export const OwnerRoomsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [ownerProperties, setOwnerProperties] = useState<PGListing[]>([]);
  const [activeListingId, setActiveListingId] = useState<string>(id || '');
  const [listing, setListing] = useState<PGListing | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);

  // Form Fields
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('double');
  const [capacity, setCapacity] = useState(10);
  const [availableBeds, setAvailableBeds] = useState(4);
  const [rentPerBed, setRentPerBed] = useState(9500);
  const [depositAmount, setDepositAmount] = useState(15000);
  const [attachedWashroom, setAttachedWashroom] = useState(true);
  const [hasBalcony, setHasBalcony] = useState(false);
  const [hasAC, setHasAC] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const properties = await listingsService.getOwnerListings(user.id);
      setOwnerProperties(properties);

      let targetId = id || activeListingId;
      if (!targetId && properties.length > 0) {
        targetId = properties[0].id;
        setActiveListingId(targetId);
      }

      if (targetId) {
        const data = await listingsService.getListingById(targetId);
        if (data && data.owner_id !== user.id && user.role !== 'admin') {
          showToast({
            type: 'error',
            title: 'Access Denied',
            message: 'You are not authorized to view or manage rooms for this property.',
          });
          setListing(null);
          setRooms([]);
          return;
        }
        setListing(data);
        setRooms(data?.rooms || []);
      } else {
        setListing(null);
        setRooms([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, activeListingId, user]);

  const openAddModal = () => {
    setEditingRoomId(null);
    setRoomName('Deluxe Sharing Room');
    setRoomType('double');
    setCapacity(10);
    setAvailableBeds(4);
    setRentPerBed(9500);
    setDepositAmount(15000);
    setAttachedWashroom(true);
    setHasBalcony(false);
    setHasAC(false);
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (room: Room) => {
    setEditingRoomId(room.id);
    setRoomName(room.room_name || '');
    setRoomType(room.room_type);
    setCapacity(room.total_capacity);
    setAvailableBeds(room.available_beds);
    setRentPerBed(room.rent_per_bed);
    setDepositAmount(room.deposit_amount);
    setAttachedWashroom(room.has_attached_washroom);
    setHasBalcony(room.has_balcony);
    setHasAC(room.is_air_conditioned);
    setErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (capacity < 1) errs.capacity = 'Capacity must be at least 1 bed';
    if (availableBeds < 0) errs.availableBeds = 'Available beds cannot be negative';
    if (availableBeds > capacity) {
      errs.availableBeds = 'Available beds cannot exceed total capacity';
    }
    if (rentPerBed < 0) errs.rentPerBed = 'Rent cannot be negative';
    if (depositAmount < 0) errs.depositAmount = 'Deposit cannot be negative';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const listingId = id || activeListingId;

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !listingId) return;

    try {
      if (editingRoomId) {
        await roomsService.updateRoom(listingId, editingRoomId, {
          room_name: roomName,
          room_type: roomType,
          total_capacity: Number(capacity),
          available_beds: Number(availableBeds),
          rent_per_bed: Number(rentPerBed),
          deposit_amount: Number(depositAmount),
          has_attached_washroom: attachedWashroom,
          has_balcony: hasBalcony,
          is_air_conditioned: hasAC,
        });

        showToast({
          type: 'success',
          title: 'Room Updated',
          message: `${roomName} inventory updated successfully.`,
          isMockPersisted: true,
        });
      } else {
        await roomsService.addRoom(listingId, {
          room_name: roomName,
          room_type: roomType,
          total_capacity: Number(capacity),
          available_beds: Number(availableBeds),
          rent_per_bed: Number(rentPerBed),
          deposit_amount: Number(depositAmount),
          room_amenities: [
            attachedWashroom ? 'Attached Washroom' : 'Common Washroom',
            hasAC ? 'AC Room' : 'Non-AC',
          ],
          has_attached_washroom: attachedWashroom,
          has_balcony: hasBalcony,
          is_air_conditioned: hasAC,
        });

        showToast({
          type: 'success',
          title: 'Room Added',
          message: `New ${roomType} room added to ${listing?.name}.`,
          isMockPersisted: true,
        });
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error saving room',
        message: err?.message || 'Operation failed',
      });
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!listingId) return;
    if (confirm('Are you sure you want to delete this room type configuration?')) {
      await roomsService.deleteRoom(listingId, roomId);
      showToast({
        type: 'info',
        title: 'Room Deleted',
        message: 'Room removed from property inventory',
        isMockPersisted: true,
      });
      loadData();
    }
  };

  if (!isLoading && !listing) {
    return (
      <div className="bg-navy-900 border border-navy-800 rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4 my-8 shadow-xl">
        <BedDouble className="w-12 h-12 text-slate-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">No Properties Found</h2>
        <p className="text-sm text-slate-400">
          You need to add a PG property first before configuring individual rooms and bed capacities.
        </p>
        <div className="pt-2">
          <Link to="/owner/listings/new">
            <Button variant="glow" size="md" leftIcon={<Plus className="w-4 h-4" />}>
              Add PG Listing
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-800">
        <div className="flex items-center gap-3">
          <Link
            to="/owner/listings"
            className="p-2 rounded-xl bg-navy-900 border border-navy-800 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <BedDouble className="w-5 h-5 text-violet-400" />
              <h1 className="text-2xl font-extrabold text-white">
                Rooms & Bed Inventory
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {listing?.name} — Manage capacity, pricing, and live bed vacancies
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {ownerProperties.length > 1 && (
            <select
              value={activeListingId}
              onChange={e => setActiveListingId(e.target.value)}
              className="bg-navy-950 border border-navy-750 rounded-xl px-3 py-2 text-xs text-white"
            >
              {ownerProperties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <Button
            variant="glow"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={openAddModal}
          >
            Add Room Category
          </Button>
        </div>
      </div>

      {/* Property Bed Totals Banner */}
      {listing && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-navy-900/80 border border-navy-800 shadow-lg">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Rooms</span>
            <p className="text-xl font-black text-white mt-0.5">{rooms.length}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Bed Capacity</span>
            <p className="text-xl font-black text-white mt-0.5">
              {rooms.reduce((acc, r) => acc + r.total_capacity, 0)}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Occupied Beds</span>
            <p className="text-xl font-black text-brand-300 mt-0.5">
              {rooms.reduce((acc, r) => acc + (r.total_capacity - r.available_beds), 0)}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Vacant / Available</span>
            <p className="text-xl font-black text-emerald-400 mt-0.5">
              {rooms.reduce((acc, r) => acc + r.available_beds, 0)}
            </p>
          </div>
        </div>
      )}

      {/* Rooms Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-sm text-slate-400">Loading room inventory...</div>
      ) : rooms.length === 0 ? (
        <div className="bg-navy-900/50 border border-dashed border-navy-800 rounded-3xl p-12 text-center max-w-md mx-auto space-y-3">
          <BedDouble className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">No rooms configured</h3>
          <p className="text-xs text-slate-400">Add single or sharing room categories for this property.</p>
          <Button variant="primary" size="sm" onClick={openAddModal}>
            Add First Room
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {rooms.map(room => {
            const occupied = room.total_capacity - room.available_beds;
            const occupancyRate = Math.round((occupied / room.total_capacity) * 100);

            return (
              <div
                key={room.id}
                className="bg-navy-900/90 border border-navy-800 rounded-3xl p-6 shadow-xl space-y-4"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-navy-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">
                        {room.room_name || `${room.room_type.toUpperCase()} Room`}
                      </h3>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20 capitalize font-medium">
                        {room.room_type} sharing
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span>Rent: <strong className="text-white">₹{room.rent_per_bed.toLocaleString('en-IN')}/bed</strong></span>
                      <span>•</span>
                      <span>Deposit: ₹{room.deposit_amount.toLocaleString('en-IN')}</span>
                      <span>•</span>
                      <span>{room.has_attached_washroom ? 'Attached Bath' : 'Common Bath'}</span>
                      <span>•</span>
                      <span>{room.is_air_conditioned ? 'AC' : 'Non-AC'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditModal(room)}
                      leftIcon={<Edit className="w-3.5 h-3.5" />}
                    >
                      Edit
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRoom(room.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-navy-800 rounded-xl transition-colors"
                      title="Delete room category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Live Bed Visualizer Matrix */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">
                      Live Bed Slots ({occupied}/{room.total_capacity} Occupied — {occupancyRate}%)
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {room.available_beds} Vacant Beds
                    </span>
                  </div>

                  <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 p-3 bg-navy-950/80 rounded-2xl border border-navy-850">
                    {Array.from({ length: room.total_capacity }).map((_, slotIdx) => {
                      const isOccupied = slotIdx < occupied;
                      return (
                        <div
                          key={slotIdx}
                          className={`p-2 rounded-xl text-center text-[10px] font-bold border transition-all ${
                            isOccupied
                              ? 'bg-navy-900 border-navy-800 text-slate-500'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-sm'
                          }`}
                          title={`Bed #${slotIdx + 1}: ${isOccupied ? 'Occupied' : 'Vacant'}`}
                        >
                          <BedDouble className="w-3.5 h-3.5 mx-auto mb-1" />
                          <span>#{slotIdx + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Room Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRoomId ? 'Edit Room Category' : 'Add New Room Category'}
        description="Configure bed capacity, pricing, and live vacant slots"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveRoom} className="space-y-4">
          <Input
            label="Room Category Name"
            value={roomName}
            onChange={e => setRoomName(e.target.value)}
            placeholder="e.g. Double Sharing AC Executive"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Sharing Type"
              value={roomType}
              onChange={e => setRoomType(e.target.value as any)}
            >
              <option value="single">Single Private Room</option>
              <option value="double">Double Sharing</option>
              <option value="triple">Triple Sharing</option>
              <option value="four_plus">4+ Sharing Dorm</option>
            </Select>

            <Input
              label="Total Bed Capacity (min 1)"
              type="number"
              min="1"
              value={capacity}
              onChange={e => setCapacity(Number(e.target.value))}
              error={errors.capacity}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Available Beds Now"
              type="number"
              min="0"
              max={capacity}
              value={availableBeds}
              onChange={e => setAvailableBeds(Number(e.target.value))}
              error={errors.availableBeds}
              required
            />
            <Input
              label="Monthly Rent / Bed (₹)"
              type="number"
              min="0"
              value={rentPerBed}
              onChange={e => setRentPerBed(Number(e.target.value))}
              error={errors.rentPerBed}
              required
            />
            <Input
              label="Deposit / Bed (₹)"
              type="number"
              min="0"
              value={depositAmount}
              onChange={e => setDepositAmount(Number(e.target.value))}
              error={errors.depositAmount}
              required
            />
          </div>

          <div className="pt-2 border-t border-navy-800 grid grid-cols-3 gap-3 text-xs">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={attachedWashroom}
                onChange={e => setAttachedWashroom(e.target.checked)}
                className="rounded border-navy-700 bg-navy-950 text-violet-600"
              />
              <span>Attached Bath</span>
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={hasAC}
                onChange={e => setHasAC(e.target.checked)}
                className="rounded border-navy-700 bg-navy-950 text-violet-600"
              />
              <span>Air Conditioned</span>
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={hasBalcony}
                onChange={e => setHasBalcony(e.target.checked)}
                className="rounded border-navy-700 bg-navy-950 text-violet-600"
              />
              <span>Balcony Access</span>
            </label>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-navy-800">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Room Configuration
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
