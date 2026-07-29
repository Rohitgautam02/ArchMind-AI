# Proposed Architecture

## System shape

ArchMind AI should be an event-driven analysis platform with a strict privacy boundary.

```mermaid
flowchart TD
  A[Local metadata intake] --> B[Privacy engine]
  B --> C[Evidence graph]
  C --> D[Planner]
  D --> E[Tool registry]
  E --> F[Execution queue]
  F --> G1[Architecture agent]
  F --> G2[Security agent]
  F --> G3[Dependency agent]
  F --> G4[DevOps agent]
  F --> G5[Documentation agent]
  G1 --> H[Reviewer]
  G2 --> H
  G3 --> H
  G4 --> H
  G5 --> H
  H -->|approve or reject| I[Diagram generator]
  H -->|approve or reject| J[Report generator]
  I --> K[Streaming UI]
  J --> K
  C --> K
  D --> K
  E --> K
  F --> K
  H --> K
  H --> L[Decision log]
  L --> M[Run memory]
  M --> K
```

## Core layers

### 1. Privacy and ingestion layer

This layer collects metadata only. It should normalize repositories into a local, sanitized graph of facts such as packages, dependencies, files, symbols, interfaces, build scripts, and inferred architecture signals. Raw source code must not be transmitted to external providers.

The evidence graph is the canonical internal representation of the repository. It stores facts, provenance, confidence, relationships, and derivation history so every downstream decision can be traced back to evidence.

### 2. Orchestration layer

The planner does not just route work. It reasons over the evidence graph, forms hypotheses, determines what evidence is missing, decides which deterministic tools or agents are needed, and chooses whether to stop, continue, or re-run analysis.

The execution queue expands planner decisions into sequential or parallel work units. The planner can request another pass when confidence is low or contradictions remain unresolved.

```mermaid
sequenceDiagram
  participant P as Planner
  participant E as Evidence Graph
  participant T as Tool Registry
  participant Q as Execution Queue
  participant A as Agent
  participant R as Reviewer

  P->>E: inspect facts and provenance
  P->>P: form hypothesis
  P->>T: select deterministic tools
  P->>Q: enqueue work plan
  Q->>A: run agent with schema-bound inputs
  A->>T: invoke tools before LLM if needed
  A->>E: add evidence and confidence
  A->>R: submit structured result
  R->>P: approve, reject, or request more evidence
```

### 3. Agent layer

Each agent has a narrow responsibility and must emit structured output only. The output schema should include role, goal, input schema, output schema, confidence score, evidence, reasoning, and validation fields.

Agents should prefer deterministic tools first and use the LLM for synthesis, classification, and explanation. That keeps the system auditable and reduces unnecessary model reliance.

### 4. Review and synthesis layer

The reviewer validates contradictions, confidence, evidence quality, completeness, and whether the hypotheses actually follow from the evidence graph. It can reject results and request another analysis pass. Only reviewer-approved work should flow into diagrams and reports.

Every analysis run should produce a decision log containing planner decisions, tool invocations, agent outputs, reviewer outcomes, and rerun triggers. That log feeds run memory, which preserves summaries, deltas, and trend signals for future comparison.

### 5. Presentation layer

The UI should render the live orchestration state as the primary experience. The orchestration graph is the interface. Reports are the end of the flow, not the center of it.

The UI should expose live confidence, evidence provenance, and rerun decisions so the user can watch the system think.

## Architectural constraints

- Metadata-only analysis is a non-negotiable privacy boundary.
- Model providers must be abstracted behind a runtime adapter.
- Every agent contract must be schema-validated before and after model execution.
- Analysis should be event-sourced so the UI and audit trail can replay the same run.
- The system should support local-first operation with optional remote inference providers.
- Deterministic tools should run before LLM calls whenever they can produce stronger evidence.
- The evidence graph and decision log are first-class runtime assets, not incidental implementation details.
- Run memory should preserve prior analysis summaries, deltas, and trend signals for comparison across sessions.

## Extensibility points

- New agents can be added by registering a schema and planner capability rule.
- New providers can be added without changing orchestration logic.
- New report formats can consume the same reviewed graph of facts.
- New UI surfaces can subscribe to the same event stream.
- New tools can be added to the tool registry without changing agent implementations.