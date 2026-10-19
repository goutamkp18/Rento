import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  PaymentRequest,
  SubscriptionPlanId,
  StudentSubscription,
  ReconciliationStatus,
  OcrExtractionResult,
  PaymentRiskAssessment
} from '../types';
import { authService } from './authService';
import { auditService } from './auditService';
import { getPlanPaymentConfig } from '../utils/pricing';
import { validateUtr, normalizeUtr } from '../utils/utrValidation';
import { computeReceiptHash } from '../utils/receiptHash';
import { ocrService } from './ocrService';
import { fraudDetectionService } from './fraudDetectionService';

export const paymentService = {
  /**
   * Generates a unique human-readable payment reference code.
   */
  generatePaymentReference(userType: 'student' | 'owner'): string {
    const prefix = userType === 'student' ? 'RENTO-STU-' : 'RENTO-OWN-';
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${randomHex}`;
  },

  /**
   * Step 1: Creates a unique payment request in Supabase before showing the QR code.
   * Stores user ID, payment purpose, plan ID, expected amount in paise, currency, reference, status 'pending' and timestamps.
   */
  async createPaymentRequest(params: {
    userId: string;
    userType: 'student' | 'owner';
    purpose: 'student_lifetime_pass' | 'owner_subscription_renewal' | 'owner_subscription_upgrade' | 'owner_subscription_new';
    planId: string;
  }): Promise<PaymentRequest> {
    const { userId, userType, purpose, planId } = params;

    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured. Please verify your connection.');
    }

    const planConfig = getPlanPaymentConfig(planId);
    const amountPaise = planConfig.amountPaise;

    // 1. Try trusted RPC first
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_payment_request', {
        p_purpose: purpose,
        p_plan_id: planId,
      });

      if (!rpcError && rpcData) {
        return rpcData as PaymentRequest;
      }
      if (rpcError && !rpcError.message.includes('function') && !rpcError.message.includes('does not exist')) {
        throw new Error(rpcError.message);
      }
    } catch (rpcEx: any) {
      if (rpcEx.message && !rpcEx.message.includes('does not exist') && !rpcEx.message.includes('function')) {
        throw rpcEx;
      }
    }

    // 2. Direct Supabase query / fallback
    const { data: existing, error: checkErr } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .in('status', ['pending', 'pending_verification'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!checkErr && existing) {
      if (existing.reference) {
        return existing as PaymentRequest;
      }
      // Assign reference to existing
      const ref = this.generatePaymentReference(userType);
      const { data: updated } = await supabase
        .from('payment_requests')
        .update({ reference: ref, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();

      if (updated) return updated as PaymentRequest;
    }

    // Generate new unique reference
    const reference = this.generatePaymentReference(userType);

    const { data: newReq, error: insertErr } = await supabase
      .from('payment_requests')
      .insert([
        {
          user_id: userId,
          user_type: userType,
          purpose,
          plan_id: planId,
          amount_paise: amountPaise,
          currency: 'INR',
          status: 'pending',
          reference,
          payment_method: 'upi',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (insertErr) {
      if (insertErr.message.includes('schema cache') || insertErr.message.includes('does not exist')) {
        throw new Error('Supabase payment_requests table not found. Please apply supabase_master_payment_antifraud_setup.sql in your Supabase SQL Editor.');
      }
      throw new Error(`Failed to create payment request: ${insertErr.message}`);
    }

    return newReq as PaymentRequest;
  },

  /**
   * Step 2: Validates UTR format, enforces global uniqueness in Supabase,
   * uploads optional receipt, and saves submission with status 'pending_verification'.
   */
  async submitPaymentProof(params: {
    paymentId: string;
    utr: string;
    receiptFile?: File | null;
  }): Promise<PaymentRequest> {
    const { paymentId, utr, receiptFile } = params;

    // Strict client-side validation
    const validation = validateUtr(utr);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid UPI transaction reference (UTR).');
    }
    const cleanUtr = validation.normalizedUtr;

    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured. Please verify your connection.');
    }

    // First line check: verify global uniqueness in Supabase before proceeding
    const { data: dupCheck, error: dupErr } = await supabase
      .from('payment_requests')
      .select('id, user_id, plan_id, status, created_at')
      .eq('utr', cleanUtr)
      .neq('id', paymentId)
      .limit(1)
      .maybeSingle();

    if (!dupErr && dupCheck) {
      throw new Error(
        `This UPI transaction reference (UTR: ${cleanUtr}) has already been submitted for another payment request. Each transaction reference can only be used once.`
      );
    }

    // Fetch existing payment request for accurate amount and user verification
    const { data: existingReq } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('id', paymentId)
      .single();

    // 1. Compute screenshot hash and run OCR & Fraud Analysis if receiptFile is provided
    let receiptPath: string | undefined;
    let receiptUrl: string | undefined;
    let screenshotHash: string | undefined;
    let ocrResult: OcrExtractionResult | null = null;
    let riskAssessment: PaymentRiskAssessment | null = null;

    if (receiptFile) {
      try {
        screenshotHash = await computeReceiptHash(receiptFile);

        // Run non-blocking OCR analysis
        ocrResult = await ocrService.extractReceiptData(
          receiptFile,
          existingReq?.amount_paise,
          cleanUtr
        );

        // Run multi-signal fraud evaluation
        riskAssessment = await fraudDetectionService.evaluatePaymentRisk({
          userId: existingReq?.user_id || '',
          paymentId,
          planId: existingReq?.plan_id || 'student_pass',
          rawUtr: utr,
          screenshotHash,
          ocrResult,
        });

        const fileExt = receiptFile.name.split('.').pop() || 'jpg';
        const fileName = `receipts/${Date.now()}_${cleanUtr}.${fileExt}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('payment-receipts')
          .upload(fileName, receiptFile, { upsert: true });

        if (!uploadErr && uploadData?.path) {
          receiptPath = uploadData.path;
          const { data: signedData } = await supabase.storage
            .from('payment-receipts')
            .createSignedUrl(uploadData.path, 60 * 60 * 24 * 7);
          receiptUrl = signedData?.signedUrl;

          if (!receiptUrl) {
            const { data: publicUrlData } = supabase.storage
              .from('payment-receipts')
              .getPublicUrl(uploadData.path);
            receiptUrl = publicUrlData?.publicUrl;
          }
        }
      } catch (uploadEx) {
        console.warn('Receipt upload and analysis notice:', uploadEx);
      }
    } else {
      riskAssessment = await fraudDetectionService.evaluatePaymentRisk({
        userId: existingReq?.user_id || '',
        paymentId,
        planId: existingReq?.plan_id || 'student_pass',
        rawUtr: utr,
      });
    }

    // 2. Try trusted RPC first (enforces database-level transaction and uniqueness)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('submit_payment_proof', {
        p_payment_id: paymentId,
        p_utr: cleanUtr,
        p_receipt_url: receiptUrl || null,
        p_receipt_path: receiptPath || null,
        p_screenshot_hash: screenshotHash || null,
        p_risk_score: riskAssessment?.riskScore || 0,
        p_risk_level: riskAssessment?.riskLevel || 'low',
        p_risk_flags: riskAssessment?.riskFlags || [],
        p_mismatch_reasons: riskAssessment?.mismatchReasons || [],
        p_ocr_data: ocrResult ? {
          status: ocrResult.status,
          confidence: ocrResult.confidence,
          rawText: ocrResult.rawText?.slice(0, 2000),
          extractedUtr: ocrResult.extractedUtr,
          extractedAmount: ocrResult.extractedAmount,
          extractedPayee: ocrResult.extractedPayee,
          extractedDate: ocrResult.extractedDate,
          extractedStatus: ocrResult.extractedStatus,
          detectedApp: ocrResult.detectedApp,
        } : null,
      });

      if (!rpcError && rpcData) {
        return rpcData as PaymentRequest;
      }
      if (rpcError) {
        if (rpcError.message.includes('already been submitted') || rpcError.code === '23505') {
          throw new Error(`This UPI transaction reference (${cleanUtr}) has already been submitted for another payment. Each transaction reference can only be used once.`);
        }
        if (!rpcError.message.includes('function') && !rpcError.message.includes('does not exist')) {
          throw new Error(rpcError.message);
        }
      }
    } catch (rpcEx: any) {
      if (rpcEx.message && !rpcEx.message.includes('does not exist') && !rpcEx.message.includes('function')) {
        throw rpcEx;
      }
    }

    // 3. Fallback direct table update with unique constraint handler
    try {
      const { data: updatedReq, error: updateErr } = await supabase
        .from('payment_requests')
        .update({
          utr: cleanUtr,
          receipt_url: receiptUrl,
          receipt_storage_path: receiptPath,
          screenshot_hash: screenshotHash || null,
          risk_score: riskAssessment?.riskScore || 0,
          risk_level: riskAssessment?.riskLevel || 'low',
          risk_flags: riskAssessment?.riskFlags || [],
          mismatch_reasons: riskAssessment?.mismatchReasons || [],
          ocr_status: ocrResult?.status || 'pending',
          ocr_confidence: ocrResult?.confidence || null,
          ocr_raw_text: ocrResult?.rawText?.slice(0, 2000) || null,
          ocr_extracted_utr: ocrResult?.extractedUtr || null,
          ocr_extracted_amount: ocrResult?.extractedAmount || null,
          ocr_extracted_payee: ocrResult?.extractedPayee || null,
          ocr_extracted_date: ocrResult?.extractedDate || null,
          ocr_extracted_status: ocrResult?.extractedStatus || null,
          ocr_detected_app: ocrResult?.detectedApp || null,
          status: 'pending_verification',
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (updateErr) {
        if (updateErr.code === '23505' || updateErr.message.includes('duplicate key') || updateErr.message.includes('idx_payment_requests_utr_unique')) {
          throw new Error(`This UPI transaction reference (${cleanUtr}) has already been submitted for another payment. Each transaction reference can only be used once.`);
        }
        throw new Error(`Failed to update payment proof: ${updateErr.message}`);
      }

      const req = updatedReq as PaymentRequest;

      // Update student or owner subscription state with provisional access (24-hour buffer)
      const provisionalUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      if (req.user_type === 'student') {
        try {
          await supabase.from('student_subscriptions').upsert(
            {
              student_id: req.user_id,
              plan_id: 'student_pass',
              status: 'pending_verification',
              entitlement_type: 'lifetime',
              amount_paise: 900,
              base_price: 7.63,
              gst_amount: 1.37,
              total_price: 9.00,
              currency: 'INR',
              payment_method: 'upi',
              payment_reference: cleanUtr,
              payment_request_id: req.id,
              receipt_storage_path: receiptPath,
              is_provisional: true,
              provisional_access_until: provisionalUntil,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'student_id' }
          );
        } catch (e: any) {
          console.warn('student_subscriptions update notice:', e?.message);
        }
      } else if (req.user_type === 'owner') {
        try {
          await supabase
            .from('subscriptions')
            .update({
              selected_plan_id: req.plan_id,
              payment_status: 'pending_verification',
              payment_request_id: req.id,
              is_provisional: true,
              provisional_access_until: provisionalUntil,
              updated_at: new Date().toISOString(),
            })
            .eq('owner_id', req.user_id);
        } catch (subErr) {
          console.warn('Subscription pending status update notice:', subErr);
        }
      }

      return req;
    } catch (e: any) {
      if (e.code === '23505' || e.message?.includes('duplicate key') || e.message?.includes('already been submitted')) {
        throw new Error(`This UPI transaction reference (${cleanUtr}) has already been submitted for another payment. Each transaction reference can only be used once.`);
      }
      throw e;
    }
  },

  /**
   * Helper that creates request and submits proof in one step.
   */
  async submitStudentPayment(params: {
    studentId: string;
    studentName: string;
    studentEmail: string;
    utr: string;
    receiptFile?: File | null;
  }): Promise<{ request: PaymentRequest; isPending: boolean }> {
    const { studentId, utr, receiptFile } = params;

    const valResult = validateUtr(utr);
    if (!valResult.isValid) {
      throw new Error(valResult.error || 'Invalid UPI transaction reference format.');
    }

    // 1. Create or fetch payment request
    const req = await this.createPaymentRequest({
      userId: studentId,
      userType: 'student',
      purpose: 'student_lifetime_pass',
      planId: 'student_pass',
    });

    // 2. Submit payment proof
    const updated = await this.submitPaymentProof({
      paymentId: req.id,
      utr: valResult.normalizedUtr,
      receiptFile,
    });

    return {
      request: updated,
      isPending: true,
    };
  },

  /**
   * Helper that creates request and submits proof in one step for owner subscriptions.
   */
  async submitOwnerPayment(params: {
    ownerId: string;
    planId: SubscriptionPlanId;
    utr: string;
    receiptFile?: File | null;
  }): Promise<{ request: PaymentRequest; isPending: boolean }> {
    const { ownerId, planId, utr, receiptFile } = params;

    const valResult = validateUtr(utr);
    if (!valResult.isValid) {
      throw new Error(valResult.error || 'Invalid UPI transaction reference format.');
    }

    // 1. Create payment request
    const req = await this.createPaymentRequest({
      userId: ownerId,
      userType: 'owner',
      purpose: 'owner_subscription_renewal',
      planId,
    });

    // 2. Submit proof
    const updated = await this.submitPaymentProof({
      paymentId: req.id,
      utr: valResult.normalizedUtr,
      receiptFile,
    });

    return {
      request: updated,
      isPending: true,
    };
  },

  /**
   * Retrieves pending or active payment request for a student.
   */
  async getStudentPaymentStatus(studentId: string): Promise<{
    activeSubscription: StudentSubscription | null;
    pendingRequest: PaymentRequest | null;
    rejectedRequest: PaymentRequest | null;
  }> {
    if (!isSupabaseConfigured || !supabase || !studentId) {
      return { activeSubscription: null, pendingRequest: null, rejectedRequest: null };
    }

    let activeSubscription: StudentSubscription | null = null;
    let pendingRequest: PaymentRequest | null = null;
    let rejectedRequest: PaymentRequest | null = null;

    try {
      // 1. Check active or provisional subscription
      const { data: subData } = await supabase
        .from('student_subscriptions')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

      if (subData) {
        const isProvisionalValid =
          Boolean(subData.is_provisional) &&
          Boolean(subData.provisional_access_until) &&
          new Date(subData.provisional_access_until).getTime() > Date.now();

        if (subData.status === 'active' || isProvisionalValid) {
          activeSubscription = subData as StudentSubscription;
        }
      }
    } catch {
      // Ignore
    }

    try {
      // 2. Check pending / pending_verification / rejected payment requests
      const { data: reqData } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('user_id', studentId)
        .eq('plan_id', 'student_pass')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reqData) {
        if (reqData.status === 'pending' || reqData.status === 'pending_verification') {
          pendingRequest = reqData as PaymentRequest;
        } else if (reqData.status === 'rejected') {
          rejectedRequest = reqData as PaymentRequest;
        }
      }
    } catch {
      // Ignore
    }

    return { activeSubscription, pendingRequest, rejectedRequest };
  },

  /**
   * Retrieves owner payment request history (durable log of renewals & payments).
   */
  async getOwnerPaymentHistory(ownerId: string): Promise<PaymentRequest[]> {
    if (!isSupabaseConfigured || !supabase || !ownerId) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('user_id', ownerId)
        .eq('user_type', 'owner')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data as PaymentRequest[];
      }
    } catch (e) {
      console.warn('Error fetching owner payment history:', e);
    }

    return [];
  },

  /**
   * Admin operations: Fetches all payment requests across students & owners.
   */
  async getAllPaymentRequestsForAdmin(): Promise<PaymentRequest[]> {
    const isAuthorized = await authService.verifyAdminPrivileges();
    if (!isAuthorized) {
      throw new Error('Unauthorized: Only administrators can view payment requests.');
    }

    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select(`
          *,
          user_profile:profiles!user_id (
            full_name,
            email,
            role,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data as PaymentRequest[];
      }
      if (error) {
        console.warn('[paymentService] Profile join query notice:', error.message);
      }

      // Fallback simple query if profile join fails
      const { data: simpleData, error: simpleErr } = await supabase
        .from('payment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (!simpleErr && simpleData) {
        return simpleData as PaymentRequest[];
      }
      if (simpleErr) {
        console.error('[paymentService] Admin query error:', simpleErr);
        throw new Error(simpleErr.message);
      }
    } catch (e: any) {
      console.error('Error fetching admin payment requests:', e);
      throw e;
    }

    return [];
  },

  /**
   * Admin operations: Approves or rejects a payment request after manual bank reconciliation.
   * Atomically updates status, grants entitlements, and records audit trail.
   */
  async adminVerifyPayment(
    paymentId: string,
    action: 'approve' | 'reject',
    rejectionReason?: string
  ): Promise<PaymentRequest> {
    const isAuthorized = await authService.verifyAdminPrivileges();
    if (!isAuthorized) {
      throw new Error('Unauthorized: Only administrators can verify payment requests.');
    }

    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured.');
    }

    const currentAdmin = authService.getCurrentUser();
    const adminId = currentAdmin?.id || 'usr_admin_ops';
    const adminEmail = currentAdmin?.email || 'admin@rento.dev';

    // Postgres UUID validation: if adminId is an app string (e.g. 'usr_admin_ops') or not in profiles,
    // safeAdminUuid must be null to prevent Postgres UUID parse error and foreign key constraint failures.
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let safeAdminUuid: string | null = null;
    if (currentAdmin?.id && UUID_REGEX.test(currentAdmin.id)) {
      try {
        const { data: prof } = await supabase.from('profiles').select('id').eq('id', currentAdmin.id).maybeSingle();
        if (prof?.id) {
          safeAdminUuid = prof.id;
        }
      } catch {
        safeAdminUuid = null;
      }
    }

    // 1. Try trusted RPC first
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_verify_payment', {
        p_payment_id: paymentId,
        p_action: action,
        p_reason: rejectionReason || null,
        p_admin_id: safeAdminUuid,
      });

      if (!rpcErr && rpcData) {
        return rpcData as PaymentRequest;
      }
      if (rpcErr && !rpcErr.message.includes('function') && !rpcErr.message.includes('does not exist')) {
        console.warn('admin_verify_payment RPC returned error, falling back:', rpcErr.message);
      }
    } catch (rpcEx: any) {
      console.warn('admin_verify_payment RPC exception, falling back:', rpcEx?.message || rpcEx);
    }

    // 2. Direct Supabase verification fallback
    const { data: req, error: fetchErr } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (fetchErr || !req) {
      throw new Error(`Payment request #${paymentId} not found.`);
    }

    if (req.status !== 'pending' && req.status !== 'pending_verification') {
      // Idempotency: if already approved or rejected with same action, return safely without re-activating or extending
      if (req.status === 'approved' && action === 'approve') {
        return req as PaymentRequest;
      }
      if (req.status === 'rejected' && action === 'reject') {
        return req as PaymentRequest;
      }
      throw new Error(`Payment request #${paymentId} has already been resolved with status "${req.status}".`);
    }

    const now = new Date().toISOString();
    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    if (action === 'approve') {
      // Update payment request
      const { data: updatedReq, error: reqErr } = await supabase
        .from('payment_requests')
        .update({
          status: 'approved',
          reconciliation_status: 'confirmed_credit',
          verified_at: now,
          verified_by: safeAdminUuid,
          updated_at: now,
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (reqErr) throw new Error(`Could not approve payment request: ${reqErr.message}`);

      // Activate student pass and clear provisional status
      if (req.purpose === 'student_lifetime_pass' || req.user_type === 'student') {
        const { error: stuSubErr } = await supabase
          .from('student_subscriptions')
          .update({
            status: 'active',
            entitlement_type: 'lifetime',
            payment_reference: req.utr,
            receipt_storage_path: req.receipt_storage_path,
            is_provisional: false,
            provisional_access_until: null,
            activated_at: now,
            verified_at: now,
            verified_by: safeAdminUuid,
            updated_at: now,
          })
          .eq('student_id', req.user_id);

        if (stuSubErr) console.warn('Student subscription update notice:', stuSubErr.message);

        await auditService.logAction({
          action: 'approve_student_payment',
          payment_request_id: req.id,
          details: `Approved ₹9 lifetime pass for student ID ${req.user_id} (Ref: ${req.reference || 'N/A'}, UTR: ${req.utr || 'N/A'}) by ${adminEmail}`,
        });
      } else if (req.user_type === 'owner') {
        const planConfig = getPlanPaymentConfig(req.plan_id);

        const { error: ownSubErr } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            trial_status: 'converted',
            plan_id: req.plan_id,
            base_price: planConfig.amountRupees,
            gst_amount: 0,
            total_price: planConfig.amountRupees,
            amount_paise: req.amount_paise,
            listing_limit: req.plan_id === 'basic' ? 1 : req.plan_id === 'pro' ? 3 : 9999,
            is_provisional: false,
            provisional_access_until: null,
            current_period_start: now,
            current_period_end: expiry,
            payment_method: 'upi',
            payment_status: 'paid',
            payment_request_id: req.id,
            verified_at: now,
            updated_at: now,
          })
          .eq('owner_id', req.user_id);

        if (ownSubErr) console.warn('Owner subscription update notice:', ownSubErr.message);

        await auditService.logAction({
          action: 'approve_owner_payment',
          payment_request_id: req.id,
          details: `Approved ${req.plan_id.toUpperCase()} subscription for owner ID ${req.user_id} (Ref: ${req.reference || 'N/A'}, UTR: ${req.utr || 'N/A'}) by ${adminEmail}`,
        });
      }

      return updatedReq as PaymentRequest;
    } else {
      // Reject payment request
      const reason = rejectionReason || 'Transaction could not be verified in bank statement.';

      const { data: updatedReq, error: reqErr } = await supabase
        .from('payment_requests')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          reconciliation_status: 'credit_not_found',
          verified_at: now,
          verified_by: safeAdminUuid,
          updated_at: now,
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (reqErr) throw new Error(`Could not reject payment request: ${reqErr.message}`);

      if (req.user_type === 'student') {
        await supabase
          .from('student_subscriptions')
          .update({
            status: 'rejected',
            is_provisional: false,
            provisional_access_until: null,
            rejection_reason: reason,
            verified_at: now,
            verified_by: safeAdminUuid,
            updated_at: now,
          })
          .eq('student_id', req.user_id);

        await auditService.logAction({
          action: 'reject_student_payment',
          payment_request_id: req.id,
          details: `Rejected payment for student ${req.user_id}: ${reason} by ${adminEmail}`,
          rejection_reason: reason,
        });
      } else if (req.user_type === 'owner') {
        await supabase
          .from('subscriptions')
          .update({
            payment_status: 'rejected',
            is_provisional: false,
            provisional_access_until: null,
            rejection_reason: reason,
            updated_at: now,
          })
          .eq('owner_id', req.user_id);

        await auditService.logAction({
          action: 'reject_owner_payment',
          payment_request_id: req.id,
          details: `Rejected payment for owner ${req.user_id}: ${reason}`,
          rejection_reason: reason,
        });
      }

      return updatedReq as PaymentRequest;
    }
  },

  /**
   * Generates a temporary authorized signed URL for viewing uploaded receipts securely.
   */
  async getReceiptSignedUrl(storagePathOrUrl?: string): Promise<string> {
    if (!storagePathOrUrl) return '';
    if (storagePathOrUrl.startsWith('http://') || storagePathOrUrl.startsWith('https://')) {
      return storagePathOrUrl;
    }
    if (!isSupabaseConfigured || !supabase) {
      return storagePathOrUrl;
    }
    try {
      const { data, error } = await supabase.storage
        .from('payment-receipts')
        .createSignedUrl(storagePathOrUrl, 60 * 60 * 24); // 24 hours
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    } catch {
      // Ignore
    }
    return storagePathOrUrl;
  },

  /**
   * Student or owner dispute workflow for rejected payment requests.
   */
  async disputePayment(paymentId: string, disputeReason: string): Promise<PaymentRequest> {
    if (!paymentId || !disputeReason.trim()) {
      throw new Error('Payment ID and dispute explanation are required.');
    }
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured.');
    }

    try {
      const { data, error } = await supabase.rpc('dispute_payment', {
        p_payment_id: paymentId,
        p_dispute_reason: disputeReason.trim(),
      });
      if (!error && data) {
        return data as PaymentRequest;
      }
    } catch {
      // Fallback direct table
    }

    const { data: updated, error: updErr } = await supabase
      .from('payment_requests')
      .update({
        status: 'disputed',
        is_disputed: true,
        dispute_reason: disputeReason.trim(),
        disputed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (updErr) throw new Error(`Dispute submission failed: ${updErr.message}`);
    return updated as PaymentRequest;
  },

  /**
   * Granular admin reconciliation action (matched_credit, credit_not_found, amount_mismatch, investigating).
   */
  async adminReconcilePayment(
    paymentId: string,
    reconciliationStatus: ReconciliationStatus,
    notes?: string
  ): Promise<PaymentRequest> {
    const isAuthorized = await authService.verifyAdminPrivileges();
    if (!isAuthorized) {
      throw new Error('Unauthorized: Only administrators can record reconciliation decisions.');
    }

    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured.');
    }

    try {
      const { data, error } = await supabase.rpc('admin_reconcile_payment', {
        p_payment_id: paymentId,
        p_reconciliation_status: reconciliationStatus,
        p_notes: notes || null,
      });

      if (!error && data) {
        if (reconciliationStatus === 'confirmed_credit') {
          return await this.adminVerifyPayment(paymentId, 'approve');
        }
        return data as PaymentRequest;
      }
    } catch {
      // Fallback
    }

    const { data: updated, error: updErr } = await supabase
      .from('payment_requests')
      .update({
        reconciliation_status: reconciliationStatus,
        reconciliation_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (updErr) throw new Error(`Reconciliation update failed: ${updErr.message}`);

    if (reconciliationStatus === 'confirmed_credit') {
      return await this.adminVerifyPayment(paymentId, 'approve');
    }

    return updated as PaymentRequest;
  },

  /**
   * Reconciles manual bank statement lines against pending payment requests.
   * Compares UTRs and amounts without claiming automatic bank API integration.
   */
  async reconcileWithBankStatement(statementLines: string[]): Promise<{
    matched: Array<{ request: PaymentRequest; line: string; statementUtr: string; statementAmount?: number }>;
    unmatchedRequests: PaymentRequest[];
    unmatchedStatementLines: string[];
    amountMismatches: Array<{ request: PaymentRequest; expectedAmount: number; statementAmount: number }>;
  }> {
    const allRequests = await this.getAllPaymentRequestsForAdmin();
    const pendingOrUnreconciled = allRequests.filter(
      r => r.status === 'pending_verification' || r.reconciliation_status === 'unreconciled'
    );

    const matched: Array<{ request: PaymentRequest; line: string; statementUtr: string; statementAmount?: number }> = [];
    const amountMismatches: Array<{ request: PaymentRequest; expectedAmount: number; statementAmount: number }> = [];
    const unmatchedStatementLines: string[] = [];
    const matchedRequestIds = new Set<string>();

    for (const line of statementLines) {
      if (!line.trim()) continue;

      const twelveDigitMatch = line.match(/\b\d{12}\b/);
      const alphanumericMatch = line.match(/\b[A-Za-z0-9]{10,35}\b/);
      const candidateUtr = normalizeUtr(
        twelveDigitMatch ? twelveDigitMatch[0] : (alphanumericMatch ? alphanumericMatch[0] : '')
      );

      const amtMatch = line.match(/(?:₹|INR|Rs\.?|\s|^)([0-9]+(?:\.[0-9]{2})?)/);
      const statementAmount = amtMatch ? parseFloat(amtMatch[1]) : undefined;

      let found = false;
      if (candidateUtr) {
        const req = pendingOrUnreconciled.find(r => r.utr && normalizeUtr(r.utr) === candidateUtr);
        if (req) {
          found = true;
          matchedRequestIds.add(req.id);
          const expectedAmt = req.amount_paise / 100;

          if (statementAmount !== undefined && Math.abs(statementAmount - expectedAmt) > 0.05) {
            amountMismatches.push({ request: req, expectedAmount: expectedAmt, statementAmount });
          } else {
            matched.push({ request: req, line, statementUtr: candidateUtr, statementAmount });
          }
        }
      }

      if (!found) {
        unmatchedStatementLines.push(line);
      }
    }

    const unmatchedRequests = pendingOrUnreconciled.filter(r => !matchedRequestIds.has(r.id));

    return {
      matched,
      unmatchedRequests,
      unmatchedStatementLines,
      amountMismatches,
    };
  },
};
