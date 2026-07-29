import type { ComponentDescriptor, ComponentDescriptorInput } from './component-descriptor.js';

export class ComponentRegistry {
  #components = new Map<string, ComponentDescriptor>();
  #capabilities = new Map<string, Set<string>>();

  register(component: ComponentDescriptorInput): void {
    if (this.#components.has(component.id)) {
      throw new Error(`Duplicate component registration: ${component.id}`);
    }

    const descriptor = this.#freezeDescriptor(component);
    this.#components.set(descriptor.id, descriptor);

    const capabilityIds = this.#capabilities.get(descriptor.capability) ?? new Set<string>();
    capabilityIds.add(descriptor.id);
    this.#capabilities.set(descriptor.capability, capabilityIds);
  }

  unregister(id: string): void {
    const descriptor = this.#components.get(id);

    if (!descriptor) {
      return;
    }

    this.#components.delete(id);

    const capabilityIds = this.#capabilities.get(descriptor.capability);

    if (!capabilityIds) {
      return;
    }

    capabilityIds.delete(id);

    if (capabilityIds.size === 0) {
      this.#capabilities.delete(descriptor.capability);
    }
  }

  resolve(id: string): ComponentDescriptor | undefined {
    const exactMatch = this.#components.get(id);

    if (exactMatch) {
      return this.#cloneDescriptor(exactMatch);
    }

    const candidates = this.discover(id);

    return candidates[0];
  }

  discover(capability: string): readonly ComponentDescriptor[] {
    const ids = this.#capabilities.get(capability);

    if (!ids) {
      return [];
    }

    const descriptors = [...ids]
      .map((componentId) => this.#components.get(componentId))
      .filter((descriptor): descriptor is ComponentDescriptor => Boolean(descriptor))
      .sort((left, right) => this.#compareDescriptors(left, right))
      .map((descriptor) => this.#cloneDescriptor(descriptor));

    return descriptors;
  }

  list(): readonly ComponentDescriptor[] {
    return [...this.#components.values()]
      .sort((left, right) => this.#compareDescriptors(left, right))
      .map((descriptor) => this.#cloneDescriptor(descriptor));
  }

  has(id: string): boolean {
    return this.#components.has(id);
  }

  clear(): void {
    this.#components.clear();
    this.#capabilities.clear();
  }

  #freezeDescriptor(component: ComponentDescriptorInput): ComponentDescriptor {
    return Object.freeze({
      id: component.id,
      capability: component.capability,
      version: component.version,
      priority: component.priority,
      implementation: component.implementation,
      metadata: Object.freeze({ ...(component.metadata ?? {}) }),
    });
  }

  #cloneDescriptor(descriptor: ComponentDescriptor): ComponentDescriptor {
    return Object.freeze({
      id: descriptor.id,
      capability: descriptor.capability,
      version: descriptor.version,
      priority: descriptor.priority,
      implementation: descriptor.implementation,
      metadata: Object.freeze({ ...descriptor.metadata }),
    });
  }

  #compareDescriptors(left: ComponentDescriptor, right: ComponentDescriptor): number {
    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }

    const versionComparison = right.version.localeCompare(left.version);

    if (versionComparison !== 0) {
      return versionComparison;
    }

    return left.id.localeCompare(right.id);
  }
}