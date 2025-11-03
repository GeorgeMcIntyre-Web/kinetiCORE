# Smart Routing Program — Start Here

This folder contains the plan, roadmap, and working docs to take the Smart Routing System from current state to full‑featured production. It is structured so 10 agents can work in parallel with clear ownership, dependencies, and shared checklists.

Key docs:

- ROADMAP.md — Phases, milestones, outcomes, dates
- AGENT_EXECUTION_PLAN.md — Agent 1–10 assignments, deliverables, checklists
- COLLABORATION.md — Branching, PR rules, commit style, daily cadence, handoffs
- TODO_BOARD.md — Live task board (single source of truth) using Markdown checkboxes
- ACCEPTANCE_TESTS.md — End‑to‑end test scripts the PM uses to accept work
- TECH_SPEC.md — Current architecture, module map, data contracts, integration points

Workflow summary:

1) Each agent works only in their assigned areas and updates TODO_BOARD.md after each meaningful step (check items and add notes/links to PRs).
2) Agents create feature branches per COLLABORATION.md, open small PRs with passing acceptance checks from ACCEPTANCE_TESTS.md.
3) PM (you) merges green PRs, updates ROADMAP.md progress, and unblocks dependencies.

Use the AGENT_EXECUTION_PLAN.md as the operational document for daily work.

