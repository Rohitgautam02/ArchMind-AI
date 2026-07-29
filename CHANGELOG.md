# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
