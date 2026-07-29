import { LifecycleManager } from '../lifecycle/lifecycle-manager.js';
import { RuntimeState } from '../lifecycle/runtime-state.js';

export interface RuntimeKernelDependencies {
  readonly lifecycleManager: LifecycleManager;
}

export class RuntimeKernel {
  readonly #lifecycleManager: LifecycleManager;
  #booted = false;

  constructor(dependencies: RuntimeKernelDependencies) {
    this.#lifecycleManager = dependencies.lifecycleManager;
  }

  boot(): void {
    this.#ensureNotBooted();
    this.#lifecycleManager.transition(RuntimeState.BOOTING);
    this.#booted = true;
  }

  initialize(): void {
    this.#assertState(RuntimeState.BOOTING, 'initialize');
    this.#lifecycleManager.transition(RuntimeState.INITIALIZING);
    this.#lifecycleManager.transition(RuntimeState.READY);
  }

  start(): void {
    this.#assertState(RuntimeState.READY, 'start');
    this.#lifecycleManager.transition(RuntimeState.RUNNING);
  }

  stop(): void {
    const currentState = this.#lifecycleManager.currentState();

    if (currentState === RuntimeState.STOPPED) {
      throw new Error('Cannot stop when already stopped');
    }

    if (currentState !== RuntimeState.RUNNING && currentState !== RuntimeState.READY) {
      throw new Error(`Cannot stop from state ${currentState}`);
    }

    this.#lifecycleManager.transition(RuntimeState.STOPPING);

    this.#lifecycleManager.transition(RuntimeState.STOPPED);
    this.#booted = false;
  }

  restart(): void {
    if (this.#lifecycleManager.currentState() !== RuntimeState.STOPPED) {
      this.stop();
    }

    this.boot();
    this.initialize();
  }

  #ensureNotBooted(): void {
    if (this.#booted) {
      throw new Error('RuntimeKernel is already booted');
    }
  }

  #assertState(expectedState: RuntimeState, operation: string): void {
    const actualState = this.#lifecycleManager.currentState();

    if (actualState !== expectedState) {
      throw new Error(`Cannot ${operation} from state ${actualState}`);
    }
  }
}