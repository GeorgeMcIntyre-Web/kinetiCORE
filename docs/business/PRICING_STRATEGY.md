# kinetiCORE Pricing Strategy
**Version:** 1.0
**Date:** October 2025
**Owner:** George (Architecture Lead)

---

## Executive Summary

kinetiCORE is a web-based industrial robot simulation and kinematics platform targeting
engineers, roboticists, and manufacturers. This document outlines the pricing strategy,
competitive analysis, and revenue projections.

**Target Market:** Industrial simulation & kinematics software
**Business Model:** SaaS subscription with freemium tier
**Recommended Starting Price:** $79/month (Professional tier)

---

## Competitive Landscape

### Direct Competitors

| Product | Price | Model | Target |
|---------|-------|-------|--------|
| **RoboDK** | $3,000 | Perpetual license | Industrial robots |
| **ABB RobotStudio Premium** | $1,500-2,500/year | Annual subscription | ABB robots |
| **Fusion 360 CAM** | $725/year | Annual subscription | CAD/CAM users |
| **High-end simulation** | $10,000-100,000/year | Enterprise | Automotive/aerospace |
| **Gazebo** | Free | Open source | ROS developers |

### kinetiCORE Competitive Advantages

✅ **Web-based** → No installation, IT approval, or hardware requirements
✅ **Modern stack** → React + Babylon.js + Rapier physics
✅ **Real-time physics** → Interactive simulation
✅ **Cross-platform** → Works on any device with browser
✅ **25 years expertise** → Deep domain knowledge
✅ **Affordable SaaS pricing** → Predictable monthly cost vs $3K upfront

---

## Pricing Tiers

### Free Tier (Freemium)

**Price:** $0/month

**Includes:**
- 3 robot models maximum
- Basic forward kinematics (FK only)
- Export to PNG/screenshot only
- Community support (forums)
- "Powered by kinetiCORE" watermark

**Limitations:**
- No inverse kinematics (IK)
- No URDF import/export
- No path planning
- No collaboration features

**Goal:**
- Lead generation
- Education market (students, hobbyists)
- Proof of concept for enterprises
- Target: 5,000+ free users by Year 2

---

### Professional Tier ⭐ **PRIMARY REVENUE DRIVER**

**Price:**
- **$79/month** (monthly billing)
- **$790/year** (save 17% vs monthly)

**Includes:**
- ✅ Unlimited robot models
- ✅ Full FK/IK kinematics
- ✅ URDF import/export
- ✅ Path planning & collision detection
- ✅ Export to JSON/URDF/GLB/GLTF
- ✅ Email support (48-hour response)
- ✅ 10GB cloud storage
- ✅ No watermark
- ✅ Advanced physics simulation (Rapier)
- ✅ Custom robot configurations

**Target Audience:**
- Individual engineers
- Independent robotics consultants
- Small robotics companies (1-5 people)
- Research labs
- Freelance automation engineers

**Value Proposition:**
- **74% cheaper** than RoboDK ($79/mo vs $3,000 one-time)
- **Subscription flexibility** (cancel anytime vs perpetual purchase)
- **Always up-to-date** (automatic updates vs manual upgrades)

**Target:** 250 customers by Year 3 = $19,750/month revenue

---

### Team Tier

**Price:**
- **$199/month** (monthly billing)
- **$1,990/year** (save 17% vs monthly)

**Includes everything in Professional, PLUS:**
- 👥 **5 team seats** (additional seats $30/month each)
- 🤝 Shared workspace & projects
- 📊 Team collaboration tools
- 🔌 API access (REST)
- 📞 Priority support (24-hour response)
- 💾 100GB cloud storage
- 📜 Version control & project history
- 🔐 SSO (Google/Microsoft/GitHub)
- 👁️ Role-based permissions (Admin/Editor/Viewer)

**Target Audience:**
- Engineering teams (5-20 people)
- Robotics startups
- Manufacturing companies
- System integrators
- Universities (department-wide)

**Value Proposition:**
- **$40/month per user** (5 seats) vs $79/month individual
- Centralized billing
- Team collaboration saves time

**Target:** 50 teams by Year 3 = $9,950/month revenue

---

### Enterprise Tier

**Price:** Custom (starting ~$500/month or $5,000/year)

**Includes everything in Team, PLUS:**
- 🏢 Unlimited seats
- 🖥️ On-premise deployment option
- 🔧 Custom integrations
- 👨‍💼 Dedicated account manager
- 📞 Phone support + priority hotline
- 📊 SLA with 99.9% uptime guarantee
- 🎓 Custom training & onboarding
- 🏷️ White-label option (rebrand as your own)
- 🚀 Priority feature requests
- 🔒 Advanced security (SOC 2, ISO 27001)
- 📋 Custom contracts & invoicing

**Target Audience:**
- Large manufacturers (automotive, aerospace)
- Fortune 500 companies
- Government contractors
- Multi-national corporations

**Value Proposition:**
- **$50-100/month per user** at scale (50+ users)
- Compliance & security requirements met
- Dedicated support & customization

