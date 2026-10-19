import { createWorker } from 'tesseract.js';
import { OcrExtractionResult } from '../types';
import { normalizeUtr, validateUtr } from '../utils/utrValidation';

/**
 * OCR Service for Automated Receipt Consistency Checks
 *
 * NOTE: OCR is used exclusively for extracting textual fields and comparing them
 * with user-entered form data for triage. OCR CANNOT prove that an image has not
 * been edited or that money has cleared.
 *
 * If OCR fails or is inconclusive, the payment submission is ALWAYS preserved
 * for human administrator review and never rejected automatically.
 */
export const ocrService = {
  /**
   * Performs optical character recognition on an uploaded receipt file.
   * Extracts UTR, amount, payee, date/time, status, and app identifier.
   */
  async extractReceiptData(
    imageFile: File | Blob | string,
    expectedAmountPaise?: number,
    expectedUtr?: string
  ): Promise<OcrExtractionResult> {
    try {
      // Initialize Tesseract worker
      const worker = await createWorker('eng');
      const ret = await worker.recognize(imageFile);
      await worker.terminate();

      const rawText = ret.data.text || '';
      const confidence = Math.round(ret.data.confidence || 0);

      if (!rawText.trim()) {
        return {
          status: 'failed',
          confidence: 0,
          rawText: '',
          mismatchReasons: ['Receipt image contains no legible text. Requires manual review.'],
        };
      }

      return this.parseExtractedText(rawText, confidence, expectedAmountPaise, expectedUtr);
    } catch (err: any) {
      console.warn('[ocrService] OCR processing notice:', err?.message || err);
      // Non-fatal fallback: preserve submission for manual review
      return {
        status: 'failed',
        confidence: 0,
        rawText: '',
        mismatchReasons: [
          'Automated text extraction was inconclusive or unsupported on this device. Manual administrator verification required.',
        ],
      };
    }
  },

  /**
   * Parses raw OCR text with multi-app heuristics (Google Pay, PhonePe, Paytm, BHIM, etc.)
   */
  parseExtractedText(
    rawText: string,
    confidence: number,
    expectedAmountPaise?: number,
    expectedUtr?: string
  ): OcrExtractionResult {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const normalizedRaw = rawText.replace(/\r\n/g, ' ').replace(/\n/g, ' ');

    // 1. Detect Payment App
    let detectedApp: string | undefined;
    if (/google\s*pay|gpay/i.test(normalizedRaw)) {
      detectedApp = 'Google Pay';
    } else if (/phonepe/i.test(normalizedRaw)) {
      detectedApp = 'PhonePe';
    } else if (/paytm/i.test(normalizedRaw)) {
      detectedApp = 'Paytm';
    } else if (/bhim/i.test(normalizedRaw)) {
      detectedApp = 'BHIM';
    } else if (/cred/i.test(normalizedRaw)) {
      detectedApp = 'CRED';
    } else if (/amazon\s*pay/i.test(normalizedRaw)) {
      detectedApp = 'Amazon Pay';
    } else if (/hdfc/i.test(normalizedRaw)) {
      detectedApp = 'HDFC Bank';
    } else if (/icici/i.test(normalizedRaw)) {
      detectedApp = 'ICICI Bank';
    } else if (/axis/i.test(normalizedRaw)) {
      detectedApp = 'Axis Bank';
    } else if (/sbi|yono/i.test(normalizedRaw)) {
      detectedApp = 'State Bank of India';
    }

    // 2. Extract Transaction Reference / UTR
    let extractedUtr: string | undefined;

    // Pattern A: Labeled UTR / UPI Ref / RRN
    const labeledUtrMatch = normalizedRaw.match(
      /(?:UPI\s*(?:Transaction\s*ID|Ref(?:\s*No|\s*ID)?)|UTR(?:\s*No)?|Txn\s*ID|RRN|Ref\s*No)[\s:#\-_/]+([A-Za-z0-9]{10,18})\b/i
    );
    if (labeledUtrMatch && labeledUtrMatch[1]) {
      const candidate = normalizeUtr(labeledUtrMatch[1]);
      if (validateUtr(candidate).isValid) {
        extractedUtr = candidate;
      }
    }

    // Pattern B: Look for 12-digit numeric sequences
    if (!extractedUtr) {
      const twelveDigitMatches = normalizedRaw.match(/\b\d{12}\b/g);
      if (twelveDigitMatches && twelveDigitMatches.length > 0) {
        for (const candidate of twelveDigitMatches) {
          if (validateUtr(candidate).isValid) {
            extractedUtr = candidate;
            break;
          }
        }
      }
    }

    // Pattern C: If expectedUtr was provided, check if it appears in raw text
    if (!extractedUtr && expectedUtr) {
      const cleanExpected = normalizeUtr(expectedUtr);
      if (cleanExpected && normalizedRaw.toUpperCase().includes(cleanExpected)) {
        extractedUtr = cleanExpected;
      }
    }

    // 3. Extract Amount
    let extractedAmount: number | undefined;
    const amountMatches = normalizedRaw.match(/(?:₹|INR|Rs\.?)\s*([0-9]+(?:\.[0-9]{1,2})?)/gi);
    if (amountMatches && amountMatches.length > 0) {
      for (const m of amountMatches) {
        const numMatch = m.match(/([0-9]+(?:\.[0-9]{1,2})?)/);
        if (numMatch && numMatch[1]) {
          const val = parseFloat(numMatch[1]);
          if (!isNaN(val) && val > 0 && val < 100000) {
            extractedAmount = val;
            break;
          }
        }
      }
    }

    if (!extractedAmount) {
      // Fallback: standalone number near 'Paid' or 'Total' or 'Amount'
      const standaloneMatch = normalizedRaw.match(/(?:Paid|Total|Amount|Transferred)[\s:]*([0-9]+(?:\.[0-9]{2})?)/i);
      if (standaloneMatch && standaloneMatch[1]) {
        const val = parseFloat(standaloneMatch[1]);
        if (!isNaN(val) && val > 0) extractedAmount = val;
      }
    }

    // 4. Extract Status
    let extractedStatus: 'SUCCESS' | 'PENDING' | 'FAILED' | 'UNKNOWN' = 'UNKNOWN';
    if (/paid\s*successfully|payment\s*successful|completed|successful|transaction\s*successful|transfer\s*successful/i.test(normalizedRaw)) {
      extractedStatus = 'SUCCESS';
    } else if (/pending|processing|in\s*progress|awaiting\s*confirmation/i.test(normalizedRaw)) {
      extractedStatus = 'PENDING';
    } else if (/failed|declined|cancelled|reversed|payment\s*failed/i.test(normalizedRaw)) {
      extractedStatus = 'FAILED';
    }

    // 5. Extract Payee / VPA handle
    let extractedPayee: string | undefined;
    const vpaMatch = normalizedRaw.match(/[a-zA-Z0-9.\-_]{2,30}@[a-zA-Z]{2,15}/);
    if (vpaMatch) {
      extractedPayee = vpaMatch[0];
    } else if (/gangadhar/i.test(normalizedRaw)) {
      extractedPayee = 'gangadhar.66@superyes';
    } else if (/rento/i.test(normalizedRaw)) {
      extractedPayee = 'Rento Technologies';
    }

    // 6. Extract Date & Time
    let extractedDate: string | undefined;
    const dateMatch = normalizedRaw.match(
      /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}(?:,\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)?)/i
    ) || normalizedRaw.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)?)/i);

    if (dateMatch) {
      extractedDate = dateMatch[0];
    }

    // 7. Assess Consistency Mismatch Reasons
    const mismatchReasons: string[] = [];

    // Amount Check
    if (expectedAmountPaise && extractedAmount !== undefined) {
      const expectedRupees = expectedAmountPaise / 100;
      if (Math.abs(extractedAmount - expectedRupees) > 0.05) {
        mismatchReasons.push(
          `Amount Mismatch: Screenshot shows ₹${extractedAmount.toFixed(2)}, but selected plan requires exact ₹${expectedRupees.toFixed(2)}.`
        );
      }
    }

    // UTR Check
    if (expectedUtr && extractedUtr) {
      const cleanExpected = normalizeUtr(expectedUtr);
      if (extractedUtr !== cleanExpected) {
        mismatchReasons.push(
          `UTR Mismatch: Screenshot appears to show reference "${extractedUtr}", but form submitted "${cleanExpected}".`
        );
      }
    }

    // Status Check
    if (extractedStatus === 'PENDING') {
      mismatchReasons.push('Receipt indicates transaction is still in "Pending" or "Processing" state.');
    } else if (extractedStatus === 'FAILED') {
      mismatchReasons.push('Receipt indicates transaction has "Failed" or was "Declined".');
    }

    return {
      status: 'success',
      confidence,
      rawText: rawText.slice(0, 3000), // Cap for database storage
      extractedUtr,
      extractedAmount,
      extractedCurrency: 'INR',
      extractedPayee,
      extractedDate,
      extractedStatus,
      detectedApp,
      mismatchReasons,
    };
  },
};
