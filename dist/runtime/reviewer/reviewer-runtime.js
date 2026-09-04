import { ReviewDecision } from './review-decision.js';
/**
 * Deterministic reviewer that validates structured agent output against evidence and emits review lifecycle events.
 */
export class ReviewerRuntime {
    #evidenceGraph;
    #eventBus;
    #minimumConfidence;
    constructor(dependencies) {
        this.#evidenceGraph = dependencies.evidenceGraph;
        this.#eventBus = dependencies.eventBus;
        this.#minimumConfidence = dependencies.minimumConfidence ?? 0.9;
    }
    /** Validate the reviewer input before producing a decision. */
    validate(result) {
        if (!result.runId || !result.workItemId || !result.capability) {
            throw new Error('Missing reviewer metadata');
        }
        if (result.generatedEvidenceIds.length === 0) {
            throw new Error('No evidence produced');
        }
        if (result.findings.length === 0) {
            throw new Error('Empty findings');
        }
        if (new Set(result.generatedEvidenceIds).size !== result.generatedEvidenceIds.length) {
            throw new Error('Duplicate evidence');
        }
        if (!Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1) {
            throw new Error('Invalid confidence');
        }
    }
    /** Review a structured agent result and return a deterministic decision. */
    review(result) {
        this.validate(result);
        const metadata = this.#metadata(result.runId);
        this.#publish('ReviewerRequested', metadata, {
            reviewer: 'DeterministicReviewer',
        });
        const decision = this.#decide(result);
        const reviewedAt = metadata.timestamp;
        if (decision === ReviewDecision.APPROVED) {
            this.#publish('ReviewerApproved', metadata, {
                reviewer: 'DeterministicReviewer',
            });
        }
        else if (decision === ReviewDecision.REJECTED) {
            this.#publish('ReviewerRejected', metadata, {
                reviewer: 'DeterministicReviewer',
                reason: 'Validation failed or evidence was insufficient.',
            });
        }
        else {
            this.#publish('ReviewerReanalysisRequested', metadata, {
                reviewer: 'DeterministicReviewer',
                reason: 'Reanalysis required due to confidence or evidence conflict.',
            });
        }
        return Object.freeze({
            runId: result.runId,
            workItemId: result.workItemId,
            decision,
            confidence: result.confidence,
            reasons: Object.freeze(this.#reasonsFor(result, decision)),
            evidenceIds: Object.freeze([...result.generatedEvidenceIds]),
            reviewedAt,
        });
    }
    #decide(result) {
        const hasConflicts = this.#evidenceGraph.listConflicts().length > 0;
        if (hasConflicts || result.confidence < this.#minimumConfidence) {
            return ReviewDecision.REANALYSIS_REQUIRED;
        }
        // Graph-Aware Validation for ArchitectureAgent
        if (result.capability === 'ArchitectureAgent') {
            const generatedNodes = result.generatedEvidenceIds
                .map(id => this.#evidenceGraph.getNode(id))
                .filter(n => n !== undefined);
            const architectureNode = generatedNodes.find(n => n?.label === 'ArchitectureDetected');
            if (architectureNode && architectureNode.value) {
                const arch = architectureNode.value.architecture?.toLowerCase();
                // Example Graph-Aware Check:
                // If it claims MVC but there are no backend framework controllers, reject.
                if (arch === 'mvc' || arch === 'layered') {
                    const hasControllers = this.#evidenceGraph.findByKind('architecture:pattern').some(n => n.label === 'Layered Architecture');
                    const hasExpress = this.#evidenceGraph.findByKind('framework:backend').some(n => n.label === 'Express');
                    if (!hasControllers && !hasExpress) {
                        return ReviewDecision.REJECTED;
                    }
                }
            }
        }
        if (result.capability === 'DependencyAnalysis' && this.#dependencyValidationFailure(result)) {
            return ReviewDecision.REJECTED;
        }
        return ReviewDecision.APPROVED;
    }
    #reasonsFor(result, decision) {
        if (decision === ReviewDecision.APPROVED) {
            return ['Evidence present', 'Confidence valid', 'No conflicting evidence detected'];
        }
        if (result.confidence < this.#minimumConfidence) {
            return ['Confidence below threshold'];
        }
        if (this.#evidenceGraph.listConflicts().length > 0) {
            return ['Conflicting evidence detected'];
        }
        if (decision === ReviewDecision.REJECTED && result.capability === 'DependencyAnalysis') {
            return [`Dependency validation failed: ${this.#dependencyValidationFailure(result) ?? 'invalid deterministic evidence'}`];
        }
        return ['Validation rejected the structured result'];
    }
    #dependencyValidationFailure(result) {
        const generatedNode = result.generatedEvidenceIds
            .map((id) => this.#evidenceGraph.getNode(id))
            .find((node) => node?.kind === 'analysis:dependency-health');
        if (!generatedNode) {
            return 'missing dependency-health evidence';
        }
        if (!isDependencyHealthValue(generatedNode.value)) {
            return 'invalid dependency-health value';
        }
        const packageNodes = this.#evidenceGraph.findByKind('metadata:package-json');
        const declarations = packageNodes.flatMap((node) => packageDeclarations(node));
        const failure = validateDirectUsage(result.runId, generatedNode.value.directDependencyUsage, declarations, this.#evidenceGraph);
        if (failure) {
            return failure;
        }
        const unusedFailure = validateUnusedPackages(generatedNode.value.unusedPackages, generatedNode.value.directDependencyUsage, declarations);
        if (unusedFailure) {
            return unusedFailure;
        }
        const resolvedFailure = validateResolvedDependencies(result.runId, generatedNode.value.resolvedDependencies, this.#evidenceGraph);
        if (resolvedFailure) {
            return resolvedFailure;
        }
        const duplicateFailure = validateDuplicateVersions(result.runId, generatedNode.value.duplicateVersions, this.#evidenceGraph);
        if (duplicateFailure) {
            return duplicateFailure;
        }
        if (generatedNode.value.duplicateDependencies.length > 0) {
            return 'unsupported duplicateDependencies claim';
        }
        return undefined;
    }
    #publish(type, metadata, payload) {
        this.#eventBus.publish({
            type,
            metadata,
            payload,
            emittedAt: metadata.timestamp,
        });
    }
    #metadata(runId) {
        return {
            runId,
            workspaceId: 'reviewer',
            timestamp: '2026-07-28T00:00:00.000Z',
            version: '1.0.0',
        };
    }
}
function isDependencyHealthValue(value) {
    if (!isRecord(value)
        || !isRecord(value.directDependencyUsage)
        || !Array.isArray(value.unusedPackages)
        || !value.unusedPackages.every((item) => typeof item === 'string')
        || !Array.isArray(value.resolvedDependencies)
        || !value.resolvedDependencies.every(isResolvedDependency)
        || !Array.isArray(value.duplicateVersions)
        || !value.duplicateVersions.every(isDuplicateVersions)
        || !Array.isArray(value.duplicateDependencies)) {
        return false;
    }
    const usage = value.directDependencyUsage;
    return Array.isArray(usage.declaredAndImported)
        && usage.declaredAndImported.every(isUsageFinding)
        && Array.isArray(usage.declaredButNotImported)
        && usage.declaredButNotImported.every(isUsageFinding)
        && Array.isArray(usage.importedButUndeclared)
        && usage.importedButUndeclared.every(isImportedUndeclaredFinding);
}
function isUsageFinding(value) {
    return isRecord(value)
        && typeof value.package === 'string'
        && typeof value.version === 'string'
        && typeof value.dependencyType === 'string'
        && typeof value.runtimeUnused === 'boolean'
        && isStringArray(value.supportingEvidenceIds)
        && isStringArray(value.importedEvidenceIds);
}
function isImportedUndeclaredFinding(value) {
    return isRecord(value) && typeof value.package === 'string' && isStringArray(value.supportingEvidenceIds);
}
function isResolvedDependency(value) {
    return isRecord(value)
        && typeof value.package === 'string'
        && typeof value.resolvedVersion === 'string'
        && typeof value.location === 'string'
        && typeof value.isDirect === 'boolean'
        && (value.declaredVersion === undefined || typeof value.declaredVersion === 'string')
        && (value.dependencyType === undefined || typeof value.dependencyType === 'string')
        && isStringArray(value.supportingEvidenceIds);
}
function isDuplicateVersions(value) {
    return isRecord(value)
        && typeof value.package === 'string'
        && isStringArray(value.versions)
        && isStringArray(value.locations)
        && isStringArray(value.supportingEvidenceIds);
}
function isStringArray(value) {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function packageDeclarations(node) {
    const value = node.value;
    if (!isRecord(value)) {
        return [];
    }
    const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
    return sections.flatMap((dependencyType) => {
        const section = value[dependencyType];
        if (!isRecord(section) || !Object.values(section).every((version) => typeof version === 'string')) {
            return [];
        }
        return Object.entries(section).map(([packageName, version]) => ({
            package: packageName,
            version: version,
            dependencyType,
            nodeId: node.id,
        }));
    });
}
function validateDirectUsage(runId, usage, declarations, graph) {
    for (const finding of usage.declaredAndImported) {
        const failure = validateUsageFinding(runId, finding, declarations, graph, true);
        if (failure)
            return failure;
    }
    for (const finding of usage.declaredButNotImported) {
        const failure = validateUsageFinding(runId, finding, declarations, graph, false);
        if (failure)
            return failure;
    }
    for (const finding of usage.importedButUndeclared) {
        const supportingNodes = resolveSupportingNodes(runId, finding.supportingEvidenceIds, graph);
        if (supportingNodes.failure)
            return supportingNodes.failure;
        if (!supportingNodes.nodes.some((node) => node.kind === 'ast:module' && externalPackageRoot(node.label) === finding.package)) {
            return 'dependency usage claim not supported by graph evidence';
        }
        if (declarations.some((declaration) => declaration.package === finding.package)) {
            return 'imported-but-undeclared claim contradicts manifest evidence';
        }
    }
    return undefined;
}
function validateUsageFinding(runId, finding, declarations, graph, requiresImport) {
    const supportingNodes = resolveSupportingNodes(runId, finding.supportingEvidenceIds, graph);
    if (supportingNodes.failure)
        return supportingNodes.failure;
    const declaration = declarations.find((item) => item.package === finding.package && item.dependencyType === finding.dependencyType && item.version === finding.version && supportingNodes.nodes.some((node) => node.id === item.nodeId));
    if (!declaration)
        return 'dependency usage claim not supported by manifest evidence';
    if (requiresImport) {
        if (!finding.importedEvidenceIds.length)
            return 'declared-and-imported finding has no import evidence';
        const importedNodes = resolveSupportingNodes(runId, finding.importedEvidenceIds, graph);
        if (importedNodes.failure)
            return importedNodes.failure;
        if (!importedNodes.nodes.some((node) => node.kind === 'ast:module' && externalPackageRoot(node.label) === finding.package)) {
            return 'dependency usage claim not supported by import evidence';
        }
    }
    else if (finding.importedEvidenceIds.length > 0) {
        return 'declared-but-not-imported finding contains import evidence';
    }
    return undefined;
}
function validateUnusedPackages(unusedPackages, usage, declarations) {
    const deterministicUnused = new Set(usage.declaredButNotImported
        .filter((finding) => finding.runtimeUnused && finding.dependencyType === 'dependencies')
        .map((finding) => finding.package));
    for (const packageName of unusedPackages) {
        if (!deterministicUnused.has(packageName))
            return 'unused package claim is not deterministic';
        if (!declarations.some((declaration) => declaration.package === packageName && declaration.dependencyType === 'dependencies')) {
            return 'unused package is not a declared runtime dependency';
        }
    }
    return undefined;
}
function validateResolvedDependencies(runId, values, graph) {
    for (const value of values) {
        const supportingNodes = resolveSupportingNodes(runId, value.supportingEvidenceIds, graph);
        if (supportingNodes.failure)
            return supportingNodes.failure;
        const match = supportingNodes.nodes.find((node) => node.kind === 'dependency:resolved' && resolvedDependencyMatches(node.value, value));
        if (!match)
            return 'resolved version does not match deterministic evidence';
    }
    return undefined;
}
function validateDuplicateVersions(runId, values, graph) {
    for (const value of values) {
        if (new Set(value.versions).size < 2)
            return 'duplicate-version claim has fewer than two versions';
        const supportingNodes = resolveSupportingNodes(runId, value.supportingEvidenceIds, graph);
        if (supportingNodes.failure)
            return supportingNodes.failure;
        const match = graph.findByKind('dependency:duplicate-version')
            .find((node) => duplicateVersionsMatch(node.value, value));
        if (!match)
            return 'duplicate-version claim does not match deterministic evidence';
        if (!supportingNodes.nodes.every((node) => node.kind === 'dependency:resolved')) {
            return 'duplicate-version supporting evidence has wrong kind';
        }
        if (!isDuplicateVersions(match.value)
            || !sameStringSet(match.value.supportingEvidenceIds, value.supportingEvidenceIds)) {
            return 'duplicate-version supporting evidence does not match deterministic evidence';
        }
    }
    return undefined;
}
function resolveSupportingNodes(runId, ids, graph) {
    if (ids.length === 0)
        return { nodes: [], failure: 'unresolved supporting evidence' };
    if (new Set(ids).size !== ids.length)
        return { nodes: [], failure: 'duplicate supporting evidence IDs' };
    const resolvedNodes = [];
    for (const id of ids) {
        const node = graph.getNode(id);
        if (!node)
            return { nodes: [], failure: 'unresolved supporting evidence' };
        resolvedNodes.push(node);
    }
    if (resolvedNodes.some((node) => !node.provenance.some((provenance) => provenance.runId === runId))) {
        return { nodes: [], failure: 'supporting evidence belongs to another run' };
    }
    return { nodes: resolvedNodes };
}
function resolvedDependencyMatches(actual, expected) {
    return isResolvedDependency(actual)
        && actual.package === expected.package
        && actual.resolvedVersion === expected.resolvedVersion
        && actual.location === expected.location
        && actual.isDirect === expected.isDirect
        && actual.declaredVersion === expected.declaredVersion
        && actual.dependencyType === expected.dependencyType;
}
function duplicateVersionsMatch(actual, expected) {
    return isDuplicateVersions(actual)
        && actual.package === expected.package
        && JSON.stringify(actual.versions) === JSON.stringify(expected.versions)
        && JSON.stringify(actual.locations) === JSON.stringify(expected.locations);
}
function sameStringSet(left, right) {
    return left.length === right.length && left.every((value) => right.includes(value));
}
function externalPackageRoot(moduleSpecifier) {
    if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('node:'))
        return undefined;
    const segments = moduleSpecifier.split('/');
    return moduleSpecifier.startsWith('@') ? (segments.length >= 2 ? `${segments[0]}/${segments[1]}` : undefined) : segments[0];
}
