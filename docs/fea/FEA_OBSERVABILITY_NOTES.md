# FEA Backend Observability Guide

**Status:** Active
**Last Updated:** 2025-11-19
**Author:** Agent 2 (Observability Engineer)

## Overview

This guide explains the observability infrastructure for the FEA backend, including:
- **Structured logging** with correlation IDs across the E2E flow
- **Lightweight metrics** for debugging and E2E testing
- **How to trace a job** from submission to completion/failure

This is a **development/debugging** setup. For production monitoring, use Prometheus/Grafana or similar.

---

## Architecture

### Components

1. **FastAPI (main.py)** - Handles HTTP requests, logs job submissions
2. **Celery Worker (worker.py)** - Processes jobs asynchronously, logs execution
3. **Mock Solver (mock_solver.py)** - Simulates FEA computation, logs results
4. **Metrics Store (metrics.py)** - Thread-safe in-memory counters

### Correlation ID

Every job has a unique `job_id` (UUID) that flows through all layers:
- Generated in `POST /fea/jobs`
- Passed to Celery worker as `task_id`
- Forwarded to solver in request metadata
- **Appears in every log line** for that job

This allows you to grep logs by `job_id=<uuid>` to see the complete lifecycle.

---

## Structured Logging

### Log Format

All logs use a consistent key=value format:

```
<timestamp> <level> <module>: <message> job_id=<uuid> [key1=val1 key2=val2 ...]
```

Example:
```
2025-11-19 14:32:01,234 INFO app.main: Job submission: job_id=a1b2c3d4-... model_type=beam-demo name=Test Beam
```

### Log Lifecycle for One Job

Here's what you'll see in logs for a successful job:

#### 1. **Job Submission (FastAPI)**

```
INFO app.main: Job submission: job_id=a1b2c3d4-1234-5678-90ab-cdef01234567 model_type=beam-demo name=Test Beam Analysis
INFO app.main: Job queued: job_id=a1b2c3d4-1234-5678-90ab-cdef01234567 task_id=a1b2c3d4-1234-5678-90ab-cdef01234567
```

**What happened:**
- User submitted job via `POST /fea/jobs`
- Job ID generated and logged
- Task queued to Celery

#### 2. **Worker Start (Celery)**

```
INFO app.worker: Worker task start: job_id=a1b2c3d4-1234-5678-90ab-cdef01234567 model_type=beam-demo task_id=a1b2c3d4-1234-5678-90ab-cdef01234567
INFO app.worker: Worker routing solver: job_id=a1b2c3d4-1234-5678-90ab-cdef01234567 solver=mock model_type=beam-demo
```

**What happened:**
- Celery worker picked up the task
- Validated the request
- Routing to appropriate solver (currently always mock)

#### 3. **Solver Execution (Mock Solver)**

```
INFO app.solvers.mock_solver: Mock solver started for job a1b2c3d4-1234-5678-90ab-cdef01234567 (model_type=beam-demo, slow=False, force_error=False)
INFO app.solvers.mock_solver: Mock solver completed for job a1b2c3d4-1234-5678-90ab-cdef01234567: max_disp=0.15mm, max_stress=30.0MPa, FoS=8.33
```

**What happened:**
- Solver started computation (2s simulated delay)
- Solver completed and calculated results
- Key metrics logged: displacement, stress, factor of safety

#### 4. **Worker Completion**

```
INFO app.worker: Worker task complete: job_id=a1b2c3d4-1234-5678-90ab-cdef01234567 max_disp=0.000150m max_stress=30.00MPa solve_time=2.00s
```

**What happened:**
- Worker received solver results
- Logged final metrics
- Incremented `completed` counter

---

### Log Lifecycle for a Failed Job

#### Validation Error (Worker Level)

```
ERROR app.worker: Worker validation failed: job_id=bad-job-id error=Invalid FEA job request: ...
```

#### Solver Error

```
ERROR app.solvers.mock_solver: Job a1b2c3d4-...: Forced error via debugForceError flag
ERROR app.worker: Worker solver error: job_id=a1b2c3d4-... error=Solver failed: Forced error for testing (debugForceError=true)
ERROR app.worker: Worker task failed: job_id=a1b2c3d4-... error=Solver failed: ...
```

#### Model Type Error

```
ERROR app.worker: Worker model_type error: job_id=a1b2c3d4-... error=Unsupported model type: invalid-type
```

**In all cases:**
- Error logged with `job_id`
- `failed` metric incremented
- Celery marks task as `FAILURE`

---

## Metrics System

### Endpoint: `GET /fea/metrics`

Returns in-memory job counters:

```json
{
  "submitted": 42,
  "completed": 38,
  "failed": 4
}
```

### Metrics Semantics

| Metric | When Incremented | Notes |
|--------|------------------|-------|
| `submitted` | Job accepted by `POST /fea/jobs` | Excludes validation errors (422) |
| `completed` | Worker task finishes successfully | Result available via `/result` |
| `failed` | Worker task throws exception | Check logs for error details |

### Important Notes

