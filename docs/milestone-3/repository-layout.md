# Production Repository Layout

## Proposed Folder Structure

```text
docs/
  architecture/
  adr/
  milestone-3/
src/
  runtime/
    contracts.ts
    events.ts
    evidence-graph.ts
    planner-runtime.ts
    agent-runtime.ts
    reviewer-runtime.ts
    execution-queue.ts
    tool-registry.ts
    provider-adapter.ts
    run-memory.ts
  agents/
  tools/
  providers/
  state/
  shared/
  types/
  utils/
```

## Why Each Folder Exists

- `docs/` holds architecture, ADRs, and milestone specifications.
- `docs/architecture/` holds the system-level design approved before implementation.
- `docs/adr/` records architectural decisions and rationale.
- `docs/milestone-3/` isolates the runtime contract package for this milestone.
- `src/runtime/` will eventually hold the orchestration kernel and type-only contracts.
- `src/agents/` will later hold agent implementations, but not in this milestone.
- `src/tools/` will later hold deterministic tool implementations.
- `src/providers/` will later hold provider adapters.
- `src/state/` will later hold runtime state and persistence boundaries.
- `src/shared/` will later hold cross-runtime utilities and value objects.
- `src/types/` will later hold shared TypeScript types and schemas.
- `src/utils/` will later hold pure helper functions with no domain ownership.

## Layout Rules

- Keep runtime contracts separate from execution logic.
- Keep tool interfaces separate from concrete tool implementations.
- Keep provider adapters separate from provider-specific clients.
- Keep decisioning logic separate from transport and presentation logic.