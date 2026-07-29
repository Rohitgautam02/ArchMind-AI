import type { EventBus } from '../events/event-bus.js';
import type { RuntimeMetadata } from '../contracts.js';
import type { RuntimeEvent } from '../events/runtime-event.js';
import type { ExecutionPlan } from '../planner/execution-plan.js';
import type { WorkItem } from '../planner/work-item.js';
import type { QueueItem } from './queue-item.js';
import { QueueState } from './queue-state.js';

export interface ExecutionQueueDependencies {
  readonly eventBus: EventBus;
}

interface QueueRuntime {
  readonly runId: string;
  state: QueueState;
  readonly items: QueueItem[];
  readonly completedItemIds: Set<string>;
  cancelledReason?: string;
}

/**
 * Deterministic in-memory execution queue that converts execution plans into dependency-ordered queue items.
 */
export class ExecutionQueue {
  readonly #eventBus: EventBus;
  #queues = new Map<string, QueueRuntime>();
  #sequence = 0;

  constructor(dependencies: ExecutionQueueDependencies) {
    this.#eventBus = dependencies.eventBus;
  }

  /** Enqueue an execution plan for scheduling. */
  enqueue(plan: ExecutionPlan): void {
    const queueRuntime = this.#queues.get(plan.runId) ?? this.#createQueue(plan.runId);
    const existingIds = new Set(queueRuntime.items.map((item) => item.id));
    const nextItems = plan.workItems
      .filter((workItem) => !existingIds.has(workItem.id) && !queueRuntime.completedItemIds.has(workItem.id))
      .map((workItem) => this.#toQueueItem(plan.runId, workItem))
      .sort((left, right) => this.#compareItems(left, right));

    queueRuntime.items.push(...nextItems);
    queueRuntime.items.sort((left, right) => this.#compareItems(left, right));
    queueRuntime.state = queueRuntime.state === QueueState.CANCELLED ? QueueState.CANCELLED : QueueState.ACTIVE;

    this.#queues.set(plan.runId, this.#freezeQueueRuntime(queueRuntime));

    if (nextItems.length > 0) {
      this.#publish('QueueStarted', plan.runId, { runId: plan.runId });

      for (const item of nextItems) {
        this.#publish('WorkQueued', plan.runId, {
          runId: plan.runId,
          workItemId: item.id,
          capability: item.capability,
        });
      }
    }
  }

  /** Return the next ready queue item without removing it from the scheduling history. */
  dequeue(): QueueItem | undefined {
    const next = this.#nextReadyItem();

    if (!next) {
      this.#maybeComplete();
      return undefined;
    }

    const queueRuntime = this.#queues.get(next.runId);

    if (!queueRuntime || queueRuntime.state !== QueueState.ACTIVE) {
      return undefined;
    }

    queueRuntime.completedItemIds.add(next.id);
    queueRuntime.items.splice(queueRuntime.items.findIndex((item) => item.id === next.id), 1);
    this.#queues.set(next.runId, this.#freezeQueueRuntime(queueRuntime));

    this.#publish('WorkDequeued', next.runId, {
      runId: next.runId,
      workItemId: next.id,
      capability: next.capability,
    });

    this.#maybeComplete(next.runId);

