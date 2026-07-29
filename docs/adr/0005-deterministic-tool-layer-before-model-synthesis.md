# ADR 0005: Deterministic tool layer before model synthesis

## Status

Proposed

## Context

Production AI systems should not ask the model to infer facts that a deterministic tool can produce locally with higher fidelity and lower risk.

## Decision

Agents will use a tool registry for deterministic pre-LLM work such as metadata parsing, dependency analysis, policy checks, and local validation. Model calls are reserved for synthesis, ranking, explanation, and gap filling.

## Consequences

- Evidence quality improves because tools can produce structured facts.
- Model usage is reduced and better constrained.
- Each agent becomes more testable because tool outputs can be verified independently.
- The platform can add new tools without changing agent contracts.