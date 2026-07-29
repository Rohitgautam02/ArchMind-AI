# Runtime State Machine

## States

- Idle
- Planning
- Evidence Collection
- Tool Execution
- Agent Execution
- Review
- Approved
- Report
- Completed

## Transitions

- Idle -> Planning
- Planning -> Evidence Collection
- Evidence Collection -> Tool Execution
- Tool Execution -> Agent Execution
- Agent Execution -> Review
- Review -> Approved
- Approved -> Report
- Report -> Completed

## Failure Handling

- Any state may transition to failure handling when a hard error occurs.
- Recovery may re-enter Planning if evidence is incomplete.
- Reviewer rejection may return the run to Evidence Collection or Planning.

## Retry Handling

- Retry is permitted for idempotent tool calls and provider calls.
- Planner retries are permitted when additional evidence arrives.
- Reviewer-driven retries are permitted when contradictions remain unresolved.

## Cancellation Handling

- Cancellation must stop queue dispatch.
- Cancellation must preserve partial evidence and decision logs.
- Cancellation should mark the run as incomplete rather than deleting state.

## Partial Success Handling

- Partial success is allowed when some agents complete and others fail.
- The reviewer may still reject a partially successful run.
- Partial success must be visible in the decision log and event stream.