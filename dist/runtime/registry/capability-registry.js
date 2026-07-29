import { CapabilityNotFoundError, resolveCapabilityCandidates, listCapabilityNames, } from './capability-resolution.js';
export class CapabilityRegistry {
    #componentRegistry;
    constructor(dependencies) {
        this.#componentRegistry = dependencies.componentRegistry;
    }
    /** Resolve the highest-priority implementation for a capability. */
    resolve(capability, versionConstraint) {
        return this.#resolveInternal({ capability, versionConstraint }).selected;
    }
    /** Resolve all compatible implementations for a capability in deterministic order. */
    resolveAll(capability, versionConstraint) {
        return this.#resolveInternal({ capability, versionConstraint }).candidates;
    }
    /** Check whether at least one implementation exists for the given capability. */
    has(capability) {
        return this.#componentRegistry.discover(capability).length > 0;
    }
    /** List all known capabilities in deterministic order. */
    listCapabilities() {
        return listCapabilityNames(this.#componentRegistry.list());
    }
    /** Clear transient resolution state. */
    clear() {
        return undefined;
    }
    /** Compatibility alias for the shared runtime contract. */
    request(capability, options) {
        return this.resolve(capability, options?.version);
    }
    /** Compatibility alias for the shared runtime contract. */
    list(capability) {
        if (!capability) {
            return this.#componentRegistry.list();
        }
        return this.resolveAll(capability);
    }
    #resolveInternal(request) {
        const candidates = this.#componentRegistry.discover(request.capability);
        if (candidates.length === 0) {
            throw new CapabilityNotFoundError(request.capability, request.versionConstraint);
        }
        return resolveCapabilityCandidates(candidates, request);
    }
}
