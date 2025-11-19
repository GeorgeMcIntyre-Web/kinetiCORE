# FEA Backend MVP - End-to-End Testing Guide

**Document Version:** 1.0
**Last Updated:** 2025-01-19
**Owner:** Agent 1 (Claude Code / George)

---

## Overview

This guide describes how to run an end-to-end test of the complete FEA backend integration, from frontend UI to backend solver.

**Architecture:**

```
Frontend (React + TypeScript)
    ↓ HTTP POST /fea/jobs
FastAPI (port 8050)
    ↓ Celery task enqueue
Redis (port 6379)
    ↓ Task dequeue
Celery Worker
    ↓ Run solver
Mock Solver (2s delay, analytical beam solution)
    ↓ Return result
Frontend polls GET /fea/jobs/{id}/result
    ↓ Display results
User sees: maxDisplacement, maxVonMises, FoS
```

---

## Prerequisites

### Required Software

1. **Python 3.10+** - Backend runtime
2. **Node.js 18+** - Frontend runtime
3. **Redis 7.x** - Message broker & result backend

### Optional (Future)

- Gmsh - Mesh generation (not used in MVP)
- CalculiX - FEA solver (not used in MVP)

---

## Quick Start (E2E Test)

### Step 1: Start Redis

**Option A: Docker (Recommended)**

```bash
docker run -d -p 6379:6379 redis:7-alpine
```

**Option B: Native Installation**

```bash
# macOS (Homebrew)
brew services start redis

# Linux
sudo systemctl start redis

# Windows (if installed)
redis-server.exe
```

**Verify Redis is running:**

```bash
redis-cli ping
# Expected output: PONG
```

---

### Step 2: Install Backend Dependencies

Navigate to the `server/` directory:

```bash
cd server
```

**Option A: Using pip**

```bash
pip install -r requirements-fea.txt
```

**Option B: Using poetry (recommended)**

```bash
poetry install
poetry shell
```

---

### Step 3: Start Celery Worker

**Open a new terminal** in the `server/` directory:

```bash
# Using pip
celery -A app.core.celery_app worker --loglevel=info

# Using poetry
poetry run celery -A app.core.celery_app worker --loglevel=info
```

**Expected output:**

```
-------------- celery@your-hostname v5.3.6 (emerald-rush)
--- ***** -----
-- ******* ---- macOS-14.0-arm64-arm-64bit 2025-01-19 12:00:00
- *** --- * ---
- ** ---------- [config]
- ** ---------- .> app:         kineticore_fea:0x...
- ** ---------- .> transport:   redis://localhost:6379/0
- ** ---------- .> results:     redis://localhost:6379/0
- *** --- * --- .> concurrency: 8 (prefork)
-- ******* ---- .> task events: OFF
--- ***** -----
 -------------- [queues]
                .> celery           exchange=celery(direct) key=celery

[tasks]
  . app.worker.run_fea_analysis

[2025-01-19 12:00:00,000: INFO/MainProcess] Connected to redis://localhost:6379/0
[2025-01-19 12:00:00,000: INFO/MainProcess] mingle: searching for neighbors
[2025-01-19 12:00:00,000: INFO/MainProcess] mingle: all alone
[2025-01-19 12:00:00,000: INFO/MainProcess] celery@your-hostname ready.
```

✅ **Key indicator:** Look for `celery@your-hostname ready.`

---

### Step 4: Start FastAPI Server

**Open another new terminal** in the `server/` directory:

```bash
# Using pip
uvicorn app.main:app --reload --port 8050

# Using poetry
poetry run uvicorn app.main:app --reload --port 8050

# Or using Python directly
python -m app.main
```

**Expected output:**

```
INFO:     Uvicorn running on http://0.0.0.0:8050 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using StatReload
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Verify backend is running:**

```bash
curl http://localhost:8050/health
# Expected: {"status":"healthy","service":"kinetiCORE FEA Service"}
```

---

### Step 5: Start Frontend Dev Server

**Open a new terminal** in the **kinetiCORE root directory**:

```bash
npm run dev
```

**Expected output:**

```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Open browser:**

