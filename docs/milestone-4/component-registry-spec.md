# Component Registry Specification

## Responsibilities

- register runtime components
- discover by capability
- support versioning
- resolve fallback implementations
- expose priorities for selection

## Registered Component Types

- agents
- providers
- tools
- policies
- reviewers
- planners

## Discovery Model

- discovery is capability-first, not class-name-first
- registry lookups must be deterministic
- multiple implementations may satisfy a capability
- fallback resolution is based on priority and compatibility

## Failure Cases

- duplicate registration conflict
- version mismatch
- capability missing
- fallback unavailable

## Retry Strategy

- retry registration only for transient bootstrap failures
- re-resolve selection after policy or provider changes