import { AnalysisState, terminalAnalysisStates } from './analysis-state.js';
import type { EventBus } from '../events/event-bus.js';

export interface AnalysisStateMachineDependencies {
  readonly eventBus: EventBus;
}

export class AnalysisStateMachine {
  readonly #eventBus: EventBus;
  #state: AnalysisState = AnalysisState.IDLE;
  #history: readonly AnalysisState[] = [AnalysisState.IDLE];

  constructor(dependencies: AnalysisStateMachineDependencies) {
    this.#eventBus = dependencies.eventBus;
  }

  get state(): AnalysisState {
    return this.#state;
  }

  get history(): readonly AnalysisState[] {
    return this.#history;
  }

  transition(next: AnalysisState, reason?: string): void {
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
    } as any);
  }

  #isTerminal(state: AnalysisState): boolean {
    return terminalAnalysisStates.includes(state);
  }

  #isValidTransition(current: AnalysisState, next: AnalysisState): boolean {
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
