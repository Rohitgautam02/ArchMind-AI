/**
 * Analysis-level state machine states as defined in:
 * - docs/milestone-3/state-machine.md
 * - src/runtime/contracts.ts (RuntimeState type)
 *
 * These represent the analysis pipeline states, distinct from the kernel lifecycle states.
 */
export var AnalysisState;
(function (AnalysisState) {
    AnalysisState["IDLE"] = "Idle";
    AnalysisState["PLANNING"] = "Planning";
    AnalysisState["EVIDENCE_COLLECTION"] = "Evidence Collection";
    AnalysisState["TOOL_EXECUTION"] = "Tool Execution";
    AnalysisState["AGENT_EXECUTION"] = "Agent Execution";
    AnalysisState["REVIEW"] = "Review";
    AnalysisState["APPROVED"] = "Approved";
    AnalysisState["REPORT"] = "Report";
    AnalysisState["COMPLETED"] = "Completed";
    AnalysisState["FAILED"] = "Failed";
    AnalysisState["CANCELLED"] = "Cancelled";
})(AnalysisState || (AnalysisState = {}));
export const terminalAnalysisStates = [
    AnalysisState.COMPLETED,
    AnalysisState.FAILED,
    AnalysisState.CANCELLED,
];
