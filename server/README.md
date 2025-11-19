# kinetiCORE FEA Backend Service

**FastAPI + Celery + Redis** backend for Finite Element Analysis (FEA) job processing.

## Overview

This service provides an asynchronous HTTP API for submitting and querying FEA jobs:

1. **Frontend** submits job via `POST /fea/jobs`
2. **FastAPI** enqueues task in **Celery**
3. **Celery worker** processes job (calls solver)
4. **Frontend** polls `GET /fea/jobs/{id}` for status
5. **Frontend** retrieves result via `GET /fea/jobs/{id}/result`

### Architecture

```
Frontend (React)  →  FastAPI (port 8050)  →  Redis (port 6379)
                                                  ↓
                                            Celery Worker
                                                  ↓
                                            Mock Solver (2s delay)
```

---

## Prerequisites

### Required

- **Python 3.10+**
- **Redis** (running on `localhost:6379`)

### Optional (Future)

- **Gmsh** - Mesh generation (not yet used)
- **CalculiX** - FEA solver (not yet used)

---

## Quick Start

### 1. Install Dependencies

**Using pip:**

```bash
cd server
pip install -r requirements-fea.txt
```

**Using poetry (recommended):**

```bash
cd server
poetry install
poetry shell
```

### 2. Start Redis

**Linux/macOS:**

```bash
redis-server
```

**Windows (with Redis installed):**

```bash
redis-server.exe
```

**Docker:**

```bash
docker run -d -p 6379:6379 redis:7-alpine
```

### 3. Start Celery Worker

Open a **new terminal** in the `server/` directory:

```bash
# Using pip
celery -A app.core.celery_app worker --loglevel=info

# Using poetry
poetry run celery -A app.core.celery_app worker --loglevel=info
```

**Expected output:**

```
[tasks]
  . app.worker.run_fea_analysis

celery@hostname ready.
```

### 4. Start FastAPI Server

Open **another terminal** in the `server/` directory:

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
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### 5. Test the API

**Health check:**

```bash
curl http://localhost:8050/health
```

**Submit a job:**

```bash
curl -X POST http://localhost:8050/fea/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "meta": {
      "name": "Test Beam",
      "modelType": "beam-demo"
    },
    "materials": [{
      "id": "steel",
      "name": "Steel",
      "youngsModulus": 200e9,
      "poissonsRatio": 0.3,
      "yieldStrength": 250e6
    }],
    "boundaryConditions": [{
      "type": "fixed",
      "nodeIds": [0]
    }],
    "loads": [{
      "type": "concentrated",
      "nodeIds": [20],
      "force": {"x": 0, "y": -1000, "z": 0}
    }]
  }'
```

**Response:**

```json
{
  "jobId": "abc-123-def",
  "status": "queued",
  "message": "Job queued for processing"
}
```

**Check status:**

```bash
curl http://localhost:8050/fea/jobs/abc-123-def
```

**Get result (after ~2 seconds):**

```bash
curl http://localhost:8050/fea/jobs/abc-123-def/result
```

---

## Project Structure

```
server/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app (REST endpoints)
│   ├── worker.py               # Celery tasks
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py           # Settings (Pydantic)
│   │   └── celery_app.py       # Celery configuration
│   ├── models/
│   │   ├── __init__.py
│   │   └── fea.py              # Pydantic schemas
│   └── solvers/
│       ├── __init__.py
│       └── mock_solver.py      # Mock beam solver
├── pyproject.toml              # Poetry dependencies
├── requirements-fea.txt        # Pip dependencies
└── README.md                   # This file
```

---

## API Reference

### Endpoints

#### `GET /health`

Health check.

**Response:**

```json
{
  "status": "healthy",
  "service": "kinetiCORE FEA Service"
}
```

---

#### `POST /fea/jobs`

Submit a new FEA job.

**Request Body:** `FeaJobRequest` (JSON)

