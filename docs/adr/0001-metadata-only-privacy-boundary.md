# ADR 0001: Metadata-only privacy boundary

## Status

Proposed

## Context

The product promise is that source code must never leave the user's machine. The system must still support useful analysis, provider flexibility, and explainable output.

## Decision

The analysis pipeline will consume metadata only. Source code will remain local and outside the model invocation boundary. Any external LLM call receives sanitized, derived facts rather than raw code.

## Consequences

- The system preserves the privacy contract by construction.
- Analysis quality depends on high-quality metadata extraction and normalization.
- Some deep semantic questions will require local inference or explicit user opt-in.
- The architecture becomes easier to audit and reason about.