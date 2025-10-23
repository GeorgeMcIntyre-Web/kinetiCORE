# Team Collaboration Guide - kinetiCORE Agent Coordination

**Purpose:** Ensure seamless collaboration between all 5 AI agents  
**Created:** 2025-10-23  
**Status:** Active

---

## 🤖 Agent Overview

### Agent 1: IK Devices Target Location Implementation
- **Focus:** Visual target placement system with 3D gizmos
- **Priority:** HIGH - Critical user workflow
- **Timeline:** 7-10 days
- **Key Deliverable:** Interactive IK target placement UI

### Agent 2: Full Body IK Front and Back End
- **Focus:** Multi-chain coordination, constraint system
- **Priority:** HIGH - Core system enhancement
- **Timeline:** 10-13 days
- **Key Deliverable:** Full-body IK solver with compact UI

### Agent 3: Full Code Review
- **Focus:** Code quality, architecture, performance review
- **Priority:** MEDIUM - Foundation for future development
- **Timeline:** 9-13 days
- **Key Deliverable:** Comprehensive code quality report

### Agent 4: Performance Optimization & Testing Infrastructure
- **Focus:** Real-time performance monitoring, testing framework
- **Priority:** MEDIUM - Production readiness
- **Timeline:** 12-16 days
- **Status:** ✅ Phases 1-3 complete (ahead of schedule!)
- **Key Deliverable:** Performance monitoring tools, testing infrastructure

### Agent 5: Documentation & User Experience Research
- **Focus:** User guides, tutorials, UX research
- **Priority:** MEDIUM - User adoption
- **Timeline:** 12-16 days
- **Key Deliverable:** Comprehensive documentation, UX insights

---

## 🔗 Agent Dependencies

### Agent 1 Dependencies
- **Depends on:** Agent 4 (performance monitoring for IK solve)
- **Provides to:** Agent 2 (single-chain IK foundation)
- **Coordinates with:** Agent 5 (UI/UX for target placement)

### Agent 2 Dependencies
- **Depends on:** Agent 1 (single-chain IK solver)
- **Depends on:** Agent 4 (performance testing for multi-chain)
- **Coordinates with:** Agent 5 (compact icon-based UI)

### Agent 3 Dependencies
- **Reviews:** All agents' code
- **Uses:** Agent 4's testing infrastructure
- **Provides to:** All agents (code quality feedback)

### Agent 4 Dependencies
- **Provides to:** All agents (performance tools, testing framework)
- **Coordinates with:** Agent 3 (code quality validation)
- **Status:** ✅ Infrastructure ready for all agents

### Agent 5 Dependencies
- **Documents:** All agents' work
- **Coordinates with:** Agent 1, Agent 2 (UI/UX)
- **Uses:** Agent 4's tools (performance troubleshooting guides)

---

## 🎯 Agent 4 Integration Points

### Available Now for All Agents

**Agent 4 has completed Phases 1-3 and provides:**

#### 1. Performance Monitoring
- **Module:** `src/core/PerformanceMetrics.ts`
- **Usage:** Track frame metrics, operation timing, memory
- **Integration:** See `agent-notes/shared/AGENT4_INTEGRATION_GUIDE.md`

#### 2. Benchmark Utilities
- **Module:** `src/utils/benchmark.ts`
- **Usage:** Statistical performance testing
- **Example:** `benchmark(() => myFunction(), { iterations: 100 })`

#### 3. Testing Framework
- **Framework:** Vitest (configured and ready)
- **Examples:** `src/core/__tests__/*.test.ts`
- **Guide:** `docs/TESTING_GUIDE.md`

#### 4. Performance Overlay
- **Component:** `src/ui/components/debug/PerformanceMonitor.tsx`
- **Usage:** Enable with `?debug=true` or `import.meta.env.DEV`
- **Features:** Real-time FPS, memory, draw calls

#### 5. Comprehensive Documentation
- **Performance:** `docs/PERFORMANCE_MONITORING.md`
- **Testing:** `docs/TESTING_GUIDE.md`
- **Optimization:** `docs/PERFORMANCE_OPTIMIZATION.md`

