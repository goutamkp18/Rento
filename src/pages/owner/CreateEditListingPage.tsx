import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  MapPin,
  IndianRupee,
  Utensils,
  ShieldCheck,
  Image as ImageIcon,
  Check,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Save,
  Send,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Edit3,
  Camera,
  Layers,
  BedDouble,
  Users,
  Clock,
  Sparkles,
  Eye,
  Info,
  Compass,
  AlertCircle,
  ExternalLink,
  Star,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { PGListing, GenderPreference, FoodType, PhotoCategory, OwnerDocument, Room, ListingRevision } from '../../types';
import { listingsService } from '../../services/listingsService';
import { storageService } from '../../services/storageService';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';


interface CategorizedPhoto {
  id: string;
  url: string;
  category: PhotoCategory;
  name: string;
  file?: File;
}

const PRESET_BANGALORE_LOCATIONS = [
  { name: 'RVCE / Kengeri', locality: 'Mylasandra / Kengeri', landmark: 'Behind RV College Metro', lat: 12.9238, lng: 77.4987, college: 'RV College of Engineering', dist: 0.8 },
  { name: 'BMSCE / Basavanagudi', locality: 'Basavanagudi', landmark: 'Near Bull Temple Road', lat: 12.9416, lng: 77.5654, college: 'BMS College of Engineering', dist: 0.5 },
  { name: 'PES / Banashankari', locality: 'Banashankari 3rd Stage', landmark: 'Near Outer Ring Road', lat: 12.9344, lng: 77.5345, college: 'PES University Ring Road Campus', dist: 0.6 },
  { name: 'Christ / Koramangala', locality: 'Koramangala 5th Block', landmark: 'Near Forum South Mall', lat: 12.9352, lng: 77.6245, college: 'Christ University Central Campus', dist: 1.2 },
  { name: 'Electronic City Tech Hub', locality: 'Electronic City Phase 1', landmark: 'Near Infosys Gate 1', lat: 12.8452, lng: 77.6602, college: 'IIIT Bangalore', dist: 1.0 },
  { name: 'HSR Layout Sector 4', locality: 'HSR Layout', landmark: 'Near BDA Complex', lat: 12.9121, lng: 77.6446, college: 'NIFT Bangalore', dist: 1.5 },
];

