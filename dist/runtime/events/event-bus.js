import { InMemoryEventStore } from './in-memory-event-store.js';
export class EventBus {
    #handlers = new Map();
    #store;
    constructor(store = new InMemoryEventStore()) {
        this.#store = store;
    }
    publish(event) {
        this.#store.append(event);
        const handlers = this.#handlers.get(event.type) ?? new Set();
        const wildcards = this.#handlers.get('*') ?? new Set();
        if (handlers.size === 0 && wildcards.size === 0) {
            return;
        }
        for (const handler of [...handlers, ...wildcards]) {
            try {
                void Promise.resolve(handler(event)).catch(() => undefined);
            }
            catch {
                continue;
            }
        }
    }
    subscribe(eventType, handler) {
        const handlers = this.#handlers.get(eventType) ?? new Set();
        handlers.add(handler);
        this.#handlers.set(eventType, handlers);
        return () => {
            this.unsubscribe(eventType, handler);
        };
    }
    unsubscribe(eventType, handler) {
        const handlers = this.#handlers.get(eventType);
        if (!handlers) {
            return;
        }
        handlers.delete(handler);
        if (handlers.size === 0) {
            this.#handlers.delete(eventType);
        }
    }
    history() {
        return this.#store.history();
    }
    async *replay(runId) {
        for (const event of this.#store.historyForRun(runId)) {
            yield event;
        }
    }
    clear() {
        this.#store.clear();
    }
}
