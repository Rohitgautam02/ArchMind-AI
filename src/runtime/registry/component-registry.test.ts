import { describe, expect, it } from 'vitest';
import { ComponentRegistry } from './component-registry.js';
import type { ComponentDescriptorInput } from './component-descriptor.js';

const createComponent = (overrides: Partial<ComponentDescriptorInput> = {}): ComponentDescriptorInput => ({
  id: overrides.id ?? 'component-1',
  capability: overrides.capability ?? 'architecture',
  version: overrides.version ?? '1.0.0',
  priority: overrides.priority ?? 10,
  implementation: overrides.implementation ?? (() => undefined),
  metadata: overrides.metadata ?? { label: 'test' },
});

describe('ComponentRegistry', () => {
  it('register component', () => {
    const registry = new ComponentRegistry();

    registry.register(createComponent());

    expect(registry.has('component-1')).toBe(true);
  });

  it('duplicate registration rejected', () => {
    const registry = new ComponentRegistry();

    registry.register(createComponent());

    expect(() => registry.register(createComponent())).toThrow('Duplicate component registration: component-1');
  });

  it('unregister component', () => {
    const registry = new ComponentRegistry();

    registry.register(createComponent());
    registry.unregister('component-1');

    expect(registry.has('component-1')).toBe(false);
  });

  it('resolve by id', () => {
    const registry = new ComponentRegistry();

    registry.register(createComponent({ id: 'component-1' }));

    expect(registry.resolve('component-1')?.id).toBe('component-1');
  });

  it('discover by capability', () => {
    const registry = new ComponentRegistry();

    registry.register(createComponent({ id: 'component-1', capability: 'planner' }));
    registry.register(createComponent({ id: 'component-2', capability: 'security' }));

    expect(registry.discover('planner')).toHaveLength(1);
    expect(registry.discover('planner')[0]?.id).toBe('component-1');
  });

  it('priority ordering', () => {
    const registry = new ComponentRegistry();

    registry.register(createComponent({ id: 'component-low', capability: 'planner', priority: 5 }));
    registry.register(createComponent({ id: 'component-high', capability: 'planner', priority: 20 }));

    expect(registry.discover('planner').map((component) => component.id)).toEqual(['component-high', 'component-low']);
    expect(registry.resolve('planner')?.id).toBe('component-high');
  });

  it('fallback candidates', () => {
    const registry = new ComponentRegistry();

    registry.register(createComponent({ id: 'component-primary', capability: 'report', priority: 30 }));
    registry.register(createComponent({ id: 'component-fallback', capability: 'report', priority: 10 }));

    expect(registry.discover('report').map((component) => component.id)).toEqual(['component-primary', 'component-fallback']);
    expect(registry.resolve('report')?.id).toBe('component-primary');
  });

  it('clear registry', () => {
    const registry = new ComponentRegistry();

    registry.register(createComponent());
    registry.clear();

    expect(registry.list()).toEqual([]);
    expect(registry.has('component-1')).toBe(false);
  });

  it('list registered components', () => {
    const registry = new ComponentRegistry();

    registry.register(createComponent({ id: 'component-b', capability: 'planner', priority: 5 }));
    registry.register(createComponent({ id: 'component-a', capability: 'planner', priority: 15 }));
    registry.register(createComponent({ id: 'component-c', capability: 'security', priority: 1 }));

    expect(registry.list().map((component) => component.id)).toEqual(['component-a', 'component-b', 'component-c']);
  });
});