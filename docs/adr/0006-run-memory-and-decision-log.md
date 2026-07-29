# ADR 0006: Run memory and decision log

## Status

Proposed

## Context

The product should support repeated analyses, comparisons across runs, and clear explanations of why decisions changed over time.

## Decision

A local run memory will store prior analysis summaries, deltas, and trend signals. Each run will also emit a decision log capturing planner decisions, evidence additions, tool invocations, reviewer outcomes, and re-analysis triggers.

## Consequences

- Users can ask what changed since the last run.
- The platform can surface trends rather than one-off reports.
- Decision history improves trust and debugging.
- The runtime must isolate local memory from any provider-facing payloads.