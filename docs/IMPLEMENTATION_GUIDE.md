# Implementation Guide

This guide freezes the approved architecture and defines the execution order for the first implementation slice.

## Rules Of Engagement

- Do not add new architecture documents unless implementation exposes a real defect.
- Do not redesign approved contracts during implementation.
- Build the runtime foundation first.
- Add tests before advancing to the next component.
- Keep the first vertical slice small and observable.

## Implementation Order

### 0. Project Skeleton

Purpose: create the runtime folder structure before code lands.

Dependencies: none.

Required output:

- `src/runtime/kernel/`
- `src/runtime/events/`
- `src/runtime/graph/`
- `src/runtime/registry/`
- `src/runtime/lifecycle/`
- `src/runtime/run-manager/`
- `src/shared/`
- `src/tests/`

Definition of done:

- folders exist and are ready for implementation
- no business logic is introduced

### 1. RuntimeKernel

Purpose: own boot, initialize, lifecycle, orchestration, shutdown, and restart control.

Dependencies: RuntimeContext, ComponentRegistry, CapabilityRegistry, EventBus, RunManager.

Mocks first: EventBus, EvidenceGraph, ProviderRegistry, ToolRegistry, RunMemory.

Required tests:

- boots with a valid context
- rejects invalid bootstrap state
- transitions through lifecycle states in order
- shuts down cleanly

Definition of done:

- kernel control flow exists and is testable
- lifecycle transitions are explicit
- no business logic leaks into the kernel

### 2. EventBus

Purpose: publish, subscribe, and replay typed runtime events.

Dependencies: RuntimeMetadata, RuntimeEvent, runtime event payloads.

Mocks first: none beyond in-memory event handlers.

Required tests:

- publishes typed events
- dispatches subscribed handlers
- preserves event order
- replays a run stream

Definition of done:

- event lifecycle is observable end to end
- replay is supported for runtime debugging

### 3. EvidenceGraph

Purpose: store canonical facts, provenance, confidence, conflicts, and hypotheses.

Dependencies: Confidence, Provenance, GraphUpdate, GraphSnapshot.

Mocks first: EventBus.

Required tests:

- applies graph updates
- merges snapshots deterministically
- preserves provenance
- records conflicts explicitly

Definition of done:

- graph state is canonical and replayable
- conflicts are not overwritten silently

### 4. ComponentRegistry

Purpose: register and resolve agents, providers, tools, policies, reviewers, and planners.

Dependencies: RuntimeContext, component descriptors.

Mocks first: CapabilityRegistry.

Required tests:

- registers components
- discovers by capability
- resolves by version and priority
- returns fallback candidates when primary resolution fails

Definition of done:

- runtime components are addressable by capability instead of concrete class

### 5. CapabilityRegistry

Purpose: resolve requested capabilities to implementation candidates.

Dependencies: ComponentRegistry, policy bundle.

Mocks first: ComponentRegistry.

Required tests:

- resolves by capability
- honors version constraints
- respects priority ordering
- falls back when allowed

Definition of done:

- planner can request capabilities without naming implementations

### 6. RunManager

Purpose: create, resume, cancel, and replay runs.

Dependencies: RuntimeKernel, EventBus, RunMemory, EvidenceGraph.

Mocks first: RunMemory, EventBus.

Required tests:

- creates a new run
- resumes an existing run
- cancels an active run
- replays a completed run

Definition of done:

- run lifecycle is recoverable and replayable

## First Vertical Slice

The first working slice should be:

Metadata -> EvidenceGraph -> Planner -> one fake agent -> Reviewer -> Report

Only after that slice works should additional agents, tools, and provider integrations be introduced.

## What To Mock First

- provider calls
- deterministic tools
- run persistence
- report generation
- agent implementations beyond the single fake agent

## Milestone Exit Criteria

### Milestone 5: Runtime Foundation Implementation

- RuntimeKernel boots and stops cleanly
- EventBus publishes and replays typed events
- EvidenceGraph stores and merges canonical facts
- ComponentRegistry and CapabilityRegistry resolve by capability
- RunManager can create, resume, cancel, and replay runs
- The first vertical slice is executable in tests

### Subsequent Milestones

- add Planner after the kernel foundation is stable
- add a single fake agent before real agents
- add Reviewer before providers and tool expansion
- add reports only after the vertical slice is stable
