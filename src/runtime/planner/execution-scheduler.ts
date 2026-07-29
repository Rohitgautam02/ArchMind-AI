import type { WorkItem } from './work-item.js';
import type { AbstractComponent } from '../registry/abstract-component.js';
import type { GraphSnapshot } from '../contracts.js';

export class ExecutionScheduler {
  /**
   * Schedules a capability into a formatted WorkItem.
   */
  schedule(
    capabilityName: string,
    implementation: AbstractComponent,
    graphSnapshot: GraphSnapshot
  ): WorkItem {
    return Object.freeze({
      id: `work-item-${capabilityName.toLowerCase()}-${Date.now()}`,
      capability: capabilityName,
      priority: 'Normal', // Defaults to normal, could be derived from rules
      dependencies: Object.freeze([] as string[]),
      metadata: Object.freeze({
        graphNodeCount: graphSnapshot.nodes.length,
        graphEdgeCount: graphSnapshot.edges.length,
        selectedImplementationId: implementation.id,
      }),
    });
  }
}
