import type { EventBus } from '../events/event-bus.js';
import type { RuntimeMetadata } from '../contracts.js';
import type { EvidenceGraph } from '../graph/evidence-graph.js';
import type { RuntimeEvent } from '../events/runtime-event.js';
import { RunStatus, terminalRunStatuses } from './run-status.js';
import type { RunContext } from './run-context.js';
import type { RunRecord, RunRecordInput } from './run-record.js';

export interface RunManagerDependencies {
  readonly eventBus: EventBus;
  readonly evidenceGraph: EvidenceGraph;
}

export interface RunManagerCreateResult {
  readonly runId: string;
  readonly record: RunRecord;
}

export class RunManager {
  readonly #eventBus: EventBus;
  readonly #evidenceGraph: EvidenceGraph;
  #runs = new Map<string, RunRecord>();
  #sequence = 0;

  constructor(dependencies: RunManagerDependencies) {
    this.#eventBus = dependencies.eventBus;
    this.#evidenceGraph = dependencies.evidenceGraph;
  }

  /** Create a new analysis run with an in-memory context and published lifecycle event. */
  createRun(): RunManagerCreateResult {
    const runId = this.#nextRunId();

    if (this.#runs.has(runId)) {
      throw new Error(`Duplicate run id generated: ${runId}`);
    }

    const now = this.#now();
    const context: RunContext = Object.freeze({
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
  resumeRun(runId: string): RunRecord {
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
  cancelRun(runId: string): RunRecord {
    const record = this.#getExistingRun(runId);

    if (terminalRunStatuses.includes(record.status) || record.status === RunStatus.CANCELLED) {
      throw new Error(`Cannot cancel run '${runId}' from status ${record.status}`);
    }

    return this.#transition(runId, RunStatus.CANCELLED, { eventType: 'RunCancelled' });
  }

  /** Complete a running run and preserve all graph state. */
  completeRun(runId: string): RunRecord {
    const record = this.#getExistingRun(runId);

    if (record.status !== RunStatus.RUNNING) {
      throw new Error(`Cannot complete run '${runId}' from status ${record.status}`);
    }

    return this.#transition(runId, RunStatus.COMPLETED, { eventType: 'RunCompleted' });
  }

  /** Replay a run by delegating directly to the EventBus history stream. */
  replayRun(runId: string): AsyncIterable<RuntimeEvent> {
    if (!this.#runs.has(runId)) {
      throw new Error(`Cannot replay unknown run '${runId}'`);
    }

    return this.#eventBus.replay(runId);
  }

  /** Get the current immutable record for a run. */
  getRun(runId: string): RunRecord | undefined {
    const record = this.#runs.get(runId);
    return record ? this.#cloneRecord(record) : undefined;
  }

  /** List all known runs in deterministic order. */
  listRuns(): readonly RunRecord[] {
    return [...this.#runs.values()].sort((left, right) => left.runId.localeCompare(right.runId)).map((record) => this.#cloneRecord(record));
  }

  /** Check whether a run exists in memory. */
  hasRun(runId: string): boolean {
    return this.#runs.has(runId);
  }

  #transition(runId: string, status: RunStatus, options: { readonly eventType: 'RunResumed' | 'RunCancelled' | 'RunCompleted' }): RunRecord {
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

  #publish(eventType: 'RunCreated' | 'RunResumed' | 'RunCancelled' | 'RunCompleted', runId: string, record: RunRecord): void {
    const event: RuntimeEvent = {
      type: eventType,
      metadata: this.#metadataFromRecord(record),
      payload: {
        runId,
        metadata: this.#metadataFromRecord(record),
      },
      emittedAt: this.#now(),
    } as RuntimeEvent;

    this.#eventBus.publish(event);
  }

  #metadataFromRecord(record: RunRecord): RuntimeMetadata {
    return {
      runId: record.runId,
      workspaceId: 'runtime',
      timestamp: record.updatedAt,
      version: '1.0.0',
    };
  }

  #getExistingRun(runId: string): RunRecord {
    const record = this.#runs.get(runId);

    if (!record) {
      throw new Error(`Unknown run '${runId}'`);
    }

    return record;
  }

  #nextRunId(): string {
    this.#sequence += 1;
    return `run-${String(this.#sequence).padStart(4, '0')}`;
  }

  #now(): string {
    return new Date().toISOString();
  }

  #freezeRecord(input: RunRecordInput): RunRecord {
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

  #cloneRecord(record: RunRecord): RunRecord {
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