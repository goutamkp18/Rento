import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, GraduationCap, ShieldCheck, LogOut, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const StudentProfilePage: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [college, setCollege] = useState(user?.college || '');
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        college: college.trim(),
      });
      setIsSaved(true);
      showToast({
        type: 'success',
        title: 'Profile Updated',
        message: 'Your personal and academic details were saved successfully.',
        isMockPersisted: true,
      });
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: err?.message || 'Could not save profile changes',
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
        <h1 className="text-2xl font-extrabold text-white">Student Profile & Settings</h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage your personal information, contact phone, and university details
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-navy-900 border border-navy-750 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        
        {/* Avatar header */}
        <div className="flex items-center gap-4 pb-6 border-b border-navy-800">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={fullName || 'Student'}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-brand-500/40"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-brand-500/20 text-brand-300 font-bold text-2xl flex items-center justify-center border-2 border-brand-500/40">
              {fullName ? fullName.charAt(0).toUpperCase() : 'S'}
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold text-white">{fullName || 'Student'}</h2>
            <p className="text-xs text-brand-400 font-medium">Verified Student Profile</p>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
        </div>

        {/* Profile form */}
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Full Legal Name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
            required
          />

          <Input
            label="Email Address"
            type="email"
            value={user?.email || ''}
            disabled
            helperText="Email is bound to your authentication identity."
            leftIcon={<Mail className="w-4 h-4" />}
          />

          <Input
            label="Phone Number (for visit confirmations)"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            leftIcon={<Phone className="w-4 h-4" />}
            required
          />

          <Input
            label="College / University"
            value={college}
            onChange={e => setCollege(e.target.value)}
            leftIcon={<GraduationCap className="w-4 h-4" />}
            helperText="Used to recommend nearby PGs with walking proximity."
          />

          <div className="pt-4 flex items-center justify-between">
            <Button
              type="submit"
              variant="primary"
              size="md"
              leftIcon={isSaved ? <Check className="w-4 h-4" /> : undefined}
            >
              {isSaved ? 'Saved Locally' : 'Save Changes'}
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
