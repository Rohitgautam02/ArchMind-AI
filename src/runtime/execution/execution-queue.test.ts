import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../events/event-bus.js';
import type { RuntimeMetadata } from '../contracts.js';
import type { ExecutionPlan } from '../planner/execution-plan.js';
import { ExecutionQueue } from './execution-queue.js';

const createMetadata = (runId: string): RuntimeMetadata => ({
  runId,
  workspaceId: 'workspace-1',
  timestamp: '2026-07-28T00:00:00.000Z',
  version: '1.0.0',
});

const createPlan = (runId: string, workItems: ExecutionPlan['workItems']): ExecutionPlan => ({
  runId,
  workItems,
  createdAt: '2026-07-28T00:00:00.000Z',
});

const createQueue = () => new ExecutionQueue({ eventBus: new EventBus() });

describe('ExecutionQueue', () => {
  it('enqueue execution plan', () => {
    const queue = createQueue();

    queue.enqueue(createPlan('run-1', [
      { id: 'work-1', capability: 'ArchitectureAgent', priority: 'Normal', dependencies: [], metadata: {} },
    ]));

    expect(queue.size()).toBe(1);
    expect(queue.hasPending()).toBe(true);
  });

  it('dequeue work item', () => {
    const queue = createQueue();

    queue.enqueue(createPlan('run-1', [
      { id: 'work-1', capability: 'ArchitectureAgent', priority: 'Normal', dependencies: [], metadata: {} },
    ]));

    expect(queue.dequeue()?.id).toBe('work-1');
  });

  it('dependency ordering', () => {
    const queue = createQueue();

    queue.enqueue(createPlan('run-1', [
      { id: 'work-1', capability: 'ArchitectureAgent', priority: 'Normal', dependencies: [], metadata: {} },
      { id: 'work-2', capability: 'ArchitectureAgent', priority: 'Normal', dependencies: ['work-1'], metadata: {} },
    ]));

    expect(queue.dequeue()?.id).toBe('work-1');
    expect(queue.dequeue()?.id).toBe('work-2');
  });

  it('FIFO ordering', () => {
    const queue = createQueue();

    queue.enqueue(createPlan('run-1', [
      { id: 'work-1', capability: 'ArchitectureAgent', priority: 'Normal', dependencies: [], metadata: { order: 1 } },
      { id: 'work-2', capability: 'ArchitectureAgent', priority: 'Normal', dependencies: [], metadata: { order: 2 } },
    ]));

    expect(queue.dequeue()?.id).toBe('work-1');
    expect(queue.dequeue()?.id).toBe('work-2');
  });

  it('duplicate prevention', () => {
    const queue = createQueue();
    const plan = createPlan('run-1', [
      { id: 'work-1', capability: 'ArchitectureAgent', priority: 'Normal', dependencies: [], metadata: {} },
    ]);

    queue.enqueue(plan);
    queue.enqueue(plan);

    expect(queue.size()).toBe(1);
  });

  it('queue size', () => {
    const queue = createQueue();

    queue.enqueue(createPlan('run-1', [
      { id: 'work-1', capability: 'ArchitectureAgent', priority: 'Normal', dependencies: [], metadata: {} },
      { id: 'work-2', capability: 'ArchitectureAgent', priority: 'High', dependencies: [], metadata: {} },
    ]));

    expect(queue.size()).toBe(2);
  });

  it('cancellation', () => {
    const queue = createQueue();

    queue.enqueue(createPlan('run-1', [
      { id: 'work-1', capability: 'ArchitectureAgent', priority: 'Normal', dependencies: [], metadata: {} },
    ]));

    queue.cancel('run-1');

    expect(queue.hasPending()).toBe(false);
    expect(queue.dequeue()).toBeUndefined();
  });

  it('clear queue', () => {
    const queue = createQueue();

    queue.enqueue(createPlan('run-1', [
      { id: 'work-1', capability: 'ArchitectureAgent', priority: 'Normal', dependencies: [], metadata: {} },
    ]));

    queue.clear();

    expect(queue.size()).toBe(0);
    expect(queue.hasPending()).toBe(false);
  });

  it('queue completion', () => {
    const queue = createQueue();

    queue.enqueue(createPlan('run-1', [
      { id: 'work-1', capability: 'ArchitectureAgent', priority: 'Normal', dependencies: [], metadata: {} },
    ]));

    queue.dequeue();

    expect(queue.hasPending()).toBe(false);
  });

  it('queue events', () => {
    const eventBus = new EventBus();
    const publishSpy = vi.spyOn(eventBus, 'publish');
    const queue = new ExecutionQueue({ eventBus });

    queue.enqueue(createPlan('run-1', [
      { id: 'work-1', capability: 'ArchitectureAgent', priority: 'Normal', dependencies: [], metadata: {} },
    ]));
    queue.dequeue();

    expect(publishSpy.mock.calls.map((call) => call[0]?.type)).toEqual(['QueueStarted', 'WorkQueued', 'WorkDequeued', 'QueueCompleted']);
  });
});