# FEA Failure Scenarios - Testing & Resilience Guide

**Owner:** George (Agent 1 - Claude Code)
**Last Updated:** 2025-11-19
**Related Docs:** [FEA_BACKEND_MVP.md](./FEA_BACKEND_MVP.md), [FEA_HARDENING_SUMMARY.md](./FEA_HARDENING_SUMMARY.md)

---

## Overview

This document describes failure-injection mechanisms and error-handling behavior for the FEA backend MVP. These dev-only flags allow testing timeout, error, and edge-case scenarios end-to-end without modifying production code.

**Key Features:**
- Optional failure-injection flags in `FeaJobMeta` (backend & frontend)
- Typed error classes for clear error handling (`FeaPollTimeoutError`, `FeaHttpError`, `FeaJobError`)
- User-friendly error messages in the demo UI with troubleshooting tips
- Comprehensive test coverage for failure scenarios

---

## Failure Injection Flags (Dev-Only)

### Backend (Python)

**File:** [server/app/models/fea.py](../../server/app/models/fea.py)

```python
class FeaJobMeta(BaseModel):
    """FEA job request metadata."""

    name: str
    description: Optional[str]
    estimated_dofs: Optional[int] = Field(None, alias="estimatedDofs")
    model_type: FeaModelType = Field(..., alias="modelType")

    # Dev-only failure injection flags (optional)
    debug_slow_solver: Optional[bool] = Field(
        None, alias="debugSlowSolver", description="[DEV ONLY] Simulate slow solver (5-10s delay)"
    )
    debug_force_error: Optional[bool] = Field(
        None, alias="debugForceError", description="[DEV ONLY] Force solver to fail with error"
    )
```

### Frontend (TypeScript)

**File:** [src/services/fea/FeaServiceTypes.ts](../../src/services/fea/FeaServiceTypes.ts)

```typescript
export interface FeaJobMeta {
  name: string;
  description?: string;
  estimatedDofs?: number;
  modelType: FeaModelType;

  // Dev-only failure injection flags (optional)
  /** [DEV ONLY] Simulate slow solver (5-10s delay) */
  debugSlowSolver?: boolean;
  /** [DEV ONLY] Force solver to fail with error */
  debugForceError?: boolean;
}
```

**Important:** These flags are **optional** and default to `false`. They must NOT be required in production.

---

## Failure Scenarios

### 1. Slow Solver Scenario

**Purpose:** Test timeout handling and long-running job UX.

**How to Trigger:**

Set `meta.debugSlowSolver = true` in the FEA job request.

**Example (Frontend):**

```typescript
const request: FeaJobRequest = {
  meta: {
    name: 'Slow Solver Test',
    modelType: 'beam-demo',
    debugSlowSolver: true, // <-- Enable slow mode
  },
  materials: [ /* ... */ ],
  boundaryConditions: [ /* ... */ ],
  loads: [ /* ... */ ],
};

const result = await submitAndWaitForResult(baseUrl, request, {
  pollIntervalMs: 500,
  timeoutMs: 5000, // Short timeout for testing
});
```

**Expected Behavior:**

- **Backend:** Mock solver sleeps for **7 seconds** instead of the normal 2 seconds
- **Backend Logs:**
  ```
  INFO: Mock solver started for job <jobId> (slow=True, force_error=False)
  INFO: Job <jobId>: Using slow solver mode (delay=7.0s)
  ```
- **Frontend (if timeout is low):**
  - UI shows timeout error message:
    ```
    ⏱️ Timeout
    Job <jobId> is taking longer than expected (>5s). The job may still be running.
    Please check backend logs or try again with a longer timeout.
    💡 Tip: You can increase the timeout in the code or check if the backend is processing normally.
    ```
- **Frontend (if timeout is long enough):**
  - Job completes successfully after 7 seconds
  - `meta.solveTime` in result shows `7.0`

**Use Cases:**
- Test polling logic with long-running jobs
- Verify UI shows "still running" state clearly
- Test timeout handling without actually breaking the solver

---

### 2. Forced Solver Error Scenario

**Purpose:** Test error handling when solver fails.

**How to Trigger:**

Set `meta.debugForceError = true` in the FEA job request.

**Example (Frontend):**

```typescript
const request: FeaJobRequest = {
  meta: {
    name: 'Force Error Test',
    modelType: 'beam-demo',
    debugForceError: true, // <-- Force solver to fail
  },
  materials: [ /* ... */ ],
  boundaryConditions: [ /* ... */ ],
  loads: [ /* ... */ ],
};

const result = await submitAndWaitForResult(baseUrl, request);
```

**Expected Behavior:**

- **Backend:** Mock solver immediately returns error result without processing
- **Backend Logs:**
  ```
  INFO: Mock solver started for job <jobId> (slow=False, force_error=True)
  ERROR: Job <jobId>: Forced error via debugForceError flag
  ```
- **Backend Response:**
  ```json
  {
    "jobId": "<jobId>",
    "status": "error",
    "error": "Forced error for testing (debugForceError=true)"
  }
  ```
