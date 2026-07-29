const confidenceSourcePriority = {
    tool: 3,
    provider: 2,
    derived: 1,
    reviewer: 4,
};
export class EvidenceGraph {
    #nodes = new Map();
    #edges = new Map();
    #derivedFacts = new Map();
    #conflicts = new Map();
    #hypotheses = new Map();
    #provenance = [];
    apply(update) {
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
    snapshot(runId) {
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
    merge(snapshot) {
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
    getNode(id) {
        const node = this.#nodes.get(id);
        return node ? this.#clone(node) : undefined;
    }
    getEdge(id) {
        const edge = this.#edges.get(id);
        return edge ? this.#clone(edge) : undefined;
    }
    listNodes() {
        return [...this.#nodes.values()].sort((left, right) => left.id.localeCompare(right.id)).map((node) => this.#clone(node));
    }
    listEdges() {
        return [...this.#edges.values()].sort((left, right) => left.id.localeCompare(right.id)).map((edge) => this.#clone(edge));
    }
    listConflicts() {
        return [...this.#conflicts.values()].sort((left, right) => left.id.localeCompare(right.id)).map((conflict) => this.#clone(conflict));
    }
    clear() {
        this.#nodes.clear();
        this.#edges.clear();
        this.#derivedFacts.clear();
        this.#conflicts.clear();
        this.#hypotheses.clear();
        this.#provenance = [];
    }
    #upsertNode(incoming) {
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
    #upsertEdge(incoming) {
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
    #recordConflict(subjectType, subjectId, existingId, incomingId, existingProvenance, incomingProvenance, summary) {
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
    #mergeProvenance(existing, incoming) {
        const merged = [...existing];
        for (const provenance of incoming) {
            if (!merged.some((item) => this.#sameProvenance(item, provenance))) {
                merged.push(provenance);
            }
        }
        return merged.sort((left, right) => this.#provenanceKey(left).localeCompare(this.#provenanceKey(right)));
    }
    #sameProvenance(left, right) {
        return this.#provenanceKey(left) === this.#provenanceKey(right);
    }
    #provenanceKey(provenance) {
        return [provenance.sourceType, provenance.sourceId, provenance.sourceVersion ?? '', provenance.createdAt, provenance.runId, provenance.external ? '1' : '0'].join('|');
    }
    #mergeConfidence(existing, incoming, incomingId) {
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
    #hasConflict(existing, incoming) {
        if ('kind' in existing && 'kind' in incoming) {
            return existing.kind !== incoming.kind || existing.label !== incoming.label || !this.#sameValue(existing.value, incoming.value);
        }
        if ('relation' in existing && 'relation' in incoming) {
            return existing.from !== incoming.from || existing.to !== incoming.to || existing.relation !== incoming.relation;
        }
        return false;
    }
    #sameValue(left, right) {
        return JSON.stringify(left) === JSON.stringify(right);
    }
    #clone(value) {
        return structuredClone(value);
    }
}
