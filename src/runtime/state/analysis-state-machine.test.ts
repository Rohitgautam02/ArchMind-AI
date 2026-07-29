import { describe, expect, it } from 'vitest';
import { EventBus } from '../events/event-bus.js';
import { AnalysisState } from './analysis-state.js';
import { AnalysisStateMachine } from './analysis-state-machine.js';

describe('AnalysisStateMachine', () => {
  it('starts in IDLE state', () => {
    const eventBus = new EventBus();
    const stateMachine = new AnalysisStateMachine({ eventBus });

    expect(stateMachine.state).toBe(AnalysisState.IDLE);
    expect(stateMachine.history).toEqual([AnalysisState.IDLE]);
  });

  it('allows valid transitions', () => {
    const eventBus = new EventBus();
    const stateMachine = new AnalysisStateMachine({ eventBus });

    stateMachine.transition(AnalysisState.PLANNING);
    stateMachine.transition(AnalysisState.EVIDENCE_COLLECTION);
    stateMachine.transition(AnalysisState.TOOL_EXECUTION);
    stateMachine.transition(AnalysisState.AGENT_EXECUTION);
    stateMachine.transition(AnalysisState.REVIEW);
    stateMachine.transition(AnalysisState.APPROVED);
    stateMachine.transition(AnalysisState.REPORT);
    stateMachine.transition(AnalysisState.COMPLETED);

    expect(stateMachine.state).toBe(AnalysisState.COMPLETED);
    expect(stateMachine.history).toHaveLength(9);
  });

  it('rejects invalid transitions', () => {
    const eventBus = new EventBus();
    const stateMachine = new AnalysisStateMachine({ eventBus });

    expect(() => stateMachine.transition(AnalysisState.TOOL_EXECUTION)).toThrow(/Invalid transition/);
  });

  it('publishes events on transition', () => {
    const eventBus = new EventBus();
    const stateMachine = new AnalysisStateMachine({ eventBus });

    stateMachine.transition(AnalysisState.PLANNING, 'Run started');

    const history = eventBus.history();
    const stateEvent = history.find(e => e.type === 'AnalysisStateChanged');
    
    expect(stateEvent).toBeDefined();
    expect(stateEvent?.payload).toMatchObject({
      previous: AnalysisState.IDLE,
      current: AnalysisState.PLANNING,
      reason: 'Run started',
    });
  });

  it('allows recovery from review to planning', () => {
    const eventBus = new EventBus();
    const stateMachine = new AnalysisStateMachine({ eventBus });

    stateMachine.transition(AnalysisState.PLANNING);
    stateMachine.transition(AnalysisState.EVIDENCE_COLLECTION);
    stateMachine.transition(AnalysisState.TOOL_EXECUTION);
    stateMachine.transition(AnalysisState.AGENT_EXECUTION);
    stateMachine.transition(AnalysisState.REVIEW);
    stateMachine.transition(AnalysisState.PLANNING); // Re-plan

    expect(stateMachine.state).toBe(AnalysisState.PLANNING);
  });

  it('rejects transitions from terminal states', () => {
    const eventBus = new EventBus();
    const stateMachine = new AnalysisStateMachine({ eventBus });

    stateMachine.transition(AnalysisState.FAILED);

    expect(() => stateMachine.transition(AnalysisState.PLANNING)).toThrow(/Cannot transition from terminal state Failed/);
  });
});
