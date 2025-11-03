# Smart Routing - Performance Harness

**Version:** 0.1.0  
**Last Updated:** 2025-11-03  
**Owner:** Agent 10 (QA, Performance, Release)

---

## Purpose

Provide a repeatable methodology for measuring Smart Routing performance across core workflows. The harness defines the metrics, test scenes, and execution scripts used to detect regressions before release.

---

## Key Performance Questions

1. Can pathfinding finish within the required budgets under simple and obstacle-dense scenes?  
   - **Targets:** TC-A1 (<100ms), TC-A2 (<500ms)
2. Does geometry generation maintain interactive frame rates (>=60 FPS) when producing meshes for long routes?  
   - **Target:** TC-PERF1
3. Do validation and persistence flows remain responsive when processing batches of routes?  
   - **Targets:** TC-C*, TC-S1, TC-BOM1

---

## Metrics

| Metric | Description | Tooling | Target |
|--------|-------------|---------|--------|
| `pathfinding.totalTimeMs` | Wall-clock time for Agent 1 to compute a route | `scripts/perf/routing-perf.ts` | <100ms simple, <500ms complex |
| `geometry.buildTimeMs` | Time from route selection to finished meshes | Babylon timing hooks | <250ms per route |
| `validation.batchTimeMs` | Time to validate a route batch of N=10 | Constraint validator instrumentation | <150ms |
| `fps.viewportMin` | Minimum frame rate during geometry generation | Browser Performance API | >=60 FPS |
| `memory.heapUsedMB` | Heap usage delta while generating geometry | Chrome DevTools Protocol | <150MB increase |

**Recording Format:**
```json
{
  "sceneId": "boxes-300",
  "build": "feature/sr/agent-10-qa-perf@abc1234",
  "metrics": {
    "pathfinding.totalTimeMs": 412,
    "geometry.buildTimeMs": 238,
    "fps.viewportMin": 63
  },
  "capturedAt": "2025-11-03T00:00:00Z"
}
```

Store raw metric captures in `reports/perf/<YYYY-MM-DD>/<sceneId>.json`.

---

## Test Scenes

| Scene | File | Purpose |
|-------|------|---------|
| Simple straight-line | `scenes/demo/simple-two-points.json` | Baseline latency checks, regression guardrail |
| Obstacle-dense grid | `scenes/demo/boxes-300.json` | Stress pathfinding heuristics, validate budgets |
| Factory slice | `scenes/demo/factory-slice.json` | End-to-end workflow (route, geometry, persistence) |

---

## Harness Components

1. **Scene Loader** – Reads demo scene JSON and spawns fixtures in Babylon scene graph.  
2. **Execution Driver** – Calls routing APIs in scripted order (create connectors → pathfind → validate → generate geometry).  
3. **Metrics Collector** – Wraps critical calls with timers and aggregates FPS via PerformanceObserver.  
4. **Reporter** – Serializes metric snapshots, outputs markdown summary for TODO_BOARD.md updates.

---

## Script Usage

Once `scripts/perf/routing-perf.ts` is implemented:

```bash
# Run baseline performance sweep across demo scenes and emit stub JSON baselines
npx ts-node --esm scripts/perf/routing-perf.ts --scene all --output reports/perf/$(date +%F)

# Run targeted pathfinding benchmark only (no file output)
npx ts-node --esm scripts/perf/routing-perf.ts --scene boxes-300 --mode pathfinding
```

Each run validates that demo fixtures are loadable and, when `--output` is provided, writes a
`<sceneId>.<mode>.baseline.json` file containing connector counts, obstacle totals, and the execution
mode placeholder for downstream instrumentation. The examples above rely on `ts-node` being available
in the environment (either globally or as a dev dependency).

> ℹ️ Until the harness is fully implemented, the generated metrics still contain TODO placeholders.

---

## Reporting Workflow

1. Execute harness per scenario.  
2. Store raw JSON metrics under `reports/perf/<date>`.  
3. Append summary table to `docs/SMART_ROUTING/ACCEPTANCE_TESTS.md` with latest pass/fail status.  
4. Update `docs/SMART_ROUTING/TODO_BOARD.md` with results and link to raw report.  
5. Notify PM if any metric exceeds thresholds (create `[BLOCKER]`).

---

## Next Steps

- [ ] Implement `scripts/perf/routing-perf.ts` with CLI arguments (`--scene`, `--mode`, `--output`).  
- [ ] Integrate harness with CI nightly job.  
- [ ] Capture baseline metrics for `feature/smart-routing-system` branch.  
- [ ] Document mitigation playbook for regressions (owner, response time, rollback steps).

