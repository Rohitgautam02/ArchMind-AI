import type { EventBus } from '../events/event-bus.js';
import type { RuntimeEvent } from '../events/runtime-event.js';

export interface StructuredLoggerDependencies {
  readonly eventBus: EventBus;
}

export class StructuredLogger {
  readonly #eventBus: EventBus;

  constructor(dependencies: StructuredLoggerDependencies) {
    this.#eventBus = dependencies.eventBus;
  }

  start(): void {
    this.#eventBus.subscribe('*' as any, (event: RuntimeEvent) => {
      this.#log(event);
    });
  }

  #log(event: RuntimeEvent): void {
    const logEntry = {
      timestamp: event.emittedAt,
      level: event.type.includes('Failed') ? 'ERROR' : 'INFO',
      eventType: event.type,
      runId: event.metadata.runId,
      workspaceId: event.metadata.workspaceId,
      payload: event.payload,
    };

    // Use console.log for standard stdout structured logging
    // Ensure it outputs a single line JSON for easy parsing by log aggregators
    console.log(JSON.stringify(logEntry));
  }
}