**Target:** 15 enterprise customers by Year 3 = $7,500+/month revenue

---

## Add-On Revenue Streams

### Premium Robot Models Marketplace
- Pre-configured industrial robots: $19-99 each
- Brand-specific models (ABB, FANUC, KUKA): $49-199
- Custom robot modeling service: $499/robot

### Professional Services
- Custom URDF conversion: $199/project
- Training & certification: $499/person (4-hour workshop)
- Custom integration development: $150/hour

### White-Label Licensing
- Embed kinetiCORE in your product: $2,000/year base + revenue share

### API Overage Charges
- Team tier includes 1M API calls/month
- Additional: $10 per 100K calls

---

## Revenue Projections

### Conservative Scenario

| Year | Free Users | Pro Users | Team Users | Enterprise | MRR | ARR |
|------|------------|-----------|------------|------------|------|-------|
| **1** | 500 | 20 | 2 | 0 | $1,980 | $23,760 |
| **2** | 2,000 | 100 | 10 | 2 | $11,880 | $142,560 |
| **3** | 5,000 | 250 | 25 | 5 | $27,225 | $326,700 |

**Assumptions:**
- 4% conversion rate (Free → Pro)
- 10% upgrade rate (Pro → Team)
- 2-5 enterprise deals per year

---

### Optimistic Scenario

| Year | Free Users | Pro Users | Team Users | Enterprise | MRR | ARR |
|------|------------|-----------|------------|------------|------|-------|
| **1** | 1,000 | 50 | 5 | 1 | $5,435 | $65,220 |
| **2** | 5,000 | 200 | 20 | 5 | $21,280 | $255,360 |
| **3** | 15,000 | 500 | 50 | 15 | $56,450 | $677,400 |

**Assumptions:**
- 6% conversion rate (Free → Pro)
- 15% upgrade rate (Pro → Team)
- Active outbound sales for Enterprise

---

## Pricing vs Hosting Costs

### Year 1 (Conservative)
- **Revenue:** $23,760
- **Hosting (Cloudflare):** $60
- **Profit Margin on Infrastructure:** **99.7%** ✅

### Year 3 (Optimistic)
- **Revenue:** $677,400
- **Hosting (Cloudflare):** $800-1,200
- **Profit Margin on Infrastructure:** **99.8%** ✅

**Key Insight:** Cloudflare's unlimited bandwidth enables predictable costs even with
large 3D asset downloads (10-50MB GLB files per user).

---

## Go-to-Market Strategy

### Phase 1: Beta (Months 1-3)
**Goal:** Validate product-market fit
- Launch free tier only
- Gather feedback from 100-500 users
- Build community (Discord/Slack)
- **Cost:** $0/month hosting

### Phase 2: Paid Launch (Months 4-6)
**Goal:** First revenue
- Launch Professional tier at **$49/month early bird** (40% discount)
- Limited to first 100 customers
- Target: 20-50 paying customers
- **Revenue:** $980-2,450/month
- **Cost:** $5-20/month hosting

### Phase 3: Scale (Months 7-12)
**Goal:** Establish pricing
- Increase Pro tier to **$79/month** (full price)
- Launch Team tier
- Target: 100 paying customers
- **Revenue:** $8,000-12,000/month
- **Cost:** $50-100/month hosting

### Phase 4: Enterprise (Year 2+)
**Goal:** Land enterprise contracts
- Launch Enterprise tier
- Hire sales team
- Custom contracts with manufacturers
- **Revenue:** $20,000-60,000/month
- **Cost:** $100-500/month hosting

---

## Pricing Rationale

### Why $79/month for Professional?

**Anchoring:**
- RoboDK costs $3,000 perpetual → $79/month = **$948/year** (68% cheaper)
- Annual commitment → $790/year (74% cheaper than RoboDK)

**Value Perception:**
- Below $100/month = "affordable" for individuals
- Above $50/month = "professional tool" (not a toy)
- $79 is psychologically positioned as premium but accessible

**Market Positioning:**
- **Premium vs open-source** (Gazebo is free but complex)
- **Affordable vs enterprise** (RobotStudio is $1,500+/year)
- **Subscription vs perpetual** (predictable cost vs large upfront)

**Comparison:**
| Competitor | Annual Cost | kinetiCORE Savings |
|------------|-------------|-------------------|
| RoboDK | $3,000 (one-time) | 74% cheaper (annual) |
| ABB RobotStudio | $1,500-2,500/year | 68% cheaper |
| Fusion 360 | $725/year | Similar market |

---

## Customer Acquisition Cost (CAC) Assumptions

### Free Tier (Freemium Funnel)
- **CAC:** $0-10 (organic, content marketing)
- **Conversion to Pro:** 4-6%
- **Time to conversion:** 3-6 months

### Professional Tier
- **CAC:** $200-500 (paid ads, content, SEO)
- **LTV (Lifetime Value):** $2,370 (30-month average subscription)
- **LTV:CAC Ratio:** 4.7:1 to 11.8:1 ✅ (healthy)

