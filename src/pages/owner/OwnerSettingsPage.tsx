import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, User, Building2, Phone, Mail, LogOut, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const OwnerSettingsPage: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState(user?.business_name || '');
  const [ownerName, setOwnerName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [city, setCity] = useState(user?.city || 'Bangalore');
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateProfile({
        business_name: businessName.trim(),
        full_name: ownerName.trim(),
        phone: phone.trim(),
        city: city.trim(),
      });
      setIsSaved(true);
      showToast({
        type: 'success',
        title: 'Settings Saved',
        message: 'Business information updated successfully.',
        isMockPersisted: true,
      });
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Save Failed',
        message: err?.message || 'Could not save business settings',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="pb-4 border-b border-navy-800">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-violet-400" />
          <h1 className="text-2xl font-extrabold text-white">Owner Business Settings</h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Manage your property management agency name and manager contact details
        </p>
      </div>

      <div className="bg-navy-900 border border-navy-750 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        
        <div className="flex items-center gap-4 pb-6 border-b border-navy-800">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={ownerName || 'Owner'}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-violet-500/40"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-violet-500/20 text-violet-300 font-bold text-2xl flex items-center justify-center border-2 border-violet-500/40">
              {ownerName ? ownerName.charAt(0).toUpperCase() : <Building2 className="w-8 h-8" />}
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold text-white">{ownerName || businessName || 'PG Owner'}</h2>
            <p className="text-xs text-violet-400 font-medium">Verified Property Partner</p>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Business / Enterprise Brand Name"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
            leftIcon={<Building2 className="w-4 h-4" />}
            required
          />

          <Input
            label="Primary Manager Contact Person"
            value={ownerName}
            onChange={e => setOwnerName(e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
            required
          />

          <Input
            label="Manager Phone (for student calls & SMS notifications)"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            leftIcon={<Phone className="w-4 h-4" />}
            required
          />

          <Input
            label="Registered City"
            value={city}
            onChange={e => setCity(e.target.value)}
            required
          />

          <div className="pt-4 flex items-center justify-between">
            <Button
              type="submit"
              variant="primary"
              size="md"
              leftIcon={isSaved ? <Check className="w-4 h-4" /> : undefined}
            >
              {isSaved ? 'Saved Locally' : 'Save Business Settings'}
            </Button>

            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleLogout}
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Sign Out
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
};
