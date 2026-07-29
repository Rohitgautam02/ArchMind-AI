# Milestone Plan

## Milestone 1: Project foundation

Goal: establish repo structure, local-only defaults, shared types, and build tooling.

Exit criteria: documented architecture boundaries, base app shell, and CI-ready project layout.

## Milestone 2: Privacy engine

Goal: create metadata extraction, sanitization, and local-only policy enforcement.

Exit criteria: no raw source code leaves the machine and all outbound model payloads are sanitized.

## Milestone 3: Evidence graph and agent runtime

Goal: implement the evidence graph, provider abstraction, schema validation, event bus, and agent execution lifecycle.

Exit criteria: structured agent calls are observable and replayable.

## Milestone 4: Runtime kernel

Goal: design the runtime kernel, component registry, dependency injection model, capability registry, policy framework, and lifecycle.

Exit criteria: runtime execution can be derived mechanically from the kernel contracts.

## Milestone 5: Runtime foundation implementation

Goal: implement the runtime kernel, event bus, evidence graph, component registry, capability registry, and run manager.

Exit criteria: the runtime foundation can boot, execute, replay, and recover from tests.

## Milestone 6: Architecture agent

Goal: infer system structure, boundaries, module relationships, and architecture risks from metadata.

Exit criteria: outputs are schema-validated and reviewer-ready.

## Milestone 7: Security agent

Goal: identify exposure, dependency risk, policy issues, and architecture-level security concerns.

Exit criteria: findings include evidence and confidence, not just labels.

## Milestone 8: Reviewer and re-analysis loop

Goal: validate contradictions, completeness, confidence, and evidence quality, then approve or reject analysis.

Exit criteria: reviewer can request another pass and block downstream artifacts.

## Milestone 9: Streaming UI

Goal: render the orchestration flow as a live AI operating system experience.

Exit criteria: planner wake-up, agent activation, reviewer gating, and report materialization are visibly animated.

## Milestone 10: Reports, run memory, and polish

Goal: generate diagrams, reports, historical run comparisons, and final product polish from reviewed structured data.

Exit criteria: report content is traceable to evidence and review outcomes, and the product feels premium, cohesive, and production-ready.

## Delivery rule

After each milestone, review the code, refactor if needed, remove duplication, and only then continue.