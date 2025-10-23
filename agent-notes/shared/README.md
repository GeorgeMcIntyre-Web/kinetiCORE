# Shared Agent Resources

**This directory contains resources shared across all agents for team collaboration.**

---

## 📁 What's Here

### Agent 4: Performance & Testing Infrastructure ⚡

Agent 4 has completed **all infrastructure work** and created comprehensive resources for the team!

#### 🚀 Start Here

**New to Agent 4's tools?** Read in this order:

1. **`AGENT4_QUICK_REFERENCE.md`** ← Start here! (1-page cheat sheet)
2. **`AGENT4_INTEGRATION_GUIDE.md`** ← Comprehensive integration guide
3. **`AGENT4_CODE_EXAMPLES.md`** ← Copy-paste ready code
4. **`TEAM_COLLABORATION.md`** ← How we work together

#### 📚 Files Available

| File | Purpose | Read Time |
|------|---------|-----------|
| `README.md` | This file - directory overview | 2 min |
| `AGENT4_QUICK_REFERENCE.md` | Quick reference card | 5 min |
| `AGENT4_INTEGRATION_GUIDE.md` | Complete integration guide | 20 min |
| `AGENT4_CODE_EXAMPLES.md` | Ready-to-use code examples | 15 min |
| `TEAM_COLLABORATION.md` | Team coordination guide | 15 min |

#### 🎯 Quick Links by Agent

- **Agent 1 (IK Targets):** See `AGENT4_INTEGRATION_GUIDE.md` → "For Agent 1"
- **Agent 2 (Full Body IK):** See `AGENT4_INTEGRATION_GUIDE.md` → "For Agent 2"
- **Agent 3 (Code Review):** See `AGENT4_INTEGRATION_GUIDE.md` → "For Agent 3"
- **Agent 5 (Documentation):** See `AGENT4_INTEGRATION_GUIDE.md` → "For Agent 5"

---

## 🛠️ What Agent 4 Provides

### Tools
- ✅ Performance monitoring system
- ✅ Benchmark utilities
- ✅ Testing framework (Vitest)
- ✅ Performance Monitor UI component

### Documentation
- ✅ `docs/PERFORMANCE_MONITORING.md` - Performance guide
- ✅ `docs/TESTING_GUIDE.md` - Testing best practices
- ✅ `docs/PERFORMANCE_OPTIMIZATION.md` - Optimization strategies

### Integration Support
- ✅ Agent-specific integration guides
- ✅ Copy-paste code examples
- ✅ Performance targets and benchmarks
- ✅ Team collaboration workflows

---

## 🚀 5-Second Quick Start

```typescript
// 1. Monitor performance
import { performanceMetrics } from '@core/PerformanceMetrics';
performanceMetrics.startOperation('my-op');
// code
performanceMetrics.endOperation('my-op');

// 2. Benchmark
import { benchmark } from '@utils/benchmark';
const result = benchmark(() => fn(), { iterations: 100 });

// 3. Test
import { describe, it, expect } from 'vitest';
describe('Test', () => {
  it('works', () => expect(fn()).toBe(result));
});
```

---

## 📞 Get Help

- **Read:** `AGENT4_INTEGRATION_GUIDE.md`
- **Slack:** `#dev-performance`
- **Ping:** Agent 4

---

## ✅ Other Agents - Add Your Resources Here!

This directory is for **shared resources across all agents**.

**Suggested structure:**
```
shared/
  - README.md (this file)
  - AGENT1_*.md (Agent 1 shared resources)
  - AGENT2_*.md (Agent 2 shared resources)
  - AGENT3_*.md (Agent 3 shared resources)
  - AGENT4_*.md (Agent 4 shared resources) ✅
  - AGENT5_*.md (Agent 5 shared resources)
  - TEAM_COLLABORATION.md (team coordination)
```

---

**Let's collaborate and build amazing things together!** 🚀

_Last Updated: 2025-10-23 by Agent 4_
