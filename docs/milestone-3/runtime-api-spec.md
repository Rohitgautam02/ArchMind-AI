# Runtime API Specification

## Design Principles

- Treat the runtime as an orchestration kernel, not as a UI helper.
- Keep data flow explicit and observable.
- Prefer typed contracts over implicit conventions.
- Allow every runtime surface to be tested in isolation.

## PlannerRuntime

### Responsibilities

- Inspect the current evidence graph.
- Form hypotheses.
- Decide which agents or tools are needed.
- Decide whether more evidence is required.
- Emit a decision log entry for every planning step.

### Lifecycle

1. Receive run context.
2. Inspect evidence graph snapshot.
3. Form candidate hypotheses.
4. Select tools and agents.
5. Emit a plan.
6. Re-evaluate after new evidence arrives.

### Public Methods

- `plan(input)`
- `revisePlan(input)`
- `recordDecision(input)`

### Failure Cases

- Insufficient evidence.
- Conflicting evidence.
- Invalid agent selection.
- Planner confidence below threshold.

### Retry Strategy

- Re-plan after evidence updates.
- Escalate to additional agents when confidence is low.
- Stop after configurable retry ceiling is reached.

## AgentRuntime

### Responsibilities

- Execute one agent contract.
- Resolve tools required by the agent.
- Validate input and output schemas.
- Publish lifecycle events.
- Persist produced evidence.

### Lifecycle

1. Receive agent execution request.
2. Validate contract and payload.
3. Resolve deterministic tools.
4. Invoke provider if needed.
5. Validate structured output.
6. Convert outputs into graph updates.

### Public Methods

- `execute(input)`
- `validate(input)`
- `cancel(runId)`

### Failure Cases

- Schema validation failure.
- Tool failure.
- Provider failure.
- Timeout.
- Inconsistent output.

### Retry Strategy

- Retry tool or provider calls only when idempotent.
- Retry within configured execution policy.
- Hand off to reviewer when failures are partially recoverable.

## ExecutionQueue

### Responsibilities

- Sequence planner-selected work.
- Support parallel and dependent execution.
- Track job state and completion order.

### Lifecycle

1. Accept queued work.
2. Resolve dependency graph.
3. Dispatch work units.
4. Observe completion or failure.
5. Emit queue state updates.

### Public Methods

- `enqueue(item)`
- `dequeue()`
- `dispatch(batch)`
- `cancel(runId)`

### Failure Cases

- Dependency deadlock.
- Queue saturation.
- Stuck job.

### Retry Strategy

- Re-dispatch failed idempotent jobs.
- Rebuild queue after planner revision.

## EventBus

### Responsibilities

- Provide typed event publication and subscription.
- Support replay for observability and debugging.
- Decouple orchestration components.

### Lifecycle

1. Subscribe listeners.
2. Publish typed events.
3. Persist event stream.
4. Replay events when needed.

### Public Methods

- `publish(event)`
- `subscribe(eventType, handler)`
- `replay(runId)`

### Failure Cases

- Listener failure.
- Event schema mismatch.
- Event ordering violation.

### Retry Strategy

- Retry transient event persistence failures.
- Treat handler failures as isolated unless they affect core persistence.

## EvidenceGraph

### Responsibilities

- Store canonical runtime facts.
- Maintain provenance, confidence, conflicts, and derived facts.
- Support merge, snapshot, and conflict resolution.

### Lifecycle

1. Ingest metadata facts.
2. Normalize evidence nodes and edges.
3. Apply derived updates.
4. Record conflicts and hypotheses.
5. Produce snapshots for runtime consumers.

### Public Methods

- `apply(update)`
- `merge(snapshot)`
- `resolveConflict(conflictId)`
- `snapshot(runId)`

### Failure Cases

- Invalid graph update.
- Duplicate provenance.
- Merge conflict.

### Retry Strategy

- Re-apply idempotent updates.
- Request additional evidence when conflict cannot be resolved deterministically.

## ToolRegistry

### Responsibilities

- Register deterministic tools.
- Support discovery and versioning.
- Resolve tool compatibility for agents.

### Lifecycle

1. Register tool metadata.
2. Advertise capabilities.
3. Resolve matching tools at runtime.
4. Track tool execution status.

### Public Methods

- `register(tool)`
- `discover(filter)`
- `resolve(name, version)`
- `listCapabilities()`

### Failure Cases

- Tool version mismatch.
- Missing capability.
- Unsupported runtime environment.

### Retry Strategy

- Retry only idempotent deterministic tools.
- Prefer alternate registered tool implementations when available.

## ProviderAdapter

### Responsibilities

- Abstract provider differences.
- Support streaming and structured outputs.
- Enforce timeouts, retries, rate limits, and circuit breaking.

### Lifecycle

1. Establish provider session.
2. Stream or request structured output.
3. Validate output contract.
4. Close or recycle session.

### Public Methods

- `generate(input)`
- `stream(input)`
- `healthCheck()`

### Failure Cases

- Provider timeout.
- Rate limit exceeded.
- Structured output mismatch.
- Circuit breaker open.

### Retry Strategy

- Retry only with bounded exponential backoff.
- Fail over to alternate provider when policy permits.

## ReviewerRuntime

### Responsibilities

- Validate contradictions and completeness.
- Compare confidence against evidence quality.
- Approve, reject, or request another pass.

### Lifecycle

1. Receive structured outputs.
2. Compare against evidence graph.
3. Apply review rules.
4. Emit approval or rejection.

### Public Methods

- `review(input)`
- `reject(reason)`
- `requestReanalysis(input)`

### Failure Cases

- Contradictory evidence.
- Incomplete evidence.
- Reviewer threshold not met.

### Retry Strategy

- Trigger planner revision when rejection occurs.
- Allow review re-run only after new evidence arrives.

## RunMemory

### Responsibilities

- Persist local historical summaries.
- Track deltas between runs.
- Store trend signals and comparative context.

### Lifecycle

1. Receive decision log and summary.
2. Store run-level artifacts.
3. Expose comparison data for future runs.

### Public Methods

- `store(run)`
- `compare(currentRunId, previousRunId)`
- `load(runId)`

### Failure Cases

- Storage unavailable.
- Corrupted run snapshot.
- Comparison data missing.

### Retry Strategy

- Retry local persistence with bounded attempts.
- Fall back to in-memory ephemeral state for the current session only.