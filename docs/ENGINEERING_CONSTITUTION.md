# ArchMind AI — Engineering Constitution & Implementation Guide

## 1. Project Vision

ArchMind AI is not an AI chatbot.

It is not a repository summarizer.

It is not a wrapper around OpenAI or Claude.

ArchMind AI is a production-grade AI Operating System for software architecture analysis.

The platform analyzes an entire software repository while respecting a strict privacy boundary. Instead of sending source code to an LLM, it extracts deterministic metadata, builds a canonical Evidence Graph, reasons over that graph, orchestrates specialised AI agents, validates every result through a reviewer, and finally produces diagrams, reports, and architectural insights.

The project is designed as if it were a commercial product that enterprises could use to understand large software systems.

## 2. Core Product Goal

Given any software repository, ArchMind AI should be able to:

- analyse repository structure
- infer architecture
- understand module relationships
- detect architectural risks
- analyse dependencies
- inspect DevOps configuration
- identify security concerns
- generate software diagrams
- produce architecture documentation
- compare analyses across runs
- explain every conclusion with evidence

Every conclusion must be explainable.
Every decision must be reproducible.
Every output must be traceable back to evidence.

## 3. Product Principles

The following principles are non-negotiable.

### Privacy First
Source code never leaves the user's machine.
Only derived metadata may be sent to external providers.

### Deterministic Before AI
If deterministic tooling can answer a question:
DO NOT call an LLM.

LLMs are used only for:
- reasoning
- synthesis
- explanation
- ranking
- filling knowledge gaps

Never use an LLM to infer facts that deterministic tooling already knows.

### Event Driven Runtime
Everything inside the runtime communicates through events.
Nothing should call downstream systems directly when an event-driven workflow is appropriate.

### Evidence Driven Reasoning
Every runtime component reads and writes to the Evidence Graph.
The Evidence Graph is the canonical runtime state.

### Explainability
Every architectural conclusion must answer:
Why?
Where did this come from?
What evidence supports it?

### Runtime Instead of Scripts
This project is an AI runtime.
Not a collection of utilities.
Everything must execute through the runtime pipeline.

## 4. High-Level Runtime Workflow

The complete execution flow is:

```text
Repository
        │
        ▼
Metadata Extraction
        │
        ▼
Deterministic Tool Registry
        │
        ▼
Evidence Graph
        │
        ▼
Planner Runtime
        │
        ▼
Execution Queue
        │
        ▼
Agent Runtime
        │
        ▼
Provider Adapter (only when necessary)
        │
        ▼
Reviewer Runtime
        │
        ▼
Decision Log
        │
        ▼
Run Memory
        │
        ▼
Diagram Generator
        │
        ▼
Report Generator
        │
        ▼
Streaming UI
```

## 5. Runtime Responsibilities

### Runtime Kernel
Owns bootstrapping, lifecycle, dependency injection, shutdown, restart, and runtime composition.
Never contains business logic.

### Event Bus
Publishes typed runtime events.
Supports replay.
Provides observability.

### Evidence Graph
Stores:
- facts
- provenance
- confidence
- hypotheses
- conflicts
- relationships

It is the single source of truth.

### Planner Runtime
Reads the Evidence Graph.
Forms hypotheses.
Determines missing evidence.
Chooses deterministic tools.
Chooses AI agents.
Creates execution plans.
Can re-plan after reviewer feedback.

### Execution Queue
Schedules work.
Supports dependencies.
Supports sequential and parallel execution.
Tracks job state.

### Agent Runtime
Executes one specialised AI agent.
Validates schemas.
Invokes deterministic tools.
Uses Provider Adapter only when deterministic evidence is insufficient.
Writes evidence back into the graph.

### Provider Adapter
Abstracts Groq, Ollama, OpenAI, Claude, and future providers.
Must never leak provider-specific APIs into runtime components.

### Reviewer Runtime
Validates:
- completeness
- confidence
- contradictions
- evidence quality

Approves or rejects results.
May request re-analysis.

### Decision Log
Stores every decision made during a run.

### Run Memory
Stores previous analyses.
Supports comparisons.
Tracks trends.

## 6. AI Agents

The platform will include specialised agents.

Examples:
- Architecture Agent
- Security Agent
- Dependency Agent
- DevOps Agent
- Documentation Agent

Every agent:
- has one responsibility
- consumes structured input
- emits structured output
- declares required evidence
- declares produced evidence
- prefers deterministic tools first

## 7. Deterministic Tools

Examples:
- Metadata Parser
- Dependency Scanner
- Docker Inspector
- Policy Checker
- README Analyzer

Future MCP-compatible tools must integrate through the same registry.

## 8. Repository Structure

The repository is organised into clear responsibilities:

- `docs/` – architecture, ADRs, milestone plans, implementation guides
- `src/runtime/` – runtime kernel, orchestration, execution, lifecycle, planner, reviewer, registries, graph, events
- `src/metadata/` – metadata extraction and repository scanning
- `src/tools/` – deterministic tool framework
- Future directories:
  - `src/providers/`
  - `src/agents/`
  - `src/state/`
  - `src/shared/`
  - `src/utils/`
  - `src/types/`

## 9. Engineering Rules

- Never redesign approved architecture.
- Never replace working implementations.
- Prefer extending existing code.
- Maintain strict TypeScript.
- Use constructor dependency injection.
- Avoid global state.
- Keep behaviour deterministic wherever possible.
- Write unit tests for every new runtime component.
- Write integration tests for every major workflow.
- Public APIs must be documented.
- No TODOs in committed code.
- No dead code.
- No hidden side effects.

## 10. Development Roadmap

### Completed
- Runtime Foundation
- Runtime Pipeline
- Metadata Extraction
- Deterministic Tool Framework
- Runtime Integration Tests

### Current Work
Complete Milestone 5 by:
- fixing platform-specific test failures
- implementing the Analysis State Machine
- implementing the Dependency Injector
- reconciling runtime contracts with implementations

### Upcoming
**Milestone 6:**
- Generic Agent Runtime
- Provider Adapter
- Real Architecture Agent
- Metadata → Tool Registry → Evidence Graph integration

**Milestone 7:**
- Security Agent
- Dependency Agent
- DevOps Agent
- Documentation Agent

**Milestone 8:**
- Reviewer enhancement
- Re-analysis loop
- Confidence refinement

**Milestone 9:**
- Streaming AI Operating System UI

**Milestone 10:**
- Run Memory
- Decision Log
- Diagram Generator
- Report Generator
- Production polish

## 11. Role of the AI Coding Assistant

When working on this repository, the assistant must:
1. Read the existing implementation before making changes.
2. Respect the frozen architecture.
3. Extend rather than rewrite.
4. Keep changes aligned with the roadmap.
5. Explain any proposed architectural deviation before making it.
6. Stop after completing the requested milestone.
7. Never jump ahead to later milestones without explicit approval.
