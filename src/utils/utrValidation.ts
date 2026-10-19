/**
 * Comprehensive UPI Transaction Reference (UTR / RRN) Validation & Normalization
 * Supports standard NPCI 12-digit numeric UTRs and bank/UPI app reference formats
 * (Google Pay, PhonePe, Paytm, BHIM, CRED, Amazon Pay, iMobile, YONO, etc.)
 */

export interface UtrValidationResult {
  isValid: boolean;
  error?: string;
  normalizedUtr: string;
  formatType?: 'npci_12_digit' | 'bank_alphanumeric_10_18' | 'bank_alphanumeric_10_35';
  format?: 'npci_12_digit' | 'bank_alphanumeric_10_18' | 'bank_alphanumeric_10_35';
  detectedAppHint?: string;
}

export interface UpiAppGuideItem {
  app: string;
  appName: string;
  hint: string;
  fieldLabel: string;
  digits: string;
  notes: string;
}

// Obvious dummy / sequential patterns rejected as fraudulent
const REJECTED_PATTERNS = [
  /^0+$/, // All zeros
  /^1+$/, // All ones
  /^9+$/, // All nines
  /^(.)\1{9,}$/, // Any repeating single character 10+ times
  /^(123456789012|012345678901|987654321098|234567890123)$/, // Sequential
  /^(TEST|DEMO|MOCK|FAKE|SAMPLE|NULL|UNDEFINED|ABCD|QWER)/i, // Test labels
];

/**
 * Normalizes a raw user-inputted UTR or Transaction ID:
 * - Trims leading & trailing whitespace
 * - Strips common prefixes like "Transaction ID:", "Txn ID:", "UTR:", "UPI/", "REF:", "#"
 * - Removes internal spaces, hyphens, and dots
 * - Converts to uppercase
 */
export function normalizeUtr(raw: string): string {
  if (!raw) return '';

  let cleaned = raw.trim();

  // Strip common label prefixes (e.g. "Transaction ID: ", "Txn ID: ", "UTR: ", "UPI Ref: ", etc.)
  cleaned = cleaned.replace(
    /^(?:(?:UPI\s*)?(?:TRANSACTION\s*ID|TXN\s*(?:ID)?|TRANSACTION\s*REF(?:ERENCE)?)|UTR(?:\s*NO|\s*NUMBER)?|UPI\s*REF(?:\s*NO|\s*ID)?|REF(?:\s*NO|\s*ID)?|REFERENCE|RRN|#)\s*[:\-_/]\s*/i,
    ''
  );

  // Fallback for short prefixes
  cleaned = cleaned.replace(/^(UTR\s*[:\-_/]\s*|UPI\s*[:\-_/]\s*|REF\s*[:\-_/]\s*|TXN\s*[:\-_/]\s*|#\s*)/i, '');

  // Strip internal separators (spaces, dashes, underscores, dots)
  cleaned = cleaned.replace(/[\s\-_.]/g, '');

  return cleaned.toUpperCase();
}

/**
 * Validates a UPI Transaction Reference / UTR / Transaction ID with strict rules:
 * 1. Must not be empty.
 * 2. Must only contain alphanumeric characters (A-Z, 0-9).
 * 3. Length must be between 10 and 35 characters (standard NPCI is 12 digits; Google Pay / PhonePe transaction IDs range 18-25).
 * 4. Rejects dummy/mock strings (e.g. 123456789012, 000000000000, TEST...).
 */
export function validateUtr(raw: string): UtrValidationResult {
  const normalizedUtr = normalizeUtr(raw);

  if (!normalizedUtr) {
    return {
      isValid: false,
      error: 'Please enter your UPI transaction reference (UTR or Transaction ID).',
      normalizedUtr: '',
    };
  }

  // Check for invalid characters
  if (!/^[A-Z0-9]+$/.test(normalizedUtr)) {
    return {
      isValid: false,
      error: 'Invalid characters in reference. Only letters and numbers are allowed.',
      normalizedUtr,
    };
  }

  // Length check (UPI standard is 12 digits; app transaction IDs & bank references range 10-35)
  if (normalizedUtr.length < 10) {
    return {
      isValid: false,
      error: `Reference is too short (${normalizedUtr.length} chars). Standard UPI UTR is 12 digits, and Transaction IDs are 10–35 characters.`,
      normalizedUtr,
    };
  }

  if (normalizedUtr.length > 35) {
    return {
      isValid: false,
      error: `Reference is too long (${normalizedUtr.length} chars). Maximum allowed is 35 characters.`,
      normalizedUtr,
    };
  }

  // Check against fake / dummy sequences
  for (const pattern of REJECTED_PATTERNS) {
    if (pattern.test(normalizedUtr)) {
      return {
        isValid: false,
        error: 'Invalid or sample transaction reference. Please enter the authentic UTR or Transaction ID from your UPI payment receipt.',
        normalizedUtr,
      };
    }
  }

  // Format type classification
  const isNpci12Digit = /^\d{12}$/.test(normalizedUtr);
  const formatType = isNpci12Digit ? 'npci_12_digit' : 'bank_alphanumeric_10_35';

  // Detected UPI app hint
  let detectedAppHint: string | undefined;
  if (isNpci12Digit) {
    detectedAppHint = 'Standard 12-Digit NPCI UPI Ref (Google Pay / PhonePe / Paytm / BHIM / CRED)';
  } else if (/^T\d{16,}/.test(normalizedUtr)) {
    detectedAppHint = 'Google Pay / PhonePe Transaction ID';
  } else if (/^[A-Z]{2,4}\d{8,}/.test(normalizedUtr)) {
    detectedAppHint = 'Bank Gateway Reference (HDFC / ICICI / Axis / SBI)';
  } else {
    detectedAppHint = 'Alphanumeric Transaction Reference';
  }

  return {
    isValid: true,
    normalizedUtr,
    formatType,
    format: formatType,
    detectedAppHint,
  };
}

/**
 * Helpful helper text showing where to find the UTR or Transaction ID in popular apps.
 */
export const UPI_APP_UTR_GUIDE: UpiAppGuideItem[] = [
  {
    app: 'Google Pay',
    appName: 'Google Pay',
    hint: 'Look for "Transaction ID" or "UPI transaction ID" under Transaction details',
    fieldLabel: 'Transaction ID / UPI transaction ID',
    digits: '12–25 characters',
    notes: 'Found in payment details under Transaction details (e.g. T26...)',
  },
  {
    app: 'PhonePe',
    appName: 'PhonePe',
    hint: 'Look for "UTR" or "Transaction ID" under Transfer Details',
    fieldLabel: 'UTR / Transaction ID',
    digits: '12–25 characters',
    notes: 'Found under Transfer Details or Transaction ID (starts with T or 12 digits)',
  },
  {
    app: 'Paytm',
    appName: 'Paytm',
    hint: 'Look for "UPI Ref No." or "UPI Transaction ID" in receipt details',
    fieldLabel: 'UPI Ref No. / Transaction ID',
    digits: '12–25 characters',
    notes: 'Found in the completed payment details',
  },
  {
    app: 'BHIM / Others',
    appName: 'BHIM / Others',
    hint: 'Look for "Transaction ID", "UPI Reference ID" or "RRN"',
    fieldLabel: 'Transaction ID / UPI Reference ID / RRN',
    digits: '10–35 characters',
    notes: 'Found on the completed payment summary screen',
  },
];
