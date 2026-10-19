import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PaymentRiskAssessment, RiskLevel, OcrExtractionResult } from '../types';
import { normalizeUtr, validateUtr } from '../utils/utrValidation';
import { getPlanPaymentConfig } from '../utils/pricing';

export interface FraudEvaluationParams {
  userId: string;
  paymentId?: string;
  planId: string;
  rawUtr: string;
  screenshotHash?: string;
  ocrResult?: OcrExtractionResult | null;
}

export const fraudDetectionService = {
  /**
   * Evaluates fraud signals, duplicate submissions, OCR consistency, and user velocity.
   * Returns a 0-100 score, tier (low/medium/high), risk flags, and mismatch descriptions.
   */
  async evaluatePaymentRisk(params: FraudEvaluationParams): Promise<PaymentRiskAssessment> {
    const { userId, paymentId, planId, rawUtr, screenshotHash, ocrResult } = params;

    let riskScore = 0;
    const riskFlags: string[] = [];
    const mismatchReasons: string[] = [];

    let isDuplicateUtr = false;
    let isDuplicateScreenshot = false;
    let isAmountMismatch = false;
    let isPayeeMismatch = false;
    let isStatusMismatch = false;
    let isSuspiciousPattern = false;

    const cleanUtr = normalizeUtr(rawUtr);
    const planConfig = getPlanPaymentConfig(planId);

    // -------------------------------------------------------------------------
    // 1. Format & Plausibility Validation
    // -------------------------------------------------------------------------
    const utrVal = validateUtr(rawUtr);
    if (!utrVal.isValid) {
      riskScore += 40;
      riskFlags.push('MALFORMED_OR_MOCK_UTR');
      mismatchReasons.push(utrVal.error || 'Invalid UTR format or rejected pattern.');
    }

    // -------------------------------------------------------------------------
    // 2. Global UTR Duplication Check in Supabase
    // -------------------------------------------------------------------------
    if (isSupabaseConfigured && supabase && cleanUtr) {
      try {
        let query = supabase
          .from('payment_requests')
          .select('id, user_id, status, plan_id, created_at')
          .eq('utr', cleanUtr);

        if (paymentId) {
          query = query.neq('id', paymentId);
        }

        const { data: existingUtrs, error: utrErr } = await query;

        if (!utrErr && existingUtrs && existingUtrs.length > 0) {
          isDuplicateUtr = true;
          const duplicate = existingUtrs[0];

          if (duplicate.user_id === userId) {
            riskScore += 60;
            riskFlags.push('REPEATED_UTR_SAME_USER');
            mismatchReasons.push(
              `Duplicate Reference: You previously submitted this UTR for payment request #${duplicate.id.slice(0, 8)} (${duplicate.status}).`
            );
          } else {
            riskScore += 95; // Extreme risk: cross-account reuse
            riskFlags.push('DUPLICATE_UTR_CROSS_ACCOUNT');
            mismatchReasons.push(
              'Severe Conflict: This transaction reference was already recorded by another user account.'
            );
          }
        }
      } catch (err) {
        console.warn('[fraudDetectionService] UTR duplicate check query error:', err);
      }
    }

    // -------------------------------------------------------------------------
    // 3. Screenshot Hash Duplication Check (Detecting Stolen / Reused Receipts)
    // -------------------------------------------------------------------------
    if (isSupabaseConfigured && supabase && screenshotHash) {
      try {
        let query = supabase
          .from('payment_requests')
          .select('id, user_id, status, created_at')
          .eq('screenshot_hash', screenshotHash);

        if (paymentId) {
          query = query.neq('id', paymentId);
        }

        const { data: existingHashes, error: hashErr } = await query;

        if (!hashErr && existingHashes && existingHashes.length > 0) {
          isDuplicateScreenshot = true;
          const match = existingHashes[0];

          if (match.user_id !== userId) {
            riskScore += 80;
            riskFlags.push('REUSED_SCREENSHOT_DIFFERENT_ACCOUNT');
            mismatchReasons.push(
              'Duplicate Image: This exact screenshot file was previously uploaded by a different account.'
            );
          } else {
            riskScore += 35;
            riskFlags.push('REUSED_SCREENSHOT_SAME_ACCOUNT');
            mismatchReasons.push(
              `Repeated Image: You uploaded this identical receipt on previous payment request #${match.id.slice(0, 8)}.`
            );
          }
        }
      } catch (err) {
        console.warn('[fraudDetectionService] Screenshot hash check error:', err);
      }
    }

    // -------------------------------------------------------------------------
    // 4. OCR Consistency Cross-Checks
    // -------------------------------------------------------------------------
    if (ocrResult && ocrResult.status === 'success') {
      // 4A. Amount Comparison
      if (ocrResult.extractedAmount !== undefined) {
        const expectedRupees = planConfig.amountRupees;
        if (Math.abs(ocrResult.extractedAmount - expectedRupees) > 0.05) {
          isAmountMismatch = true;
          riskScore += 45;
          riskFlags.push('OCR_AMOUNT_MISMATCH');
          mismatchReasons.push(
            `Price Conflict: Screenshot shows ₹${ocrResult.extractedAmount.toFixed(2)}, but selected ${planConfig.name} requires exact ₹${expectedRupees}.00.`
          );
        }
      }

      // 4B. UTR Comparison
      if (ocrResult.extractedUtr && cleanUtr) {
        if (ocrResult.extractedUtr !== cleanUtr) {
          riskScore += 35;
          riskFlags.push('OCR_UTR_MISMATCH');
          mismatchReasons.push(
            `Reference Mismatch: Receipt text indicates reference "${ocrResult.extractedUtr}", while form entered "${cleanUtr}".`
          );
        }
      }

      // 4C. Status Comparison (Pending or Failed Screenshots)
      if (ocrResult.extractedStatus === 'PENDING') {
        isStatusMismatch = true;
        riskScore += 40;
        riskFlags.push('TRANSACTION_NOT_COMPLETED');
        mismatchReasons.push('Receipt image indicates the transaction is still pending/processing.');
      } else if (ocrResult.extractedStatus === 'FAILED') {
        isStatusMismatch = true;
        riskScore += 65;
        riskFlags.push('TRANSACTION_FAILED_SCREENSHOT');
        mismatchReasons.push('Receipt image clearly indicates a failed or declined transaction.');
      }

      // 4D. Payee Comparison
      if (ocrResult.extractedPayee) {
        const expectedVpa = planConfig.upiId.toLowerCase();
        const detectedVpa = ocrResult.extractedPayee.toLowerCase();
        if (!detectedVpa.includes('gangadhar') && !detectedVpa.includes('rento') && !detectedVpa.includes('superyes')) {
          isPayeeMismatch = true;
          riskScore += 30;
          riskFlags.push('OCR_PAYEE_MISMATCH');
          mismatchReasons.push(
            `Payee Warning: Screenshot appears addressed to "${ocrResult.extractedPayee}" instead of official VPA "${planConfig.upiId}".`
          );
        }
      }

      // 4E. Date Plausibility (Future Date)
      if (ocrResult.extractedDate) {
        const parsed = Date.parse(ocrResult.extractedDate);
        if (!isNaN(parsed) && parsed > Date.now() + 24 * 60 * 60 * 1000) {
          riskScore += 25;
          riskFlags.push('FUTURE_TRANSACTION_DATE');
          mismatchReasons.push('Receipt timestamp appears to be in the future.');
        }
      }
    }

    // -------------------------------------------------------------------------
    // 5. Account Velocity & Abuse Protection
    // -------------------------------------------------------------------------
    if (isSupabaseConfigured && supabase && userId) {
      try {
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Check recent payment requests
        const { data: recentAttempts } = await supabase
          .from('payment_requests')
          .select('id, status, created_at')
          .eq('user_id', userId)
          .gte('created_at', fifteenMinsAgo);

        if (recentAttempts && recentAttempts.length >= 4) {
          isSuspiciousPattern = true;
          riskScore += 25;
          riskFlags.push('EXCESSIVE_RAPID_SUBMISSIONS');
          mismatchReasons.push('Multiple payment submissions in a very short time window.');
        }

        // Check recent rejected payments
        const { data: recentRejections } = await supabase
          .from('payment_requests')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'rejected')
          .gte('created_at', oneDayAgo);

        if (recentRejections && recentRejections.length >= 2) {
          isSuspiciousPattern = true;
          riskScore += 20;
          riskFlags.push('MULTIPLE_RECENT_REJECTIONS');
          mismatchReasons.push(
            `Account has ${recentRejections.length} rejected payment submissions in the past 24 hours.`
          );
        }
      } catch (err) {
        console.warn('[fraudDetectionService] Velocity check notice:', err);
      }
    }

    // Cap risk score between 0 and 100
    riskScore = Math.min(100, Math.max(0, riskScore));

    // Determine Risk Level Tier
    let riskLevel: RiskLevel = 'low';
    if (riskScore >= 70) {
      riskLevel = 'high';
    } else if (riskScore >= 30) {
      riskLevel = 'medium';
    }

    return {
      riskScore,
      riskLevel,
      riskFlags,
      mismatchReasons,
      isDuplicateUtr,
      isDuplicateScreenshot,
      isAmountMismatch,
      isPayeeMismatch,
      isStatusMismatch,
      isSuspiciousPattern,
    };
  },
};
