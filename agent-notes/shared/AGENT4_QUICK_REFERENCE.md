# Agent 4 Tools - Quick Reference Card

**One-page reference for all agents** 📋

---

## 🚀 1-Minute Quick Start

### Add Performance Monitoring

```typescript
import { performanceMetrics } from '@core/PerformanceMetrics';

performanceMetrics.startOperation('my-operation');
// ... your code ...
performanceMetrics.endOperation('my-operation');
```

### Benchmark Any Function

```typescript
import { benchmark } from '@utils/benchmark';

const result = benchmark(() => myFunction(), { iterations: 100 });
console.log(`P95: ${result.stats.p95}ms`);
```

### Write a Test

```typescript
import { describe, it, expect } from 'vitest';

describe('MyModule', () => {
  it('should work', () => {
    expect(myFunction()).toBe(expected);
  });
});
```

---

## 📚 Quick Links

- **Performance Guide:** `docs/PERFORMANCE_MONITORING.md`
- **Testing Guide:** `docs/TESTING_GUIDE.md`
- **Optimization Guide:** `docs/PERFORMANCE_OPTIMIZATION.md`
- **Integration Guide:** `agent-notes/shared/AGENT4_INTEGRATION_GUIDE.md`

---

## 🎯 Performance Targets

| Metric | Target | Command |
|--------|--------|---------|
| FPS | 60 FPS | `performanceMetrics.getFrameStats()` |
| Input Latency | <50ms | `benchmark(handleInput)` |
| IK Solve | <100ms | `benchmark(ikSolver.solve)` |
| Frame Time | <16ms | Check PerformanceMonitor overlay |

---

## 🔧 Essential Commands

```bash
npm test                    # Run all tests
npm run test:coverage       # Coverage report
npm test -- --watch         # Watch mode
npm test -- MyModule        # Run specific test
npm run type-check          # TypeScript check
```

---

## 💡 Common Patterns

### Time an Operation
```typescript
performanceMetrics.startOperation('name');
// code
performanceMetrics.endOperation('name');
```

### Benchmark a Function
```typescript
const result = benchmark(() => fn(), { iterations: 100 });
```

### Write a Test
```typescript
describe('Module', () => {
  it('should work', () => {
    expect(fn()).toBe(result);
  });
});
```

### Enable Performance Overlay
```
http://localhost:5173/?debug=true
```

---

## 🤝 Agent-Specific Tips

**Agent 1 (IK Targets):** Benchmark target placement (<50ms), test robot selection  
**Agent 2 (Full Body IK):** Benchmark multi-chain solve (<200ms), test constraints  
**Agent 3 (Code Review):** Check test coverage (>80%), review for performance anti-patterns  
**Agent 5 (Docs):** Include performance troubleshooting, testing guide for contributors  

---

## ❓ Get Help

- **Docs:** `docs/PERFORMANCE_MONITORING.md`
- **Slack:** `#dev-performance`
- **Agent 4:** Ping me!

---

**Made with ⚡ by Agent 4**
