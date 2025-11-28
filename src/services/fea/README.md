# FEA Service Client

## Overview

TypeScript HTTP client for communicating with the kinetiCORE FEA backend service (FastAPI + Celery + Redis).

**Architecture Pattern:** Thin Client
- Browser handles pre/post-processing and visualization only
- Heavy FEA computation runs on backend (local workstation or server)
- Asynchronous job submission with polling

## Files

- **FeaServiceTypes.ts** - Type definitions for job requests, status, and results
- **FeaServiceClient.ts** - HTTP client functions for job submission and polling
- **index.ts** - Public exports

## Quick Start

### Submit Job and Wait for Result

```typescript
import {
  submitAndWaitForResult,
  getDefaultFeaBaseUrl,
} from '@/services/fea';
import type { FeaJobRequest } from '@/services/fea';

async function runFeaAnalysis() {
  const request: FeaJobRequest = {
    meta: {
      name: 'BracketAnalysis_v1',
      description: 'Steel bracket with tip load',
      estimatedDofs: 12000,
      modelType: 'shell-demo',
    },
    materials: [
      {
        id: 'steel_hsla',
        name: 'HSLA 350/450',
        youngsModulus: 210e9,
        poissonsRatio: 0.3,
        yieldStrength: 350e6,
      },
    ],
    boundaryConditions: [
      {
        type: 'fixed',
        nodeIds: [1, 2, 3, 4],
        dofs: ['ux', 'uy', 'uz'],
      },
    ],
    loads: [
      {
        type: 'concentrated',
        nodeIds: [99],
        force: { x: 0, y: -1000, z: 0 },
      },
    ],
  };

  const baseUrl = getDefaultFeaBaseUrl();

  try {
    const result = await submitAndWaitForResult(baseUrl, request, {
      pollIntervalMs: 1000,
      timeoutMs: 300000, // 5 minutes
    });

    console.log('Max displacement:', result.maxDisplacement, 'm');
    console.log('Max von Mises:', result.maxVonMises, 'Pa');
    console.log('Factor of safety:', result.factorOfSafety);
  } catch (error) {
    console.error('FEA job failed:', error);
  }
}
```

### Manual Submission and Polling

For more control over the job lifecycle:

```typescript
import {
  submitFeaJob,
  pollFeaJobUntilDone,
  getDefaultFeaBaseUrl,
} from '@/services/fea';

async function runWithManualPolling() {
  const baseUrl = getDefaultFeaBaseUrl();

  // Submit job
  const status = await submitFeaJob(baseUrl, request);
  console.log('Job submitted:', status.jobId);

  // Update UI with "queued" status
  updateUI({ status: 'queued', jobId: status.jobId });

  // Poll until done
  const result = await pollFeaJobUntilDone(baseUrl, status.jobId, {
    pollIntervalMs: 2000,
    timeoutMs: 600000, // 10 minutes
  });

  // Display results
  visualizeResults(result);
}
```

### Check Job Status

```typescript
import { getFeaJobStatus } from '@/services/fea';

async function checkStatus(jobId: string) {
  const baseUrl = getDefaultFeaBaseUrl();
  const status = await getFeaJobStatus(baseUrl, jobId);

  console.log('Status:', status.status);
  console.log('Progress:', status.progress, '%');
  console.log('Message:', status.message);
}
```

## API Reference

### Functions

#### `getDefaultFeaBaseUrl(): string`

Returns the default FEA service base URL.

**Configuration:**
- Set `window.__FEA_SERVICE_URL__` at runtime
- Or configure via build system
- Default: `http://localhost:8050`

---

#### `submitFeaJob(baseUrl, request): Promise<FeaJobStatus>`

Submit FEA job to backend service.

**Parameters:**
- `baseUrl` - Base URL of FEA service
- `request` - FEA job request (see types below)

**Returns:** Job status with `jobId`

**Throws:** Validation error or network error

---

#### `pollFeaJobUntilDone(baseUrl, jobId, options?): Promise<FeaJobResult>`

Poll job status until completion.

**Parameters:**
- `baseUrl` - Base URL of FEA service
- `jobId` - Job identifier from `submitFeaJob`
- `options` - Optional polling configuration
  - `pollIntervalMs` - Polling interval (default: 1000ms)
  - `timeoutMs` - Total timeout (default: 300000ms = 5 minutes)

**Returns:** Final job result with displacements and stresses

**Throws:** Timeout, job error, or network error

---

#### `getFeaJobStatus(baseUrl, jobId): Promise<FeaJobStatus>`

Get current status of FEA job.

**Parameters:**
- `baseUrl` - Base URL of FEA service
- `jobId` - Job identifier

**Returns:** Current job status

---

#### `getFeaJobResult(baseUrl, jobId): Promise<FeaJobResult>`

Get final result of completed job.

**Parameters:**
- `baseUrl` - Base URL of FEA service
- `jobId` - Job identifier

**Returns:** Job result (only if status is `completed`)

**Throws:** 404 if result not ready yet

---

#### `submitAndWaitForResult(baseUrl, request, options?): Promise<FeaJobResult>`

Submit job and poll until done in one call.

Convenience wrapper around `submitFeaJob` + `pollFeaJobUntilDone`.

