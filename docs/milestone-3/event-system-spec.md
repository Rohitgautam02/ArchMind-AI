# Event System Specification

## Design Goals

- Fully typed runtime events.
- Replayable analysis runs.
- Clear lifecycle observability.
- Low coupling between runtime components.

## Runtime Events

- RunStarted
- PlannerStarted
- HypothesisCreated
- EvidenceAdded
- ToolInvoked
- ToolCompleted
- AgentStarted
- AgentCompleted
- AgentFailed
- ReviewerRequested
- ReviewerRejected
- ReviewerApproved
- ReportGenerated
- RunCompleted

## Event Payload Rules

- Every event must include run metadata.
- Every event must include timestamps.
- Every event must include a typed payload schema.
- Payloads must be serializable.

## Event Semantics

- `RunStarted` initializes orchestration context.
- `PlannerStarted` marks the beginning of reasoning over evidence.
- `HypothesisCreated` records planner hypotheses.
- `EvidenceAdded` records normalized graph updates.
- `ToolInvoked` and `ToolCompleted` bracket deterministic work.
- `AgentStarted`, `AgentCompleted`, and `AgentFailed` bracket agent execution.
- `ReviewerRequested`, `ReviewerRejected`, and `ReviewerApproved` gate downstream artifacts.
- `ReportGenerated` materializes approved analysis.
- `RunCompleted` closes the run lifecycle.