    return next;
  }

  /** Inspect the next ready queue item without consuming it. */
  peek(): QueueItem | undefined {
    return this.#nextReadyItem();
  }

  /** Cancel all scheduled work for a run and preserve scheduling history. */
  cancel(runId: string): void {
    const queueRuntime = this.#queues.get(runId);

    if (!queueRuntime) {
      throw new Error(`Unknown queue run '${runId}'`);
    }

    if (queueRuntime.state === QueueState.CANCELLED) {
      return;
    }

    queueRuntime.state = QueueState.CANCELLED;
    queueRuntime.cancelledReason = 'Cancelled by caller';
    this.#queues.set(runId, this.#freezeQueueRuntime(queueRuntime));
    this.#publish('QueueCancelled', runId, { runId, reason: queueRuntime.cancelledReason });
  }

  /** Clear all queued runs and pending work. */
  clear(): void {
    this.#queues.clear();
  }

  /** Check whether there is pending work in any active queue. */
  hasPending(): boolean {
    return [...this.#queues.values()].some((queueRuntime) => queueRuntime.state === QueueState.ACTIVE && queueRuntime.items.length > 0);
  }

  /** Get the total number of pending work items across all queues. */
  size(): number {
    return [...this.#queues.values()].reduce((total, queueRuntime) => total + queueRuntime.items.length, 0);
  }

  #createQueue(runId: string): QueueRuntime {
    return {
      runId,
      state: QueueState.IDLE,
      items: [],
      completedItemIds: new Set<string>(),
    };
  }

  #toQueueItem(runId: string, workItem: WorkItem): QueueItem {
    this.#sequence += 1;

    return Object.freeze({
      runId,
      sequence: this.#sequence,
      id: workItem.id,
      capability: workItem.capability,
      priority: workItem.priority,
      dependencies: Object.freeze([...workItem.dependencies]),
      metadata: Object.freeze({ ...workItem.metadata }),
    });
  }

  #nextReadyItem(): QueueItem | undefined {
    const queues = [...this.#queues.values()]
      .filter((queueRuntime) => queueRuntime.state === QueueState.ACTIVE)
      .sort((left, right) => left.runId.localeCompare(right.runId));

    for (const queueRuntime of queues) {
      const nextItem = queueRuntime.items
        .filter((item) => this.#dependenciesSatisfied(queueRuntime, item))
        .sort((left, right) => this.#compareItems(left, right))[0];

      if (nextItem) {
        return nextItem;
      }
    }

    return undefined;
  }

  #dependenciesSatisfied(queueRuntime: QueueRuntime, item: QueueItem): boolean {
    return item.dependencies.every((dependencyId) => queueRuntime.completedItemIds.has(dependencyId));
  }

  #compareItems(left: QueueItem, right: QueueItem): number {
    const priorityComparison = this.#priorityValue(right.priority) - this.#priorityValue(left.priority);

    if (priorityComparison !== 0) {
      return priorityComparison;
    }

    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }

    return left.id.localeCompare(right.id);
  }

  #priorityValue(priority: QueueItem['priority']): number {
    switch (priority) {
      case 'High':
        return 3;
      case 'Normal':
        return 2;
      case 'Low':
        return 1;
    }
  }

  #maybeComplete(runId?: string): void {
    if (runId) {
      const queueRuntime = this.#queues.get(runId);

      if (!queueRuntime || queueRuntime.state !== QueueState.ACTIVE) {
        return;
      }

      if (queueRuntime.items.length === 0) {
        queueRuntime.state = QueueState.COMPLETED;
        this.#queues.set(runId, this.#freezeQueueRuntime(queueRuntime));
        this.#publish('QueueCompleted', runId, { runId });
      }

      return;
    }

    for (const queueRuntime of this.#queues.values()) {
      if (queueRuntime.state === QueueState.ACTIVE && queueRuntime.items.length === 0) {
        queueRuntime.state = QueueState.COMPLETED;
        this.#queues.set(queueRuntime.runId, this.#freezeQueueRuntime(queueRuntime));
        this.#publish('QueueCompleted', queueRuntime.runId, { runId: queueRuntime.runId });
      }
    }
  }

  #publish<TType extends 'QueueStarted' | 'WorkQueued' | 'WorkDequeued' | 'QueueCompleted' | 'QueueCancelled'>(
    type: TType,
    runId: string,
    payload: Record<string, unknown>,
  ): void {
    const metadata = this.#metadata(runId);
    const event: RuntimeEvent<TType> = {
      type,
      metadata,
      payload: {
        ...payload,
        metadata,
      },
      emittedAt: metadata.timestamp,
    } as RuntimeEvent<TType>;

    this.#eventBus.publish(event);
  }

  #metadata(runId: string): RuntimeMetadata {
    return {
      runId,
      workspaceId: 'execution',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  #freezeQueueRuntime(queueRuntime: QueueRuntime): QueueRuntime {
    return {
      runId: queueRuntime.runId,
      state: queueRuntime.state,
      items: [...queueRuntime.items],
      completedItemIds: new Set(queueRuntime.completedItemIds),
      cancelledReason: queueRuntime.cancelledReason,
    };
  }
}