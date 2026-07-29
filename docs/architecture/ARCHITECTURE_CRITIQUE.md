# Architecture Critique

## What must not happen

This system must not become a single LLM-backed dashboard that reads files, summarizes them, and prints a report. That pattern fails the product goal, the privacy goal, and the engineering goal.

## Key risks in a naive design

- A single orchestration prompt would make planner, reviewer, and reporting behavior opaque and impossible to validate independently.
- Direct source-code ingestion would violate the privacy promise and create avoidable trust risk.
- Free-form agent text would make downstream reasoning brittle and hard to test.
- A report-first UI would make the product feel like a dashboard instead of an AI operating system.
- A provider-specific implementation would make the platform fragile and hard to extend.

## Architectural challenge

The core system challenge is not analysis accuracy. It is control: controlling what data enters the system, what each agent is allowed to decide, how uncertainty is represented, and when another pass is required.

## Architectural improvement direction

- Use metadata-only analysis as a hard boundary.
- Make the planner an actual decision engine with evidence-aware routing.
- Force every agent to emit structured output with schemas and validation.
- Treat the reviewer as a gate, not a summarizer.
- Drive the UI from orchestration events so the product feels alive.
- Isolate model providers behind a runtime adapter so Ollama, Groq, and future providers are interchangeable.

## Decision criteria

Any implementation should be rejected if it cannot prove:

- source code never leaves the user machine
- every agent output is schema-validated
- the reviewer can reject and re-run analysis
- the analysis pipeline is observable end to end
- the UI reflects real orchestration state, not static page composition