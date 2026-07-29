import { describe, expect, it } from 'vitest';
import { EventBus } from '../events/event-bus.js';
import { EvidenceGraph } from '../graph/evidence-graph.js';
import { RunManager } from './run-manager.js';
import { RunStatus } from './run-status.js';

const createManager = () => new RunManager({ eventBus: new EventBus(), evidenceGraph: new EvidenceGraph() });

describe('RunManager', () => {
  it('create run', () => {
    const manager = createManager();

    const { runId, record } = manager.createRun();

    expect(runId).toBe('run-0001');
    expect(record.status).toBe(RunStatus.CREATED);
    expect(manager.hasRun(runId)).toBe(true);
  });

  it('duplicate ids impossible', () => {
    const manager = createManager();

    const first = manager.createRun();
    const second = manager.createRun();

    expect(first.runId).not.toBe(second.runId);
  });

  it('resume run', () => {
    const manager = createManager();
    const { runId } = manager.createRun();

    const resumed = manager.resumeRun(runId);

    expect(resumed.status).toBe(RunStatus.RUNNING);
  });

  it('cancel run', () => {
    const manager = createManager();
    const { runId } = manager.createRun();

    const cancelled = manager.cancelRun(runId);

    expect(cancelled.status).toBe(RunStatus.CANCELLED);
    expect(cancelled.cancelledAt).toBeDefined();
  });

  it('complete run', () => {
    const manager = createManager();
    const { runId } = manager.createRun();
    manager.resumeRun(runId);

    const completed = manager.completeRun(runId);

    expect(completed.status).toBe(RunStatus.COMPLETED);
    expect(completed.completedAt).toBeDefined();
  });

  it('replay run', async () => {
    const manager = createManager();
    const { runId } = manager.createRun();
    manager.resumeRun(runId);
    manager.completeRun(runId);

    const events = [] as string[];

    for await (const event of manager.replayRun(runId)) {
      events.push(event.type);
    }

    expect(events).toEqual(['RunCreated', 'RunResumed', 'RunCompleted']);
  });

  it('get run', () => {
    const manager = createManager();
    const { runId } = manager.createRun();

    expect(manager.getRun(runId)?.runId).toBe(runId);
  });

  it('list runs', () => {
    const manager = createManager();
    const first = manager.createRun();
    const second = manager.createRun();

    expect(manager.listRuns().map((record) => record.runId)).toEqual([first.runId, second.runId]);
  });

  it('has run', () => {
    const manager = createManager();
    const { runId } = manager.createRun();

    expect(manager.hasRun(runId)).toBe(true);
  });

  it('invalid resume', () => {
    const manager = createManager();

    expect(() => manager.resumeRun('run-missing')).toThrow("Unknown run 'run-missing'");
  });

  it('invalid cancel', () => {
    const manager = createManager();

    expect(() => manager.cancelRun('run-missing')).toThrow("Unknown run 'run-missing'");
  });

  it('invalid replay', () => {
    const manager = createManager();

    expect(() => manager.replayRun('run-missing')).toThrow("Cannot replay unknown run 'run-missing'");
  });

  it('state transitions', () => {
    const manager = createManager();
    const { runId } = manager.createRun();

    expect(manager.getRun(runId)?.status).toBe(RunStatus.CREATED);
    expect(manager.resumeRun(runId).status).toBe(RunStatus.RUNNING);
    expect(manager.completeRun(runId).status).toBe(RunStatus.COMPLETED);
  });

  it('event publication', async () => {
    const manager = createManager();
    const { runId } = manager.createRun();

    manager.resumeRun(runId);
    manager.cancelRun(runId);

    const events = [] as string[];

    for await (const event of manager.replayRun(runId)) {
      events.push(event.type);
    }

    expect(events).toEqual(['RunCreated', 'RunResumed', 'RunCancelled']);
  });
});