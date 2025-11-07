# Smart Routing Roadmap (Current → Production)

Owner: PM (this file is the authoritative plan)

Timebox: 6 weeks (3 bi‑weekly sprints) — adjust as we learn

Scope: Pipes, Electrical, Cable Trays, Conduit — A* pathfinding, constraint validation, geometry generation, UI workflow, persistence, BOM exports, docs/tests.

## Milestones

- M0 (Today): Pipes generate reliably via panel and viewport flow; stable connector placement; scene tree not clipping; pro layout loads. Baseline E2E test passes. (Done when ACCEPTANCE_TESTS.md:TC‑P1–P3 pass)
- M1 (End of Week 2): All four route types generate 3D geometry with constraint validation and visual warnings; “Create Route” and “Generate All Geometry” flows; basic BOM CSV export. (TC‑G1–G6)
- M2 (End of Week 4): Advanced fittings (elbow/tee/reducer), support placement, presets, Auto‑Route All, route editing (move points, regenerate), saved projects round‑trip. (TC‑E1–E7)
- M3 (End of Week 6): Performance hardening (100+ routes), QA pass, docs (user + API), demo content, marketing materials, CI smoke tests. (TC‑Q1–Q6)

## Epics

1) E‑A*: Pathfinding & Constraints
2) E‑GEO: Geometry generation (pipes/cables/trays/conduits + fittings/supports)
3) E‑UI: Workflow & UX (placing, selecting, creating, editing routes)
4) E‑PERSIST: Save/load, import/export, BOM
5) E‑PERF: Performance & stability
6) E‑QA: Tests, docs, and release readiness

## High‑level Timeline

- Sprint 1 (Weeks 1–2): M0→M1
  - Fix known blockers (placing mode, creation without leaving mode, create button, geometry attach, tree width in Pro)
  - Pipe geometry: pull diameter from spec table; show route details in panel; generate reliably
  - Add “Create Route” (2‑select) and “Generate Geometry” bulk action
  - Cable/conduit/tray parity with simplified geometry

- Sprint 2 (Weeks 3–4): M1→M2
  - Advanced fittings, support placement, regenerate on edit, presets
  - Auto‑Route All; warnings panel with counts
  - Save/load round‑trip; BOM CSV (lengths, fittings, supports, material)

- Sprint 3 (Weeks 5–6): M2→M3
  - Perf (graph density tuning, culling, throttles)
  - QA suite (acceptance + manual scripts); docs; demo worlds
  - Marketing deliverables (screenshots + videos); release notes

## Risk & Mitigation

- Graph explosions in dense scenes → limit nodes, hierarchical graph, caching
- Geometry accuracy → table‑driven sizes; unit tests around PIPE_SIZES
- User confusion → clear buttons, hints, and explicit “Finish Placing” / “Create Route”

## Status Tracking

- Use TODO_BOARD.md daily; PM updates milestone burndown and checks test IDs (ACCEPTANCE_TESTS.md)

