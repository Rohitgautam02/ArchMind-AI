import type { Confidence, Provenance } from '../contracts.js';
import type { EvidenceEdge } from './evidence-edge.js';
import type { EvidenceNode } from './evidence-node.js';
import type { EvidenceConflict, GraphUpdate } from './graph-update.js';
import type { GraphSnapshot } from './graph-snapshot.js';

const confidenceSourcePriority: Record<Confidence['source'], number> = {
  tool: 3,
  provider: 2,
  derived: 1,
  reviewer: 4,
};

export class EvidenceGraph {
  #nodes = new Map<string, EvidenceNode>();
  #edges = new Map<string, EvidenceEdge>();
  #derivedFacts = new Map<string, GraphSnapshot['derivedFacts'][number]>();
  #conflicts = new Map<string, EvidenceConflict>();
  #hypotheses = new Map<string, GraphSnapshot['hypotheses'][number]>();
  #provenance: readonly Provenance[] = [];

  apply(update: GraphUpdate): void {
    this.#provenance = this.#mergeProvenance(this.#provenance, [update.provenance]);

    for (const node of update.nodes ?? []) {
      this.#upsertNode(node);
    }

    for (const edge of update.edges ?? []) {
      this.#upsertEdge(edge);
    }

    for (const derivedFact of update.derivedFacts ?? []) {
      this.#derivedFacts.set(derivedFact.id, this.#clone(derivedFact));
    }

    for (const conflict of update.conflicts ?? []) {
      this.#conflicts.set(conflict.id, this.#clone(conflict));
    }

    for (const hypothesis of update.hypotheses ?? []) {
      this.#hypotheses.set(hypothesis.id, this.#clone(hypothesis));
    }
  }

