# ADR 0004: Evidence graph as canonical runtime state

## Status

Proposed

## Context

The system needs a way to explain why it believes something, not just what it believes. Raw agent outputs alone are not sufficient for auditability or planner reasoning.

## Decision

The evidence graph will be the canonical runtime state for facts, provenance, confidence, relationships, and derivation history. Planner, agents, reviewer, and UI will all read from and write to this graph through typed interfaces.

## Consequences

- The system becomes explainable and auditable by construction.
- The planner can reason over normalized evidence instead of ad hoc text.
- The reviewer can validate contradictions against a shared state model.
- The implementation needs strong schema discipline and graph update rules.