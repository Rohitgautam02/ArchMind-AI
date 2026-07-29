import { RunStatus, terminalRunStatuses } from './run-status.js';
export class RunManager {
    #eventBus;
    #evidenceGraph;
    #runs = new Map();
    #sequence = 0;
    constructor(dependencies) {
        this.#eventBus = dependencies.eventBus;
        this.#evidenceGraph = dependencies.evidenceGraph;
    }
    /** Create a new analysis run with an in-memory context and published lifecycle event. */
    createRun() {
        const runId = this.#nextRunId();
        if (this.#runs.has(runId)) {
            throw new Error(`Duplicate run id generated: ${runId}`);
        }
        const now = this.#now();
        const context = Object.freeze({
            runId,
            createdAt: now,
            updatedAt: now,
            evidenceGraph: this.#evidenceGraph,
        });
        const record = this.#freezeRecord({
            runId,
            status: RunStatus.CREATED,
            context,
            createdAt: now,
            updatedAt: now,
        });
        this.#runs.set(runId, record);
        this.#publish('RunCreated', runId, record);
        return { runId, record };
    }
    /** Resume a created or paused run and transition it into the running state. */
    resumeRun(runId) {
        const record = this.#getExistingRun(runId);
        if (terminalRunStatuses.includes(record.status)) {
            throw new Error(`Cannot resume run '${runId}' from terminal status ${record.status}`);
        }
        if (record.status !== RunStatus.CREATED && record.status !== RunStatus.PAUSED) {
            throw new Error(`Cannot resume run '${runId}' from status ${record.status}`);
        }
        return this.#transition(runId, RunStatus.RUNNING, { eventType: 'RunResumed' });
    }
    /** Cancel a non-terminal run and preserve all graph state. */
    cancelRun(runId) {
        const record = this.#getExistingRun(runId);
        if (terminalRunStatuses.includes(record.status) || record.status === RunStatus.CANCELLED) {
            throw new Error(`Cannot cancel run '${runId}' from status ${record.status}`);
        }
        return this.#transition(runId, RunStatus.CANCELLED, { eventType: 'RunCancelled' });
    }
    /** Complete a running run and preserve all graph state. */
    completeRun(runId) {
        const record = this.#getExistingRun(runId);
        if (record.status !== RunStatus.RUNNING) {
            throw new Error(`Cannot complete run '${runId}' from status ${record.status}`);
        }
        return this.#transition(runId, RunStatus.COMPLETED, { eventType: 'RunCompleted' });
    }
    /** Replay a run by delegating directly to the EventBus history stream. */
    replayRun(runId) {
        if (!this.#runs.has(runId)) {
            throw new Error(`Cannot replay unknown run '${runId}'`);
        }
        return this.#eventBus.replay(runId);
    }
    /** Get the current immutable record for a run. */
    getRun(runId) {
        const record = this.#runs.get(runId);
        return record ? this.#cloneRecord(record) : undefined;
    }
    /** List all known runs in deterministic order. */
    listRuns() {
        return [...this.#runs.values()].sort((left, right) => left.runId.localeCompare(right.runId)).map((record) => this.#cloneRecord(record));
    }
    /** Check whether a run exists in memory. */
    hasRun(runId) {
        return this.#runs.has(runId);
    }
    #transition(runId, status, options) {
        const currentRecord = this.#getExistingRun(runId);
        const now = this.#now();
        const nextRecord = this.#freezeRecord({
            ...currentRecord,
            status,
            updatedAt: now,
            completedAt: status === RunStatus.COMPLETED ? now : currentRecord.completedAt,
            cancelledAt: status === RunStatus.CANCELLED ? now : currentRecord.cancelledAt,
        });
        this.#runs.set(runId, nextRecord);
        this.#publish(options.eventType, runId, nextRecord);
        return nextRecord;
    }
    #publish(eventType, runId, record) {
        const event = {
            type: eventType,
            metadata: this.#metadataFromRecord(record),
            payload: {
                runId,
                metadata: this.#metadataFromRecord(record),
            },
            emittedAt: this.#now(),
        };
        this.#eventBus.publish(event);
    }
    #metadataFromRecord(record) {
        return {
            runId: record.runId,
            workspaceId: 'runtime',
            timestamp: record.updatedAt,
            version: '1.0.0',
        };
    }
    #getExistingRun(runId) {
        const record = this.#runs.get(runId);
        if (!record) {
            throw new Error(`Unknown run '${runId}'`);
        }
        return record;
    }
    #nextRunId() {
        this.#sequence += 1;
        return `run-${String(this.#sequence).padStart(4, '0')}`;
    }
    #now() {
        return new Date().toISOString();
    }
    #freezeRecord(input) {
        return Object.freeze({
            runId: input.runId,
            status: input.status,
            context: input.context,
            createdAt: input.createdAt,
            updatedAt: input.updatedAt,
            completedAt: input.completedAt,
            cancelledAt: input.cancelledAt,
            failureReason: input.failureReason,
        });
    }
    #cloneRecord(record) {
        return this.#freezeRecord({
            runId: record.runId,
            status: record.status,
            context: record.context,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            completedAt: record.completedAt,
            cancelledAt: record.cancelledAt,
            failureReason: record.failureReason,
        });
    }
}
