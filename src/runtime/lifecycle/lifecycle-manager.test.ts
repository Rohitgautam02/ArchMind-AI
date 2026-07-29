import { describe, expect, it } from 'vitest';
import { LifecycleManager } from './lifecycle-manager.js';
import { RuntimeState } from './runtime-state.js';

describe('LifecycleManager', () => {
  it('supports the valid lifecycle sequence', () => {
    const manager = new LifecycleManager();

    manager.transition(RuntimeState.BOOTING);
    manager.transition(RuntimeState.INITIALIZING);
    manager.transition(RuntimeState.READY);
    manager.transition(RuntimeState.RUNNING);
    manager.transition(RuntimeState.STOPPING);
    manager.transition(RuntimeState.STOPPED);

    expect(manager.currentState()).toBe(RuntimeState.STOPPED);
    expect(manager.history()).toHaveLength(6);
  });

  it('rejects invalid transitions', () => {
    const manager = new LifecycleManager();

    expect(() => manager.transition(RuntimeState.RUNNING)).toThrow(
      'Invalid lifecycle transition from STOPPED to RUNNING',
    );
  });

  it('records history for each transition', () => {
    const manager = new LifecycleManager();

    manager.transition(RuntimeState.BOOTING);
    manager.transition(RuntimeState.INITIALIZING);

    const [firstTransition, secondTransition] = manager.history();

    expect(firstTransition.from).toBe(RuntimeState.STOPPED);
    expect(firstTransition.to).toBe(RuntimeState.BOOTING);
    expect(secondTransition.from).toBe(RuntimeState.BOOTING);
    expect(secondTransition.to).toBe(RuntimeState.INITIALIZING);
  });
});