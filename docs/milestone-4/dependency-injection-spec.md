# Dependency Injection Specification

## Design Rules

- components receive dependencies through constructors or explicit factory inputs
- avoid service locator patterns
- avoid global state
- avoid hidden singleton access

## Injection Boundaries

- RuntimeKernel receives the root context
- RunManager receives runtime dependencies through explicit arguments
- Planner, reviewer, and agent runtimes receive typed interfaces only

## Failure Cases

- missing dependency
- circular dependency
- partially initialized dependency graph

## Recovery Strategy

- fail fast during boot
- rebuild the dependency graph on restart
- never silently create ad hoc globals