/**
 * Comprehensive UPI Transaction Reference (UTR / RRN) Validation & Normalization
 * Supports standard NPCI 12-digit numeric UTRs and bank/UPI app reference formats
 * (Google Pay, PhonePe, Paytm, BHIM, CRED, Amazon Pay, iMobile, YONO, etc.)
 */

export interface UtrValidationResult {
  isValid: boolean;
  error?: string;
  normalizedUtr: string;
  formatType?: 'npci_12_digit' | 'bank_alphanumeric_10_18';
  format?: 'npci_12_digit' | 'bank_alphanumeric_10_18';
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
 * Normalizes a raw user-inputted UTR:
 * - Trims leading & trailing whitespace
 * - Strips common prefixes like "UTR:", "UTR-", "UPI/", "REF:", "#"
 * - Removes internal spaces, hyphens, and dots
 * - Converts to uppercase
 */
export function normalizeUtr(raw: string): string {
  if (!raw) return '';

  let cleaned = raw.trim();

  // Strip common label prefixes
  cleaned = cleaned.replace(/^(UTR\s*[:\-_/]\s*|UPI\s*[:\-_/]\s*|REF\s*[:\-_/]\s*|TXN\s*[:\-_/]\s*|#\s*)/i, '');

  // Strip internal separators (spaces, dashes, underscores, dots)
  cleaned = cleaned.replace(/[\s\-_.]/g, '');

  return cleaned.toUpperCase();
}

/**
 * Validates a UPI Transaction Reference / UTR with strict rules:
 * 1. Must not be empty.
 * 2. Must only contain alphanumeric characters (A-Z, 0-9).
 * 3. Length must be between 10 and 18 characters (standard NPCI is exactly 12 digits).
 * 4. Rejects dummy/mock strings (e.g. 123456789012, 000000000000, TEST...).
 */
export function validateUtr(raw: string): UtrValidationResult {
  const normalizedUtr = normalizeUtr(raw);

  if (!normalizedUtr) {
    return {
      isValid: false,
      error: 'Please enter your UPI transaction reference (UTR).',
      normalizedUtr: '',
    };
  }

  // Check for invalid characters
  if (!/^[A-Z0-9]+$/.test(normalizedUtr)) {
    return {
      isValid: false,
      error: 'Invalid characters in UTR. Only letters and numbers are allowed.',
      normalizedUtr,
    };
  }

  // Length check (UPI standard is 12 digits; bank references range 10-18)
  if (normalizedUtr.length < 10) {
    return {
      isValid: false,
      error: `UTR is too short (${normalizedUtr.length} chars). Standard UPI UTR is 12 digits.`,
      normalizedUtr,
    };
  }

  if (normalizedUtr.length > 18) {
    return {
      isValid: false,
      error: `UTR is too long (${normalizedUtr.length} chars). Maximum allowed is 18 characters.`,
      normalizedUtr,
    };
  }

  // Check against fake / dummy sequences
  for (const pattern of REJECTED_PATTERNS) {
    if (pattern.test(normalizedUtr)) {
      return {
        isValid: false,
        error: 'Invalid or sample transaction reference. Please enter the authentic UTR from your UPI payment receipt.',
        normalizedUtr,
      };
    }
  }

  // Format type classification
  const isNpci12Digit = /^\d{12}$/.test(normalizedUtr);
  const formatType = isNpci12Digit ? 'npci_12_digit' : 'bank_alphanumeric_10_18';

  // Detected UPI app hint
  let detectedAppHint: string | undefined;
  if (isNpci12Digit) {
    detectedAppHint = 'Standard 12-Digit NPCI UPI Ref (Google Pay / PhonePe / Paytm / BHIM / CRED)';
  } else if (/^T\d{18,}/.test(normalizedUtr)) {
    detectedAppHint = 'PhonePe Transaction ID';
  } else if (/^[A-Z]{2,4}\d{10,}/.test(normalizedUtr)) {
    detectedAppHint = 'Bank Gateway Reference (HDFC / ICICI / Axis / SBI)';
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
 * Helpful helper text showing where to find the 12-digit UTR in popular apps.
 */
export const UPI_APP_UTR_GUIDE: UpiAppGuideItem[] = [
  {
    app: 'Google Pay',
    appName: 'Google Pay',
    hint: 'Look for "UPI transaction ID" (12 digits)',
    fieldLabel: 'UPI transaction ID',
    digits: '12 digits',
    notes: 'Found in payment details under Completed transaction',
  },
  {
    app: 'PhonePe',
    appName: 'PhonePe',
    hint: 'Look for "UTR" (12 digits under Transfer Details)',
    fieldLabel: 'UTR',
    digits: '12 digits',
    notes: 'Found under Transfer Details or Transaction ID',
  },
  {
    app: 'Paytm',
    appName: 'Paytm',
    hint: 'Look for "UPI Ref No." in receipt details (12 digits)',
    fieldLabel: 'UPI Ref No.',
    digits: '12 digits',
    notes: 'Found in the completed payment details',
  },
  {
    app: 'BHIM / Others',
    appName: 'BHIM / Others',
    hint: 'Look for "UPI Reference ID" or "RRN"',
    fieldLabel: 'UPI Reference ID / RRN',
    digits: '12 digits',
    notes: 'Found on the completed payment summary screen',
  },
];
