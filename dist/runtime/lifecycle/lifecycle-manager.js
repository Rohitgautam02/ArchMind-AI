import { RuntimeState } from './runtime-state.js';
export class LifecycleManager {
    #state = RuntimeState.STOPPED;
    #history = [];
    currentState() {
        return this.#state;
    }
    history() {
        return [...this.#history];
    }
    canTransition(nextState) {
        if (nextState === RuntimeState.FAILED) {
            return true;
        }
        return this.#isValidTransition(this.#state, nextState);
    }
    transition(nextState) {
        if (!this.canTransition(nextState)) {
            throw new Error(`Invalid lifecycle transition from ${this.#state} to ${nextState}`);
        }
        const previousState = this.#state;
        this.#state = nextState;
        this.#history.push({ from: previousState, to: nextState, timestamp: new Date().toISOString() });
    }
    #isValidTransition(currentState, nextState) {
        if (currentState === nextState) {
            return false;
        }
        if (currentState === RuntimeState.STOPPED) {
            return nextState === RuntimeState.BOOTING;
        }
        if (currentState === RuntimeState.FAILED) {
            return nextState === RuntimeState.BOOTING || nextState === RuntimeState.STOPPED;
        }
        if (currentState === RuntimeState.BOOTING) {
            return nextState === RuntimeState.INITIALIZING;
        }
        if (currentState === RuntimeState.INITIALIZING) {
            return nextState === RuntimeState.READY;
        }
        if (currentState === RuntimeState.READY) {
            return nextState === RuntimeState.RUNNING || nextState === RuntimeState.STOPPING;
        }
        if (currentState === RuntimeState.RUNNING) {
            return nextState === RuntimeState.STOPPING;
        }
        if (currentState === RuntimeState.STOPPING) {
            return nextState === RuntimeState.STOPPED;
        }
        return false;
    }
}
