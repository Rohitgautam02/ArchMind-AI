import { describe, expect, it, vi } from 'vitest';
import type { RuntimeMetadata } from '../contracts.js';
import { EventBus } from './event-bus.js';
import type { RuntimeEvent } from './runtime-event.js';

const createMetadata = (runId: string): RuntimeMetadata => ({
  runId,
  workspaceId: 'workspace-1',
  timestamp: '2026-07-28T00:00:00.000Z',
  version: '1.0.0',
});

const createEvent = <TType extends RuntimeEvent['type']>(
  type: TType,
  runId: string,
  payload: RuntimeEvent<TType>['payload'],
): RuntimeEvent<TType> => ({
  type,
  metadata: createMetadata(runId),
  payload,
  emittedAt: '2026-07-28T00:00:00.000Z',
});

describe('EventBus', () => {
  it('publishes events', () => {
    const bus = new EventBus();
    const event = createEvent('RunStarted', 'run-1', { metadata: createMetadata('run-1') });

    bus.publish(event);

    expect(bus.history()).toEqual([event]);
  });

  it('subscribers receive events', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.subscribe('RunStarted', handler);
    bus.publish(createEvent('RunStarted', 'run-1', { metadata: createMetadata('run-1') }));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('preserves ordering', () => {
    const bus = new EventBus();

    bus.publish(createEvent('RunStarted', 'run-1', { metadata: createMetadata('run-1') }));
    bus.publish(createEvent('RunCompleted', 'run-1', { metadata: createMetadata('run-1') }));

    expect(bus.history().map((event) => event.type)).toEqual(['RunStarted', 'RunCompleted']);
  });

  it('unsubscribe removes handler', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.subscribe('RunStarted', handler);
    bus.unsubscribe('RunStarted', handler);
    bus.publish(createEvent('RunStarted', 'run-1', { metadata: createMetadata('run-1') }));

    expect(handler).not.toHaveBeenCalled();
  });

  it('replay returns ordered events', async () => {
    const bus = new EventBus();

    bus.publish(createEvent('RunStarted', 'run-1', { metadata: createMetadata('run-1') }));
    bus.publish(createEvent('PlannerStarted', 'run-1', { metadata: createMetadata('run-1') }));

    const events = [] as RuntimeEvent[];

    for await (const event of bus.replay('run-1')) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual(['RunStarted', 'PlannerStarted']);
  });

  it('history returns complete stream', () => {
    const bus = new EventBus();

    bus.publish(createEvent('RunStarted', 'run-1', { metadata: createMetadata('run-1') }));
    bus.publish(createEvent('RunCompleted', 'run-2', { metadata: createMetadata('run-2') }));

    expect(bus.history()).toHaveLength(2);
  });

  it('clear removes stored events', () => {
    const bus = new EventBus();

    bus.publish(createEvent('RunStarted', 'run-1', { metadata: createMetadata('run-1') }));
    bus.clear();

    expect(bus.history()).toEqual([]);
  });

  it('handler exception does not stop dispatch to remaining handlers', () => {
    const bus = new EventBus();
    const failingHandler = vi.fn(() => {
      throw new Error('boom');
    });
    const succeedingHandler = vi.fn();

    bus.subscribe('RunStarted', failingHandler);
    bus.subscribe('RunStarted', succeedingHandler);

    expect(() => bus.publish(createEvent('RunStarted', 'run-1', { metadata: createMetadata('run-1') }))).not.toThrow();
    expect(succeedingHandler).toHaveBeenCalledTimes(1);
  });

  it('multiple handlers execute', () => {
    const bus = new EventBus();
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    bus.subscribe('RunStarted', firstHandler);
    bus.subscribe('RunStarted', secondHandler);

    bus.publish(createEvent('RunStarted', 'run-1', { metadata: createMetadata('run-1') }));

    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).toHaveBeenCalledTimes(1);
  });

  it('unknown event types are handled safely', () => {
    const bus = new EventBus();
    const unknownEvent = {
      type: 'UnknownEvent',
      metadata: createMetadata('run-1'),
      payload: {},
      emittedAt: '2026-07-28T00:00:00.000Z',
    } as RuntimeEvent;

    expect(() => bus.publish(unknownEvent)).not.toThrow();
    expect(bus.history()).toHaveLength(1);
  });

  it('replay only returns events for the matching run', async () => {
    const bus = new EventBus();

    bus.publish(createEvent('RunStarted', 'run-1', { metadata: createMetadata('run-1') }));
    bus.publish(createEvent('RunStarted', 'run-2', { metadata: createMetadata('run-2') }));

    const events = [] as RuntimeEvent[];

    for await (const event of bus.replay('run-1')) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]?.metadata.runId).toBe('run-1');
  });
});