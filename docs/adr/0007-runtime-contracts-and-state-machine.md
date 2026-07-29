# ADR 0007: Runtime contracts and explicit state machine

## Status

Proposed

## Context

Milestone 3 needs the runtime to be mechanical to implement later. Ad hoc flows and implicit transitions would make future implementation ambiguous.

## Decision

The platform will use explicit runtime contracts for planner, agents, execution queue, event bus, evidence graph, tool registry, provider adapter, reviewer runtime, and run memory. The runtime will also use an explicit state machine with typed transitions.

## Consequences

- Implementation becomes derivable from architecture.
- Errors and retries become consistent across components.
- State transitions are observable and testable.
- The runtime is easier to reason about under failure.