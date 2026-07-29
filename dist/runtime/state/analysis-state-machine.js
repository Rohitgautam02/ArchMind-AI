import { AnalysisState, terminalAnalysisStates } from './analysis-state.js';
export class AnalysisStateMachine {
    #eventBus;
    #state = AnalysisState.IDLE;
    #history = [AnalysisState.IDLE];
    constructor(dependencies) {
        this.#eventBus = dependencies.eventBus;
    }
    get state() {
        return this.#state;
    }
    get history() {
        return this.#history;
    }
    transition(next, reason) {
        if (this.#isTerminal(this.#state)) {
            throw new Error(`Cannot transition from terminal state ${this.#state} to ${next}`);
        }
        if (!this.#isValidTransition(this.#state, next)) {
            throw new Error(`Invalid transition from ${this.#state} to ${next}`);
        }
        const previous = this.#state;
        this.#state = next;
        this.#history = Object.freeze([...this.#history, next]);
        this.#eventBus.publish({
            type: 'AnalysisStateChanged',
            emittedAt: new Date().toISOString(),
            metadata: {
                runId: 'system',
                workspaceId: 'system',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
            },
            payload: {
                previous,
                current: next,
                reason,
            },
        });
    }
    #isTerminal(state) {
        return terminalAnalysisStates.includes(state);
    }
    #isValidTransition(current, next) {
        if (next === AnalysisState.FAILED || next === AnalysisState.CANCELLED) {
            return true; // Any non-terminal state can transition to failed or cancelled
        }
        switch (current) {
            case AnalysisState.IDLE:
                return next === AnalysisState.PLANNING;
            case AnalysisState.PLANNING:
                return next === AnalysisState.EVIDENCE_COLLECTION;
            case AnalysisState.EVIDENCE_COLLECTION:
                return next === AnalysisState.TOOL_EXECUTION || next === AnalysisState.PLANNING; // Recovery back to planning
            case AnalysisState.TOOL_EXECUTION:
                return next === AnalysisState.AGENT_EXECUTION;
            case AnalysisState.AGENT_EXECUTION:
                return next === AnalysisState.REVIEW;
            case AnalysisState.REVIEW:
                return next === AnalysisState.APPROVED || next === AnalysisState.EVIDENCE_COLLECTION || next === AnalysisState.PLANNING;
            case AnalysisState.APPROVED:
                return next === AnalysisState.REPORT;
            case AnalysisState.REPORT:
                return next === AnalysisState.COMPLETED;
            default:
                return false;
        }
    }
}
