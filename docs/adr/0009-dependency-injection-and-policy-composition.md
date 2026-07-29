# ADR 0009: Dependency injection and policy composition

## Status

Proposed

## Context

The kernel must avoid service locators and global state so execution stays predictable and portable.

## Decision

Runtime components will receive dependencies through explicit typed injection. Policies will be composable, versioned, and injected rather than fetched from global registries.

## Consequences

- dependencies remain visible at construction boundaries
- testability improves significantly
- runtime boot failures surface early
- accidental coupling is reduced