- **Frontend:**
  - Client throws `FeaJobError` with clear message
  - UI shows job failure error:
    ```
    ❌ Job Failed
    Job failed during execution: Forced error for testing (debugForceError=true).
    Check server logs for detailed error information.
    ```

**Use Cases:**
- Test error propagation from worker → backend → frontend
- Verify error messages are clear and actionable
- Test UI behavior when jobs fail

---

### 3. Unknown Job / Invalid Job ID

**Purpose:** Test handling of missing or invalid job IDs.

**How to Trigger:**

Manually call `getFeaJobStatus()` or `getFeaJobResult()` with a fake job ID.

**Example (Frontend):**

```typescript
// Simulate querying a job that doesn't exist
try {
  const status = await getFeaJobStatus('http://localhost:8050', 'fake-job-id-12345');
} catch (error) {
  if (error instanceof FeaHttpError) {
    console.log('Status code:', error.statusCode); // 404
    console.log('Job ID:', error.jobId);           // 'fake-job-id-12345'
    console.log('Body:', error.body);              // 'Job not found'
  }
}
```

**Expected Behavior:**

- **Backend:** Returns HTTP 404 with message "Job not found"
- **Frontend:**
  - Client throws `FeaHttpError`
  - Error includes:
    - `statusCode: 404`
    - `jobId: 'fake-job-id-12345'`
    - `body: 'Job not found'`
    - `url: 'http://localhost:8050/fea/jobs/fake-job-id-12345'`

**Use Cases:**
- Test handling of typos or stale job IDs
- Verify 404 errors are caught and displayed clearly

---

### 4. Backend Service Unavailable

**Purpose:** Test handling when backend is down or unreachable.

**How to Trigger:**

Stop the FastAPI server or use an invalid base URL.

**Example (Frontend):**

```typescript
// Use wrong port or stopped server
const request: FeaJobRequest = { /* ... */ };

try {
  const result = await submitAndWaitForResult('http://localhost:9999', request);
} catch (error) {
  if (error instanceof Error) {
    console.log(error.message); // "Failed to connect to FEA service at ..."
  }
}
```

**Expected Behavior:**

- **Frontend:**
  - Network error caught during `fetch()`
  - UI shows backend error:
    ```
    🌐 Backend Error
    Failed to connect to FEA service at http://localhost:9999/fea/jobs.
    Please ensure the backend service is running and accessible.
    💡 Tip: Ensure Redis, Celery worker, and FastAPI server are running (see server/README.md).
    ```

**Use Cases:**
- Test network failure handling
- Verify clear instructions for troubleshooting
- Test connection error messages

---

### 5. Malformed JSON Response

**Purpose:** Test handling of corrupted or invalid backend responses.

**How to Simulate:**

This requires mocking the fetch response in tests (see unit tests).

**Example (Test):**

```typescript
(global.fetch as any).mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => {
    throw new SyntaxError('Unexpected token < in JSON at position 0');
  },
});

await expect(
  getFeaJobStatus('http://localhost:8050', 'test-job-123')
).rejects.toThrow(SyntaxError);
```

**Expected Behavior:**

- **Frontend:**
  - JSON parsing error thrown
  - Error propagates to caller

**Use Cases:**
- Test robustness against malformed responses
- Verify parsing errors are caught

---

## Error Types Reference

### Custom Error Classes

**File:** [src/services/fea/FeaServiceClient.ts](../../src/services/fea/FeaServiceClient.ts)

#### 1. `FeaPollTimeoutError`

Thrown when polling exceeds the configured timeout.

```typescript
class FeaPollTimeoutError extends Error {
  constructor(
    public readonly jobId: string,
    public readonly timeoutMs: number
  )
}
```

**When Thrown:**
- `pollFeaJobUntilDone()` times out waiting for job completion

**Properties:**
- `jobId` - Job identifier
- `timeoutMs` - Timeout value in milliseconds
- `message` - Human-readable message

---

#### 2. `FeaHttpError`

Thrown when backend returns HTTP error (4xx, 5xx).

```typescript
class FeaHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly jobId: string | null,
    public readonly body: string,
    public readonly url: string
  )
}
```

**When Thrown:**
- `submitFeaJob()` - 4xx/5xx on submit endpoint
- `getFeaJobStatus()` - 4xx/5xx on status endpoint
- `getFeaJobResult()` - 4xx/5xx on result endpoint

**Properties:**
- `statusCode` - HTTP status code (e.g., 404, 500)
- `jobId` - Job ID (null for submit failures)
- `body` - Response body text
- `url` - URL that failed

---

#### 3. `FeaJobError`

Thrown when backend reports job failed (status = "error").

```typescript
class FeaJobError extends Error {
  constructor(
    public readonly jobId: string,
    public readonly errorMessage: string
  )
}
```

**When Thrown:**
- `pollFeaJobUntilDone()` receives `status: "error"` from backend

**Properties:**
- `jobId` - Job identifier
- `errorMessage` - Error message from backend

---

## UI Error States

**File:** [src/ui/components/FeaBackendDemoPanel.tsx](../../src/ui/components/FeaBackendDemoPanel.tsx)

