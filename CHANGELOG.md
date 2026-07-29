# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] - 2026-07-29

### Architecture Stabilization

This milestone refines the architecture, strictly separating policy from mechanism and introducing deep evidence provenance to mathematically derive reasoning confidence.

### Added
- **The Planning Triad**: Decoupled the monolithic `PlannerRuntime` into `PlannerRuntime` (Policy), `CapabilityResolver` (Resolution), and `ExecutionScheduler` (Mechanism).
- **CapabilityResolver SemVer**: Resolves concrete capabilities by parsing semantic versions instead of simple locale comparisons.
- **Recursive Provenance**: The `Provenance` schema now tracks `supportingEvidenceIds`.
- **Confidence Engine**: Dynamically calculates the derived confidence of high-level evidence nodes based on the scores of the supporting deterministic nodes.

### Changed
- **CLI Lifecycle**: Unified the pipeline into a single, cohesive RunManager lifecycle traversing extraction, planning, reasoning, and review.

## [0.4.0] - 2026-07-29

### Evidence-Aware Planning Engine

This milestone transforms the platform into an active reasoning engine.

### Added
- **Graph Query API**: Exposed topological queries (`findByKind`, `findByRelation`, `findIncoming`, etc.).
- **Declarative Planner Rules**: Capabilities now specify Required vs Produced evidence.
- **Graph-Aware Reviewer**: The Reviewer now actively checks AI assertions against deterministic graph truths.

## [0.3.0] - 2026-07-29

### Semantic Evidence Graph

This milestone transforms the Evidence Graph from a flat collection of metadata into a deeply connected semantic topology, allowing downstream reasoning to traverse dependencies and structural heuristics.

### Added
- **Graph Edges**: Extractor contracts now emit `EvidenceEdge` objects alongside nodes, creating relational pathways.
- **Topological AST Graphing**: The `TypeScriptAstExtractor` now emits distinct nodes for Files, Classes, and Modules, connected via `contains`, `imports`, and `extends` edges.
- **FrameworkDetector**: A deterministic heuristic engine that infers the technology stack (e.g., React, Express, Vue) with 100% confidence prior to AI reasoning.
- **ArchitectureDetector**: A structural heuristic engine that identifies design patterns (e.g., Layered Architecture, DDD) based on repository topology.

## [0.2.0] - 2026-07-29

### Real Repository Intelligence

This release pivots the platform from a demonstration runtime to a genuinely capable developer tool by introducing **Deterministic Extraction**. ArchMind AI now deeply parses a repository locally before involving any LLMs.

### Added
- **RepositoryIntelligenceEngine**: Orchestrates local file scanning and AST parsing.
- **PackageJsonExtractor**: Parses dependencies, devDependencies, and scripts.
- **TsConfigExtractor**: Extracts compiler options and includes/excludes.
- **DockerfileExtractor**: Extracts base images, exposed ports, and build stages.
- **ReadmeExtractor**: Ingests raw documentation for downstream reasoning.
- **TypeScriptAstExtractor**: Walks the `.ts` Abstract Syntax Tree using the TypeScript compiler API to extract interfaces, classes, functions, and imports.

### Changed
- **Architecture Agent**: Now receives a serialized view of the deterministic Evidence Graph (AST nodes, dependencies) to base its reasoning on concrete facts rather than placeholders.
- **Pipeline Integration**: The CLI natively invokes the `RepositoryScanner` and pre-populates the Evidence Graph before executing the `RuntimeOrchestrator`.

## [0.1.0] - 2026-07-29

This marks the first demonstrable release of the ArchMind AI platform.

### Added
- **CLI**: Executable entrypoint (`archmind analyze`) to trigger end-to-end repository analysis.
- **Provider Framework**: Extensible provider adapters with a concrete `OllamaProvider` implementation.
- **Evidence Graph**: A canonical, provenance-tracked, directed acyclic graph to store all extracted and derived architectural data.
- **Runtime Kernel**: A deterministic bootloader managing dependency injection and initialization lifecycle.
- **Planner**: `PlannerRuntime` to evaluate evidence and determine which capabilities to schedule.
- **Reviewer**: `ReviewerRuntime` to act as an adversarial check on agent outputs before writing to the Evidence Graph.
- **Configuration Loader**: Support for overriding defaults via `archmind.config.json`.
- **Report Generator**: Automatic conversion of the terminal Evidence Graph into a human-readable Markdown report.
- **Agent Runtime**: Dynamic dispatch, strictly validated execution, and generic error mapping for all AI agents.
- **Dynamic Dispatch**: Capability and Agent registries that resolve abstract work items into concrete execution components.

### Changed
- **Architecture Agent**: Rewritten from a hardcoded procedural script into a declarative, Zod-validated `AgentDefinition`.
- **Provider Layer**: Decoupled from agent logic; providers are now strictly responsible for network I/O and return raw JSON objects for the AgentRuntime to validate.

### Removed
- **Fake Runtime Execution**: Replaced hardcoded test scripts with a genuine asynchronous pipeline orchestrator.
