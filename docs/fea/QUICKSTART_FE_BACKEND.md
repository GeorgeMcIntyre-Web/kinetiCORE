# FEA Backend Quick Start Guide

**5-minute setup guide for local development**

**Version:** 1.0
**Last Updated:** 2025-11-19

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Redis 7.x**

---

## Quick Start

### 1. Start Redis

```bash
# Docker (recommended)
docker run -d -p 6379:6379 redis:7-alpine

# Verify
redis-cli ping
# Expected: PONG
```

### 2. Start Celery Worker

**Terminal 1:**
```bash
cd server
pip install -r requirements-fea.txt
celery -A app.core.celery_app worker --loglevel=info
```

Wait for: `celery@hostname ready.`

### 3. Start FastAPI Server

**Terminal 2:**
```bash
cd server
uvicorn app.main:app --reload --port 8050
```

Wait for: `Uvicorn running on http://0.0.0.0:8050`

**Test:**
```bash
curl http://localhost:8050/health
# Expected: {"status":"healthy","service":"kinetiCORE FEA Service"}
```

### 4. Start Frontend Dev Server

**Terminal 3:**
```bash
cd ../  # back to root
npm install
npm run dev
```

Open browser: http://localhost:5173

### 5. Test FEA Demo

**Access the FEA Backend Demo Panel:**

1. In the UI, ensure you're in **Professional Mode** (mode switcher in header)
2. Open the browser console (F12)
3. Run: `window.__DEBUG_showFeaBackendDemo()`
4. The FEA Backend Demo Panel will appear
5. Click **"Run Beam FEA (Mock Backend)"** button

Alternatively, the panel is automatically opened by E2E tests.

**Expected Results (~2 seconds):**
- ✅ Max Displacement: ~1.60 mm
- ✅ Max von Mises: ~60.0 MPa
- ✅ Factor of Safety: ~4.17
- ✅ Field Data: 21 nodes with displacements and stresses

---

## Architecture

```
Browser → FastAPI (8050) → Redis → Celery Worker → Mock Solver → Result
```

---

## Troubleshooting

### "Failed to connect to FEA service"
- Check FastAPI is running: `curl http://localhost:8050/health`
- Verify CORS in `server/app/core/config.py`: `["http://localhost:5173"]`

### Job stuck in "Queued"
- Check Celery worker is running and shows "ready"
- Verify Redis: `redis-cli ping`

### Unexpected results
Expected values (stable across runs):
- Displacement: 1.60 mm ± 0.002 mm
- Stress: 60.0 MPa ± 0.1 MPa
- FoS: 4.17 ± 0.01

---

## Development Workflow

### Running Tests

**Backend Unit Tests:**
```bash
cd server
pytest tests/ -v
```

**Frontend Unit Tests:**
```bash
npm run test src/services/fea
```

**E2E Browser Tests (Playwright):**

Prerequisites: All services running (Redis, Celery, FastAPI, Frontend)

```bash
# Run all E2E tests
npm run test:e2e

# Run only FEA backend tests
npm run test:e2e:fea

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode (step through tests)
npm run test:e2e:debug

# Interactive UI mode
npm run test:e2e:ui
```

**What the E2E tests do:**
1. ✅ Launch frontend dev server automatically
2. ✅ Open Professional mode
3. ✅ Trigger FEA Backend Demo Panel
4. ✅ Submit mock beam FEA job
5. ✅ Wait for completion (polls backend)
6. ✅ Verify results: displacement, stress, FoS
7. ✅ Test error handling and multiple submissions

**E2E Test Coverage:**
- `[E2E-FEA-001]` Happy path - Full job submission workflow
- `[E2E-FEA-002]` Panel open/close behavior
- `[E2E-FEA-003]` Requirements instructions display
- `[E2E-FEA-004]` Backend unavailable error handling
- `[E2E-FEA-005]` Multiple job submissions

**Note:** If backend is not running, tests will gracefully skip with a warning.

### Making Changes

1. Edit code
2. Backend: Auto-reloads (uvicorn --reload)
3. Frontend: Auto-reloads (Vite HMR)
4. Celery: Restart worker for changes

---

## Environment Variables

Create `server/.env` (optional):

```bash
DEBUG=false
PORT=8050
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
REDIS_URL=redis://localhost:6379/0
CELERY_TASK_TIME_LIMIT=3600
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/app/main.py` | FastAPI REST API |
| `server/app/worker.py` | Celery tasks |
| `server/app/models/fea.py` | Pydantic models |
| `server/app/solvers/mock_solver.py` | Mock beam solver |
| `src/services/fea/FeaServiceClient.ts` | Frontend HTTP client |
| `src/services/fea/FeaServiceTypes.ts` | TypeScript types |

---

## Next Steps

- **Full Documentation:** [FEA_BACKEND_IMPLEMENTATION.md](./FEA_BACKEND_IMPLEMENTATION.md)
- **Architecture:** [FEA_ARCHITECTURE_DRAFT.md](./FEA_ARCHITECTURE_DRAFT.md)
- **Testing Guide:** [FEA_BACKEND_MVP.md](./FEA_BACKEND_MVP.md) (E2E testing)
- **Backend README:** [server/README.md](../../server/README.md)

---

**Questions?** Slack: `#dev-fea` or `#dev-blockers`
