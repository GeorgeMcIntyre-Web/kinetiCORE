/**
 * Pricing Configuration for kinetiCORE
 * Based on competitive analysis and market positioning
 */

export type PricingTier = 'free' | 'professional' | 'business' | 'enterprise';

export interface PricingFeature {
  name: string;
  included: boolean;
  limit?: string;
  tooltip?: string;
}

export interface PricingPlan {
  id: PricingTier;
  name: string;
  description: string;
  price: {
    monthly: number;
    annual: number;
    savings?: string;
  };
  stripePriceId?: {
    monthly: string;
    annual: string;
  };
  features: PricingFeature[];
  cta: string;
  highlighted?: boolean;
  customPricing?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Community',
    description: 'Perfect for students, hobbyists, and evaluation',
    price: {
      monthly: 0,
      annual: 0,
    },
    features: [
      { name: 'Up to 3 robot projects', included: true },
      { name: 'Basic kinematics solver', included: true },
      { name: 'Physics simulation (Rapier)', included: true },
      { name: 'URDF import', included: true },
      { name: 'Community support', included: true },
      { name: 'Export with watermark', included: true, limit: 'Watermarked' },
      { name: 'Commercial use', included: false },
      { name: 'Priority support', included: false },
      { name: 'Team collaboration', included: false },
    ],
    cta: 'Start Free',
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'For engineers, consultants, and small firms',
    price: {
      monthly: 49,
      annual: 490,
      savings: 'Save 2 months',
    },
    stripePriceId: {
      monthly: 'price_professional_monthly', // Replace with actual Stripe price IDs
      annual: 'price_professional_annual',
    },
    features: [
      { name: 'Unlimited projects', included: true },
      { name: 'Full kinematics solver', included: true },
      { name: 'Advanced physics simulation', included: true },
      { name: 'URDF import/export', included: true },
      { name: 'DXF/STL import', included: true },
      { name: 'Commercial license', included: true },
      { name: 'Email support', included: true },
      { name: 'Export without watermark', included: true },
      { name: 'API access', included: false },
      { name: 'Team collaboration', included: false },
    ],
    cta: 'Start 14-Day Trial',
    highlighted: true,
  },
  {
    id: 'business',
    name: 'Business',
    description: 'For growing teams and mid-size companies',
    price: {
      monthly: 149,
      annual: 1490,
      savings: 'Save 2 months',
    },
    stripePriceId: {
      monthly: 'price_business_monthly',
      annual: 'price_business_annual',
    },
    features: [
      { name: 'Everything in Professional', included: true },
      { name: 'Team collaboration (5 seats)', included: true },
      { name: 'Priority support', included: true },
      { name: 'Advanced analytics', included: true },
      { name: 'API access', included: true },
      { name: 'Custom branding', included: true },
      { name: 'SSO integration', included: true },
      { name: 'Volume discount (5+ seats)', included: true, limit: '20% off' },
    ],
    cta: 'Start 14-Day Trial',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large manufacturers and aerospace',
    price: {
      monthly: 0,
      annual: 0,
    },
    customPricing: true,
    features: [
      { name: 'Everything in Business', included: true },
      { name: 'Unlimited seats', included: true },
      { name: 'On-premise deployment', included: true },
      { name: 'Dedicated account manager', included: true },
      { name: 'Custom integrations', included: true },
      { name: '99.9% SLA guarantee', included: true },
      { name: 'Training & onboarding', included: true },
      { name: 'White-label options', included: true },
    ],
    cta: 'Contact Sales',
  },
];

/**
 * Revenue projection calculator
 */
export const calculateRevenue = (
  tier: PricingTier,
  users: number,
  billingCycle: 'monthly' | 'annual'
): number => {
  const plan = PRICING_PLANS.find((p) => p.id === tier);
  if (!plan || plan.customPricing) return 0;

  const price = billingCycle === 'monthly' ? plan.price.monthly : plan.price.annual;
  return price * users;
};

/**
 * Get recommended plan based on user needs
 */
export const getRecommendedPlan = (params: {
  teamSize: number;
  commercial: boolean;
  needsApi: boolean;
}): PricingTier => {
  if (params.teamSize > 5) return 'business';
  if (params.needsApi) return 'business';
  if (params.commercial) return 'professional';
  return 'free';
};

/**
 * Feature comparison for marketing
 */
export const COMPETITOR_COMPARISON = {
  robodk: {
    name: 'RoboDK',
    price: 2995,
    billingModel: 'perpetual',
    deployment: 'desktop',
  },
  solidworks: {
    name: 'SolidWorks + CAMWorks',
    price: 12000,
    billingModel: 'perpetual + annual maintenance',
    deployment: 'desktop',
  },
  gazebo: {
    name: 'Gazebo',
    price: 0,
    billingModel: 'free (open-source)',
    deployment: 'desktop',
  },
  kineticore: {
    name: 'kinetiCORE',
    price: 490,
    billingModel: 'annual subscription',
    deployment: 'web-based',
  },
};
