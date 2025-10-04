/**
 * Pricing Page Component
 * Owner: George (Agent 3 - Hosting & Pricing)
 * Displays subscription tiers with competitive positioning
 */

import React from 'react';
import { PRICING_PLANS, COMPETITOR_COMPARISON } from '../../config/pricing';
import { useSubscriptionStore } from '../store/subscriptionStore';
import type { PricingTier } from '../../config/pricing';
import './PricingPage.css';

interface PricingPageProps {
  onClose?: () => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onClose }) => {
  const { tier: currentTier, startTrial } = useSubscriptionStore();
  const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'annual'>('annual');

  const handleSelectPlan = (tier: PricingTier) => {
    if (tier === 'free') {
      // Downgrade to free
      useSubscriptionStore.getState().setTier('free');
      alert('Switched to Free tier');
    } else if (tier === 'enterprise') {
      // Open contact form (future implementation)
      alert('Enterprise sales coming soon! Email: sales@kineticore.com');
    } else {
      // Start trial for Professional or Business
      startTrial(tier);
      alert(`Started 14-day trial of ${tier === 'professional' ? 'Professional' : 'Business'} plan!`);
    }

    if (onClose) onClose();
  };

  return (
    <div className="pricing-page">
      <div className="pricing-header">
        <h1>Choose Your Plan</h1>
        <p className="pricing-subtitle">
          Industrial robot simulation at 10x lower cost than competitors
        </p>

        {/* Billing toggle */}
        <div className="billing-toggle">
          <button
            className={billingCycle === 'monthly' ? 'active' : ''}
            onClick={() => setBillingCycle('monthly')}
          >
            Monthly
          </button>
          <button
            className={billingCycle === 'annual' ? 'active' : ''}
            onClick={() => setBillingCycle('annual')}
          >
            Annual
            <span className="savings-badge">Save 17%</span>
          </button>
        </div>
      </div>

      {/* Pricing cards */}
      <div className="pricing-grid">
        {PRICING_PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`pricing-card ${plan.highlighted ? 'highlighted' : ''} ${
              currentTier === plan.id ? 'current' : ''
            }`}
          >
            {plan.highlighted && <div className="popular-badge">Most Popular</div>}

            <div className="plan-header">
              <h3>{plan.name}</h3>
              <p className="plan-description">{plan.description}</p>
            </div>

            <div className="plan-price">
              {plan.customPricing ? (
                <div className="custom-price">Custom Pricing</div>
              ) : (
                <>
                  <span className="price-amount">
                    ${billingCycle === 'monthly' ? plan.price.monthly : plan.price.annual}
                  </span>
                  <span className="price-period">
                    /{billingCycle === 'monthly' ? 'month' : 'year'}
                  </span>
                  {billingCycle === 'annual' && plan.price.savings && (
                    <div className="savings-text">{plan.price.savings}</div>
                  )}
                </>
              )}
            </div>

            <button
              className={`cta-button ${currentTier === plan.id ? 'current-plan' : ''}`}
              onClick={() => handleSelectPlan(plan.id)}
              disabled={currentTier === plan.id}
            >
              {currentTier === plan.id ? 'Current Plan' : plan.cta}
            </button>

            <div className="features-list">
              {plan.features.map((feature, idx) => (
                <div key={idx} className={`feature ${feature.included ? 'included' : 'excluded'}`}>
                  <span className="feature-icon">
                    {feature.included ? '✓' : '✗'}
                  </span>
                  <span className="feature-text">
                    {feature.name}
                    {feature.limit && <span className="feature-limit"> ({feature.limit})</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Competitor comparison */}
      <div className="competitor-section">
        <h2>How We Compare</h2>
        <div className="comparison-table">
          <div className="comparison-row header">
            <div className="comparison-cell">Software</div>
            <div className="comparison-cell">Price</div>
            <div className="comparison-cell">Model</div>
            <div className="comparison-cell">Platform</div>
          </div>

          {Object.values(COMPETITOR_COMPARISON).map((competitor, idx) => (
            <div
              key={idx}
              className={`comparison-row ${competitor.name === 'kinetiCORE' ? 'highlight' : ''}`}
            >
              <div className="comparison-cell">
                <strong>{competitor.name}</strong>
                {competitor.name === 'kinetiCORE' && <span className="you-badge">You</span>}
              </div>
              <div className="comparison-cell">
                {competitor.price === 0 ? 'Free' : `$${competitor.price.toLocaleString()}`}
              </div>
              <div className="comparison-cell">{competitor.billingModel}</div>
              <div className="comparison-cell">{competitor.deployment}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="faq-section">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-grid">
          <div className="faq-item">
            <h4>Can I switch plans anytime?</h4>
            <p>
              Yes! Upgrade or downgrade at any time. Upgrades take effect immediately, downgrades
              at the end of your billing cycle.
            </p>
          </div>

          <div className="faq-item">
            <h4>What happens after my trial ends?</h4>
            <p>
              Your account automatically reverts to the Free tier. No credit card required for
              trials.
            </p>
          </div>

          <div className="faq-item">
            <h4>Is there a money-back guarantee?</h4>
            <p>
              Yes! Full refund within 30 days of purchase, no questions asked.
            </p>
          </div>

          <div className="faq-item">
            <h4>What payment methods do you accept?</h4>
            <p>Credit card, PayPal, and wire transfer (Enterprise only).</p>
          </div>
        </div>
      </div>

      {onClose && (
        <button className="close-button" onClick={onClose}>
          Close
        </button>
      )}
    </div>
  );
};