  snapshot(runId: string): GraphSnapshot {
    return {
      runId,
      nodes: this.listNodes(),
      edges: this.listEdges(),
      derivedFacts: [...this.#derivedFacts.values()].sort((left, right) => left.id.localeCompare(right.id)),
      conflicts: [...this.#conflicts.values()].sort((left, right) => left.id.localeCompare(right.id)),
      hypotheses: [...this.#hypotheses.values()].sort((left, right) => left.id.localeCompare(right.id)),
      provenance: [...this.#provenance],
      createdAt: new Date().toISOString(),
    };
  }

  merge(snapshot: GraphSnapshot): void {
    this.#provenance = this.#mergeProvenance(this.#provenance, snapshot.provenance);

    for (const node of snapshot.nodes) {
      this.#upsertNode(node);
    }

    for (const edge of snapshot.edges) {
      this.#upsertEdge(edge);
    }

    for (const derivedFact of snapshot.derivedFacts) {
      this.#derivedFacts.set(derivedFact.id, this.#clone(derivedFact));
    }

    for (const conflict of snapshot.conflicts) {
      this.#conflicts.set(conflict.id, this.#clone(conflict));
    }

    for (const hypothesis of snapshot.hypotheses) {
      this.#hypotheses.set(hypothesis.id, this.#clone(hypothesis));
    }
  }

  // Graph Query API

  findByKind(kind: string): EvidenceNode[] {
    return this.listNodes().filter((n) => n.kind === kind || n.kind.startsWith(`${kind}:`));
  }

  findByRelation(relation: string): EvidenceEdge[] {
    return this.listEdges().filter((e) => e.relation === relation);
  }

  findIncoming(nodeId: string, relation?: string): EvidenceEdge[] {
    return this.listEdges().filter((e) => e.to === nodeId && (!relation || e.relation === relation));
  }

  findOutgoing(nodeId: string, relation?: string): EvidenceEdge[] {
    return this.listEdges().filter((e) => e.from === nodeId && (!relation || e.relation === relation));
  }

  findNeighbours(nodeId: string, relation?: string): EvidenceNode[] {
    const outgoingIds = this.findOutgoing(nodeId, relation).map((e) => e.to);
    const incomingIds = this.findIncoming(nodeId, relation).map((e) => e.from);
    const neighbourIds = new Set([...outgoingIds, ...incomingIds]);

    return this.listNodes().filter((n) => neighbourIds.has(n.id));
  }

  getNode(id: string): EvidenceNode | undefined {
    const node = this.#nodes.get(id);
    return node ? this.#clone(node) : undefined;
  }

  getEdge(id: string): EvidenceEdge | undefined {
    const edge = this.#edges.get(id);
    return edge ? this.#clone(edge) : undefined;
  }

  listNodes(): readonly EvidenceNode[] {
    return [...this.#nodes.values()].sort((left, right) => left.id.localeCompare(right.id)).map((node) => this.#clone(node));
  }

  listEdges(): readonly EvidenceEdge[] {
    return [...this.#edges.values()].sort((left, right) => left.id.localeCompare(right.id)).map((edge) => this.#clone(edge));
  }

  listConflicts(): readonly EvidenceConflict[] {
    return [...this.#conflicts.values()].sort((left, right) => left.id.localeCompare(right.id)).map((conflict) => this.#clone(conflict));
  }

  clear(): void {
    this.#nodes.clear();
    this.#edges.clear();
    this.#derivedFacts.clear();
    this.#conflicts.clear();
    this.#hypotheses.clear();
    this.#provenance = [];
  }

  #upsertNode(incoming: EvidenceNode): void {
    const existing = this.#nodes.get(incoming.id);

    if (!existing) {
      this.#nodes.set(incoming.id, this.#clone(incoming));
      return;
    }

    const mergedProvenance = this.#mergeProvenance(existing.provenance, incoming.provenance);
    const mergedConfidence = this.#mergeConfidence(existing.confidence, incoming.confidence, incoming.id);
    const hasConflict = this.#hasConflict(existing, incoming);

    if (hasConflict) {
      this.#recordConflict('node', existing.id, existing.id, incoming.id, existing.provenance, incoming.provenance, 'Conflicting node update detected');
    }

    const nextNode = mergedConfidence.keepIncoming
      ? { ...this.#clone(incoming), confidence: mergedConfidence.confidence, provenance: mergedProvenance }
      : { ...this.#clone(existing), confidence: mergedConfidence.confidence, provenance: mergedProvenance };

    this.#nodes.set(existing.id, nextNode);
  }

  #upsertEdge(incoming: EvidenceEdge): void {
    const existing = this.#edges.get(incoming.id);

    if (!existing) {
      this.#edges.set(incoming.id, this.#clone(incoming));
      return;
    }

    const mergedProvenance = this.#mergeProvenance(existing.provenance, incoming.provenance);
    const mergedConfidence = this.#mergeConfidence(existing.confidence, incoming.confidence, incoming.id);
    const hasConflict = this.#hasConflict(existing, incoming);

    if (hasConflict) {
      this.#recordConflict('edge', existing.id, existing.id, incoming.id, existing.provenance, incoming.provenance, 'Conflicting edge update detected');
    }

    const nextEdge = mergedConfidence.keepIncoming
      ? { ...this.#clone(incoming), confidence: mergedConfidence.confidence, provenance: mergedProvenance }
      : { ...this.#clone(existing), confidence: mergedConfidence.confidence, provenance: mergedProvenance };

    this.#edges.set(existing.id, nextEdge);
  }

  #recordConflict(
    subjectType: 'node' | 'edge',
    subjectId: string,
    existingId: string,
    incomingId: string,
    existingProvenance: readonly Provenance[],
    incomingProvenance: readonly Provenance[],
    summary: string,
  ): void {
    const conflictId = `${subjectType}:${subjectId}:${existingId}:${incomingId}`;

    this.#conflicts.set(conflictId, {
      id: conflictId,
      subjectId,
      subjectType,
      summary,
      severity: 'medium',
      existingIds: [existingId],
      incomingIds: [incomingId],
      provenance: this.#mergeProvenance(existingProvenance, incomingProvenance),
    });
  }

  #mergeProvenance(existing: readonly Provenance[], incoming: readonly Provenance[]): readonly Provenance[] {
    const merged = [...existing];

    for (const provenance of incoming) {
      if (!merged.some((item) => this.#sameProvenance(item, provenance))) {
        merged.push(provenance);
      }
    }

    return merged.sort((left, right) => this.#provenanceKey(left).localeCompare(this.#provenanceKey(right)));
  }

  #sameProvenance(left: Provenance, right: Provenance): boolean {
    return this.#provenanceKey(left) === this.#provenanceKey(right);
  }

  #provenanceKey(provenance: Provenance): string {
    return [provenance.sourceType, provenance.sourceId, provenance.sourceVersion ?? '', provenance.createdAt, provenance.runId, provenance.external ? '1' : '0'].join('|');
  }

  #mergeConfidence(existing: Confidence, incoming: Confidence, incomingId: string): { readonly confidence: Confidence; readonly keepIncoming: boolean } {
    if (incoming.score > existing.score) {
      return { confidence: this.#clone(incoming), keepIncoming: true };
    }

    if (incoming.score < existing.score) {
      return { confidence: this.#clone(existing), keepIncoming: false };
    }

    const existingPriority = confidenceSourcePriority[existing.source] ?? 0;
    const incomingPriority = confidenceSourcePriority[incoming.source] ?? 0;

    if (incomingPriority > existingPriority) {
      return { confidence: this.#clone(incoming), keepIncoming: true };
    }

    if (incomingPriority < existingPriority) {
      return { confidence: this.#clone(existing), keepIncoming: false };
    }

    return {
      confidence: {
        ...incoming,
        rationale: incoming.rationale ?? existing.rationale,
      },
      keepIncoming: true,
    };
  }

  #hasConflict(existing: EvidenceNode | EvidenceEdge, incoming: EvidenceNode | EvidenceEdge): boolean {
    if ('kind' in existing && 'kind' in incoming) {
      return existing.kind !== incoming.kind || existing.label !== incoming.label || !this.#sameValue(existing.value, incoming.value);
    }

    if ('relation' in existing && 'relation' in incoming) {
      return existing.from !== incoming.from || existing.to !== incoming.to || existing.relation !== incoming.relation;
    }

    return false;
  }

  #sameValue(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  #clone<T>(value: T): T {
    return structuredClone(value);
  }
}