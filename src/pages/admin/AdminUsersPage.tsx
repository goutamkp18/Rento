import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  UserCheck,
  Building2,
  GraduationCap,
  Key,
  AlertTriangle,
  Lock,
  Search,
  Filter
} from 'lucide-react';
import { UserProfile, UserRole } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUsers = async () => {
      setIsLoading(true);

      // If Supabase is connected, query profiles table
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase.from('profiles').select('*');
          if (!error && data) {
            setUsers(data as UserProfile[]);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Supabase profiles query error:', e);
        }
      }

      // Local storage fallback: Load registered users registry
      try {
        const raw = localStorage.getItem('rento_user_registry');
        const records = raw ? JSON.parse(raw) : [];
        const profiles: UserProfile[] = records.map((r: any) => r.profile);

        // Include built-in admin profile
        profiles.unshift({
          id: 'usr_admin_ops',
          email: 'admin@rento.dev',
          full_name: 'Rento Operations Audit',
          role: 'admin',
          created_at: new Date().toISOString(),
        });

        setUsers(profiles);
      } catch (e) {
        console.error('Failed to load user registry', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadUsers();
  }, []);

  const filteredUsers = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        u.email.toLowerCase().includes(q) ||
        u.full_name.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q))
      );
    }
    return true;
  });

  return (
    <div className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-800">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-400" />
              <h1 className="text-2xl font-extrabold text-white">User Registry & Role Authorization</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Audit authenticated user accounts, verified roles, and security access policies
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              Total Accounts: <strong className="text-white">{users.length}</strong>
            </span>
          </div>
        </div>

        {/* Security Policy Information Banner */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-brand-500/20 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-brand-300">
            <Lock className="w-4 h-4 text-brand-400 shrink-0" />
            <span>Role-Based Access Control (RBAC) Governance Rules</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300 pt-1">
            <div className="p-3 bg-navy-950 rounded-xl border border-navy-800">
              <span className="font-bold text-white block mb-0.5">1. Public Signup Isolation</span>
              <span>Public registration creates Student and PG-Owner accounts only. Self-assigning 'admin' is blocked at the gateway.</span>
            </div>
            <div className="p-3 bg-navy-950 rounded-xl border border-navy-800">
              <span className="font-bold text-white block mb-0.5">2. Server-Enforced Roles</span>
              <span>Roles stored in database columns cannot be updated by client-side requests or user-editable profile endpoints.</span>
            </div>
            <div className="p-3 bg-navy-950 rounded-xl border border-navy-800">
              <span className="font-bold text-white block mb-0.5">3. Dedicated Admin Provisioning</span>
              <span>Administrators are provisioned via backend environment credentials or authorized database migrations only.</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-navy-900 border border-navy-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-navy-900 rounded-xl border border-navy-800 text-xs w-full sm:w-auto">
            {(['all', 'student', 'owner', 'admin'] as const).map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-3 py-1.5 rounded-lg capitalize font-semibold transition-all ${
                  roleFilter === role
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {role} ({role === 'all' ? users.length : users.filter(u => u.role === role).length})
              </button>
            ))}
          </div>
        </div>

        {/* User Table */}
        <div className="bg-navy-900 border border-navy-750 rounded-3xl overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading user accounts...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 space-y-2">
              <Users className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-white font-semibold">No accounts match your criteria</p>
              <p>Adjust your search query or role filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-navy-950 text-slate-400 uppercase font-semibold border-b border-navy-800">
                  <tr>
                    <th className="px-6 py-4">Account User</th>
                    <th className="px-6 py-4">Assigned Role</th>
                    <th className="px-6 py-4">Phone / Contact</th>
                    <th className="px-6 py-4">Entity Details</th>
                    <th className="px-6 py-4">Registration Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800 text-slate-300">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-navy-850/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-navy-800 text-slate-200 font-bold flex items-center justify-center border border-navy-700">
                            {u.full_name ? u.full_name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-white block">{u.full_name}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            u.role === 'admin'
                              ? 'bg-red-500/10 text-red-300 border border-red-500/30'
                              : u.role === 'owner'
                              ? 'bg-violet-500/10 text-violet-300 border border-violet-500/30'
                              : 'bg-brand-500/10 text-brand-300 border border-brand-500/30'
                          }`}
                        >
                          {u.role === 'admin' ? (
                            <ShieldCheck className="w-3 h-3 text-red-400" />
                          ) : u.role === 'owner' ? (
                            <Building2 className="w-3 h-3 text-violet-400" />
                          ) : (
                            <GraduationCap className="w-3 h-3 text-brand-400" />
                          )}
                          <span>{u.role}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px]">
                        {u.phone || <span className="text-slate-600">Not provided</span>}
                      </td>
                      <td className="px-6 py-4">
                        {u.role === 'owner' ? (
                          <span>{u.business_name || 'Independent Owner'}</span>
                        ) : u.role === 'student' ? (
                          <span>{u.college || 'Bangalore University'}</span>
                        ) : (
                          <span className="text-slate-400">Rento Security & Ops</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-[11px]">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'System Account'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
