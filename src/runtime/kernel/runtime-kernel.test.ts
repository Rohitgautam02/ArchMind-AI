import { describe, expect, it } from 'vitest';
import { LifecycleManager } from '../lifecycle/lifecycle-manager.js';
import { RuntimeState } from '../lifecycle/runtime-state.js';
import { RuntimeKernel } from './runtime-kernel.js';

describe('RuntimeKernel', () => {
  it('boots correctly', () => {
    const lifecycleManager = new LifecycleManager();
    const kernel = new RuntimeKernel({ lifecycleManager });

    kernel.boot();

    expect(lifecycleManager.currentState()).toBe(RuntimeState.BOOTING);
  });

  it('initializes to READY', () => {
    const lifecycleManager = new LifecycleManager();
    const kernel = new RuntimeKernel({ lifecycleManager });

    kernel.boot();
    kernel.initialize();

    expect(lifecycleManager.currentState()).toBe(RuntimeState.READY);
  });

  it('refuses duplicate boot', () => {
    const kernel = new RuntimeKernel({ lifecycleManager: new LifecycleManager() });

    kernel.boot();

    expect(() => kernel.boot()).toThrow('RuntimeKernel is already booted');
  });

  it('cannot start before initialize', () => {
    const kernel = new RuntimeKernel({ lifecycleManager: new LifecycleManager() });

    kernel.boot();

    expect(() => kernel.start()).toThrow('Cannot start from state BOOTING');
  });

  it('restart returns READY', () => {
    const lifecycleManager = new LifecycleManager();
    const kernel = new RuntimeKernel({ lifecycleManager });

    kernel.boot();
    kernel.initialize();
    kernel.start();
    kernel.stop();
    kernel.restart();

    expect(lifecycleManager.currentState()).toBe(RuntimeState.READY);
  });

  it('stop twice throws', () => {
    const kernel = new RuntimeKernel({ lifecycleManager: new LifecycleManager() });

    kernel.boot();
    kernel.initialize();
    kernel.stop();

    expect(() => kernel.stop()).toThrow('Cannot stop when already stopped');
  });

  it('invalid transition rejected', () => {
    const lifecycleManager = new LifecycleManager();

    expect(() => lifecycleManager.transition(RuntimeState.RUNNING)).toThrow(
      'Invalid lifecycle transition from STOPPED to RUNNING',
    );
  });
});