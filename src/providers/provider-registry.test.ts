import { describe, expect, it } from 'vitest';
import { ProviderRegistry } from './provider-registry.js';
import type { ProviderAdapter, ProviderHealth, ProviderRequest, ProviderResponse } from './provider-contract.js';

class MockProvider implements ProviderAdapter {
  constructor(public readonly name: string) {}
  readonly defaultModel = 'mock';
  readonly supportedModels = ['mock'];
  
  async checkHealth(): Promise<ProviderHealth> {
    return { isHealthy: true, details: 'ok' };
  }
  
  async invoke<T>(request: ProviderRequest): Promise<ProviderResponse<T>> {
    return {} as ProviderResponse<T>;
  }
}

describe('ProviderRegistry', () => {
  it('registers and resolves providers', () => {
    const registry = new ProviderRegistry();
    const provider1 = new MockProvider('mock1');
    const provider2 = new MockProvider('mock2');

    registry.register(provider1);
    registry.register(provider2);

    expect(registry.list()).toEqual(['mock1', 'mock2']);
    expect(registry.resolve('mock1')).toBe(provider1);
  });

  it('sets the first registered provider as default', () => {
    const registry = new ProviderRegistry();
    const provider1 = new MockProvider('mock1');
    const provider2 = new MockProvider('mock2');

    registry.register(provider1);
    registry.register(provider2);

    expect(registry.resolve()).toBe(provider1);
  });

  it('allows explicit default registration', () => {
    const registry = new ProviderRegistry();
    const provider1 = new MockProvider('mock1');
    const provider2 = new MockProvider('mock2');

    registry.register(provider1);
    registry.register(provider2, true);

    expect(registry.resolve()).toBe(provider2);
  });

  it('throws on duplicate registration', () => {
    const registry = new ProviderRegistry();
    registry.register(new MockProvider('mock'));

    expect(() => registry.register(new MockProvider('mock'))).toThrow(/already registered/);
  });

  it('throws when resolving unknown provider', () => {
    const registry = new ProviderRegistry();

    expect(() => registry.resolve('unknown')).toThrow(/not registered/);
  });

  it('throws when resolving empty registry', () => {
    const registry = new ProviderRegistry();

    expect(() => registry.resolve()).toThrow(/No providers registered/);
  });
});