export const CreateEditListingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id && id !== 'new');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const {
    currentPlan,
    hasActiveSubscription,
    canAddListing,
    listingCount,
    listingLimit,
    capacityReason,
    trialInfo,
    isTrialActive,
    isTrialEligible,
    isTrialExpired,
    startTrialOnFirstListing,
    isLoading: isSubLoading,
    refreshSubscription,
  } = useSubscription();

  // Wizard Step Control: 1: Owner, 2: Address, 3: Pricing, 4: Photos, 5: Documents, 6: Review
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [pendingPublishForReview, setPendingPublishForReview] = useState<boolean>(true);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Property Revision Tracking & Existing Listing State
  const [existingListing, setExistingListing] = useState<PGListing | null>(null);
  const [activeRevision, setActiveRevision] = useState<ListingRevision | null>(null);
  const [isRevisionSubmittedModalOpen, setIsRevisionSubmittedModalOpen] = useState(false);

  // Interactive Room Inventory & Bed Management
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoomIndex, setEditingRoomIndex] = useState<number | null>(null);
  const [roomFormData, setRoomFormData] = useState<Partial<Room>>({
    room_type: 'double',
    room_name: 'Double Sharing Study Room',
    rent_per_bed: 8500,
    deposit_amount: 15000,
    total_capacity: 2,
    available_beds: 1,
    has_attached_washroom: true,
    is_air_conditioned: false,
    has_balcony: false,
    room_amenities: ['Study Desk', 'Lockers'],
  });

  // Photo editing and reordering state
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [isPhotoEditModalOpen, setIsPhotoEditModalOpen] = useState(false);
  const [photoEditName, setPhotoEditName] = useState('');
  const [photoEditCategory, setPhotoEditCategory] = useState<PhotoCategory>('exterior');

  const syncCapacityFromRooms = (roomList: Room[]) => {
    if (!roomList || roomList.length === 0) return;
    const tRooms = roomList.length;
    const tBeds = roomList.reduce((acc, r) => acc + (Number(r.total_capacity) || 0), 0);
    const aBeds = roomList.reduce((acc, r) => acc + (Number(r.available_beds) || 0), 0);
    const rents = roomList.map(r => Number(r.rent_per_bed) || 0).filter(r => r > 0);
    setTotalRooms(tRooms);
    setTotalBeds(tBeds);
    setAvailableBeds(aBeds);
    if (rents.length > 0) {
      setMinRent(Math.min(...rents));
      setMaxRent(Math.max(...rents));
    }
  };

  const handleOpenRoomModal = (index: number | null) => {
    setEditingRoomIndex(index);
    if (index !== null && rooms[index]) {
      setRoomFormData({ ...rooms[index] });
    } else {
      setRoomFormData({
        id: `rm_${Date.now()}_${rooms.length + 1}`,
        room_type: 'double',
        room_name: 'Double Sharing Study Room',
        rent_per_bed: minRent || 8500,
        deposit_amount: securityDeposit || 15000,
        total_capacity: 2,
        available_beds: 1,
        has_attached_washroom: true,
        is_air_conditioned: false,
        has_balcony: false,
        room_amenities: ['Study Desk', 'Lockers'],
      });
    }
    setIsRoomModalOpen(true);
  };

  const handleSaveRoom = () => {
    const totalCap = Number(roomFormData.total_capacity) || 1;
    const availBeds = Number(roomFormData.available_beds) || 0;
    const rent = Number(roomFormData.rent_per_bed) || 0;
    const deposit = Number(roomFormData.deposit_amount) || 0;

    if (totalCap < 1) {
      showToast({ type: 'error', title: 'Invalid Capacity', message: 'Total capacity must be at least 1 bed.' });
      return;
    }
    if (availBeds < 0) {
      showToast({ type: 'error', title: 'Invalid Vacancy', message: 'Available beds cannot be negative.' });
      return;
    }
    if (availBeds > totalCap) {
      showToast({ type: 'error', title: 'Exceeds Capacity', message: 'Available beds cannot exceed total capacity.' });
      return;
    }
    if (rent < 0) {
      showToast({ type: 'error', title: 'Invalid Rent', message: 'Monthly rent cannot be negative.' });
      return;
    }

    const newRoom: Room = {
      id: roomFormData.id || `rm_${Date.now()}`,
      listing_id: id || '',
      room_type: roomFormData.room_type || 'double',
      room_name: roomFormData.room_name?.trim() || `${roomFormData.room_type} Room`,
      rent_per_bed: rent,
      deposit_amount: deposit,
      total_capacity: totalCap,
      available_beds: availBeds,
      has_attached_washroom: Boolean(roomFormData.has_attached_washroom),
      is_air_conditioned: Boolean(roomFormData.is_air_conditioned),
      has_balcony: Boolean(roomFormData.has_balcony),
      room_amenities: roomFormData.room_amenities || ['Study Desk', 'Power Backup'],
    };

    let updatedRooms: Room[];
    if (editingRoomIndex !== null) {
      updatedRooms = rooms.map((r, i) => (i === editingRoomIndex ? newRoom : r));
    } else {
      updatedRooms = [...rooms, newRoom];
    }

    setRooms(updatedRooms);
    syncCapacityFromRooms(updatedRooms);
    setIsRoomModalOpen(false);
  };

  const handleDeleteRoom = (index: number) => {
    if (rooms.length <= 1) {
      showToast({ type: 'error', title: 'Room Required', message: 'A property must have at least one room configuration.' });
      return;
    }
    const updated = rooms.filter((_, i) => i !== index);
    setRooms(updated);
    syncCapacityFromRooms(updated);
  };

  const handleSetCoverPhoto = (photoId: string) => {
    setCategorizedPhotos(prev => {
      const idx = prev.findIndex(p => p.id === photoId);
      if (idx <= 0) return prev;
      const target = prev[idx];
      const rest = prev.filter(p => p.id !== photoId);
      return [target, ...rest];
    });
    showToast({
      type: 'success',
      title: 'Cover Photo Updated',
      message: 'Photograph set as primary cover image for student search results.',
    });
  };

  const handleMovePhoto = (index: number, direction: 'left' | 'right') => {
    setCategorizedPhotos(prev => {
      const newIdx = direction === 'left' ? index - 1 : index + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const clone = [...prev];
      const temp = clone[index];
      clone[index] = clone[newIdx];
      clone[newIdx] = temp;
      return clone;
    });
  };

  const handleOpenPhotoEdit = (index: number) => {
    setEditingPhotoIndex(index);
    const photo = categorizedPhotos[index];
    if (photo) {
      setPhotoEditName(photo.name);
      setPhotoEditCategory(photo.category);
      setIsPhotoEditModalOpen(true);
    }
  };

  const handleSavePhotoEdit = () => {
    if (editingPhotoIndex === null) return;
    setCategorizedPhotos(prev =>
      prev.map((p, idx) =>
        idx === editingPhotoIndex
          ? {
              ...p,
              name: photoEditName.trim() || p.name,
              category: photoEditCategory,
            }
          : p
      )
    );
    setIsPhotoEditModalOpen(false);
  };

  const handleDeleteCurrentListing = async () => {
    if (!id || !isEditing) return;
    setIsDeleting(true);
    try {
      await listingsService.deleteListing(id);
      showToast({
        type: 'success',
        title: 'Property Permanently Deleted',
        message: `"${name || 'Property'}" and all associated photos, rooms and data were deleted.`,
      });
      navigate('/owner/listings');
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Could not delete listing. Please try again.',
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  };


  // Mandatory subscription or 30-day free trial check & listing limit enforcement
  useEffect(() => {
    if (isEditing || isSubLoading) return;

    if (!hasActiveSubscription) {
      showToast({
        type: 'error',
        title: 'Subscription or Free Trial Required',
        message: 'A 30-day free trial or active subscription is required to register a PG property.',
      });
      navigate('/owner/plans', { replace: true });
    } else if (!canAddListing) {
      showToast({
        type: 'error',
        title: 'Listing Limit Reached',
        message: capacityReason || `You have reached the maximum allowed listings (${listingLimit} PG${listingLimit > 1 ? 's' : ''}). Please upgrade to add more.`,
      });
      navigate('/owner/subscription', { replace: true });
    }
  }, [isEditing, isSubLoading, hasActiveSubscription, canAddListing, listingLimit, capacityReason, navigate, showToast]);

  // STEP A: OWNER INFORMATION
  const [ownerFullName, setOwnerFullName] = useState(user?.full_name || '');
  const [ownerEmail, setOwnerEmail] = useState(user?.email || '');
  const [ownerPhone, setOwnerPhone] = useState(user?.phone || '');
  const [ownerType, setOwnerType] = useState<'individual' | 'property_manager'>(user?.owner_type || 'individual');
  const [businessName, setBusinessName] = useState(user?.business_name || '');

  useEffect(() => {
    if (user) {
      if (user.full_name && !ownerFullName) setOwnerFullName(user.full_name);
      if (user.email && !ownerEmail) setOwnerEmail(user.email);
      if (user.phone && !ownerPhone) setOwnerPhone(user.phone);
      if (user.business_name && !businessName) setBusinessName(user.business_name);
    }
  }, [user]);

  // STEP B: PROPERTY ADDRESS & LOCATION
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [propertyType, setPropertyType] = useState<'pg' | 'hostel' | 'coliving'>('pg');
  const [address, setAddress] = useState('');
  const [locality, setLocality] = useState('');
  const [city, setCity] = useState('Bangalore');
  const [state, setState] = useState('Karnataka');
  const [postalCode, setPostalCode] = useState('560060');
  const [landmark, setLandmark] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [collegeName, setCollegeName] = useState('RV College of Engineering');
  const [collegeDistance, setCollegeDistance] = useState(0.8);
  const [selectedMapPin, setSelectedMapPin] = useState(PRESET_BANGALORE_LOCATIONS[0]);

  // STEP C: PRICING & ACCOMMODATION
  const [minRent, setMinRent] = useState<number>(8500);
  const [maxRent, setMaxRent] = useState<number>(14000);
  const [securityDeposit, setSecurityDeposit] = useState<number>(15000);
  const [maintenance, setMaintenance] = useState<number>(500);
  const [electricityPolicy, setElectricityPolicy] = useState('Sub-metered ₹10/unit consumed.');
  const [noticePeriod, setNoticePeriod] = useState<number>(30);
  const [genderPreference, setGenderPreference] = useState<GenderPreference>('unisex');
  const [foodType, setFoodType] = useState<FoodType>('both');
  const [foodDescription, setFoodDescription] = useState('Homestyle North & South Indian meals (Breakfast & Dinner daily, Lunch on weekends).');

  // Room Capacities & Bed Matrix
  const [singleRooms, setSingleRooms] = useState<number>(4);
  const [doubleRooms, setDoubleRooms] = useState<number>(6);
  const [tripleRooms, setTripleRooms] = useState<number>(2);
  const [totalRooms, setTotalRooms] = useState<number>(12);
  const [totalBeds, setTotalBeds] = useState<number>(22);
  const [availableBeds, setAvailableBeds] = useState<number>(7);

  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    'High-Speed Wi-Fi',
    'Attached Washroom',
    'Daily Housekeeping',
    'Power Backup',
    'RO Purified Water',
    'Biometric Access',
    'CCTV Monitoring',
    'Meals Included'
  ]);

  const [rules, setRules] = useState<string[]>([
    'Gate curfew at 10:30 PM (extension permitted with parent notice)',
    'Quiet studying hours in corridors after 11:00 PM',
    'No smoking or substance consumption on property premises',
    'Visitors allowed in designated common lounges only'
  ]);
  const [newRule, setNewRule] = useState('');

  // STEP D: PROPERTY PHOTOGRAPHS (Categorized)
  const [activePhotoCategory, setActivePhotoCategory] = useState<PhotoCategory>('exterior');
  const [categorizedPhotos, setCategorizedPhotos] = useState<CategorizedPhoto[]>([]);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [photoNameInput, setPhotoNameInput] = useState('');

  // STEP E: IDENTITY & PROPERTY DOCUMENTATION CHECKLIST
  const [documents, setDocuments] = useState<OwnerDocument[]>([
    {
      id: 'doc_id',
      category: 'identity',
      document_name: 'Government Identity Proof / Owner Authorization',
      title: 'Government Identity Proof / Owner Authorization',
      description: 'Demonstration of owner ID (Driving License / Passport / PAN Card).',
      file_name: 'sample_owner_id_card.pdf',
      status: 'uploaded',
      is_sample: true
    },
    {
      id: 'doc_prop',
      category: 'ownership',
      document_name: 'Ownership Deed or Property Management Agreement',
      title: 'Ownership Deed or Property Management Agreement',
      description: 'Validates legal tenancy rights or property management delegation.',
      file_name: 'sample_property_agreement.pdf',
      status: 'uploaded',
      is_sample: true
    },
    {
      id: 'doc_addr',
      category: 'address',
      document_name: 'Premises Address Verification (Utility / Tax Bill)',
      title: 'Premises Address Verification (Utility / Tax Bill)',
      description: 'Recent BESCOM electricity bill or Municipal tax challan.',
      file_name: 'sample_bescom_receipt.pdf',
      status: 'uploaded',
      is_sample: true
    }
  ]);

  // Load existing data if editing
  useEffect(() => {
    if (isEditing && id) {
      listingsService.getListingById(id).then(async listing => {
        if (!listing) return;
        setExistingListing(listing);

        // Security / BOLA check: Ensure caller owns the listing
        if (user && user.role !== 'admin' && listing.owner_id !== user.id) {
          showToast({
            type: 'error',
            title: 'Access Denied',
            message: 'You are not authorized to modify another owner\'s property listing.',
          });
          navigate('/owner/listings', { replace: true });
          return;
        }

        // Check for active pending or rejected revision
        let revisionToUse: ListingRevision | null = null;
        try {
          revisionToUse = await listingsService.getListingRevision(id);
          if (revisionToUse) {
            setActiveRevision(revisionToUse);
          }
        } catch (revErr) {
          console.warn('Listing revision fetch notice:', revErr);
        }

        const sourceData: Partial<PGListing> = (revisionToUse && (revisionToUse.status === 'pending_review' || revisionToUse.status === 'under_review' || revisionToUse.status === 'draft' || revisionToUse.status === 'rejected'))
          ? { ...listing, ...revisionToUse.proposed_changes }
          : listing;

        setName(sourceData.name || listing.name);
        setTagline(sourceData.tagline || listing.tagline);
        setDescription(sourceData.description || listing.description);
        setPropertyType(sourceData.property_type as any || listing.property_type);
        setGenderPreference(sourceData.gender_preference || listing.gender_preference);
        setAddress(sourceData.address || listing.address);
        setLocality(sourceData.locality || listing.locality);
        setCity(sourceData.city || listing.city);
        setPostalCode(sourceData.postal_code || listing.postal_code);
        setLandmark(sourceData.landmark || listing.landmark);
        if (sourceData.google_maps_url) setGoogleMapsUrl(sourceData.google_maps_url);
        if (sourceData.nearby_colleges && sourceData.nearby_colleges[0]) {
          setCollegeName(sourceData.nearby_colleges[0].college_name);
          setCollegeDistance(sourceData.nearby_colleges[0].distance_km);
        }
        setMinRent(sourceData.min_monthly_rent || listing.min_monthly_rent);
        setMaxRent(sourceData.max_monthly_rent || listing.max_monthly_rent);
        setSecurityDeposit(sourceData.security_deposit || listing.security_deposit);
        setMaintenance(sourceData.maintenance_charge || listing.maintenance_charge || 0);
        setElectricityPolicy(sourceData.electricity_policy || listing.electricity_policy);
        setNoticePeriod(sourceData.notice_period_days || listing.notice_period_days);
        setFoodType(sourceData.food_type || listing.food_type);
        setFoodDescription(sourceData.food_description || listing.food_description || '');
        setSelectedAmenities(sourceData.amenities || listing.amenities);
        setRules(sourceData.house_rules || listing.house_rules);

        if (sourceData.owner_name) setOwnerFullName(sourceData.owner_name);
        if (sourceData.owner_email) setOwnerEmail(sourceData.owner_email);
        if (sourceData.owner_phone) setOwnerPhone(sourceData.owner_phone);
        if (sourceData.owner_type) setOwnerType(sourceData.owner_type);
        if (sourceData.business_name) setBusinessName(sourceData.business_name);

        // Convert listing images to categorized photos
        const imagesList = sourceData.images && sourceData.images.length > 0 ? sourceData.images : listing.images;
        if (imagesList && imagesList.length > 0) {
          const catPhotos: CategorizedPhoto[] = imagesList.map((img, i) => ({
            id: img.id || `img_${i}`,
            url: img.image_url,
            category: (img.category as PhotoCategory) || (i === 0 ? 'exterior' : 'bedroom'),
            name: img.caption || `Property Photo ${i + 1}`
          }));
          setCategorizedPhotos(catPhotos);
        }

        // Initialize rooms
        const roomsList = sourceData.rooms && sourceData.rooms.length > 0 ? sourceData.rooms : listing.rooms;
        if (roomsList && roomsList.length > 0) {
          setRooms(roomsList);
          syncCapacityFromRooms(roomsList);
        } else {
          const initialRooms: Room[] = [
            {
              id: `rm_${Date.now()}_1`,
              listing_id: id,
              room_type: 'single',
              room_name: 'Single Private Room',
              rent_per_bed: listing.max_monthly_rent || 14000,
              deposit_amount: listing.security_deposit || 15000,
              total_capacity: 4,
              available_beds: 2,
              has_attached_washroom: true,
              is_air_conditioned: listing.amenities?.includes('AC Rooms') || false,
              has_balcony: true,
              room_amenities: ['Study Desk', 'Wardrobe', 'Power Backup'],
            },
            {
              id: `rm_${Date.now()}_2`,
              listing_id: id,
              room_type: 'double',
              room_name: 'Double Sharing Study Room',
              rent_per_bed: listing.min_monthly_rent || 8500,
              deposit_amount: listing.security_deposit || 15000,
              total_capacity: 12,
              available_beds: 5,
              has_attached_washroom: true,
              is_air_conditioned: false,
              has_balcony: false,
              room_amenities: ['Study Desks', 'Lockers'],
            }
          ];
          setRooms(initialRooms);
          syncCapacityFromRooms(initialRooms);
        }
      });
    }
  }, [id, isEditing]);

  // Handle Preset Map Click
  const handleSelectPresetLocation = (loc: typeof PRESET_BANGALORE_LOCATIONS[0]) => {
    setSelectedMapPin(loc);
    setLocality(loc.locality);
    setLandmark(loc.landmark);
    setCollegeName(loc.college);
    setCollegeDistance(loc.dist);
  };

  // Amenity Toggle
  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev =>
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
  };

  // House Rule Add/Remove
  const handleAddRule = () => {
    if (newRule.trim()) {
      setRules(prev => [...prev, newRule.trim()]);
      setNewRule('');
    }
  };

  const handleRemoveRule = (index: number) => {
    setRules(prev => prev.filter((_, i) => i !== index));
  };

  // Add Photo via URL
  const handleAddPhotoUrl = () => {
    if (!photoUrlInput.trim()) return;
    const newP: CategorizedPhoto = {
      id: `photo_${Date.now()}`,
      url: photoUrlInput.trim(),
      category: activePhotoCategory,
      name: photoNameInput.trim() || `${activePhotoCategory.charAt(0).toUpperCase() + activePhotoCategory.slice(1)} view`
    };
    setCategorizedPhotos(prev => [...prev, newP]);
    setPhotoUrlInput('');
    setPhotoNameInput('');
  };

  // File Upload (Drag & Drop or file select)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let addedCount = 0;
    Array.from(files).forEach((file, idx) => {
      const validation = storageService.validateImageFile(file);
      if (!validation.valid) {
        showToast({
          type: 'error',
          title: 'Invalid File',
          message: validation.error || `${file.name} is not a supported image.`,
        });
        return;
      }

      // Generate local preview URL and store File object for upload on save
      const previewUrl = URL.createObjectURL(file);
      const newP: CategorizedPhoto = {
        id: `upload_${Date.now()}_${idx}`,
        url: previewUrl,
        category: activePhotoCategory,
        name: file.name,
        file: file,
      };
      setCategorizedPhotos(prev => [...prev, newP]);
      addedCount++;
    });

    if (addedCount > 0) {
      showToast({
        type: 'success',
        title: 'Photos Selected',
        message: `${addedCount} photo(s) selected and queued for Supabase Storage upload on save.`,
      });
    }

    // Reset file input value
    e.target.value = '';
  };


  const handleRemovePhoto = (idToRemove: string) => {
    setCategorizedPhotos(prev => prev.filter(p => p.id !== idToRemove));
  };

  // Document Checklist Toggle
  const toggleDocumentUploaded = (docId: string) => {
    setDocuments(prev =>
      prev.map(d =>
        d.id === docId
          ? {
              ...d,
              status: d.status === 'uploaded' ? 'pending' : 'uploaded',
              file_name: d.status === 'uploaded' ? undefined : `sample_${d.category}_doc.pdf`
            }
          : d
      )
    );
  };

  // STEP VALIDATION LOGIC
  const validateCurrentStep = (stepToValidate: number): boolean => {
    const errs: { [key: string]: string } = {};

    if (stepToValidate === 1) {
      if (!ownerFullName.trim()) errs.ownerName = 'Full name is required';
      if (!ownerEmail.trim()) errs.ownerEmail = 'Valid email is required';
      if (!ownerPhone.trim()) errs.ownerPhone = 'Phone number is required';
    }

    if (stepToValidate === 2) {
      if (!name.trim()) errs.name = 'PG / Property name is required';
      if (!address.trim()) errs.address = 'Street address is required';
      if (!locality.trim()) errs.locality = 'Locality is required';
      if (!postalCode.trim() || postalCode.length < 6) errs.postalCode = 'Valid 6-digit PIN code required';
      if (!collegeName.trim()) errs.collegeName = 'Nearby college is required';
    }

    if (stepToValidate === 3) {
      if (minRent <= 0) errs.minRent = 'Rent must be greater than ₹0';
      if (maxRent < minRent) errs.maxRent = 'Max rent cannot be lower than Min rent';
      if (securityDeposit < 0) errs.securityDeposit = 'Deposit cannot be negative';
      if (totalRooms <= 0) errs.totalRooms = 'Total rooms must be at least 1';
      if (totalBeds <= 0) errs.totalBeds = 'Total beds must be at least 1';
      if (availableBeds < 0) errs.availableBeds = 'Available beds cannot be negative';
      if (availableBeds > totalBeds) errs.availableBeds = 'Available beds cannot exceed total capacity';
    }

    if (stepToValidate === 4) {
      if (categorizedPhotos.length === 0) {
        errs.photos = 'Please provide at least one photograph of the property';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNextStep = () => {
    if (validateCurrentStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 6));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePreviousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // SAVE AS DRAFT OR SUBMIT FOR REVIEW
  const handleSaveListing = async (publishForReview: boolean) => {
    // Validate required steps if submitting for review
    if (publishForReview) {
      if (!validateCurrentStep(1) || !validateCurrentStep(2) || !validateCurrentStep(3) || !validateCurrentStep(4)) {
        showToast({
          type: 'error',
          title: 'Incomplete Submission',
          message: 'Please resolve errors in the highlighted sections before submitting for review.'
        });
        return;
      }
    }

    if (!user) {
      showToast({
        type: 'error',
        title: 'Sign In Required',
        message: 'Please sign in to your owner account to save and submit listings.',
      });
      return;
    }

    // Check if Supabase session is active
    if (isSupabaseConfigured && supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        setPendingPublishForReview(publishForReview);
        setAuthError(null);
        setAuthPassword('');
        setIsAuthPromptOpen(true);
        return;
      }
    }

    await executeSaveListing(publishForReview);
  };

  const handleInlineAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authPassword) {
      setAuthError('Please enter your account password.');
      return;
    }
    if (!supabase) return;

    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const emailToUse = user?.email || ownerEmail.trim();
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: authPassword,
      });

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          setAuthError(
            "Your email has not been confirmed in Supabase. In the Supabase Dashboard, toggle OFF 'Confirm email' (Authentication -> Providers -> Email), or run: UPDATE auth.users SET email_confirmed_at = NOW(); in SQL Editor."
          );
        } else {
          setAuthError(error.message);
        }
        return;
      }

      if (authData.session) {
        setIsAuthPromptOpen(false);
        setAuthPassword('');
        showToast({
          type: 'success',
          title: 'Session Authenticated',
          message: 'Authenticated with Supabase. Saving your listing...',
        });
        await executeSaveListing(pendingPublishForReview);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const executeSaveListing = async (publishForReview: boolean) => {
    setIsLoading(true);
    setUploadStatusText('Processing property details and photos...');

    const targetListingId = isEditing && id ? id : `pg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Upload photo files to Supabase Storage bucket: property-images
    const uploadedStoragePaths: string[] = [];
    const finalImages: {
      id: string;
      image_url: string;
      caption: string;
      category: PhotoCategory;
      display_order: number;
      is_primary: boolean;
    }[] = [];

    for (let idx = 0; idx < categorizedPhotos.length; idx++) {
      const photo = categorizedPhotos[idx];
      let finalImageUrl = photo.url;

      if (photo.file) {
        setUploadStatusText(`Uploading photo ${idx + 1} of ${categorizedPhotos.length}: ${photo.name}...`);
        try {
          const uploadRes = await storageService.uploadPropertyImage(
            user?.id || existingListing?.owner_id || 'owner_uploads',
            targetListingId,
            photo.file
          );
          finalImageUrl = uploadRes.publicUrl;
          uploadedStoragePaths.push(uploadRes.path);
        } catch (uploadErr: any) {
          console.warn('Storage upload notice:', uploadErr);
        }
      }

      finalImages.push({
        id: photo.id.startsWith('upload_') || photo.id.startsWith('p') ? `img_${Date.now()}_${idx}` : photo.id,
        image_url: finalImageUrl,
        caption: photo.name,
        category: photo.category,
        display_order: idx + 1,
        is_primary: idx === 0,
      });
    }

    // 2. Prepare room records ensuring valid IDs & capacities
    const finalRooms: Room[] = rooms.length > 0 ? rooms.map((r, rIdx) => ({
      ...r,
      id: r.id || `rm_${Date.now()}_${rIdx}`,
      listing_id: targetListingId,
      total_capacity: Number(r.total_capacity) || 1,
      available_beds: Number(r.available_beds) || 0,
      rent_per_bed: Number(r.rent_per_bed) || minRent,
      deposit_amount: Number(r.deposit_amount) || securityDeposit,
    })) : [
      {
        id: `room_s_${Date.now()}`,
        listing_id: targetListingId,
        room_type: 'single',
        room_name: 'Single Private Room',
        rent_per_bed: Number(maxRent) || 14000,
        deposit_amount: Number(securityDeposit) || 15000,
        total_capacity: Number(singleRooms) || 4,
        available_beds: Math.min(2, Number(singleRooms) || 4),
        has_attached_washroom: true,
        is_air_conditioned: selectedAmenities.includes('AC Rooms'),
        has_balcony: true,
        room_amenities: ['Study Desk', 'Wardrobe', 'Power Backup'],
      },
      {
        id: `room_d_${Date.now()}`,
        listing_id: targetListingId,
        room_type: 'double',
        room_name: 'Double Sharing Study Room',
        rent_per_bed: Number(minRent) || 8500,
        deposit_amount: Number(securityDeposit) || 15000,
        total_capacity: (Number(doubleRooms) || 6) * 2,
        available_beds: Number(availableBeds) || 5,
        has_attached_washroom: true,
        is_air_conditioned: false,
        has_balcony: false,
        room_amenities: ['Study Desks', 'Lockers'],
      },
    ];

    const listingPayload: Partial<PGListing> = {
      id: targetListingId,
      owner_id: user?.id,
      owner_name: ownerFullName.trim() || user?.full_name || '',
      owner_phone: ownerPhone.trim() || user?.phone || '',
      owner_email: ownerEmail.trim() || user?.email || '',
      owner_type: ownerType,
      business_name: businessName.trim() || user?.business_name || '',
      name: name.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      property_type: propertyType,
      gender_preference: genderPreference,
      address: address.trim(),
      locality: locality.trim(),
      city: city.trim(),
      state: state.trim(),
      postal_code: postalCode.trim(),
      landmark: landmark.trim(),
      google_maps_url: googleMapsUrl.trim(),
      nearby_colleges: collegeName.trim()
        ? [{ college_name: collegeName.trim(), distance_km: Number(collegeDistance) || 1 }]
        : [],
      min_monthly_rent: Number(minRent) || 0,
      max_monthly_rent: Number(maxRent) || 0,
      security_deposit: Number(securityDeposit) || 0,
      maintenance_charge: Number(maintenance) || 0,
      electricity_policy: electricityPolicy,
      notice_period_days: Number(noticePeriod) || 30,
      lock_in_months: 1,
      food_type: foodType,
      meals_provided: foodType === 'none' ? [] : ['breakfast', 'dinner'],
      food_description: foodDescription,
      amenities: selectedAmenities,
      house_rules: rules,
      rooms: finalRooms,
      images: finalImages as any,
    };

    try {
      if (isEditing && id) {
        // EDIT EXISTING LISTING
        if (publishForReview) {
          // Submit proposed edits to admin review queue
          setUploadStatusText('Submitting proposed changes to admin verification queue...');
          const result = await listingsService.submitListingChangesForVerification(id, listingPayload, user);
          if (result.revision) {
            setActiveRevision(result.revision);
          }
          showToast({
            type: 'success',
            title: 'Submitted for Verification',
            message: `Proposed changes for "${name}" submitted to admin queue. Live listing continues showing approved details.`,
          });
          setIsRevisionSubmittedModalOpen(true);
        } else {
          // Save draft of unfinished edits
          setUploadStatusText('Saving draft edits...');
          const result = await listingsService.saveListingDraft(id, listingPayload, user);
          if (result.revision) {
            setActiveRevision(result.revision);
          }
          showToast({
            type: 'info',
            title: 'Draft Saved',
            message: `Unfinished changes for "${name}" saved safely as draft.`,
          });
          navigate('/owner/listings');
        }
      } else {
        // CREATE NEW LISTING
        setUploadStatusText('Saving new property listing...');
        listingPayload.publication_status = publishForReview ? 'pending_review' : 'draft';
        listingPayload.verification_status = publishForReview ? 'pending_verification' : 'owner_submitted';

        const savedListing = await listingsService.createListing(listingPayload, user);
        const actualListingId = savedListing.id || targetListingId;

        // Save image metadata rows
        if (finalImages.length > 0) {
          await listingsService.saveListingImages(actualListingId, finalImages);
        }

        showToast({
          type: 'success',
          title: publishForReview ? 'Submitted for Review' : 'Draft Saved',
          message: publishForReview
            ? `${name} submitted for review. 30-Day Free Trial countdown active!`
            : `${name} saved as draft in Supabase.`,
        });

        if (publishForReview) {
          try {
            await startTrialOnFirstListing();
          } catch (trialErr) {
            console.warn('Could not trigger trial start on listing submission:', trialErr);
          }
          setIsSubmitConfirmOpen(true);
        } else {
          navigate('/owner/dashboard');
        }
      }

      // Update local state with the final URLs
      setCategorizedPhotos(
        finalImages.map(img => ({
          id: img.id,
          url: img.image_url,
          category: img.category,
          name: img.caption,
        }))
      );

      await refreshSubscription();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Action Failed',
        message: err?.message || 'Could not save listing. Please check required fields.',
      });
    } finally {
      setIsLoading(false);
      setUploadStatusText('');
    }
  };



  const stepsList = [
    { number: 1, code: 'A', title: 'Owner Info', desc: 'Host profile' },
    { number: 2, code: 'B', title: 'Property Address', desc: 'Location & Map' },
    { number: 3, code: 'C', title: 'Pricing & Beds', desc: 'Rates & capacity' },
    { number: 4, code: 'D', title: 'Photographs', desc: 'Categorized upload' },
    { number: 5, code: 'E', title: 'Documentation', desc: 'Audit checklist' },
    { number: 6, code: 'F', title: 'Review & Submit', desc: 'Final approval' },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      
      {/* Top Navigation & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-800">
        <div className="flex items-center gap-3">
          <Link
            to="/owner/dashboard"
            className="p-2.5 rounded-xl bg-navy-900 border border-navy-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white">
                {isEditing ? `Edit: ${name || 'Listing'}` : 'Register & Onboard New PG'}
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                Demo SaaS Wizard
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Step {currentStep} of 6 — {stepsList[currentStep - 1]?.title}
            </p>
          </div>
        </div>

        {/* Global Quick Actions & Plan Entitlement Pill */}
        <div className="flex flex-wrap items-center gap-2">
          {currentPlan && (
            <div className="hidden sm:inline-flex items-center gap-2 text-xs text-slate-300 bg-navy-900 px-3 py-1.5 rounded-xl border border-navy-800 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Plan: <strong className="text-white">{currentPlan.name}</strong></span>
              <span className="text-slate-600">•</span>
              <span className="text-violet-300 font-medium">
                {listingCount} of {listingLimit === Infinity ? 'Unlimited' : `${listingLimit} PGs`}
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSaveListing(false)}
            isLoading={isLoading}
            leftIcon={<Save className="w-3.5 h-3.5" />}
          >
            Save Draft
          </Button>
          {currentStep === 6 && (
            <Button
              type="button"
              variant="glow"
              size="sm"
              onClick={() => handleSaveListing(true)}
              isLoading={isLoading}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              {isEditing ? 'Submit Changes for Verification' : 'Submit for Review'}
            </Button>
          )}
        </div>
      </div>

      {/* REVISION & VERIFICATION STATUS BANNERS */}
      {isEditing && activeRevision && (activeRevision.status === 'pending_review' || activeRevision.status === 'under_review') && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-white">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Proposed Changes Awaiting Admin Verification</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
              {activeRevision.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-[11px] text-slate-300">
            You submitted edits for this property on <strong>{new Date(activeRevision.submission_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</strong>.
            The moderation team is currently verifying the proposed updates, room configurations, and photos.
          </p>
          <div className="p-2.5 rounded-xl bg-navy-950/80 border border-amber-500/20 text-[11px] text-slate-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Student Visibility Guarantee:</strong> Your published listing remains live for students with its previously approved details. Unapproved edits will not be shown to students until verified. You can update your submission and save changes again at any time.
            </span>
          </div>
        </div>
      )}

      {isEditing && activeRevision && activeRevision.status === 'rejected' && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-white">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>Previous Proposed Edits Were Rejected by Admin</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40">
              Revision Declined
            </span>
          </div>
          <div className="p-3 rounded-xl bg-navy-950/80 border border-red-500/20 text-xs text-white">
            <span className="text-red-400 font-bold block mb-1">Moderator Feedback / Reason:</span>
            <p className="italic text-slate-200">"{activeRevision.rejection_reason || 'Please correct the flagged details and resubmit.'}"</p>
          </div>
          <p className="text-[11px] text-slate-300">
            Please make the required adjustments based on the moderator's notes above, then click <strong>"Submit Changes for Verification"</strong> to resubmit.
          </p>
        </div>
      )}

      {isEditing && !activeRevision && existingListing && existingListing.rejection_reason && existingListing.publication_status === 'rejected' && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-white">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>Property Listing Was Rejected</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40">
              Rejected
            </span>
          </div>
          <div className="p-3 rounded-xl bg-navy-950/80 border border-red-500/20 text-xs text-white">
            <span className="text-red-400 font-bold block mb-1">Rejection Feedback:</span>
            <p className="italic text-slate-200">"{existingListing.rejection_reason}"</p>
          </div>
        </div>
      )}

      {/* Progress Indicator Stepper */}
      <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
        {/* Progress Bar */}
        <div className="w-full bg-navy-950 rounded-full h-2 overflow-hidden border border-navy-800/60">
          <div
            className="bg-gradient-to-r from-brand-500 to-violet-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / 6) * 100}%` }}
          />
        </div>

        {/* Step Icons & Labels */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {stepsList.map(step => {
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;

            return (
              <button
                key={step.number}
                type="button"
                onClick={() => {
                  // Only allow jumping back or to immediate next if validated
                  if (step.number < currentStep || validateCurrentStep(currentStep)) {
                    setCurrentStep(step.number);
                  }
                }}
                className={`p-2.5 rounded-2xl text-left transition-all border ${
                  isActive
                    ? 'bg-violet-600/20 border-violet-500 text-white shadow-lg'
                    : isCompleted
                    ? 'bg-navy-950/80 border-emerald-500/30 text-slate-300'
                    : 'bg-navy-950/40 border-navy-800/60 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      isActive
                        ? 'bg-violet-500 text-white'
                        : isCompleted
                        ? 'bg-emerald-500 text-navy-950'
                        : 'bg-navy-800 text-slate-400'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3 h-3" /> : step.code}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline">
                    {Math.round((step.number / 6) * 100)}%
                  </span>
                </div>
                <p className="text-xs font-bold truncate text-white">{step.title}</p>
                <p className="text-[10px] text-slate-400 truncate hidden sm:block">{step.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP CONTAINER */}
      <div className="bg-navy-900/90 border border-navy-750 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-8">
        
        {/* ================= STEP 1 (STEP A): OWNER INFORMATION ================= */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Step A</span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
                Owner & Property Manager Information
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Prefilled from your authenticated account. Prospective student inquiries and audit communications will be directed here.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name of Host / Representative"
                value={ownerFullName}
                onChange={e => setOwnerFullName(e.target.value)}
                error={errors.ownerName}
                placeholder="e.g. Rajesh Sharma"
                required
              />

              <Input
                label="Official Email Address"
                type="email"
                value={ownerEmail}
                onChange={e => setOwnerEmail(e.target.value)}
                error={errors.ownerEmail}
                placeholder="owner@example.com"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Mobile Number (WhatsApp Enabled)"
                type="tel"
                value={ownerPhone}
                onChange={e => setOwnerPhone(e.target.value)}
                error={errors.ownerPhone}
                placeholder="+91 98450 12345"
                required
              />

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Owner Classification
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOwnerType('individual')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                      ownerType === 'individual'
                        ? 'bg-violet-600 border-violet-500 text-white shadow-md'
                        : 'bg-navy-950 border-navy-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Individual Host
                  </button>
                  <button
                    type="button"
                    onClick={() => setOwnerType('property_manager')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                      ownerType === 'property_manager'
                        ? 'bg-violet-600 border-violet-500 text-white shadow-md'
                        : 'bg-navy-950 border-navy-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Property Manager
                  </button>
                </div>
              </div>
            </div>

            <Input
              label="Business / Registered Trade Name (Optional)"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="e.g. Sunrise Stays & Co-living Spaces LLP"
            />

            <div className="p-4 rounded-2xl bg-navy-950/80 border border-navy-800 text-xs text-slate-400 flex items-start gap-3">
              <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <p>
                <strong>Demo notice:</strong> These credentials represent your active mock session. Student visit confirmations will automatically log under this account.
              </p>
            </div>
          </div>
        )}

        {/* ================= STEP 2 (STEP B): PROPERTY ADDRESS & LOCATION ================= */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Step B</span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
                Property Address & Proximity to Colleges
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Accurate address helps students calculate walking times and commute costs from Bangalore campuses.
              </p>
            </div>

            <div className="space-y-4">
              <Input
                label="PG / Property Name"
                placeholder="e.g. Balaji Comforts Luxury Student PG"
                value={name}
                onChange={e => setName(e.target.value)}
                error={errors.name}
                required
              />

              <Input
                label="Tagline / Highlights"
                placeholder="e.g. Quiet academic stay right behind RVCE campus with food"
                value={tagline}
                onChange={e => setTagline(e.target.value)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Accommodation Category"
                  value={propertyType}
                  onChange={e => setPropertyType(e.target.value as any)}
                >
                  <option value="pg">Paying Guest (PG)</option>
                  <option value="hostel">University Hostel</option>
                  <option value="coliving">Modern Co-living Space</option>
                </Select>

                <Select
                  label="Gender Policy"
                  value={genderPreference}
                  onChange={e => setGenderPreference(e.target.value as any)}
                >
                  <option value="unisex">Co-ed / Unisex Student Stays</option>
                  <option value="boys">Boys Only</option>
                  <option value="girls">Girls Only</option>
                </Select>
              </div>

              <Input
                label="Full Street Address"
                placeholder="e.g. No. 42, 3rd Cross, Mysore Main Road, RV Vidyaniketan"
                value={address}
                onChange={e => setAddress(e.target.value)}
                error={errors.address}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Locality / Neighborhood"
                  placeholder="e.g. Kengeri / Mysore Road"
                  value={locality}
                  onChange={e => setLocality(e.target.value)}
                  error={errors.locality}
                  required
                />
                <Input
                  label="City"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  required
                />
                <Input
                  label="PIN Code"
                  placeholder="560060"
                  value={postalCode}
                  onChange={e => setPostalCode(e.target.value)}
                  error={errors.postalCode}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Nearest College or University Hub"
                  placeholder="e.g. RV College of Engineering"
                  value={collegeName}
                  onChange={e => setCollegeName(e.target.value)}
                  error={errors.collegeName}
                  required
                />
                <Input
                  label="Distance to Campus (in Kilometers)"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={collegeDistance}
                  onChange={e => setCollegeDistance(Number(e.target.value))}
                  required
                />
              </div>

              <Input
                label="Prominent Nearby Landmark"
                placeholder="e.g. 300m from RV College Metro Station Pillar 124"
                value={landmark}
                onChange={e => setLandmark(e.target.value)}
              />

              {/* Google Maps Location Link */}
              <div className="p-4 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Google Maps Location Link (Direct Redirection)
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Provide your Google Maps pin or share URL so students can get exact driving &amp; walking directions to your PG.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const query = encodeURIComponent(`${name ? name + ', ' : ''}${address || locality}, ${city} - ${postalCode}`);
                      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-semibold transition-all shrink-0 self-start sm:self-auto"
                    title="Search on Google Maps to find and copy your location share link"
                  >
                    <MapPin className="w-3.5 h-3.5 text-violet-400" />
                    <span>Search on Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    placeholder="e.g. https://maps.app.goo.gl/xyz or paste your Google Maps link"
                    value={googleMapsUrl}
                    onChange={e => setGoogleMapsUrl(e.target.value)}
                    className="flex-1 bg-navy-900 border border-navy-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                  />
                  {googleMapsUrl.trim() && (
                    <button
                      type="button"
                      onClick={() => window.open(googleMapsUrl, '_blank')}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shrink-0"
                      title="Verify your Google Maps link in a new tab"
                    >
                      <span>Verify Pin</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Interactive Bangalore Location Map Picker */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Interactive Location &amp; Landmark Picker (Bangalore Hubs)
                  </label>
                  <span className="text-[11px] text-brand-400 font-semibold">
                    📍 {selectedMapPin.name} ({selectedMapPin.lat.toFixed(4)}, {selectedMapPin.lng.toFixed(4)})
                  </span>
                </div>

                {/* Visual Map Simulator */}
                <div className="relative rounded-2xl overflow-hidden border border-navy-750 bg-navy-950 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-navy-800">
                    <span className="flex items-center gap-1.5 font-medium text-slate-300">
                      <Compass className="w-3.5 h-3.5 text-violet-400" />
                      Click a university hotspot to prefill coordinates &amp; locality:
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      Interactive Map Demo
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PRESET_BANGALORE_LOCATIONS.map(loc => {
                      const isSelected = selectedMapPin.name === loc.name;
                      return (
                        <button
                          key={loc.name}
                          type="button"
                          onClick={() => handleSelectPresetLocation(loc)}
                          className={`p-2.5 rounded-xl text-left border transition-all text-xs ${
                            isSelected
                              ? 'bg-violet-600/30 border-violet-500 text-white shadow-md'
                              : 'bg-navy-900 border-navy-800 text-slate-300 hover:border-navy-700'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold mb-0.5">
                            <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-violet-400' : 'text-slate-400'}`} />
                            <span className="truncate">{loc.name}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{loc.college}</p>
                          <p className="text-[10px] text-brand-400 font-semibold">{loc.dist} km to campus</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3 (STEP C): PRICING & ACCOMMODATION ================= */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Step C</span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
                Pricing, Room Capacities &amp; Bed Vacancies
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Transparent rent structures prevent disputes. All values are strictly validated (no negative numbers).
              </p>
            </div>

            {/* Rent & Deposit Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Monthly Rent (Min / Sharing ₹)"
                type="number"
                min="1000"
                value={minRent}
                onChange={e => setMinRent(Number(e.target.value))}
                error={errors.minRent}
                leftIcon={<IndianRupee className="w-4 h-4" />}
                required
              />

              <Input
                label="Monthly Rent (Max / Single ₹)"
                type="number"
                min={minRent}
                value={maxRent}
                onChange={e => setMaxRent(Number(e.target.value))}
                error={errors.maxRent}
                leftIcon={<IndianRupee className="w-4 h-4" />}
                required
              />

              <Input
                label="Security Deposit (Refundable ₹)"
                type="number"
                min="0"
                value={securityDeposit}
                onChange={e => setSecurityDeposit(Number(e.target.value))}
                error={errors.securityDeposit}
                leftIcon={<IndianRupee className="w-4 h-4" />}
                required
              />
            </div>

            {/* Capacity & Live Bed Tracking */}
            <div className="p-5 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-brand-400" />
                  <span>Real-time Bed Inventory &amp; Room Allocations</span>
                </h4>
                <span className="text-[11px] text-emerald-400 font-semibold">
                  Validates: Available Beds ≤ Total Capacity
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Total Rooms in Building"
                  type="number"
                  min="1"
                  value={totalRooms}
                  onChange={e => setTotalRooms(Number(e.target.value))}
                  error={errors.totalRooms}
                  required
                />

                <Input
                  label="Total Bed Capacity"
                  type="number"
                  min="1"
                  value={totalBeds}
                  onChange={e => setTotalBeds(Number(e.target.value))}
                  error={errors.totalBeds}
                  required
                />

                <Input
                  label="Currently Available Vacant Beds"
                  type="number"
                  min="0"
                  max={totalBeds}
                  value={availableBeds}
                  onChange={e => setAvailableBeds(Number(e.target.value))}
                  error={errors.availableBeds}
                  required
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-300 pt-2 border-t border-navy-800">
                <span>Total Capacity: <strong className="text-white">{totalBeds} beds</strong></span>
                <span>Vacant for Move-in: <strong className="text-emerald-400">{availableBeds} beds</strong></span>
                <span>Current Occupancy: <strong className="text-brand-300">{Math.round(((totalBeds - availableBeds) / (totalBeds || 1)) * 100)}%</strong></span>
              </div>
            </div>

            {/* Individual Room Types & Bed Inventory List */}
            <div className="p-5 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <BedDouble className="w-4 h-4 text-violet-400" />
                    <span>Individual Room Tiers &amp; Sharing Configurations ({rooms.length})</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Define single, double, or triple sharing rooms with dedicated pricing and vacant bed tracking.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleOpenRoomModal(null)}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Add Room Tier
                </Button>
              </div>

              {rooms.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-navy-800 bg-navy-900/40 text-xs text-slate-400 space-y-2">
                  <p>No individual room tiers configured yet.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenRoomModal(null)}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Configure First Room Tier
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {rooms.map((room, idx) => (
                    <div
                      key={room.id || idx}
                      className="p-4 rounded-2xl bg-navy-900 border border-navy-800 hover:border-navy-750 transition-all space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300 bg-violet-500/15 px-2 py-0.5 rounded-full border border-violet-500/30">
                            {room.room_type.replace('_', ' ')}
                          </span>
                          <h5 className="font-bold text-white text-sm mt-1">{room.room_name || `${room.room_type} Room`}</h5>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenRoomModal(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
                            title="Edit room configuration"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRoom(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete room tier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1.5 border-t border-navy-800/80">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Monthly Rent:</span>
                          <strong className="text-white">₹{Number(room.rent_per_bed).toLocaleString('en-IN')}/mo</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Deposit:</span>
                          <strong className="text-white">₹{Number(room.deposit_amount).toLocaleString('en-IN')}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Total Beds:</span>
                          <strong className="text-white">{room.total_capacity} beds</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Vacant Beds:</span>
                          <strong className="text-emerald-400">{room.available_beds} beds</strong>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 pt-1 text-[10px]">
                        {room.has_attached_washroom && (
                          <span className="px-2 py-0.5 rounded-md bg-navy-950 text-slate-300 border border-navy-800">Attached Bath</span>
                        )}
                        {room.is_air_conditioned && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20">AC Room</span>
                        )}
                        {room.has_balcony && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Balcony</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Food & Meals */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Food &amp; Dining Provision
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'both', label: 'Veg & Non-Veg' },
                  { key: 'veg_only', label: 'Pure Vegetarian' },
                  { key: 'none', label: 'Self Cooking / None' }
                ].map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setFoodType(opt.key as any)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                      foodType === opt.key
                        ? 'bg-violet-600 border-violet-500 text-white'
                        : 'bg-navy-950 border-navy-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <Input
                label="Food Schedule & Hygiene Description"
                placeholder="e.g. Breakfast (7:30 - 9:30 AM), Dinner (8:00 - 10:00 PM) prepared by certified kitchen staff"
                value={foodDescription}
                onChange={e => setFoodDescription(e.target.value)}
              />
            </div>

            {/* Amenities Multi-Select */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Included Amenities ({selectedAmenities.length} Selected)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  'High-Speed Wi-Fi',
                  'Attached Washroom',
                  'Meals Included',
                  'Daily Housekeeping',
                  'Power Backup',
                  'Biometric Access',
                  'CCTV Monitoring',
                  'Washing Machine',
                  'RO Purified Water',
                  'AC Rooms',
                  'Gym & Fitness Zone',
                  'Study Tables & Chairs'
                ].map(amenity => {
                  const isChecked = selectedAmenities.includes(amenity);
                  return (
                    <button
                      key={amenity}
                      type="button"
                      onClick={() => toggleAmenity(amenity)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-medium flex items-center justify-between transition-all ${
                        isChecked
                          ? 'bg-violet-600/20 border-violet-500 text-white'
                          : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="truncate">{amenity}</span>
                      {isChecked && <Check className="w-3.5 h-3.5 text-violet-400 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* House Rules */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                House Rules &amp; Policies ({rules.length})
              </label>
              <div className="space-y-2">
                {rules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-navy-950 border border-navy-800 flex items-center justify-between text-xs text-slate-300 gap-3"
                  >
                    <span>• {rule}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRule(idx)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add custom rule (e.g. Visitors permitted on Sundays until 7 PM)..."
                  value={newRule}
                  onChange={e => setNewRule(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddRule())}
                  className="flex-1 bg-navy-950 border border-navy-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                />
                <Button type="button" variant="secondary" size="sm" onClick={handleAddRule}>
                  Add Rule
                </Button>
              </div>
            </div>

          </div>
        )}

        {/* ================= STEP 4 (STEP D): PROPERTY PHOTOGRAPHS ================= */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Step D</span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
                Property Photographs &amp; Gallery
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Upload photos organized by space: Exterior, Bedroom, Bathroom, Common Areas, and Other amenities.
              </p>
            </div>

            {/* Category Selector */}
            <div className="flex overflow-x-auto gap-2 pb-2">
              {[
                { key: 'exterior', label: 'Exterior & Façade' },
                { key: 'bedroom', label: 'Bedrooms' },
                { key: 'bathroom', label: 'Bathrooms' },
                { key: 'common', label: 'Common Areas' },
                { key: 'other', label: 'Other Amenities' },
              ].map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActivePhotoCategory(cat.key as any)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                    activePhotoCategory === cat.key
                      ? 'bg-violet-600 border-violet-500 text-white shadow-md'
                      : 'bg-navy-950 border-navy-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.label} ({categorizedPhotos.filter(p => p.category === cat.key).length})
                </button>
              ))}
            </div>

            {/* Drag and Drop Upload Box */}
            <div className="p-8 border-2 border-dashed border-navy-700 hover:border-violet-500/80 rounded-3xl bg-navy-950/60 text-center space-y-3 transition-colors relative">
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  Drop photographs here or <span className="text-brand-400 underline">browse files</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Categorized as: <strong className="text-violet-300 capitalize">{activePhotoCategory}</strong> (JPG, PNG, WebP up to 10 MB)
                </p>
              </div>
              <p className="text-[11px] text-violet-400">
                ⚡ Selected photos are uploaded directly to Supabase Storage (<code className="text-violet-300">property-images</code> bucket) upon saving.
              </p>
            </div>


            {/* Or Add Photo via URL */}
            <div className="p-4 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-3">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Or Attach Image via Public URL
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-4">
                  <input
                    type="text"
                    placeholder="Photo caption (e.g. Master Room)..."
                    value={photoNameInput}
                    onChange={e => setPhotoNameInput(e.target.value)}
                    className="w-full bg-navy-900 border border-navy-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div className="sm:col-span-6">
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={photoUrlInput}
                    onChange={e => setPhotoUrlInput(e.target.value)}
                    className="w-full bg-navy-900 border border-navy-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="button" variant="secondary" size="sm" className="w-full" onClick={handleAddPhotoUrl}>
                    Attach
                  </Button>
                </div>
              </div>
            </div>

            {/* Photo Gallery Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Uploaded Photos ({categorizedPhotos.length})
                </span>
                {errors.photos && <span className="text-xs text-red-400">{errors.photos}</span>}
              </div>

              {categorizedPhotos.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-navy-800 bg-navy-950/40 text-xs text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-300">No photos uploaded yet</p>
                  <p className="text-[11px] text-slate-500">
                    Drop your room photographs in the upload zone above or browse files to add real premise pictures.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {categorizedPhotos.map((p, idx) => {
                    const isCover = idx === 0;
                    return (
                      <div
                        key={p.id}
                        className={`group relative rounded-2xl overflow-hidden border bg-navy-950 aspect-[4/3] shadow-md transition-all ${
                          isCover ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-navy-800 hover:border-navy-700'
                        }`}
                      >
                        <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/95 via-navy-950/20 to-transparent" />

                        {/* Badges */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                          {isCover ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/90 text-navy-950 shadow-md">
                              <Star className="w-2.5 h-2.5 fill-current" /> Cover Photo
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-navy-900/80 text-violet-300 border border-violet-500/30 capitalize">
                              {p.category}
                            </span>
                          )}
                        </div>

                        {/* Top Action Buttons */}
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleOpenPhotoEdit(idx)}
                            className="p-1.5 rounded-lg bg-navy-900/90 text-slate-200 hover:text-white hover:bg-navy-800 transition-colors"
                            title="Edit caption and category"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(p.id)}
                            className="p-1.5 rounded-lg bg-red-500/90 text-white hover:bg-red-600 transition-colors"
                            title="Remove photograph"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Bottom Info & Reorder Controls */}
                        <div className="absolute bottom-2 left-2 right-2 space-y-1">
                          <p className="text-[11px] text-white font-medium truncate" title={p.name}>
                            {p.name}
                          </p>

                          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-navy-800/60">
                            {!isCover ? (
                              <button
                                type="button"
                                onClick={() => handleSetCoverPhoto(p.id)}
                                className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 transition-colors"
                                title="Set as primary thumbnail for public search"
                              >
                                <Star className="w-3 h-3" /> Make Cover
                              </button>
                            ) : (
                              <span className="text-amber-400 font-semibold">Primary</span>
                            )}

                            <div className="flex items-center gap-1 ml-auto">
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleMovePhoto(idx, 'left')}
                                  className="p-1 rounded bg-navy-900/80 hover:bg-navy-800 text-slate-300 hover:text-white"
                                  title="Move earlier"
                                >
                                  <ChevronLeft className="w-3 h-3" />
                                </button>
                              )}
                              {idx < categorizedPhotos.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleMovePhoto(idx, 'right')}
                                  className="p-1 rounded bg-navy-900/80 hover:bg-navy-800 text-slate-300 hover:text-white"
                                  title="Move later"
                                >
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ================= STEP 5 (STEP E): IDENTITY & PROPERTY DOCUMENTATION ================= */}
        {currentStep === 5 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Step E</span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
                Owner Identity &amp; Verification Document Checklist
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Demonstrates the trust verification workflow for Rento operations to audit before granting the Verified badge.
              </p>
            </div>

            {/* MANDATORY PRIVACY ALERT BANNER */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-300 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-200">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
                <span>Privacy Notice &amp; Demonstration Sandbox</span>
              </div>
              <p className="leading-relaxed">
                <strong>Do NOT upload actual Aadhaar cards, PAN numbers, or real confidential legal deeds</strong> in this frontend demo.
                This checklist demonstrates the workflow UI. All files shown below are sample mock documents that remain strictly in your local browser demo state and are never transmitted to any external server.
              </p>
            </div>

            {/* Document Checklist Items */}
            <div className="space-y-4">
              {documents.map((doc, idx) => {
                const isAttached = doc.status === 'uploaded';
                return (
                  <div
                    key={doc.id}
                    className={`p-5 rounded-2xl border transition-all space-y-3 ${
                      isAttached
                        ? 'bg-navy-950/80 border-emerald-500/30'
                        : 'bg-navy-950/40 border-navy-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isAttached
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-navy-800 text-slate-400'
                          }`}
                        >
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-white text-sm">{doc.title}</h4>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isAttached
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                                  : 'bg-navy-900 text-slate-400 border-navy-750'
                              }`}
                            >
                              {isAttached ? 'Sample Attached' : 'Audit Required'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{doc.description}</p>
                          {doc.file_name && (
                            <p className="text-[11px] text-brand-300 font-mono mt-1">
                              📎 {doc.file_name} (Sample Test PDF)
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleDocumentUploaded(doc.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                            isAttached
                              ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                              : 'bg-violet-600 border-violet-500 text-white hover:bg-violet-500'
                          }`}
                        >
                          {isAttached ? 'Remove Sample' : 'Attach Dummy Document'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 rounded-2xl bg-navy-950/60 border border-navy-800 text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">Why are these documents collected?</p>
              <p>
                In production, verified identity and property authority prevent fraudulent student rentals and qualify property managers for the Rento Verified trust badge following in-person premise inspection.
              </p>
            </div>
          </div>
        )}

        {/* ================= STEP 6: REVIEW & SUBMIT ================= */}
        {currentStep === 6 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Step 6 of 6</span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
                Review Property Submission
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Verify all information before submission. Click any section edit button to update details.
              </p>
            </div>

            {/* Section A Review */}
            <div className="p-5 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-3">
              <div className="flex items-center justify-between border-b border-navy-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
                  A. Host &amp; Management Profile
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-xs font-semibold text-brand-400 hover:underline flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Representative:</span>
                  <span className="font-bold text-white">{ownerFullName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Email:</span>
                  <span className="font-semibold text-slate-200">{ownerEmail}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Phone:</span>
                  <span className="font-semibold text-slate-200">{ownerPhone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Host Type:</span>
                  <span className="font-semibold text-violet-300 capitalize">{ownerType.replace('_', ' ')}</span>
                </div>
              </div>
            </div>

            {/* Section B Review */}
            <div className="p-5 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-3">
              <div className="flex items-center justify-between border-b border-navy-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
                  B. Property Address &amp; College Proximity
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-xs font-semibold text-brand-400 hover:underline flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <h4 className="font-extrabold text-white text-base">{name || 'Unnamed Property'}</h4>
                <p className="text-slate-300">{address}, {locality}, {city} - {postalCode}</p>
                <div className="flex flex-wrap items-center gap-3 pt-1 text-slate-400">
                  <span>🎓 Proximity: <strong className="text-white">{collegeName} ({collegeDistance} km)</strong></span>
                  <span>📍 Landmark: <strong className="text-slate-300">{landmark || 'Nearby'}</strong></span>
                </div>
              </div>
            </div>

            {/* Section C Review */}
            <div className="p-5 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-3">
              <div className="flex items-center justify-between border-b border-navy-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
                  C. Pricing, Capacity &amp; Amenities
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="text-xs font-semibold text-brand-400 hover:underline flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Rent Range:</span>
                  <span className="font-bold text-white">₹{minRent.toLocaleString()} - ₹{maxRent.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Security Deposit:</span>
                  <span className="font-semibold text-white">₹{securityDeposit.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Live Bed Vacancy:</span>
                  <span className="font-bold text-emerald-400">{availableBeds} beds / {totalBeds} total</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Food Provision:</span>
                  <span className="font-semibold text-violet-300 capitalize">{foodType.replace('_', ' ')}</span>
                </div>
              </div>
              <div className="pt-2 text-xs text-slate-400">
                <span>Amenities: </span>
                <span className="text-slate-200">{selectedAmenities.slice(0, 6).join(', ')}...</span>
              </div>
            </div>

            {/* Section D & E Review */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-2">
                <div className="flex items-center justify-between border-b border-navy-800 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
                    D. Photographs ({categorizedPhotos.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="text-xs font-semibold text-brand-400 hover:underline flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                </div>
                <div className="flex gap-2 pt-1 overflow-x-auto">
                  {categorizedPhotos.slice(0, 4).map(p => (
                    <img key={p.id} src={p.url} alt={p.name} className="w-12 h-12 rounded-lg object-cover" />
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-navy-950/80 border border-navy-800 space-y-2">
                <div className="flex items-center justify-between border-b border-navy-800 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
                    E. Document Checklist
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(5)}
                    className="text-xs font-semibold text-brand-400 hover:underline flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                </div>
                <p className="text-xs text-slate-300">
                  {documents.filter(d => d.status === 'uploaded').length} of {documents.length} dummy verification documents attached for audit demonstration.
                </p>
              </div>
            </div>

            {/* Submission Notice Banner */}
            <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-xs text-brand-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-white">
                <ShieldCheck className="w-4 h-4 text-brand-400" />
                <span>{isEditing ? 'Admin Verification & Live Protection Protocol' : 'Publication & Verification Protocol'}</span>
              </p>
              <p>
                {isEditing ? (
                  <>
                    Upon submitting, your proposed edits will be submitted to the <strong className="text-amber-300">Admin Verification Queue</strong> as a pending revision.
                    {existingListing?.publication_status === 'published' ? (
                      <span className="block mt-1 text-emerald-300">
                        🛡️ <strong>Live Student Protection:</strong> Your currently published property remains fully active and visible to students until the admin reviews and approves your updated version.
                      </span>
                    ) : (
                      ' Your property will be published to students once our verification team reviews the details.'
                    )}
                  </>
                ) : (
                  <>
                    Upon clicking "Submit for Review", this listing will be recorded with status <strong className="text-amber-300">Pending Review</strong> and verification status <strong className="text-amber-300">Pending Verification</strong>.
                    It will NOT display an automatic Verified badge until physical audit is conducted by operations.
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* BOTTOM STEP CONTROLS (Back / Continue / Save Draft) */}
        <div className="pt-6 border-t border-navy-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={handlePreviousStep}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back to Step {stepsList[currentStep - 2]?.code}
              </Button>
            )}

            {isEditing && id && (
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setIsDeleteConfirmOpen(true)}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                leftIcon={<Trash2 className="w-4 h-4" />}
              >
                Delete Property
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {uploadStatusText && (
              <span className="text-xs font-semibold text-violet-300 animate-pulse hidden sm:inline-block">
                ⏳ {uploadStatusText}
              </span>
            )}

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => handleSaveListing(false)}
              isLoading={isLoading}
              leftIcon={<Save className="w-4 h-4" />}
            >
              {isEditing ? 'Save Draft Edits' : 'Save Draft'}
            </Button>

            {currentStep < 6 ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleNextStep}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Continue to Step {stepsList[currentStep]?.code}
              </Button>
            ) : (
              <Button
                type="button"
                variant="glow"
                size="md"
                onClick={() => handleSaveListing(true)}
                isLoading={isLoading}
                leftIcon={<Send className="w-4 h-4" />}
              >
                {isEditing ? 'Submit Changes for Verification' : 'Submit for Review'}
              </Button>
            )}
          </div>
        </div>

      </div>

      {/* CONFIRMATION MODAL ON SUBMIT FOR REVIEW */}
      <Modal
        isOpen={isSubmitConfirmOpen}
        onClose={() => {
          setIsSubmitConfirmOpen(false);
          navigate('/owner/dashboard');
        }}
        title="Listing Submitted for Review"
        description="Your accommodation record has been created in your owner property inventory."
        maxWidth="md"
      >
        <div className="space-y-4 text-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">{name}</h3>
            <p className="text-xs text-slate-400">{locality}, {city}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-navy-950 border border-navy-800 text-xs text-left space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Publication Status:</span>
              <Badge variant="pending_review" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Verification Status:</span>
              <Badge variant="pending_verification" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Total Bed Inventory:</span>
              <span className="font-bold text-white">{totalBeds} Beds ({availableBeds} Vacant)</span>
            </div>
          </div>

          {/* 30-Day Free Trial Countdown Card */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-violet-950/40 to-navy-950 border border-violet-500/30 text-xs text-left space-y-2">
            <div className="flex items-center gap-2 text-violet-300 font-bold">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span>30-Day Free Trial Officially Activated!</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Your 30-day trial countdown has begun upon submitting your first property listing for review. Enjoy access to room & bed management, photo uploads, and student enquiries.
            </p>
            <div className="pt-2 border-t border-violet-500/20 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-400">
                Duration: <strong className="text-white">30 Days</strong> (Pro Plan Features)
              </span>
              <span className="text-emerald-400 font-semibold">
                ✓ No Credit Card Required
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Zero automatic billing upon expiry. At trial end, you will automatically switch to the free Basic plan (1 PG limit) without losing any property data.
            </p>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            In accordance with Rento trust standards, this property is in <strong>Pending Review</strong> and will appear in public search once approved by operations.
          </p>

          <Button
            variant="glow"
            className="w-full font-bold mt-2"
            size="md"
            onClick={() => {
              setIsSubmitConfirmOpen(false);
              navigate('/owner/dashboard');
            }}
          >
            Go to Owner Dashboard
          </Button>
        </div>
      </Modal>

      {/* INLINE AUTHENTICATION MODAL (PROTECTS FORM STATE ON SESSION EXPIRY) */}
      <Modal
        isOpen={isAuthPromptOpen}
        onClose={() => setIsAuthPromptOpen(false)}
        title="Confirm Supabase Session"
        description="Your filled PG property details and 6 uploaded photos are preserved. Please enter your account password to confirm your Supabase session and submit."
        maxWidth="md"
      >
        <form onSubmit={handleInlineAuthSubmit} className="space-y-4 py-2 text-left">
          <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
            🔒 Supabase Row Level Security requires an active authenticated session token to create a listing and store images.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Owner Email</label>
            <input
              type="email"
              disabled
              value={user?.email || ownerEmail.trim()}
              className="w-full bg-navy-950 border border-navy-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 opacity-80 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Password <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              autoFocus
              placeholder="Enter your account password..."
              value={authPassword}
              onChange={e => {
                setAuthPassword(e.target.value);
                setAuthError(null);
              }}
              className="w-full bg-navy-900 border border-navy-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 leading-relaxed">
              {authError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-navy-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAuthPromptOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="glow"
              size="sm"
              isLoading={isAuthenticating}
              leftIcon={<Lock className="w-3.5 h-3.5" />}
            >
              Authenticate &amp; Save Listing
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="Permanently Delete Property?"
        description="This action cannot be undone. All data and photos will be erased."
        maxWidth="md"
      >
        <div className="space-y-4 py-2">
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs space-y-1.5">
            <p className="font-semibold text-red-400">
              ⚠️ Are you sure you want to delete "{name || 'this property'}"?
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
              <li>The property listing will be permanently removed from public search</li>
              <li>All rooms, bed inventories, and pricing tiers will be deleted</li>
              <li>All uploaded premise photos will be deleted from Supabase Storage</li>
              <li>All student inquiries and visit requests will be removed</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-navy-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isDeleting}
              onClick={() => setIsDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              onClick={handleDeleteCurrentListing}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Yes, Permanently Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* REVISION SUBMISSION CONFIRMATION MODAL */}
      <Modal
        isOpen={isRevisionSubmittedModalOpen}
        onClose={() => {
          setIsRevisionSubmittedModalOpen(false);
          navigate('/owner/listings');
        }}
        title="Changes Submitted for Verification"
        description="Your proposed modifications have been submitted to the Admin Verification Queue."
        maxWidth="md"
      >
        <div className="space-y-4 text-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">{name}</h3>
            <p className="text-xs text-slate-400">{locality}, {city}</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-navy-950 border border-navy-800 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Review Status:</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Pending Verification
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Public Visibility:</span>
              <span className="text-emerald-400 font-medium">
                {existingListing?.publication_status === 'published' ? 'Live (Approved Details Visible)' : 'Unpublished (Under Review)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed pt-2 border-t border-navy-800">
              {existingListing?.publication_status === 'published'
                ? 'Students browsing Rento will continue seeing your previously approved rates, rooms, and photos while the admin evaluates your new changes.'
                : 'Your listing will be published once our operations team verifies your details.'}
            </p>
          </div>

          <Button
            variant="glow"
            className="w-full font-bold mt-2"
            size="md"
            onClick={() => {
              setIsRevisionSubmittedModalOpen(false);
              navigate('/owner/listings');
            }}
          >
            Return to My Properties
          </Button>
        </div>
      </Modal>

      {/* ROOM CONFIGURATION MODAL */}
      <Modal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        title={editingRoomIndex !== null ? 'Edit Room Configuration' : 'Add Room Configuration'}
        description="Configure bed capacity, pricing, and amenities for this room tier."
        maxWidth="lg"
      >
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Room Name / Label <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Deluxe Double Room (Wing A)"
                value={roomFormData.room_name || ''}
                onChange={e => setRoomFormData(prev => ({ ...prev, room_name: e.target.value }))}
                className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Room Sharing Type</label>
              <select
                value={roomFormData.room_type || 'double'}
                onChange={e => {
                  const val = e.target.value as any;
                  const defaultCap = val === 'single' ? 1 : val === 'double' ? 2 : val === 'triple' ? 3 : val === 'four' ? 4 : 2;
                  setRoomFormData(prev => ({
                    ...prev,
                    room_type: val,
                    total_capacity: defaultCap,
                    available_beds: Math.min(Number(prev.available_beds) || 1, defaultCap),
                  }));
                }}
                className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="single">Single Room (Private)</option>
                <option value="double">Double Sharing (2 Beds)</option>
                <option value="triple">Triple Sharing (3 Beds)</option>
                <option value="four">Four Sharing (4 Beds)</option>
                <option value="other">Other / Dormitory</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Monthly Rent per Bed (₹) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="500"
                step="100"
                value={roomFormData.rent_per_bed || ''}
                onChange={e => setRoomFormData(prev => ({ ...prev, rent_per_bed: Number(e.target.value) }))}
                className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Security Deposit (₹)
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={roomFormData.deposit_amount || ''}
                onChange={e => setRoomFormData(prev => ({ ...prev, deposit_amount: Number(e.target.value) }))}
                className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Total Bed Capacity in Room <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={roomFormData.total_capacity || ''}
                onChange={e => {
                  const cap = Math.max(1, Number(e.target.value));
                  setRoomFormData(prev => ({
                    ...prev,
                    total_capacity: cap,
                    available_beds: Math.min(Number(prev.available_beds) || 0, cap),
                  }));
                }}
                className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Available Vacant Beds <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="0"
                max={roomFormData.total_capacity || 20}
                value={roomFormData.available_beds ?? ''}
                onChange={e => {
                  const beds = Number(e.target.value);
                  setRoomFormData(prev => ({
                    ...prev,
                    available_beds: Math.min(Math.max(0, beds), Number(prev.total_capacity) || 20),
                  }));
                }}
                className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Cannot exceed total bed capacity ({roomFormData.total_capacity || 0})
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Room Features</label>
            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={Boolean(roomFormData.has_attached_washroom)}
                  onChange={e => setRoomFormData(prev => ({ ...prev, has_attached_washroom: e.target.checked }))}
                  className="rounded border-navy-700 text-brand-500 focus:ring-0"
                />
                Attached Washroom
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={Boolean(roomFormData.is_air_conditioned)}
                  onChange={e => setRoomFormData(prev => ({ ...prev, is_air_conditioned: e.target.checked }))}
                  className="rounded border-navy-700 text-brand-500 focus:ring-0"
                />
                Air Conditioned (AC)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={Boolean(roomFormData.has_balcony)}
                  onChange={e => setRoomFormData(prev => ({ ...prev, has_balcony: e.target.checked }))}
                  className="rounded border-navy-700 text-brand-500 focus:ring-0"
                />
                Private Balcony
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-navy-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsRoomModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSaveRoom}
            >
              Save Room Tier
            </Button>
          </div>
        </div>
      </Modal>

      {/* PHOTO EDIT MODAL */}
      <Modal
        isOpen={isPhotoEditModalOpen}
        onClose={() => setIsPhotoEditModalOpen(false)}
        title="Edit Photograph Details"
        description="Update the caption label and category for this photograph."
        maxWidth="md"
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Photo Caption / Title
            </label>
            <input
              type="text"
              value={photoEditName}
              onChange={e => setPhotoEditName(e.target.value)}
              placeholder="e.g. Spacious Double Room with Study Desk"
              className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Photograph Category
            </label>
            <select
              value={photoEditCategory}
              onChange={e => setPhotoEditCategory(e.target.value as PhotoCategory)}
              className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="exterior">Exterior / Building Facade</option>
              <option value="bedroom">Bedroom &amp; Living</option>
              <option value="bathroom">Attached Washroom</option>
              <option value="common_area">Common Area &amp; Lounge</option>
              <option value="dining">Dining Hall / Food Area</option>
              <option value="kitchen">Kitchen / Pantry</option>
              <option value="amenity">Amenities (Gym, Study Room, Laundry)</option>
              <option value="documents">Certificates / Floor Plan</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-navy-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsPhotoEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSavePhotoEdit}
            >
              Save Photo Info
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default CreateEditListingPage;