The demo panel displays different error states based on error type:

| Error Type | Icon | Color | Message Prefix | Troubleshooting Tip |
|------------|------|-------|----------------|---------------------|
| `timeout` | ⏱️ | Orange | "Timeout" | "You can increase the timeout in the code or check if the backend is processing normally." |
| `job` | ❌ | Red | "Job Failed" | "Check server logs for detailed error information." |
| `http` | 🌐 | Red | "Backend Error" | "Ensure Redis, Celery worker, and FastAPI server are running (see server/README.md)." |
| `backend` | ⚠️ | Red | "Error" | "Ensure Redis, Celery worker, and FastAPI server are running (see server/README.md)." |

---

## Testing Recipes

### Recipe 1: Test Timeout Handling

**Goal:** Verify UI shows timeout message when job takes too long.

**Steps:**
1. Set `debugSlowSolver: true` in request
2. Set short timeout (e.g., `timeoutMs: 5000`)
3. Submit job
4. Wait for timeout
5. Verify UI shows orange timeout error with tip

**Expected Result:** Clear timeout message with troubleshooting guidance.

---

### Recipe 2: Test Error Handling

**Goal:** Verify UI shows job failure message when solver fails.

**Steps:**
1. Set `debugForceError: true` in request
2. Submit job
3. Wait for result
4. Verify UI shows red error with server log tip

**Expected Result:** Clear job failure message with guidance to check logs.

---

### Recipe 3: Test Backend Down

**Goal:** Verify UI shows backend unavailable message.

**Steps:**
1. Stop FastAPI server (or use invalid URL)
2. Submit job
3. Verify UI shows backend error with setup instructions

**Expected Result:** Clear backend error with link to server/README.md.

---

## Test Coverage

**File:** [src/services/fea/__tests__/FeaServiceClient.test.ts](../../src/services/fea/__tests__/FeaServiceClient.test.ts)

**Test Suites:**
- `Custom Error Types`
  - `FeaPollTimeoutError` - Timeout scenarios
  - `FeaHttpError` - HTTP 404, 500, 400 errors
  - `FeaJobError` - Job failure during execution
  - `Malformed JSON response` - Invalid backend responses

**Run Tests:**

```bash
npm test src/services/fea/__tests__/FeaServiceClient.test.ts
```

**Expected Output:**
- All error type tests pass
- Coverage includes timeout, HTTP errors, job errors, and malformed responses

---

## Production Considerations

### DO NOT Use in Production

The `debugSlowSolver` and `debugForceError` flags are **dev/test-only**. They should:

- **NOT** be exposed in production UI
- **NOT** be set by default
- **NOT** be documented in user-facing docs

### Graceful Degradation

In production:
- Set reasonable timeout values (e.g., 5 minutes for typical jobs)
- Log all errors with full context (job ID, request, error details)
- Show user-friendly error messages with actionable next steps
- Provide a way to retry failed jobs

---

## Troubleshooting

### "Job timed out after Xms"

**Possible Causes:**
- Job genuinely taking longer than timeout
- Backend worker not processing jobs (check Celery worker)
- Redis queue backed up

**Solutions:**
1. Check backend logs for job progress
2. Increase `timeoutMs` if job is expected to be slow
3. Verify Celery worker is running: `celery -A server.app.celery_app worker --loglevel=info`
4. Check Redis queue: `redis-cli LLEN celery`

---

### "Backend error (HTTP 500)"

**Possible Causes:**
- Backend server crashed or encountered unhandled exception
- Redis connection lost
- Celery worker crashed

**Solutions:**
1. Check FastAPI logs: `uvicorn server.app.main:app --reload --log-level debug`
2. Check Celery worker logs
3. Verify Redis is running: `redis-cli ping` (should return `PONG`)
4. Check for Python exceptions in server logs

---

### "Failed to connect to FEA service"

**Possible Causes:**
- Backend server not running
- Wrong port or URL
- CORS issues (if accessing from different origin)

**Solutions:**
1. Verify FastAPI is running: `curl http://localhost:8050/health`
2. Check CORS settings in `server/app/main.py`
3. Verify `VITE_FEA_SERVICE_URL` env var (if set)
4. Use browser dev tools to inspect network requests

---

## References

- **Backend Implementation:** [FEA_BACKEND_MVP.md](./FEA_BACKEND_MVP.md)
- **Hardening Notes:** [FEA_HARDENING_SUMMARY.md](./FEA_HARDENING_SUMMARY.md)
- **Mock Solver:** [server/app/solvers/mock_solver.py](../../server/app/solvers/mock_solver.py)
- **Client Code:** [src/services/fea/FeaServiceClient.ts](../../src/services/fea/FeaServiceClient.ts)
- **Demo UI:** [src/ui/components/FeaBackendDemoPanel.tsx](../../src/ui/components/FeaBackendDemoPanel.tsx)

---

**Next Steps:**
- Test all failure scenarios manually in dev environment
- Add E2E tests for timeout and error handling (future work)
- Document recovery strategies for production incidents
