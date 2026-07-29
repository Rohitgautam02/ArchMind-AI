# Agent Contract Specification

## Common Agent Contract

Every agent must implement the same structural contract so the planner, reviewer, and UI can reason about agents uniformly.

### Required Fields

- metadata
- capabilities
- required evidence
- produced evidence
- supported tools
- execution priority
- timeout
- retry policy
- JSON schema
- validation rules

### Behavioral Rules

- Agents must not return free-form text as their primary output.
- Agents must emit structured, schema-validated objects only.
- Agents may attach explainability fields, but those fields must also be structured.
- Agents must declare which evidence they require before execution.
- Agents must declare which evidence they produce after execution.

### TypeScript Contract

See [TypeScript Runtime Contracts](../../src/runtime/contracts.ts).

### Validation Model

- Input validation occurs before tool execution.
- Output validation occurs after tool and provider execution.
- The reviewer may reject an output even if it is schema-valid when confidence or evidence quality is insufficient.