- **Not persistent**: Metrics reset when server restarts
- **Not production-grade**: No Prometheus/StatsD integration
- **Thread-safe**: Uses locks for concurrent increments
- **For debugging only**: Not suitable for alerting/dashboards

---

## How to Debug E2E Issues

### Problem: "Job Stuck in Queued State"

**Step 1:** Check if job was submitted
```bash
grep "Job submission: job_id=<your-job-id>" server.log
```

**Step 2:** Check if worker picked it up
```bash
grep "Worker task start: job_id=<your-job-id>" server.log
```

If worker log is **missing**:
- Celery worker not running
- Redis connection issue
- Job ID mismatch

### Problem: "Job Failed but No Error in UI"

**Step 1:** Get job status
```bash
curl http://localhost:8050/fea/jobs/<job-id>
```

**Step 2:** Find error in logs
```bash
grep "Worker task failed: job_id=<your-job-id>" server.log
```

**Step 3:** Check metrics
```bash
curl http://localhost:8050/fea/metrics
```

If `failed` counter increased, error occurred in worker/solver.

### Problem: "Metrics Don't Match Reality"

**Possible causes:**
- Server restarted (metrics reset)
- Race condition (unlikely, but check logs)
- Validation error at API level (doesn't increment metrics)

**Debug:**
```bash
# Count actual job submissions in logs
grep "Job submission:" server.log | wc -l

# Count completions
grep "Worker task complete:" server.log | wc -l

# Count failures
grep "Worker task failed:" server.log | wc -l
```

---

## Example: Tracing One Job E2E

Let's trace job `abc123...` from submission to completion:

```bash
# Step 1: Extract all logs for this job
grep "job_id=abc123" server.log > job_abc123.log

# Step 2: View timeline
cat job_abc123.log
```

**Expected output:**
```
2025-11-19 14:32:01,234 INFO app.main: Job submission: job_id=abc123 model_type=beam-demo name=My Beam
2025-11-19 14:32:01,240 INFO app.main: Job queued: job_id=abc123 task_id=abc123
2025-11-19 14:32:01,250 INFO app.worker: Worker task start: job_id=abc123 model_type=beam-demo task_id=abc123
2025-11-19 14:32:01,255 INFO app.worker: Worker routing solver: job_id=abc123 solver=mock model_type=beam-demo
2025-11-19 14:32:01,260 INFO app.solvers.mock_solver: Mock solver started for job abc123 (model_type=beam-demo)
2025-11-19 14:32:03,265 INFO app.solvers.mock_solver: Mock solver completed for job abc123: max_disp=0.15mm, max_stress=30.0MPa, FoS=8.33
2025-11-19 14:32:03,270 INFO app.worker: Worker task complete: job_id=abc123 max_disp=0.000150m max_stress=30.00MPa solve_time=2.00s
```

**Timeline analysis:**
- **T+0ms**: Job submitted to API
- **T+6ms**: Task queued to Celery
- **T+16ms**: Worker started processing
- **T+21ms**: Solver started (mock delay begins)
- **T+2010ms**: Solver finished
- **T+2015ms**: Worker completed and logged results

**Total latency**: ~2.0 seconds (dominated by mock solver delay)

---

## Metrics Testing

### Test Suite: `test_fea_metrics_and_logs.py`

Located in `server/tests/test_fea_metrics_and_logs.py`

**Coverage:**
- Metrics endpoint returns correct format
- Successful jobs increment `submitted` and `completed`
- Failed jobs increment `submitted` and `failed`
- Validation errors don't increment any metrics
- Multiple jobs accumulate correctly

**Run tests:**
```bash
cd server
python -m pytest tests/test_fea_metrics_and_logs.py -v
```

**Example output:**
```
test_metrics_endpoint_exists PASSED
test_metrics_track_successful_job PASSED
test_metrics_track_failed_job PASSED
test_full_observability_cycle PASSED
```

---

## Future Enhancements

### Short Term (Agent 2 Scope)
- ✅ Structured logging with correlation IDs
- ✅ In-memory metrics store
- ✅ E2E observability tests
- ✅ Documentation

### Medium Term (Future Work)
- [ ] Prometheus metrics export (`/metrics` endpoint)
- [ ] OpenTelemetry spans for distributed tracing
- [ ] ELK/Loki integration for log aggregation
- [ ] Grafana dashboards for visualization

### Production Considerations
- Use structured JSON logging (not key=value)
- Add request IDs to API layer
- Track job duration histograms
- Add resource usage metrics (CPU, memory)
- Set up alerts for failure rate thresholds

---

## Related Documentation

- **FEA Backend MVP:** [FEA_BACKEND_MVP.md](./FEA_BACKEND_MVP.md)
- **FEA Hardening:** [FEA_HARDENING_SUMMARY.md](./FEA_HARDENING_SUMMARY.md)
- **Testing Guide:** `server/tests/test_fea_metrics_and_logs.py`

---

## Questions?

For issues or improvements:
1. Check logs using examples above
2. Run observability tests: `pytest tests/test_fea_metrics_and_logs.py`
3. Inspect metrics: `curl http://localhost:8050/fea/metrics`
4. File issue in GitHub with job ID and log snippet
