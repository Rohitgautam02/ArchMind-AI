export class StructuredLogger {
    #eventBus;
    constructor(dependencies) {
        this.#eventBus = dependencies.eventBus;
    }
    start() {
        this.#eventBus.subscribe('*', (event) => {
            this.#log(event);
        });
    }
    #log(event) {
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
