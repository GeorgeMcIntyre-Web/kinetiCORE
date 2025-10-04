/**
 * Zustand store for subscription and billing state
 * Owner: George (Agent 3 - Hosting & Pricing Implementation)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PricingTier } from '../../config/pricing';

export interface SubscriptionFeatureLimits {
  maxProjects: number | null; // null = unlimited
  hasCommercialLicense: boolean;
  hasApiAccess: boolean;
  hasTeamCollaboration: boolean;
  teamSeats: number;
  hasPrioritySupport: boolean;
  hasCustomBranding: boolean;
  hasSSO: boolean;
  canExportWithoutWatermark: boolean;
}

export interface SubscriptionState {
  // Current subscription
  tier: PricingTier;
  billingCycle: 'monthly' | 'annual';
  status: 'active' | 'trial' | 'expired' | 'free';

  // Trial information
  trialEndsAt: number | null; // Unix timestamp
  trialDaysRemaining: number;

  // Usage tracking
  projectCount: number;

  // Stripe integration (future)
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;

  // Feature limits based on tier
  limits: SubscriptionFeatureLimits;

  // Actions
  setTier: (tier: PricingTier, billingCycle?: 'monthly' | 'annual') => void;
  startTrial: (tier: PricingTier) => void;
  cancelTrial: () => void;
  updateProjectCount: (count: number) => void;
  canCreateProject: () => boolean;
  getFeatureLimit: <K extends keyof SubscriptionFeatureLimits>(
    feature: K
  ) => SubscriptionFeatureLimits[K];
  getDaysRemainingInTrial: () => number;
}

// Feature limits by tier
const TIER_LIMITS: Record<PricingTier, SubscriptionFeatureLimits> = {
  free: {
    maxProjects: 3,
    hasCommercialLicense: false,
    hasApiAccess: false,
    hasTeamCollaboration: false,
    teamSeats: 1,
    hasPrioritySupport: false,
    hasCustomBranding: false,
    hasSSO: false,
    canExportWithoutWatermark: false,
  },
  professional: {
    maxProjects: null, // Unlimited
    hasCommercialLicense: true,
    hasApiAccess: false,
    hasTeamCollaboration: false,
    teamSeats: 1,
    hasPrioritySupport: false,
    hasCustomBranding: false,
    hasSSO: false,
    canExportWithoutWatermark: true,
  },
  business: {
    maxProjects: null,
    hasCommercialLicense: true,
    hasApiAccess: true,
    hasTeamCollaboration: true,
    teamSeats: 5,
    hasPrioritySupport: true,
    hasCustomBranding: true,
    hasSSO: true,
    canExportWithoutWatermark: true,
  },
  enterprise: {
    maxProjects: null,
    hasCommercialLicense: true,
    hasApiAccess: true,
    hasTeamCollaboration: true,
    teamSeats: 999999, // Effectively unlimited
    hasPrioritySupport: true,
    hasCustomBranding: true,
    hasSSO: true,
    canExportWithoutWatermark: true,
  },
};

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      // Initial state - Free tier
      tier: 'free',
      billingCycle: 'monthly',
      status: 'free',
      trialEndsAt: null,
      trialDaysRemaining: 0,
      projectCount: 0,
      limits: TIER_LIMITS.free,

      // Change subscription tier
      setTier: (tier, billingCycle = 'monthly') => {
        set({
          tier,
          billingCycle,
          status: tier === 'free' ? 'free' : 'active',
          limits: TIER_LIMITS[tier],
          trialEndsAt: null,
          trialDaysRemaining: 0,
        });
      },

      // Start 14-day trial
      startTrial: (tier) => {
        const now = Date.now();
        const trialEndsAt = now + 14 * 24 * 60 * 60 * 1000; // 14 days

        set({
          tier,
          status: 'trial',
          trialEndsAt,
          trialDaysRemaining: 14,
          limits: TIER_LIMITS[tier],
        });
      },

      // Cancel trial and revert to free
      cancelTrial: () => {
        set({
          tier: 'free',
          status: 'free',
          trialEndsAt: null,
          trialDaysRemaining: 0,
          limits: TIER_LIMITS.free,
        });
      },

      // Update project count (called when projects are created/deleted)
      updateProjectCount: (count) => {
        set({ projectCount: count });
      },

      // Check if user can create another project
      canCreateProject: () => {
        const { projectCount, limits } = get();
        if (limits.maxProjects === null) return true; // Unlimited
        return projectCount < limits.maxProjects;
      },

      // Get specific feature limit
      getFeatureLimit: (feature) => {
        return get().limits[feature];
      },

      // Calculate days remaining in trial
      getDaysRemainingInTrial: () => {
        const { trialEndsAt, status } = get();
        if (status !== 'trial' || !trialEndsAt) return 0;

        const now = Date.now();
        const remaining = trialEndsAt - now;
        if (remaining <= 0) {
          // Trial expired
          set({ status: 'expired', trialDaysRemaining: 0 });
          return 0;
        }

        const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
        set({ trialDaysRemaining: days });
        return days;
      },
    }),
    {
      name: 'kineticore-subscription', // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        tier: state.tier,
        billingCycle: state.billingCycle,
        status: state.status,
        trialEndsAt: state.trialEndsAt,
        projectCount: state.projectCount,
        stripeCustomerId: state.stripeCustomerId,
        stripeSubscriptionId: state.stripeSubscriptionId,
      }),
    }
  )
);
