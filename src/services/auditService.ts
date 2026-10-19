import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { authService } from './authService';

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  admin_email: string;
  action:
    | 'approve_publication'
    | 'reject_publication'
    | 'approve_revision'
    | 'reject_revision'
    | 'verify_property'
    | 'audit_in_progress'
    | 'reset_unverified'
    | 'revoke_privileges'
    | 'approve_student_payment'
    | 'reject_student_payment'
    | 'approve_owner_payment'
    | 'reject_owner_payment';
  listing_id?: string;
  listing_name?: string;
  payment_request_id?: string;
  details: string;
  rejection_reason?: string;
  created_at: string;
}

const AUDIT_STORAGE_KEY = 'rento_admin_audit_logs';

function getStoredLogs(): AdminAuditLog[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredLogs(logs: AdminAuditLog[]): void {
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to store audit log', e);
  }
}

export const auditService = {
  async logAction(
    entry: Omit<AdminAuditLog, 'id' | 'created_at' | 'admin_id' | 'admin_email'>
  ): Promise<AdminAuditLog> {
    const currentAdmin = authService.getCurrentUser();
    const adminId = currentAdmin?.id || 'usr_admin_ops';
    const adminEmail = currentAdmin?.email || 'admin@rento.dev';

    const logRecord: AdminAuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      admin_id: adminId,
      admin_email: adminEmail,
      action: entry.action,
      listing_id: entry.listing_id,
      listing_name: entry.listing_name,
      details: entry.details,
      rejection_reason: entry.rejection_reason,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('admin_audit_logs').insert([
          {
            id: logRecord.id,
            admin_id: logRecord.admin_id,
            admin_email: logRecord.admin_email,
            action: logRecord.action,
            listing_id: logRecord.listing_id,
            listing_name: logRecord.listing_name,
            details: logRecord.details,
            rejection_reason: logRecord.rejection_reason,
            created_at: logRecord.created_at,
          }
        ]);
      } catch (err) {
        console.warn('Supabase audit log insert notice:', err);
      }
    }

    const all = getStoredLogs();
    all.unshift(logRecord);
    saveStoredLogs(all);
    return logRecord;
  },

  async getLogs(): Promise<AdminAuditLog[]> {
    const isAuthorized = await authService.verifyAdminPrivileges();
    if (!isAuthorized) {
      throw new Error('Unauthorized: Only verified administrators can access audit logs.');
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('admin_audit_logs')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) return data as AdminAuditLog[];
      } catch (e) {
        console.warn('Supabase fetch audit logs error:', e);
      }
    }

    return getStoredLogs();
  }
};
