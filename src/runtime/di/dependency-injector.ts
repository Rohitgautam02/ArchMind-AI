import type {
  DependencyInjectionGraph,
  DependencyInjectionNode,
  DependencyInjectionPlan,
  DependencyInjector as DependencyInjectorContract,
  RegisteredComponentKind,
  RuntimeContext
} from '../contracts.js';

export class DependencyInjector implements DependencyInjectorContract {
  readonly #registry = new Map<string, unknown>();

  resolve<T>(token: string): T {
    if (!this.#registry.has(token)) {
      throw new Error(`Dependency not found for token: ${token}`);
    }

    return this.#registry.get(token) as T;
  }

  register<T>(token: string, value: T): void {
    if (this.#registry.has(token)) {
      throw new Error(`Dependency already registered for token: ${token}`);
    }

    this.#registry.set(token, value);
  }

  createPlan(context: RuntimeContext): DependencyInjectionPlan {
    const nodes: DependencyInjectionNode[] = [];

    // The runtime context itself acts as the root of the dependency graph.
    // In a full implementation, this would introspect registered components
    // and extract their declared dependencies. For now, it maps the provided context.
    
    nodes.push({
      id: 'RuntimeContext',
      kind: 'runtime',
      dependencies: ['RuntimeConfig', 'EventBus', 'EvidenceGraph', 'Providers', 'Tools', 'Policies', 'Memory', 'ComponentRegistry', 'CapabilityRegistry', 'StateMachine', 'Logger'],
    });

    nodes.push({ id: 'RuntimeConfig', kind: 'runtime', dependencies: [] });
    nodes.push({ id: 'EventBus', kind: 'runtime', dependencies: [] });
    nodes.push({ id: 'EvidenceGraph', kind: 'runtime', dependencies: [] });
    nodes.push({ id: 'Logger', kind: 'runtime', dependencies: ['EventBus'] });
    nodes.push({ id: 'Providers', kind: 'provider', dependencies: ['RuntimeConfig'] });
    nodes.push({ id: 'Tools', kind: 'tool', dependencies: [] });
    nodes.push({ id: 'Policies', kind: 'policy', dependencies: [] });
    nodes.push({ id: 'Memory', kind: 'memory', dependencies: [] });
    nodes.push({ id: 'ComponentRegistry', kind: 'runtime', dependencies: [] });
    nodes.push({ id: 'CapabilityRegistry', kind: 'runtime', dependencies: ['ComponentRegistry'] });
    nodes.push({ id: 'StateMachine', kind: 'state', dependencies: ['EventBus'] });

    const graph: DependencyInjectionGraph = {
      root: 'RuntimeContext',
      nodes: Object.freeze(nodes),
    };

    const bootOrder = this.#topologicalSort(nodes);

    return {
      graph,
      bootOrder: Object.freeze(bootOrder),
    };
  }

  #topologicalSort(nodes: readonly DependencyInjectionNode[]): readonly string[] {
    const ordered: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const nodeMap = new Map<string, DependencyInjectionNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) {
        return;
      }

      if (visiting.has(nodeId)) {
        throw new Error(`Circular dependency detected involving: ${nodeId}`);
      }

      visiting.add(nodeId);

      const node = nodeMap.get(nodeId);
      if (node) {
        for (const dep of node.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      ordered.push(nodeId);
    };

    for (const node of nodes) {
      visit(node.id);
    }

    return ordered;
  }
}
