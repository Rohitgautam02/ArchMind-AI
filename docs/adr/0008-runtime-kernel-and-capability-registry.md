# ADR 0008: Runtime kernel and capability registry

## Status

Proposed

## Context

The runtime needs to behave like an operating system. The planner should reason in terms of capabilities rather than hard-coded concrete implementations.

## Decision

The platform will introduce a RuntimeKernel, RunManager, RuntimeContext, Component Registry, Capability Registry, and injectable policy framework. Component selection will happen by capability and version, not by direct class reference.

## Consequences

- runtime behavior becomes plugin-oriented
- implementations can evolve independently of contracts
- planner logic stays abstract and architecture-driven
- boot and recovery become explicit and testable