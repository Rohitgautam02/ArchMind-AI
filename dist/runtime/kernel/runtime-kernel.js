import { RuntimeState } from '../lifecycle/runtime-state.js';
export class RuntimeKernel {
    #lifecycleManager;
    #booted = false;
    constructor(dependencies) {
        this.#lifecycleManager = dependencies.lifecycleManager;
    }
    boot() {
        this.#ensureNotBooted();
        this.#lifecycleManager.transition(RuntimeState.BOOTING);
        this.#booted = true;
    }
    initialize() {
        this.#assertState(RuntimeState.BOOTING, 'initialize');
        this.#lifecycleManager.transition(RuntimeState.INITIALIZING);
        this.#lifecycleManager.transition(RuntimeState.READY);
    }
    start() {
        this.#assertState(RuntimeState.READY, 'start');
        this.#lifecycleManager.transition(RuntimeState.RUNNING);
    }
    stop() {
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
    restart() {
        if (this.#lifecycleManager.currentState() !== RuntimeState.STOPPED) {
            this.stop();
        }
        this.boot();
        this.initialize();
    }
    #ensureNotBooted() {
        if (this.#booted) {
            throw new Error('RuntimeKernel is already booted');
        }
    }
    #assertState(expectedState, operation) {
        const actualState = this.#lifecycleManager.currentState();
        if (actualState !== expectedState) {
            throw new Error(`Cannot ${operation} from state ${actualState}`);
        }
    }
}