---

### Types

#### `FeaJobRequest`

```typescript
interface FeaJobRequest {
  meta: FeaJobMeta;
  materials: FeaMaterial[];
  boundaryConditions: FeaBoundaryCondition[];
  loads: FeaLoad[];
  solverOptions?: {
    maxIterations?: number;
    tolerance?: number;
  };
}
```

#### `FeaJobMeta`

```typescript
interface FeaJobMeta {
  name: string;
  description?: string;
  estimatedDofs?: number;
  modelType: 'beam-demo' | 'shell-demo' | 'biw-proto';
}
```

#### `FeaMaterial`

```typescript
interface FeaMaterial {
  id: string;
  name: string;
  youngsModulus: number; // Pa
  poissonsRatio: number; // dimensionless
  density?: number; // kg/m³
  yieldStrength?: number; // Pa
}
```

#### `FeaBoundaryCondition`

```typescript
interface FeaBoundaryCondition {
  type: 'fixed' | 'pinned' | 'symmetry';
  nodeIds: number[];
  dofs?: ('ux' | 'uy' | 'uz' | 'rx' | 'ry' | 'rz')[];
}
```

#### `FeaLoad`

```typescript
interface FeaLoad {
  type: 'concentrated' | 'pressure' | 'gravity';
  nodeIds?: number[];
  elementIds?: number[];
  force?: { x: number; y: number; z: number };
  pressure?: number; // Pa
}
```

#### `FeaJobStatus`

```typescript
interface FeaJobStatus {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  progress?: number; // 0-100
  message?: string;
  updatedAt?: string;
}
```

#### `FeaJobResult`

```typescript
interface FeaJobResult {
  jobId: string;
  status: 'completed' | 'error';
  error?: string;
  maxDisplacement?: number; // m
  maxVonMises?: number; // Pa
  factorOfSafety?: number;
  fields?: {
    nodeIds?: number[];
    displacements?: Array<{ x: number; y: number; z: number }>;
    vonMises?: number[];
  };
  meta?: {
    solveTime?: number; // seconds
    dofs?: number;
  };
}
```

## Validation

Both `FeaMaterial` and `FeaJobRequest` have validation functions:

```typescript
import { validateFeaMaterial, validateFeaJobRequest } from '@/services/fea';

const error = validateFeaMaterial(material);
if (error) {
  console.error('Invalid material:', error);
}
```

Validation checks:
- Young's modulus > 0
- Poisson's ratio in [0, 0.5)
- Density > 0 (if provided)
- Yield strength > 0 (if provided)
- At least one material, BC, and load

## Error Handling

All functions throw errors with descriptive messages:

```typescript
try {
  const result = await submitAndWaitForResult(baseUrl, request);
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('timed out')) {
      // Handle timeout
    } else if (error.message.includes('validation')) {
      // Handle validation error
    } else if (error.message.includes('Failed to connect')) {
      // Handle network error
    } else {
      // Handle job execution error
    }
  }
}
```

## Backend Integration

This client expects a backend service with the following REST API:

### Endpoints

- **POST** `/fea/jobs` - Submit new job
  - Request: `FeaJobRequest` (JSON)
  - Response: `FeaJobStatus` with `jobId`

- **GET** `/fea/jobs/{jobId}` - Get job status
  - Response: `FeaJobStatus`

- **GET** `/fea/jobs/{jobId}/result` - Get job result
  - Response: `FeaJobResult`

### Backend Stack (Planned)

- **FastAPI** - REST API server
- **Celery** - Async task queue
- **Redis** - Job broker + result backend
- **Gmsh** - Mesh generation
- **CalculiX ccx** - FEA solver

See [docs/fea/FEA_ARCHITECTURE_DRAFT.md](../../../docs/fea/FEA_ARCHITECTURE_DRAFT.md) for full backend architecture.

## Configuration

### Development

Default URL: `http://localhost:8050`

No configuration needed for local development.

### Production

Set the FEA service URL at runtime:

```typescript
// In your app initialization:
(window as any).__FEA_SERVICE_URL__ = 'https://fea.kinetic-core.com';
```

Or configure via build-time environment variable (requires build system integration).

## Testing

### Unit Tests (TODO)

```typescript
import { validateFeaMaterial } from '@/services/fea';

describe('validateFeaMaterial', () => {
  it('rejects negative Young modulus', () => {
    const material = {
      id: 'test',
      name: 'Test',
      youngsModulus: -1,
      poissonsRatio: 0.3,
    };
    expect(validateFeaMaterial(material)).toContain('positive');
  });
});
```

### Integration Tests (TODO)

Mock fetch and test job submission flow.

## Roadmap

- [x] Type definitions
- [x] HTTP client functions
- [x] Validation helpers
- [ ] Backend implementation (FastAPI + Celery)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Real solver integration (CalculiX)
- [ ] Result field visualization
- [ ] Job history/caching
- [ ] Batch job support

## References

- Architecture: [docs/fea/FEA_ARCHITECTURE_DRAFT.md](../../../docs/fea/FEA_ARCHITECTURE_DRAFT.md)
- Beam Demo: [experiments/fea-beam/](../../../experiments/fea-beam/)
- Backend Repo: (TBD)