Navigate to [http://localhost:5173](http://localhost:5173)

---

### Step 6: Open FEA Backend Demo Panel

**Option A: Direct Import (Temporary Testing)**

If the panel is not yet integrated into the main UI, you can temporarily add it:

1. Open `src/ui/layouts/EssentialModeLayout.tsx` or similar
2. Add import:
   ```typescript
   import { FeaBackendDemoPanel } from '../components/FeaBackendDemoPanel';
   ```
3. Add panel to render:
   ```tsx
   <FeaBackendDemoPanel onClose={() => setShowFeaDemo(false)} />
   ```

**Option B: Integration via Panel Registry (Future)**

Once integrated into the main panel system, access via:
- Menu → Debug → FEA Backend Demo
- Or keyboard shortcut (TBD)

---

### Step 7: Run E2E Test

In the FEA Backend Demo Panel:

1. **Click "Run Beam FEA (Mock Backend)" button**

2. **Observe status transitions:**
   - `Submitting job...` (< 100ms)
   - `Job submitted. Polling for result...` (< 100ms)
   - `Job completed successfully` (after ~2 seconds)

3. **Verify results displayed:**
   - **Max Displacement:** ~1.6000 mm (should be stable across runs)
   - **Max von Mises Stress:** ~60.00 MPa
   - **Factor of Safety:** ~4.17
   - **Field Data:**
     - Nodes: 21
     - Displacements: 21
     - Von Mises values: 21
   - **Metadata:**
     - Solve Time: 2.00s
     - DOFs: 63

---

## Expected Results

### Analytical Solution (Cantilever Beam)

**Input Parameters:**
- **Geometry:** 1.0m long, 50mm × 100mm rectangular cross-section
- **Material:** Structural steel (E = 200 GPa, ν = 0.3, σ_y = 250 MPa)
- **Boundary Conditions:** Fixed at x = 0
- **Load:** 1000 N downward concentrated force at x = L

**Expected Output (Euler-Bernoulli Theory):**

| Metric                 | Formula                          | Value         |
|------------------------|----------------------------------|---------------|
| Max Displacement       | δ = PL³/(3EI)                    | **1.60 mm**   |
| Max Bending Moment     | M = PL                           | 1000 N·m      |
| Max Stress             | σ = Mc/I                         | **60.0 MPa**  |
| Factor of Safety       | FoS = σ_y/σ                      | **4.17**      |

Where:
- P = 1000 N
- L = 1.0 m
- E = 200 GPa
- I = (bh³)/12 = (0.05 × 0.1³)/12 = 4.167×10⁻⁶ m⁴
- c = h/2 = 0.05 m

---

## Troubleshooting

### Issue: "Failed to connect to FEA service at http://localhost:8050"

**Possible Causes:**
1. FastAPI server not running
2. Wrong port (should be 8050)
3. CORS issue (frontend on different origin)

**Solutions:**
1. Verify FastAPI is running: `curl http://localhost:8050/health`
2. Check server logs for errors
3. Verify CORS origins in `server/app/core/config.py`:
   ```python
   cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000"]
   ```

---

### Issue: Job Stuck in "Queued" Status

**Possible Causes:**
1. Celery worker not running
2. Redis not running
3. Task import error in worker

**Debug Steps:**

```bash
# 1. Check Redis is running
redis-cli ping
# Expected: PONG

# 2. Check Celery worker logs
# Look for: "celery@hostname ready."

# 3. Check Redis keys
redis-cli
> KEYS *
# Should show task IDs like: celery-task-meta-<uuid>

# 4. Check Celery active tasks
celery -A app.core.celery_app inspect active
```

---

### Issue: CORS Error in Browser Console

**Error Message:**
```
Access to fetch at 'http://localhost:8050/fea/jobs' from origin
'http://localhost:5173' has been blocked by CORS policy
```

**Solution:**

1. Verify `server/app/core/config.py` has correct CORS origins:
   ```python
   cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000"]
   ```

2. Restart FastAPI server after changing config

3. Create `.env` file in `server/` directory if needed:
   ```bash
   CORS_ORIGINS=http://localhost:5173,http://localhost:3000
   ```

---

### Issue: Job Returns 404 for Result

**Cause:**
Job not completed yet (still in `queued` or `running` state).

**Solution:**
- Wait for job to complete (mock solver takes ~2 seconds)
- Frontend client (`FeaServiceClient.ts`) handles this automatically via polling
- If polling timeout occurs (default 5 minutes), check worker logs

---

### Issue: Unexpected Result Values

**Cause:**
Mock solver uses deterministic analytical solution. Values should be stable across runs.

**Expected Values (Tolerance ±0.1%):**
- Max Displacement: 1.60 mm ± 0.002 mm
- Max von Mises: 60.0 MPa ± 0.1 MPa
- Factor of Safety: 4.17 ± 0.01

**If values differ significantly:**
1. Check input request (materials, loads)
2. Review mock solver calculation in `server/app/solvers/mock_solver.py`
3. Verify units (Pa, meters, etc.)

---

## Backend Logs

### FastAPI Logs

**What to look for:**

```
INFO:     POST /fea/jobs HTTP/1.1 200 OK
INFO:     GET /fea/jobs/{uuid} HTTP/1.1 200 OK
INFO:     GET /fea/jobs/{uuid}/result HTTP/1.1 200 OK
```

**Errors to watch for:**

```
ERROR:    Exception in ASGI application
ERROR:    500 Internal Server Error
```

---

### Celery Worker Logs

**Successful job:**

```
[2025-01-19 12:00:05,000: INFO/MainProcess] Task app.worker.run_fea_analysis[{uuid}] received
[2025-01-19 12:00:05,010: INFO/ForkPoolWorker-1] Starting FEA job {uuid}
[2025-01-19 12:00:05,020: INFO/ForkPoolWorker-1] Job {uuid} validated: model_type=beam-demo
[2025-01-19 12:00:05,030: INFO/ForkPoolWorker-1] Job {uuid} routing to mock solver (model_type=beam-demo)
[2025-01-19 12:00:05,040: INFO/ForkPoolWorker-1] Mock solver started for job {uuid} (model_type=beam-demo)
[2025-01-19 12:00:07,050: INFO/ForkPoolWorker-1] Mock solver completed for job {uuid}: max_disp=1.60mm, max_stress=60.0MPa, FoS=4.17
[2025-01-19 12:00:07,060: INFO/ForkPoolWorker-1] Job {uuid} completed successfully
[2025-01-19 12:00:07,070: INFO/ForkPoolWorker-1] Task app.worker.run_fea_analysis[{uuid}] succeeded in 2.05s
```

**Failed job:**

```
[2025-01-19 12:00:05,000: ERROR/ForkPoolWorker-1] Job {uuid} validation failed: ...
[2025-01-19 12:00:05,010: ERROR/ForkPoolWorker-1] FEA analysis failed for job {uuid}: ...
[2025-01-19 12:00:05,020: ERROR/MainProcess] Task app.worker.run_fea_analysis[{uuid}] raised unexpected: RuntimeError('...')
```

---

## Testing Checklist

Use this checklist to verify the E2E integration:

- [ ] Redis running and responding to `redis-cli ping`
- [ ] Celery worker started and showing "ready" status
- [ ] FastAPI server running on port 8050
- [ ] Health endpoint returns 200: `curl http://localhost:8050/health`
- [ ] Frontend dev server running on port 5173
- [ ] FEA Backend Demo Panel visible in UI
- [ ] Click "Run Beam FEA" button
- [ ] Status changes from "Submitting" → "Polling" → "Completed"
- [ ] Results displayed:
  - [ ] Max Displacement ≈ 1.60 mm
  - [ ] Max von Mises ≈ 60.0 MPa
  - [ ] Factor of Safety ≈ 4.17
  - [ ] Field Data: 21 nodes, 21 displacements, 21 von Mises values
  - [ ] Metadata: 2.0s solve time, 63 DOFs
- [ ] No errors in browser console
- [ ] No errors in FastAPI logs
- [ ] No errors in Celery worker logs
- [ ] Job completes in ~2 seconds (±0.5s)

---

## Next Steps

### Phase 2: Real FEA Integration

Once the mock backend is working end-to-end:

1. **Gmsh Integration:**
   - Install Gmsh binary
   - Add meshing step in solver
   - Generate `.msh` files from geometry

2. **CalculiX Integration:**
   - Install CalculiX (ccx) binary
   - Write `.inp` input files
   - Parse `.frd` result files

3. **Shell Elements:**
   - Implement S8R shell element support
   - Handle STEP file imports
   - BIW (Body-in-White) geometry processing

4. **Production Deployment:**
   - Docker containerization
   - Kubernetes orchestration
   - Horizontal scaling of workers
   - Result caching (S3/MinIO)

See `docs/fea/FEA_ARCHITECTURE_DRAFT.md` for full roadmap.

---

## References

- **Frontend Types:** [src/services/fea/FeaServiceTypes.ts](../../src/services/fea/FeaServiceTypes.ts)
- **Frontend Client:** [src/services/fea/FeaServiceClient.ts](../../src/services/fea/FeaServiceClient.ts)
- **Backend Models:** [server/app/models/fea.py](../../server/app/models/fea.py)
- **Backend API:** [server/app/main.py](../../server/app/main.py)
- **Celery Worker:** [server/app/worker.py](../../server/app/worker.py)
- **Mock Solver:** [server/app/solvers/mock_solver.py](../../server/app/solvers/mock_solver.py)
- **Backend README:** [server/README.md](../../server/README.md)

---

## Support

**Questions or issues?**

- **Slack:** `#dev-fea` or `#dev-blockers`
- **GitHub:** [kinetiCORE Issues](https://github.com/GeorgeMcIntyre-Web/kinetiCORE/issues)
- **Email:** (Team lead contact)

---

**Last Updated:** 2025-01-19
**Tested By:** Agent 1 (Claude Code)
**Status:** ✅ Ready for testing
