# ADR 0003: Event-driven orchestration and reviewer gate

## Status

Proposed

## Context

The platform needs to feel alive while also remaining auditable and deterministic enough for engineering review.

## Decision

The runtime will be event-driven. The planner emits decisions, the scheduler fans out work, agents publish structured updates, and the reviewer acts as a gate before diagrams and reports are materialized.

## Consequences

- The UI can visualize live orchestration state.
- Review can reject incomplete or contradictory analysis.
- Runs can be replayed from the event log.
- The system gains better debuggability and observability.