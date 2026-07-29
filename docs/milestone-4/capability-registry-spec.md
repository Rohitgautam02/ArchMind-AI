# Capability Registry Specification

## Purpose

The planner must request capabilities, not concrete implementations. The capability registry resolves those requests into versioned, prioritized, and fallback-aware implementations.

## Requirements

- support semantic versioning
- support capability priorities
- support fallback chains
- support compatibility constraints
- support selection by policy

## Failure Cases

- no matching capability
- incompatible version
- fallback cycle
- ambiguous selection

## Retry Strategy

- re-run resolution when dependencies change
- switch to fallback implementation when primary selection fails