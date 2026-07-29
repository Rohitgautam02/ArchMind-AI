import type { RuntimeEventType } from '../contracts.js';
import { InMemoryEventStore } from './in-memory-event-store.js';
import type { EventHandler, RuntimeEvent } from './runtime-event.js';

export class EventBus {
  readonly #handlers = new Map<RuntimeEventType | string, Set<EventHandler>>();
  readonly #store: InMemoryEventStore;

  constructor(store: InMemoryEventStore = new InMemoryEventStore()) {
    this.#store = store;
  }

  publish<TType extends RuntimeEventType>(event: RuntimeEvent<TType>): void {
    this.#store.append(event);

    const handlers = this.#handlers.get(event.type) ?? new Set<EventHandler>();
    const wildcards = this.#handlers.get('*') ?? new Set<EventHandler>();

    if (handlers.size === 0 && wildcards.size === 0) {
      return;
    }

    for (const handler of [...handlers, ...wildcards]) {
      try {
        void Promise.resolve(handler(event)).catch(() => undefined);
      } catch {
        continue;
      }
    }
  }

  subscribe<TType extends RuntimeEventType>(eventType: TType | '*', handler: EventHandler<TType>): () => void {
    const handlers = this.#handlers.get(eventType) ?? new Set<EventHandler>();
    handlers.add(handler as any);
    this.#handlers.set(eventType, handlers);

    return () => {
      this.unsubscribe(eventType, handler);
    };
  }

  unsubscribe<TType extends RuntimeEventType>(eventType: TType | '*', handler: EventHandler<TType>): void {
    const handlers = this.#handlers.get(eventType);

    if (!handlers) {
      return;
    }

    handlers.delete(handler as any);

    if (handlers.size === 0) {
      this.#handlers.delete(eventType);
    }
  }

  history(): readonly RuntimeEvent[] {
    return this.#store.history();
  }

  async *replay(runId: string): AsyncIterable<RuntimeEvent> {
    for (const event of this.#store.historyForRun(runId)) {
      yield event;
    }
  }

  clear(): void {
    this.#store.clear();
  }
}