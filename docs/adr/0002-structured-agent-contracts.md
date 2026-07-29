# ADR 0002: Structured agent contracts

## Status

Proposed

## Context

The platform needs multiple specialized agents that can be validated, compared, and orchestrated reliably.

## Decision

All agents will return structured outputs only. Each contract must include role, goal, input schema, output schema, confidence score, evidence, reasoning, and validation.

## Consequences

- Agent results become testable and composable.
- The reviewer can validate outputs consistently.
- Free-form natural language is reduced, so prompting must be more disciplined.
- UI components can render trustworthy state instead of unbounded text.