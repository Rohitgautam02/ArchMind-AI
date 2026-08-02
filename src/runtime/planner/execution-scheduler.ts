import type { WorkItem } from './work-item.js';
import type { ComponentDescriptor } from '../registry/component-descriptor.js';
import type { GraphSnapshot } from '../graph/graph-snapshot.js';

export class ExecutionScheduler {
  /**
   * Schedules a capability into a formatted WorkItem.
   */
  schedule(
    capabilityName: string,
    implementation: ComponentDescriptor,
    graphSnapshot: GraphSnapshot
  ): WorkItem {
    return Object.freeze({
      id: `work-item-${capabilityName.toLowerCase()}-${graphSnapshot.runId}`,
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
