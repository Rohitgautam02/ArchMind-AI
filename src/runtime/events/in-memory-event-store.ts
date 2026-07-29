import type { RuntimeEvent } from './runtime-event.js';

export class InMemoryEventStore {
  #events: RuntimeEvent[] = [];

  append(event: RuntimeEvent): void {
    this.#events.push(event);
  }

  history(): readonly RuntimeEvent[] {
    return [...this.#events];
  }

  historyForRun(runId: string): readonly RuntimeEvent[] {
    return this.#events.filter((event) => event.metadata.runId === runId);
  }

  clear(): void {
    this.#events = [];
  }
}