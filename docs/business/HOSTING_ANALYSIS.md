# Hosting Platform Analysis for kinetiCORE
**Analysis Date:** October 2025
**Prepared by:** Architecture Team
**Document Version:** 1.0

---

## Executive Summary

This document analyzes hosting platforms for kinetiCORE, a web-based industrial robot simulation
platform built with React + TypeScript + Babylon.js + Rapier physics engine.

**Recommendation:** Start with **Cloudflare Pages** for optimal cost-to-performance ratio.

---

## Platform Comparison

### 1. Cloudflare Pages 🏆 **RECOMMENDED**

#### Performance
- **Edge Locations:** 200+ globally
- **TTFB:** <50ms globally (95% of world within 50ms)
- **Uptime SLA:** 99.99%+
- **WebAssembly:** Excellent (Rapier WASM performs optimally)
- **CDN:** Built-in, unlimited bandwidth at no cost

#### Pricing

**Free Tier:**
- Cost: $0/month, $0/year
- Bandwidth: **UNLIMITED** (no cost ever)
- Builds: 500/month
- Requests: 100,000/day
- Storage: 25,000 files

**Workers Paid Plan:**
- Cost: $5/month, $60/year
- Bandwidth: **UNLIMITED** (still free)
- Requests: 10M/month (then $0.30 per million)
- CPU Time: 30M CPU-ms/month

#### 3-Year Cost Projection
- **Year 1:** $0 (free tier sufficient)
- **Year 2:** $60 ($5/month)
- **Year 3:** $120 ($10/month)
- **At scale (10K users):** $120-300/year

#### Pros
✅ Unlimited bandwidth (critical for 3D assets)
✅ Best global latency
✅ Most cost-effective at scale
✅ No vendor lock-in (standard static hosting)
✅ Enterprise-grade infrastructure
✅ Excellent WebAssembly/Rapier performance

#### Cons
❌ Less mature than Vercel/Netlify for advanced features
❌ Limited serverless function runtime (CPU time limits)

---

### 2. Vercel

#### Performance
- **Edge Network:** Global
- **TTFB:** <50ms
- **Uptime SLA:** 99.99%
- **Optimization:** Best for Next.js/React

#### Pricing

**Hobby (Free) - Non-Commercial Only:**
- Cost: $0/month
- Bandwidth: 100GB/month
- ⚠️ **Cannot use for commercial products**

**Pro Plan (Required for Commercial):**
- Cost: $20/month/seat, $240/year
- Bandwidth: 1TB/month ($150 per additional TB)
- Builds: 200 hours/month
- Edge Requests: 10M/month

**Enterprise:**
- Cost: $20,000-25,000+/year minimum

#### 3-Year Cost Projection
- **Year 1:** $240/year minimum (Pro required for commercial)
- **Year 2:** $400-800/year (with overages)
- **At scale:** $1,000-3,000/year

#### Pros
✅ Best developer experience
✅ Seamless GitHub integration
✅ Excellent Next.js optimization
✅ Instant deployments

#### Cons
❌ Expensive bandwidth overages ($0.15/GB)
❌ $20/month minimum for commercial use
❌ Costs scale quickly with traffic
❌ Per-seat pricing expensive for teams

---

### 3. Netlify

#### Performance
- **CDN:** Global
- **TTFB:** <50ms
- **Uptime SLA:** 99.99%

#### Pricing

**Free Plan:**
- Cost: $0/month
- Bandwidth: 100GB/month
- Builds: 300 minutes/month
- Functions: 125K invocations/month

**Pro Plan:**
- Cost: $19/month, $228/year
- Bandwidth: 1TB/month ($55 per 100GB additional)
- Builds: 25,000 minutes/month

**Note:** New credit-based pricing launched Sept 2025 (10 credits/GB bandwidth)

#### 3-Year Cost Projection
- **Year 1:** $0-228/year
- **Year 2:** $300-500/year (with overages)
- **At scale:** $800-2,000/year

#### Pros
✅ Great developer experience
✅ Built-in forms, functions, split testing
✅ Good free tier
✅ Middle-ground pricing

#### Cons
❌ Bandwidth overages add up
❌ New credit system is complex
❌ More expensive than Cloudflare at scale

---

## Cost Comparison Summary

| Platform | Year 1 | Year 2-3 | At Scale (10K users) |
|----------|--------|----------|----------------------|
| **Cloudflare** | $0 | $60-120 | $120-300 |
| **Vercel** | $240 | $400-800 | $1,000-3,000 |
| **Netlify** | $0-228 | $300-500 | $800-2,000 |

---

## kinetiCORE-Specific Considerations

### Stack Requirements
- **React + TypeScript:** ✅ All platforms support Vite builds
- **Babylon.js (WebGL):** ✅ All platforms support static assets
- **Rapier (WebAssembly):** ✅ All platforms support WASM (~2MB bundle)
- **3D Assets (GLB/GLTF):** 10-50MB per model

### Critical Success Metrics
- **Target latency:** <50ms ✅ All platforms achieve this
- **Target FPS:** 60 FPS with 50 objects ✅ Client-side (not hosting-dependent)
- **Uptime:** 99.9%+ ✅ All platforms meet this

### Bandwidth Requirements
With **large 3D model files (10-50MB each)**, bandwidth becomes expensive quickly:
- **Vercel:** $0.15/GB = $150/TB → $150 per 1,000 full page loads
- **Netlify:** $55/100GB = $550/TB → $550 per 1,000 full page loads
- **Cloudflare:** $0/TB → **$0 regardless of traffic** ✅

---

## Recommendation

### Start with Cloudflare Pages

**Rationale:**
1. **Zero bandwidth costs** → Predictable expenses as you scale
2. **Best global latency** → 200+ edge locations
3. **Excellent WASM performance** → Rapier physics runs optimally
4. **Low risk** → Easy migration to Vercel/Netlify later if needed
5. **No vendor lock-in** → Standard static hosting

### Migration Path

**Phase 1 (Months 1-6):** Cloudflare Pages Free
**Phase 2 (Year 1):** Cloudflare Workers Paid ($5/month)
**Phase 3 (Year 2+):** Evaluate if AWS/Azure needed for custom features

All platforms support standard Vite + React builds → migration is straightforward.

---

## Implementation Steps

1. **Set up Cloudflare Pages account**
2. **Connect GitHub repository**
3. **Configure build settings:**
   - Build command: `npm run build`
   - Output directory: `dist`
   - Node version: 18+
4. **Set environment variables** (if needed)
5. **Deploy** → Automatic on every push to main

---

## References

- Cloudflare Pages Docs: https://developers.cloudflare.com/pages/
- Vercel Pricing: https://vercel.com/pricing
- Netlify Pricing: https://www.netlify.com/pricing/
- Performance Comparison: https://www.digitalapplied.com/blog/vercel-vs-netlify-vs-cloudflare-pages-comparison

---

**Next Steps:** Review pricing strategy document for business model alignment.