### Enterprise Tier
- **CAC:** $5,000-15,000 (sales team, demos, custom POCs)
- **LTV:** $60,000-180,000 (3-5 year contracts)
- **LTV:CAC Ratio:** 12:1 ✅ (excellent)

---

## Discount Strategy

### Annual Prepayment Discount
- Save **17%** by paying annually
- $79/month × 12 = $948 → $790/year
- Improves cash flow
- Reduces churn (committed for year)

### Early Adopter Discount
- **$49/month** for first 100 customers (limited time)
- Grandfathered pricing for 12 months
- Converts to $79/month after Year 1

### Educational Discount
- **50% off** for students (.edu email)
- **40% off** for academic institutions
- Builds brand awareness with future engineers

### Non-Profit Discount
- **30% off** for registered non-profits

### Volume Discounts (Enterprise)
- 10-50 seats: 15% off
- 51-100 seats: 25% off
- 100+ seats: 35% off + custom pricing

---

## Payment & Billing

### Payment Methods
- Credit card (Stripe)
- ACH/wire transfer (Enterprise only)
- PayPal (consideration)

### Billing Cycle
- Monthly: charged on signup date
- Annual: charged upfront, auto-renews
- Enterprise: Net-30 invoicing available

### Refund Policy
- 30-day money-back guarantee (Pro/Team)
- No refunds on annual plans after 30 days
- Enterprise: custom terms

---

## Churn Mitigation

### Expected Churn Rates
- **Month 1:** 20% (trial users)
- **Month 2-6:** 10% per month
- **Month 6+:** 3-5% per month (stabilized)
- **Annual plans:** <5% per year

### Retention Strategies
- Quarterly customer check-ins
- Feature request voting
- Case studies & success stories
- Email automation (onboarding, tips, updates)
- In-app messaging for feature updates

---

## Competitive Response

### If competitors lower prices:
- Emphasize **web-based advantage** (no installation)
- Highlight **modern UI/UX** (easier to use)
- Focus on **continuous updates** (subscription value)

### If competitors add features:
- Rapid development cycle (agile, weekly releases)
- Community-driven roadmap
- Open API for extensibility

### If open-source alternatives emerge:
- Emphasize **support & reliability**
- Enterprise features (SSO, compliance, SLA)
- Managed hosting (no DevOps required)

---

## Key Performance Indicators (KPIs)

### Growth Metrics
- Monthly Active Users (MAU)
- Free-to-Pro conversion rate
- Monthly Recurring Revenue (MRR)
- Annual Recurring Revenue (ARR)
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)
- LTV:CAC ratio

### Engagement Metrics
- Daily Active Users (DAU)
- Average session duration
- Features used per session
- Projects created per user

### Financial Metrics
- Gross margin (should be 85%+ for SaaS)
- Net Revenue Retention (NRR) - target 100%+
- Churn rate (monthly & annual)
- Average Revenue Per User (ARPU)

---

## Success Metrics

### Year 1 Goals
✅ 500-1,000 free users
✅ 20-50 paying customers
✅ $24K-65K ARR
✅ <5% monthly churn (after Month 6)

### Year 2 Goals
✅ 2,000-5,000 free users
✅ 100-200 paying customers
✅ $140K-255K ARR
✅ First 2-5 enterprise customers

### Year 3 Goals
✅ 5,000-15,000 free users
✅ 250-500 paying customers
✅ $327K-677K ARR
✅ Profitable (revenue > costs)

---

## Pricing Evolution

### Year 1
- Maintain $79/month Pro pricing
- Focus on product-market fit
- Iterate based on customer feedback

### Year 2
- Consider adding **Starter tier** ($29/month) if $79 is too high
- Introduce annual-only discounts (15-20% off)
- Test enterprise pricing

### Year 3+
- Increase prices by **5-10% annually** (inflation + value add)
- Grandfather existing customers (optional)
- Introduce usage-based pricing tiers (API calls, storage)

---

## Risk Mitigation

### Price is Too High
**Indicator:** <2% Free-to-Pro conversion
**Action:** Introduce $49/month tier or increase free tier features

### Price is Too Low
**Indicator:** >10% Free-to-Pro conversion + rapid growth
**Action:** Increase prices for new customers, grandfather existing

### Market Saturation
**Indicator:** Declining growth rate
**Action:** Expand to adjacent markets (education, VR/AR, digital twins)

---

## Summary

**Recommended Pricing:**
- **Free:** $0/month (3 robots, FK only)
- **Professional:** $79/month or $790/year (unlimited, full features)
- **Team:** $199/month or $1,990/year (5 seats, collaboration)
- **Enterprise:** Custom ($500+/month)

**3-Year Revenue Target:** $300K-680K ARR

**Hosting Costs:** $60-1,200/year (99%+ profit margin on infrastructure)

**Next Steps:**
1. Implement payment system (Stripe)
2. Build feature gating (free vs paid)
3. Launch beta with free tier
4. Introduce paid tiers after 100 users
5. Monitor conversion rates & iterate

---

**Prepared by:** George (25 years industrial automation experience)
**Review Date:** Quarterly (Jan, Apr, Jul, Oct)
