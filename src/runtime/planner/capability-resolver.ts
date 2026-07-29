import type { CapabilityRegistry } from '../registry/capability-registry.js';
import type { AbstractComponent } from '../registry/abstract-component.js';

export class CapabilityResolver {
  readonly #capabilityRegistry: CapabilityRegistry;

  constructor(capabilityRegistry: CapabilityRegistry) {
    this.#capabilityRegistry = capabilityRegistry;
  }

  /**
   * Resolves an abstract capability to the best available implementation.
   */
  resolve(capabilityName: string): AbstractComponent | undefined {
    if (!this.#capabilityRegistry.has(capabilityName)) {
      return undefined;
    }

    const candidates = this.#capabilityRegistry.resolveAll(capabilityName);
    
    if (candidates.length === 0) {
      return undefined;
    }

    // Sort by version (highest version first)
    const sorted = [...candidates].sort((a, b) => this.#compareSemVer(b.version, a.version));

    // In a future update, we would check provider health/availability here.
    return sorted[0];
  }

  /**
   * Basic semantic version comparison.
   * Returns positive if v1 > v2, negative if v1 < v2, 0 if equal.
   */
  #compareSemVer(v1: string, v2: string): number {
    const p1 = v1.split('-')[0].split('.').map(Number);
    const p2 = v2.split('-')[0].split('.').map(Number);
    
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const num1 = p1[i] || 0;
      const num2 = p2[i] || 0;
      if (num1 !== num2) {
        return num1 - num2;
      }
    }
    
    // Prerelease handling (e.g. 1.0.0-beta < 1.0.0)
    const hasPre1 = v1.includes('-');
    const hasPre2 = v2.includes('-');
    if (hasPre1 && !hasPre2) return -1;
    if (!hasPre1 && hasPre2) return 1;
    
    return 0;
  }
}
