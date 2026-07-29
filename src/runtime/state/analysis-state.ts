/**
 * Analysis-level state machine states as defined in:
 * - docs/milestone-3/state-machine.md
 * - src/runtime/contracts.ts (RuntimeState type)
 *
 * These represent the analysis pipeline states, distinct from the kernel lifecycle states.
 */
export enum AnalysisState {
  IDLE = 'Idle',
  PLANNING = 'Planning',
  EVIDENCE_COLLECTION = 'Evidence Collection',
  TOOL_EXECUTION = 'Tool Execution',
  AGENT_EXECUTION = 'Agent Execution',
  REVIEW = 'Review',
  APPROVED = 'Approved',
  REPORT = 'Report',
  COMPLETED = 'Completed',
  FAILED = 'Failed',
  CANCELLED = 'Cancelled',
}

export const terminalAnalysisStates: readonly AnalysisState[] = [
  AnalysisState.COMPLETED,
  AnalysisState.FAILED,
  AnalysisState.CANCELLED,
] as const;
