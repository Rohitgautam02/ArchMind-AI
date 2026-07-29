import { describe, expect, it } from 'vitest';
import { DependencyInjector } from './dependency-injector.js';
import type { RuntimeContext } from '../contracts.js';

describe('DependencyInjector', () => {
  it('registers and resolves dependencies', () => {
    const injector = new DependencyInjector();
    const mockDependency = { foo: 'bar' };

    injector.register('MockDep', mockDependency);
    const resolved = injector.resolve<typeof mockDependency>('MockDep');

    expect(resolved).toBe(mockDependency);
    expect(resolved.foo).toBe('bar');
  });

  it('throws when resolving unknown dependency', () => {
    const injector = new DependencyInjector();

    expect(() => injector.resolve('Unknown')).toThrow(/Dependency not found/);
  });

  it('throws when registering duplicate dependency', () => {
    const injector = new DependencyInjector();
    injector.register('Dep', 1);

    expect(() => injector.register('Dep', 2)).toThrow(/already registered/);
  });

  it('creates a topological boot plan from context', () => {
    const injector = new DependencyInjector();
    const mockContext = {} as RuntimeContext; // The plan logic doesn't deeply read the context right now

    const plan = injector.createPlan(mockContext);

    expect(plan.graph.root).toBe('RuntimeContext');
    expect(plan.bootOrder).toContain('RuntimeContext');
    expect(plan.bootOrder).toContain('EventBus');

    // CapabilityRegistry depends on ComponentRegistry, so ComponentRegistry should come first
    const componentRegistryIndex = plan.bootOrder.indexOf('ComponentRegistry');
    const capabilityRegistryIndex = plan.bootOrder.indexOf('CapabilityRegistry');
    expect(componentRegistryIndex).toBeLessThan(capabilityRegistryIndex);

    // StateMachine depends on EventBus, so EventBus should come first
    const eventBusIndex = plan.bootOrder.indexOf('EventBus');
    const stateMachineIndex = plan.bootOrder.indexOf('StateMachine');
    expect(eventBusIndex).toBeLessThan(stateMachineIndex);
  });
});
