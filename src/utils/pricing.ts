import { SubscriptionPlan, SubscriptionPlanId, PriceBreakdown } from '../types';

/**
 * Illustrative GST rate (18%) used for demonstration purposes.
 * Note: Subject to confirmation before commercial launch.
 */
export const DEFAULT_GST_RATE = 0.18;

/**
 * Centralized configuration for Rento PG Owner Subscription Plans.
 * Low, accessible pricing with 18% GST calculation.
 */
export const OWNER_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Starter',
    tagline: 'Ideal for standalone PG owners starting out',
    basePrice: 49,
    billingInterval: 'month',
    listingLimit: 1,
    description: 'Ideal for standalone PG owners starting out',
    features: [
      'Manage 1 PG property',
      'Full property listing management',
      'Room & bed availability tracking',
      'Student enquiries & visit requests',
      'Standard search placement',
    ],
    isRecommended: false,
    badge: 'Starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Recommended for growing PG owners with multiple properties',
    description: 'Recommended for growing PG owners with multiple properties',
    basePrice: 99,
    billingInterval: 'month',
    listingLimit: 3,
    features: [
      'Manage up to 3 PG properties',
      'All Starter features included',
      'Combined enquiry management inbox',
      'Portfolio occupancy overview',
      'Basic property analytics & views',
      'Priority student inquiries placement',
    ],
    isRecommended: true,
    badge: 'Recommended',
  },
  {
    id: 'pro_plus',
    name: 'Pro Plus',
    tagline: 'Comprehensive solution for commercial coliving chains',
    description: 'Comprehensive solution for commercial coliving chains',
    basePrice: 199,
    billingInterval: 'month',
    listingLimit: Infinity, // Unlimited properties
    features: [
      'Unlimited PG properties',
      'All Pro features included',
      'Centralized multi-property operations',
      'Advanced portfolio analytics & revenue',
      'Priority support as an enterprise benefit',
      'Custom room tier management',
    ],
    isRecommended: true,
    badge: 'Enterprise',
  },
];

/**
 * Rento Student Access Pass (₹9 with GST included).
 * Unlocks enquiries, bed booking, PG comparisons, and live Google Maps locations.
 */
export const STUDENT_SUBSCRIPTION_PLAN = {
  id: 'student_pass' as const,
  name: 'Student Access Pass',
  tagline: 'Unlock all PG features: booking, messaging, live locations & comparisons',
  basePrice: 7.63,
  gstAmount: 1.37,
  totalPrice: 9.00,
  billingInterval: 'month' as const,
  features: [
    'Unlock exact property addresses & live Google Maps directions',
    'Direct messaging & chat with PG property managers',
    'Schedule free in-person room visits',
    'Reserve verified beds & pay advance booking fee',
    'Full side-by-side multi-PG comparison tool',
  ],
};

/**
 * Calculates base price, GST amount and final monthly total.
 * Consistent rounding to 2 decimal places.
 */
export function calculatePlanPrice(
  basePrice: number,
  gstRate: number = DEFAULT_GST_RATE
): PriceBreakdown {
  const gstAmount = Math.round(basePrice * gstRate * 100) / 100;
  const totalAmount = Math.round((basePrice + gstAmount) * 100) / 100;

  return {
    basePrice,
    gstRate,
    gstPercentage: Math.round(gstRate * 100),
    gstRatePercent: Math.round(gstRate * 100),
    gstAmount,
    totalAmount,
    totalMonthlyPrice: totalAmount,
  };
}

/**
 * Formats a numeric currency value into standardized Indian Rupee (INR) format
 * with consistent 2 decimal places.
 * Example: 499 -> "₹499.00", 588.82 -> "₹588.82"
 */
export function formatINR(amount: number): string {
  if (isNaN(amount)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a currency value compactly without decimals if whole,
 * useful for badges or headers.
 */
export function formatINRCompact(amount: number): string {
  if (isNaN(amount)) return '₹0';
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Retrieves a plan by ID. Defaults to 'pro' if not found.
 */
export function getSubscriptionPlan(planId: SubscriptionPlanId | string): SubscriptionPlan {
  const found = OWNER_SUBSCRIPTION_PLANS.find(p => p.id === planId);
  return found || OWNER_SUBSCRIPTION_PLANS[1]; // default to 'pro'
}

/**
 * Returns human-readable listing limit text.
 */
export function formatListingLimit(limit: number): string {
  if (limit === Infinity || limit >= 999) {
    return 'Unlimited PGs';
  }
  if (limit === 1) {
    return '1 PG listing';
  }
  return `Up to ${limit} PGs`;
}

export interface PlanPaymentDetails {
  planId: string;
  name: string;
  userType: 'student' | 'owner';
  amountRupees: number;
  amountPaise: number;
  qrCodeUrl: string;
  upiId: string;
  description: string;
}

export const PLAN_PAYMENT_CONFIG: Record<string, PlanPaymentDetails> = {
  student_pass: {
    planId: 'student_pass',
    name: 'Student Lifetime Access Pass',
    userType: 'student',
    amountRupees: 9,
    amountPaise: 900,
    qrCodeUrl: '/qr/qr_student_9.jpg',
    upiId: 'gangadhar.66@superyes',
    description: 'Lifetime access to PG comparisons, booking, direct messaging & live Google Maps addresses.',
  },
  basic: {
    planId: 'basic',
    name: 'Starter Plan (1 PG)',
    userType: 'owner',
    amountRupees: 49,
    amountPaise: 4900,
    qrCodeUrl: '/qr/qr_owner_basic_49.jpg',
    upiId: 'rento.owners@icici',
    description: 'Monthly subscription to manage 1 active PG accommodation.',
  },
  pro: {
    planId: 'pro',
    name: 'Pro Plan (Up to 3 PGs)',
    userType: 'owner',
    amountRupees: 99,
    amountPaise: 9900,
    qrCodeUrl: '/qr/qr_owner_pro_99.jpg',
    upiId: 'rento.owners@icici',
    description: 'Monthly subscription to manage up to 3 PG accommodations.',
  },
  pro_plus: {
    planId: 'pro_plus',
    name: 'Pro Plus Plan (Unlimited PGs)',
    userType: 'owner',
    amountRupees: 199,
    amountPaise: 19900,
    qrCodeUrl: '/qr/qr_owner_pro_plus_199.jpg',
    upiId: 'rento.owners@icici',
    description: 'Enterprise monthly plan with unlimited accommodations and priority support.',
  },
};

export function getPlanPaymentConfig(planId: string): PlanPaymentDetails {
  return PLAN_PAYMENT_CONFIG[planId] || PLAN_PAYMENT_CONFIG.student_pass;
}

