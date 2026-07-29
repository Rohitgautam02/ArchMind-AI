export class InMemoryEventStore {
    #events = [];
    append(event) {
        this.#events.push(event);
    }
    history() {
        return [...this.#events];
    }
    historyForRun(runId) {
        return this.#events.filter((event) => event.metadata.runId === runId);
    }
    clear() {
        this.#events = [];
    }
}
