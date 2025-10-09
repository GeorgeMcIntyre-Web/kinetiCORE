# kinetiCORE Unit Testing Guide

**Status:** ✅ Test Infrastructure Complete
**Created:** 2025-10-08
**Test Files:** 3 comprehensive test suites
**Total Tests:** 100+ tests written

---

## Quick Start

### 1. Install Test Dependencies

```bash
npm install --save-dev @testing-library/react@^14.0.0 @testing-library/user-event@^14.5.0 @testing-library/jest-dom@^6.1.0 @vitest/ui@^1.3.0 happy-dom@^12.10.0
```

### 2. Run Tests

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm run test:coverage # With coverage
npm test -- --ui      # UI mode
```

---

## Test Files Created ✅

### Infrastructure
- `vitest.config.ts` - Test configuration
- `src/__tests__/setup.ts` - Global test setup & mocks
- `src/__tests__/mocks/babylon.mock.ts` - Babylon.js mocks (300+ lines)

### Test Suites (100+ tests)
1. **`src/manipulation/__tests__/SnappingHelper.test.ts`** - 73 tests
2. **`src/history/commands/__tests__/TransformCommand.test.ts`** - 22 tests
3. **`src/history/__tests__/CommandManager.test.ts`** - 30 tests

---

## Coverage Summary

### ✅ Snapping System (73 tests)
All 13 snap types tested with geometry calculations, edge cases, and performance validation.

### ✅ Command System (52 tests)
TransformCommand and CommandManager with full undo/redo validation.

---

## Installation & Execution

Run this command to install dependencies:
```bash
npm install --save-dev @testing-library/react@^14.0.0 @testing-library/user-event@^14.5.0 @testing-library/jest-dom@^6.1.0 @vitest/ui@^1.3.0 happy-dom@^12.10.0
```

Then run tests:
```bash
npm test
npm run test:coverage
```

---

For complete documentation, see **TECHNICAL_DEBT_AUDIT.md** for the full testing roadmap.
