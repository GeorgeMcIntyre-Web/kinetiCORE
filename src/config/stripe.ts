/**
 * Stripe Integration Configuration
 * Owner: George (Agent 3 - Hosting & Pricing)
 *
 * IMPORTANT: Replace with actual Stripe API keys from https://dashboard.stripe.com/apikeys
 * Use test keys for development, production keys for deployment
 */

export const STRIPE_CONFIG = {
  // Publishable key (safe to expose in frontend)
  publishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_YOUR_KEY_HERE',

  // Price IDs from Stripe Dashboard (https://dashboard.stripe.com/prices)
  priceIds: {
    professional: {
      monthly: process.env.VITE_STRIPE_PROFESSIONAL_MONTHLY || 'price_professional_monthly',
      annual: process.env.VITE_STRIPE_PROFESSIONAL_ANNUAL || 'price_professional_annual',
    },
    business: {
      monthly: process.env.VITE_STRIPE_BUSINESS_MONTHLY || 'price_business_monthly',
      annual: process.env.VITE_STRIPE_BUSINESS_ANNUAL || 'price_business_annual',
    },
  },

  // Success/Cancel URLs for Stripe Checkout
  successUrl: `${window.location.origin}/payment/success`,
  cancelUrl: `${window.location.origin}/pricing`,

  // Customer portal URL (for managing subscriptions)
  customerPortalUrl: 'https://billing.stripe.com/p/login/YOUR_PORTAL_ID',
};

/**
 * Type definitions for Stripe integration
 */
export interface StripeCheckoutParams {
  priceId: string;
  customerId?: string;
  email?: string;
  trialDays?: number;
}

/**
 * Environment-specific configuration
 */
export const isProduction = import.meta.env.PROD;
export const isDevelopment = import.meta.env.DEV;

/**
 * Stripe initialization check
 */
export const isStripeConfigured = (): boolean => {
  return (
    STRIPE_CONFIG.publishableKey !== 'pk_test_YOUR_KEY_HERE' &&
    STRIPE_CONFIG.publishableKey.startsWith('pk_')
  );
};

/**
 * Get checkout session configuration
 */
export const getCheckoutConfig = (params: StripeCheckoutParams) => {
  return {
    mode: 'subscription' as const,
    lineItems: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    successUrl: STRIPE_CONFIG.successUrl,
    cancelUrl: STRIPE_CONFIG.cancelUrl,
    customerEmail: params.email,
    subscriptionData: params.trialDays
      ? {
          trialPeriodDays: params.trialDays,
        }
      : undefined,
  };
};

/**
 * TODO: Implement these functions when Stripe is integrated
 *
 * 1. Install Stripe: npm install @stripe/stripe-js
 * 2. Create Stripe account: https://dashboard.stripe.com/register
 * 3. Create products and prices in Stripe Dashboard
 * 4. Add environment variables to .env:
 *    - VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
 *    - VITE_STRIPE_PROFESSIONAL_MONTHLY=price_...
 *    - VITE_STRIPE_PROFESSIONAL_ANNUAL=price_...
 *    - VITE_STRIPE_BUSINESS_MONTHLY=price_...
 *    - VITE_STRIPE_BUSINESS_ANNUAL=price_...
 * 5. Set up webhook endpoint for subscription events
 * 6. Implement server-side checkout session creation (Cloudflare Workers)
 */