```typescript
{
  meta: {
    name: string;
    description?: string;
    estimatedDofs?: number;
    modelType: "beam-demo" | "shell-demo" | "biw-proto";
  };
  materials: Array<{
    id: string;
    name: string;
    youngsModulus: number;      // Pa
    poissonsRatio: number;       // dimensionless
    density?: number;            // kg/m³
    yieldStrength?: number;      // Pa
  }>;
  boundaryConditions: Array<{
    type: "fixed" | "pinned" | "symmetry";
    nodeIds: number[];
    dofs?: ("ux" | "uy" | "uz" | "rx" | "ry" | "rz")[];
  }>;
  loads: Array<{
    type: "concentrated" | "pressure" | "gravity";
    nodeIds?: number[];
    elementIds?: number[];
    force?: { x: number; y: number; z: number };
    pressure?: number;
  }>;
  solverOptions?: {
    maxIterations?: number;
    tolerance?: number;
  };
}
```

**Response:** `FeaJobStatus` (JSON)

```json
{
  "jobId": "uuid-string",
  "status": "queued",
  "message": "Job queued for processing",
  "updatedAt": "2025-01-19T12:00:00"
}
```

---

#### `GET /fea/jobs/{job_id}`

Get current status of a job.

**Path Parameters:**

- `job_id` (string) - Job UUID

**Response:** `FeaJobStatus`

```json
{
  "jobId": "uuid-string",
  "status": "running",
  "progress": 45.0,
  "message": "Running mock solver",
  "updatedAt": "2025-01-19T12:00:05"
}
```

**Status values:**

- `queued` - Job waiting in queue
- `running` - Job currently executing
- `completed` - Job finished successfully
- `error` - Job failed

---

#### `GET /fea/jobs/{job_id}/result`

Get result of a completed job.

**Path Parameters:**

- `job_id` (string) - Job UUID

**Response:** `FeaJobResult`

```json
{
  "jobId": "uuid-string",
  "status": "completed",
  "maxDisplacement": 0.0016,
  "maxVonMises": 60000000,
  "factorOfSafety": 4.17,
  "fields": {
    "nodeIds": [0, 1, 2, ...],
    "displacements": [
      { "x": 0, "y": 0, "z": 0 },
      { "x": 0, "y": 0.00008, "z": 0 },
      ...
    ],
    "vonMises": [60000000, 54000000, ...]
  },
  "meta": {
    "solveTime": 2.0,
    "dofs": 63
  }
}
```

**Error Response:**

```json
{
  "jobId": "uuid-string",
  "status": "error",
  "error": "Solver failed: Invalid material properties"
}
```

---

## Configuration

### Environment Variables

Create a `.env` file in the `server/` directory:

```bash
# Application
DEBUG=false
HOST=0.0.0.0
PORT=8050

# CORS (comma-separated)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Redis
REDIS_URL=redis://localhost:6379/0

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
CELERY_TASK_TIME_LIMIT=3600

# Solver paths (future)
GMSH_BINARY_PATH=gmsh
CALCULIX_BINARY_PATH=ccx

# Working directory
WORK_DIR=./solver_workspace
```

### Default Values

If no `.env` file is present, these defaults are used:

- **Port:** `8050`
- **CORS:** `["http://localhost:5173", "http://localhost:3000"]`
- **Redis:** `redis://localhost:6379/0`

---

## Mock Solver Details

The mock solver (`app/solvers/mock_solver.py`) simulates FEA computation:

### Behavior

1. **Sleeps for 2 seconds** (simulates compute time)
2. **Uses Euler-Bernoulli beam theory:**
   - Deflection: `v(x) = (P/6EI)(3Lx² - x³)`
   - Stress: `σ = Mc/I`
3. **Generates 20 nodes** with displacement and stress fields
4. **Returns deterministic results** based on input materials/loads

### Assumptions

- **Beam geometry:** 1m long, 50mm × 100mm rectangular section
- **Boundary condition:** Fixed at x=0
- **Load:** Concentrated vertical force at free end (x=L)