---

## 🤝 Collaboration Workflows

### Agent 1 + Agent 4 Collaboration

**Scenario:** IK target placement system needs performance validation

**Workflow:**
1. **Agent 1:** Implements target placement with 3D gizmos
2. **Agent 1:** Adds performance monitoring:
   ```typescript
   import { performanceMetrics } from '@core/PerformanceMetrics';
   
   performanceMetrics.startOperation('target-placement');
   placeTargetGizmo(position);
   performanceMetrics.endOperation('target-placement');
   ```
3. **Agent 1:** Validates <50ms input latency target
4. **Agent 4:** Reviews performance data, suggests optimizations if needed
5. **Agent 1:** Writes tests using Agent 4's testing framework

**Success Criteria:**
- ✅ Target placement <50ms latency (P95)
- ✅ Tests written and passing
- ✅ Performance validated

---

### Agent 2 + Agent 4 Collaboration

**Scenario:** Full-body IK needs multi-chain performance testing

**Workflow:**
1. **Agent 2:** Implements multi-chain IK solver
2. **Agent 2:** Benchmarks performance:
   ```typescript
   import { benchmark } from '@utils/benchmark';
   
   const result = benchmark(() => {
     fullBodyIKSolver.solve(targets);
   }, { iterations: 100 });
   
   console.log(`Multi-chain solve P95: ${result.stats.p95}ms`);
   ```
3. **Agent 2:** Validates <200ms solve time target
4. **Agent 4:** Provides optimization suggestions from `PERFORMANCE_OPTIMIZATION.md`
5. **Agent 2:** Writes integration tests

**Success Criteria:**
- ✅ Multi-chain solve <200ms (P95)
- ✅ Constraint application <50ms
- ✅ Integration tests passing

---

### Agent 3 + Agent 4 Collaboration

**Scenario:** Code review needs test coverage validation

**Workflow:**
1. **Agent 3:** Reviews codebase for quality issues
2. **Agent 3:** Runs coverage report:
   ```bash
   npm run test:coverage
   open coverage/index.html
   ```
3. **Agent 3:** Uses Agent 4's `PERFORMANCE_OPTIMIZATION.md` to identify anti-patterns
4. **Agent 4:** Provides additional performance insights
5. **Agent 3:** Creates action items for improvements

**Success Criteria:**
- ✅ Core modules >80% coverage
- ✅ No performance anti-patterns
- ✅ Proper resource disposal

---

### Agent 5 + Agent 4 Collaboration

**Scenario:** Documentation needs performance troubleshooting guide

**Workflow:**
1. **Agent 5:** Creates user documentation
2. **Agent 5:** Includes performance monitoring instructions:
   ```markdown
   ## Troubleshooting Performance
   
   Enable performance overlay: `?debug=true`
   Check FPS, memory usage, frame time
   Export data: Click "Export" button
   ```
3. **Agent 5:** References Agent 4's guides
4. **Agent 4:** Reviews documentation for technical accuracy
5. **Agent 5:** Adds contributor testing guide

**Success Criteria:**
- ✅ Performance troubleshooting documented
- ✅ Testing guide for contributors
- ✅ Links to Agent 4's technical docs

---

## 📋 Coordination Checklist

### Before Starting Work

- [ ] Read project file (`AGENT#_*_PROJECT.md`)
- [ ] Review dependencies on other agents
- [ ] Check `agent-notes/shared/` for integration guides
- [ ] Post in `#agent-coordination` Slack about starting

### During Work

- [ ] Use Agent 4's performance monitoring tools
- [ ] Write tests using Agent 4's testing framework
- [ ] Update `agent-notes/shared/` with progress
- [ ] Coordinate breaking changes with dependent agents
- [ ] Post updates in `#agent-coordination` Slack

### Before Completing Phase

