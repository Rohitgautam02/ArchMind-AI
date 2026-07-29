import type { ComponentRegistry } from './component-registry.js';
import type { ComponentDescriptor } from './component-descriptor.js';
import {
  type CapabilityResolutionRequest,
  type CapabilityResolutionResult,
  CapabilityNotFoundError,
  resolveCapabilityCandidates,
  listCapabilityNames,
  type VersionConstraint,
} from './capability-resolution.js';

export interface CapabilityRegistryDependencies {
  readonly componentRegistry: ComponentRegistry;
}

export class CapabilityRegistry {
  readonly #componentRegistry: ComponentRegistry;

  constructor(dependencies: CapabilityRegistryDependencies) {
    this.#componentRegistry = dependencies.componentRegistry;
  }

  /** Resolve the highest-priority implementation for a capability. */
  resolve(capability: string, versionConstraint?: VersionConstraint): ComponentDescriptor {
    return this.#resolveInternal({ capability, versionConstraint }).selected;
  }

  /** Resolve all compatible implementations for a capability in deterministic order. */
  resolveAll(capability: string, versionConstraint?: VersionConstraint): readonly ComponentDescriptor[] {
    return this.#resolveInternal({ capability, versionConstraint }).candidates;
  }

  /** Check whether at least one implementation exists for the given capability. */
  has(capability: string): boolean {
    return this.#componentRegistry.discover(capability).length > 0;
  }

  /** List all known capabilities in deterministic order. */
  listCapabilities(): readonly string[] {
    return listCapabilityNames(this.#componentRegistry.list());
  }

  /** Clear transient resolution state. */
  clear(): void {
    return undefined;
  }

  /** Compatibility alias for the shared runtime contract. */
  request(capability: string, options?: { readonly version?: VersionConstraint }): ComponentDescriptor {
    return this.resolve(capability, options?.version);
  }

  /** Compatibility alias for the shared runtime contract. */
  list(capability?: string): readonly ComponentDescriptor[] {
    if (!capability) {
      return this.#componentRegistry.list();
    }

    return this.resolveAll(capability);
  }

  #resolveInternal(request: CapabilityResolutionRequest): CapabilityResolutionResult {
    const candidates = this.#componentRegistry.discover(request.capability);

    if (candidates.length === 0) {
      throw new CapabilityNotFoundError(request.capability, request.versionConstraint);
    }

    return resolveCapabilityCandidates(candidates, request);
  }
}