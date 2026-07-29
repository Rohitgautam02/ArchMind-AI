import type { EvidenceGraph } from '../runtime/graph/evidence-graph.js';
import type { EvidenceEdge, EvidenceNode, Provenance } from '../runtime/contracts.js';
import type { GraphUpdate } from '../runtime/graph/graph-update.js';
import type { Tool } from './tool-contract.js';
import type { ToolExecutionResult, ToolEvidenceDraft } from './tool-result.js';

export interface ToolExecutionRequest<TInput = unknown> {
  readonly name: string;
  readonly version?: string;
  readonly input: TInput;
  readonly evidenceGraph?: EvidenceGraph;
  readonly provenance?: Provenance;
}

export class ToolRegistry {
  #tools = new Map<string, Tool<unknown, unknown>>();
  #toolsByName = new Map<string, Map<string, Tool<unknown, unknown>>>();

  register<TInput, TOutput>(tool: Tool<TInput, TOutput>): void {
    const toolId = this.#toolId(tool.metadata.name, tool.metadata.version);

    if (this.#tools.has(toolId)) {
      throw new Error(`Tool ${tool.metadata.name} version ${tool.metadata.version} is already registered.`);
    }

    this.#tools.set(toolId, tool as Tool<unknown, unknown>);

    const versions = this.#toolsByName.get(tool.metadata.name) ?? new Map<string, Tool<unknown, unknown>>();
    versions.set(tool.metadata.version, tool as Tool<unknown, unknown>);
    this.#toolsByName.set(tool.metadata.name, versions);
  }

  unregister(toolId: string): void {
    const tool = this.#tools.get(toolId);

    if (!tool) {
      return;
    }

    this.#tools.delete(toolId);

    const versions = this.#toolsByName.get(tool.metadata.name);
    versions?.delete(tool.metadata.version);

    if (versions && versions.size === 0) {
      this.#toolsByName.delete(tool.metadata.name);
    }
  }

  discover(capability: string): readonly string[] {
    return [...this.#tools.values()]
      .filter((tool) => tool.metadata.capability === capability)
      .map((tool) => this.#toolId(tool.metadata.name, tool.metadata.version))
      .sort((left, right) => left.localeCompare(right));
  }

  resolve(name: string, version?: string): Tool<unknown, unknown> {
    const versions = this.#toolsByName.get(name);

    if (!versions || versions.size === 0) {
      throw new Error(`Tool ${name} is not registered.`);
    }

    if (version) {
      const exact = versions.get(version);
      if (!exact) {
        throw new Error(`Tool ${name} version ${version} is not registered.`);
      }

      return exact;
    }

    const orderedVersions = [...versions.entries()].sort((left, right) => this.#compareVersions(right[0], left[0]));
    return orderedVersions[0][1];
  }

  execute<TInput, TOutput>(request: ToolExecutionRequest<TInput>): ToolExecutionResult<TOutput> {
    const tool = this.resolve(request.name, request.version) as Tool<TInput, TOutput>;
    const validation = tool.validate(request.input);

    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    const result = tool.execute(request.input);

    if (request.evidenceGraph) {
      if (!request.provenance) {
        throw new Error(`Tool ${request.name} produced evidence but no provenance was provided.`);
      }

      this.#applyEvidence(request.evidenceGraph, result.evidence, request.provenance);
    }

    return result;
  }

  listCapabilities(): readonly string[] {
    return [...new Set([...this.#tools.values()].map((tool) => tool.metadata.capability))].sort((left, right) => left.localeCompare(right));
  }

  #applyEvidence(evidenceGraph: EvidenceGraph, evidence: ToolEvidenceDraft | undefined, provenance: Provenance): void {
    if (!evidence) {
      return;
    }

    const update: GraphUpdate = {
      provenance,
      nodes: evidence.nodes?.map((node) => this.#attachProvenanceToNode(node, provenance)),
      edges: evidence.edges?.map((edge) => this.#attachProvenanceToEdge(edge, provenance)),
    };

    evidenceGraph.apply(update);
  }

  #attachProvenanceToNode(node: any, provenance: Provenance): EvidenceNode {
    return Object.freeze({
      ...node,
      provenance: [provenance],
    });
  }

  #attachProvenanceToEdge(edge: any, provenance: Provenance): EvidenceEdge {
    return Object.freeze({
      ...edge,
      provenance: [provenance],
    });
  }

  #toolId(name: string, version: string): string {
    return `${name}@${version}`;
  }

  #compareVersions(left: string, right: string): number {
    const leftParts = this.#parseVersion(left);
    const rightParts = this.#parseVersion(right);

    if (leftParts && rightParts) {
      return this.#compareVersionParts(leftParts, rightParts);
    }

    return left.localeCompare(right);
  }

  #compareVersionParts(left: readonly number[], right: readonly number[]): number {
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
      const leftValue = left[index] ?? 0;
      const rightValue = right[index] ?? 0;

      if (leftValue !== rightValue) {
        return leftValue - rightValue;
      }
    }

    return 0;
  }

  #parseVersion(version: string): readonly number[] | undefined {
    const parts = version.split('.').map((part) => Number.parseInt(part, 10));
    return parts.every((part) => Number.isFinite(part)) ? parts : undefined;
  }
}