### Example Calculation

**Input:**

- E = 200 GPa (steel)
- P = 1000 N (downward)
- L = 1m

**Output:**

- Max displacement: **1.6 mm** (at tip)
- Max stress: **60 MPa** (at fixed end)
- Factor of safety: **4.17** (for 250 MPa yield)

---

## Development

### Running Tests (TODO)

```bash
pytest
```

### Code Formatting

```bash
# Format code
black app/

# Sort imports
isort app/

# Type checking
mypy app/
```

### Debugging

**Enable debug mode:**

```bash
# In .env
DEBUG=true
```

**View Celery logs:**

```bash
celery -A app.core.celery_app worker --loglevel=debug
```

**View FastAPI logs:**

```bash
uvicorn app.main:app --reload --log-level debug
```

---

## Troubleshooting

### Redis Connection Error

**Error:**

```
celery.exceptions.ImproperlyConfigured: Cannot connect to Redis
```

**Solution:**

1. Check Redis is running: `redis-cli ping` (should return `PONG`)
2. Verify URL in `.env`: `REDIS_URL=redis://localhost:6379/0`
3. Try Docker: `docker run -d -p 6379:6379 redis:7-alpine`

---

### CORS Error in Browser

**Error:**

```
Access to fetch at 'http://localhost:8050/fea/jobs' from origin
'http://localhost:5173' has been blocked by CORS policy
```

**Solution:**

1. Verify frontend URL in `CORS_ORIGINS` (in `.env` or `app/core/config.py`)
2. Restart FastAPI server after changing config

---

### Job Stuck in "queued" Status

**Possible Causes:**

1. **Celery worker not running** → Start with `celery -A app.core.celery_app worker`
2. **Redis not running** → Start with `redis-server`
3. **Task import error** → Check worker logs for Python errors

**Debug:**

```bash
# Check Redis keys
redis-cli
> KEYS *

# Check Celery queue
celery -A app.core.celery_app inspect active
```

---

### Job Returns 404 for Result

**Cause:**

Job not completed yet (still `queued` or `running`).

**Solution:**

1. Poll `GET /fea/jobs/{id}` until `status == "completed"`
2. Then request `GET /fea/jobs/{id}/result`

Frontend client (`src/services/fea/FeaServiceClient.ts`) handles this automatically via `pollFeaJobUntilDone()`.

---

## Roadmap

### Phase 1.5 (Current)

- ✅ FastAPI server with 3 endpoints
- ✅ Celery worker with progress tracking
- ✅ Mock solver (analytical beam solution)
- ✅ Redis integration
- ⬜ Unit tests
- ⬜ Integration tests

### Phase 2 (Next)

- ⬜ Gmsh meshing integration
- ⬜ CalculiX solver integration
- ⬜ S8R shell elements
- ⬜ STEP file import
- ⬜ Material library (HSLA steels)

### Phase 3 (Future)

- ⬜ Docker deployment
- ⬜ Kubernetes orchestration
- ⬜ Job queue dashboard
- ⬜ Result caching
- ⬜ Batch job support

---

## References

- **Frontend Integration:** [src/services/fea/README.md](../src/services/fea/README.md)
- **FEA Architecture:** [docs/fea/FEA_ARCHITECTURE_DRAFT.md](../docs/fea/FEA_ARCHITECTURE_DRAFT.md)
- **FastAPI Docs:** https://fastapi.tiangolo.com
- **Celery Docs:** https://docs.celeryq.dev
- **Redis Docs:** https://redis.io/docs

---

## Support

**Questions or issues?**

- Slack: `#dev-fea` or `#dev-blockers`
- GitHub: [kinetiCORE Issues](https://github.com/GeorgeMcIntyre-Web/kinetiCORE/issues)

---

**Document Version:** 1.0
**Last Updated:** 2025-01-19
**Author:** Agent 1 (Claude Code / George)
