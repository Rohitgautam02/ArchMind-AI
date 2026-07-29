import { describe, expect, it } from 'vitest';
import { ComponentRegistry } from './component-registry.js';
import type { ComponentDescriptorInput } from './component-descriptor.js';
import { CapabilityRegistry } from './capability-registry.js';

const createComponent = (overrides: Partial<ComponentDescriptorInput> = {}): ComponentDescriptorInput => ({
  id: overrides.id ?? 'component-1',
  capability: overrides.capability ?? 'planner',
  version: overrides.version ?? '1.0.0',
  priority: overrides.priority ?? 10,
  implementation: overrides.implementation ?? (() => undefined),
  metadata: overrides.metadata ?? { label: 'test' },
});

describe('CapabilityRegistry', () => {
  it('resolve single implementation', () => {
    const componentRegistry = new ComponentRegistry();
    componentRegistry.register(createComponent({ id: 'planner-1', capability: 'planner', priority: 10 }));

    const capabilityRegistry = new CapabilityRegistry({ componentRegistry });

    expect(capabilityRegistry.resolve('planner').id).toBe('planner-1');
  });

  it('resolve highest priority implementation', () => {
    const componentRegistry = new ComponentRegistry();
    componentRegistry.register(createComponent({ id: 'planner-low', capability: 'planner', priority: 1 }));
    componentRegistry.register(createComponent({ id: 'planner-high', capability: 'planner', priority: 10 }));

    const capabilityRegistry = new CapabilityRegistry({ componentRegistry });

    expect(capabilityRegistry.resolve('planner').id).toBe('planner-high');
  });

  it('resolve specific version', () => {
    const componentRegistry = new ComponentRegistry();
    componentRegistry.register(createComponent({ id: 'planner-1', capability: 'planner', version: '1.2.0', priority: 5 }));
    componentRegistry.register(createComponent({ id: 'planner-2', capability: 'planner', version: '2.0.0', priority: 10 }));

    const capabilityRegistry = new CapabilityRegistry({ componentRegistry });

    expect(capabilityRegistry.resolve('planner', '=1.2.0').id).toBe('planner-1');
  });

  it('version mismatch', () => {
    const componentRegistry = new ComponentRegistry();
    componentRegistry.register(createComponent({ id: 'planner-1', capability: 'planner', version: '1.2.0', priority: 5 }));

    const capabilityRegistry = new CapabilityRegistry({ componentRegistry });

    expect(() => capabilityRegistry.resolve('planner', '=2.0.0')).toThrow("No matching capability found for 'planner' with version constraint '=2.0.0'");
  });

  it('fallback selection', () => {
    const componentRegistry = new ComponentRegistry();
    componentRegistry.register(createComponent({ id: 'planner-primary', capability: 'planner', version: '2.0.0', priority: 20 }));
    componentRegistry.register(createComponent({ id: 'planner-fallback', capability: 'planner', version: '1.2.0', priority: 10 }));

    const capabilityRegistry = new CapabilityRegistry({ componentRegistry });

    expect(capabilityRegistry.resolve('planner', '=1.2.0').id).toBe('planner-fallback');
    expect(capabilityRegistry.resolveAll('planner', '=1.2.0').map((component) => component.id)).toEqual(['planner-fallback']);
  });

  it('no matching capability', () => {
    const capabilityRegistry = new CapabilityRegistry({ componentRegistry: new ComponentRegistry() });

    expect(() => capabilityRegistry.resolve('planner')).toThrow("No matching capability found for 'planner'");
  });

  it('ambiguous resolution rejected', () => {
    const componentRegistry = new ComponentRegistry();
    componentRegistry.register(createComponent({ id: 'planner-a', capability: 'planner', version: '1.0.0', priority: 10 }));
    componentRegistry.register(createComponent({ id: 'planner-b', capability: 'planner', version: '2.0.0', priority: 10 }));

    const capabilityRegistry = new CapabilityRegistry({ componentRegistry });

    expect(() => capabilityRegistry.resolve('planner')).toThrow("Ambiguous capability resolution for 'planner'");
  });

  it('deterministic ordering', () => {
    const componentRegistry = new ComponentRegistry();
    componentRegistry.register(createComponent({ id: 'planner-b', capability: 'planner', version: '1.0.0', priority: 5 }));
    componentRegistry.register(createComponent({ id: 'planner-a', capability: 'planner', version: '2.0.0', priority: 10 }));
    componentRegistry.register(createComponent({ id: 'planner-c', capability: 'planner', version: '0.9.0', priority: 1 }));

    const capabilityRegistry = new CapabilityRegistry({ componentRegistry });

    expect(capabilityRegistry.resolveAll('planner').map((component) => component.id)).toEqual(['planner-a', 'planner-b', 'planner-c']);
  });

  it('list capabilities', () => {
    const componentRegistry = new ComponentRegistry();
    componentRegistry.register(createComponent({ id: 'planner-1', capability: 'planner' }));
    componentRegistry.register(createComponent({ id: 'security-1', capability: 'security' }));

    const capabilityRegistry = new CapabilityRegistry({ componentRegistry });

    expect(capabilityRegistry.listCapabilities()).toEqual(['planner', 'security']);
  });

  it('clear registry', () => {
    const componentRegistry = new ComponentRegistry();
    componentRegistry.register(createComponent({ id: 'planner-1', capability: 'planner' }));

    const capabilityRegistry = new CapabilityRegistry({ componentRegistry });

    capabilityRegistry.clear();

    expect(capabilityRegistry.resolve('planner').id).toBe('planner-1');
  });
});