- [ ] Run tests: `npm test`
- [ ] Check coverage: `npm run test:coverage`
- [ ] Validate performance targets
- [ ] Update documentation
- [ ] Post completion in `#agent-coordination` Slack
- [ ] Tag next agent in dependency chain

---

## 🗣️ Communication Channels

### Slack Channels

- **`#agent-coordination`** - General agent coordination
- **`#dev-performance`** - Performance and testing (Agent 4)
- **`#dev-ik-systems`** - IK development (Agent 1, Agent 2)
- **`#dev-code-quality`** - Code review (Agent 3)
- **`#dev-documentation`** - Documentation (Agent 5)

### Shared Notes

**Location:** `agent-notes/shared/`

**Current Files:**
- `AGENT4_INTEGRATION_GUIDE.md` - How to use Agent 4's tools
- `AGENT4_QUICK_REFERENCE.md` - Quick reference card
- (Other agents should add their guides here)

### Git Coordination

**Branch Strategy:**
- `main` - Protected, production-ready
- `agent#/feature-name` - Agent feature branches
- Create PR with 1 approval required

**Commit Message Format:**
```
[Agent#] type: description

- Bullet points of changes
- Reference related agents if applicable
```

**Example:**
```
[Agent4] feat: Add performance monitoring infrastructure

- Created PerformanceMetrics module
- Added benchmark utilities
- Implemented PerformanceMonitor component
- Coordinates with Agent1 for IK performance validation
```

---

## 🎯 Performance Targets (Shared)

All agents should validate against these targets:

| Metric | Target | Owner | Validator |
|--------|--------|-------|-----------|
| FPS (50 objects) | 60 FPS | All | Agent 4 |
| Input Latency | <50ms | Agent 1, 2 | Agent 4 |
| IK Solve (single) | <100ms | Agent 1 | Agent 4 |
| IK Solve (multi) | <200ms | Agent 2 | Agent 4 |
| Load Time | <3s | All | Agent 4 |
| Memory (1hr) | No leaks | All | Agent 4 |
| Test Coverage | >80% | All | Agent 3, 4 |

---

## 🚦 Current Status

### Agent 4 Status
**Status:** ✅ Phases 1-3 Complete (Ahead of Schedule)  
**Available:** Performance monitoring, benchmarking, testing infrastructure  
**Next:** Helping integrate tools across team

**Deliverables Ready:**
- `src/core/PerformanceMetrics.ts`
- `src/utils/benchmark.ts`
- `src/ui/components/debug/PerformanceMonitor.tsx`
- `docs/PERFORMANCE_MONITORING.md`
- `docs/TESTING_GUIDE.md`
- `docs/PERFORMANCE_OPTIMIZATION.md`
- `agent-notes/shared/AGENT4_INTEGRATION_GUIDE.md`

### Other Agents
Check project files and Slack for current status.

---

## 📞 Getting Help

### From Agent 4 (Performance & Testing)

**Available Services:**
- Performance monitoring integration
- Benchmark setup
- Test writing assistance
- Performance optimization advice
- Testing infrastructure support

**How to Request:**
1. Post in `#dev-performance` Slack
2. Reference `agent-notes/shared/AGENT4_INTEGRATION_GUIDE.md`
3. Ping Agent 4 directly

### General Help

1. Check project file: `AGENT#_*_PROJECT.md`
2. Check shared notes: `agent-notes/shared/`
3. Post in appropriate Slack channel
4. Ping responsible agent

---

## ✅ Success Metrics

### Team Coordination Success
- [ ] All agents using Agent 4's performance tools
- [ ] All agents writing tests
- [ ] Performance targets met
- [ ] Test coverage >80%
- [ ] No blocking dependencies
- [ ] Regular communication in Slack

### Individual Agent Success
- [ ] Phase deliverables completed
- [ ] Tests passing
- [ ] Performance validated
- [ ] Documentation updated
- [ ] Coordination points addressed

---

**Remember: We're a team! Communicate early and often!** 🤝

_Last Updated: 2025-10-23_  
_Maintained by: All Agents_
