import { deterministicToolConfidence, freezeToolValue } from './tool-result.js';
import { validateAgainstSchema } from './tool-contract.js';
const inputSchema = Object.freeze({
    title: 'MetadataResult',
    description: 'Input metadata extracted from the repository filesystem.',
    fields: Object.freeze({
        extractedAt: Object.freeze({ type: 'string', required: true }),
        summary: Object.freeze({ type: 'object', required: true }),
    }),
});
const outputSchema = Object.freeze({
    title: 'NormalizedMetadataEvidence',
    description: 'Normalized metadata evidence ready for graph insertion.',
    fields: Object.freeze({
        repository: Object.freeze({ type: 'object', required: true }),
        languages: Object.freeze({ type: 'array', required: true, itemType: 'object' }),
        frameworks: Object.freeze({ type: 'array', required: true, itemType: 'object' }),
        packageManagers: Object.freeze({ type: 'array', required: true, itemType: 'object' }),
        configurationFiles: Object.freeze({ type: 'array', required: true, itemType: 'object' }),
        dependencies: Object.freeze({ type: 'array', required: true, itemType: 'object' }),
    }),
});
export class MetadataParser {
    metadata = Object.freeze({
        id: 'metadata-parser@1.0.0',
        name: 'metadata-parser',
        capability: 'metadata.normalize',
        version: '1.0.0',
        inputSchema,
        outputSchema,
    });
    validate(input) {
        return validateAgainstSchema(input, this.metadata.inputSchema);
    }
    execute(input) {
        const evidence = freezeToolValue({
            repository: {
                name: input.summary.repository.name,
                rootPath: input.summary.repository.rootPath,
                branch: input.summary.repository.branch,
                commitHash: input.summary.repository.commitHash,
            },
            languages: [...input.summary.languages]
                .sort((left, right) => left.name.localeCompare(right.name))
                .map((language) => ({ name: language.name, evidence: Object.freeze([...language.evidence]) })),
            frameworks: [...input.summary.frameworks]
                .sort((left, right) => left.name.localeCompare(right.name))
                .map((framework) => ({ name: framework.name, evidence: Object.freeze([...framework.evidence]) })),
            packageManagers: [...input.summary.packageManagers]
                .sort((left, right) => left.name.localeCompare(right.name))
                .map((manager) => ({ name: manager.name, path: manager.path })),
            configurationFiles: [...input.summary.configurationFiles]
                .sort((left, right) => left.name.localeCompare(right.name))
                .map((configurationFile) => ({ name: configurationFile.name, path: configurationFile.path })),
            dependencies: [...input.summary.dependencies]
                .sort((left, right) => left.packageName.localeCompare(right.packageName))
                .map((dependency) => ({
                packageName: dependency.packageName,
                version: dependency.version,
                source: 'metadata.summary.dependencies',
            })),
        });
        return freezeToolValue({
            toolId: this.metadata.id,
            toolName: this.metadata.name,
            capability: this.metadata.capability,
            version: this.metadata.version,
            output: evidence,
            evidence: {
                nodes: this.#toEvidenceNodes(evidence),
            },
        });
    }
    #toEvidenceNodes(evidence) {
        const nodes = [];
        nodes.push({
            id: 'metadata:repository',
            kind: 'repository',
            label: evidence.repository.name,
            value: evidence.repository,
            confidence: deterministicToolConfidence,
            provenance: [],
        });
        for (const language of evidence.languages) {
            nodes.push({
                id: `metadata:language:${language.name}`,
                kind: 'language',
                label: language.name,
                value: language.evidence,
                confidence: deterministicToolConfidence,
                provenance: [],
            });
        }
        for (const framework of evidence.frameworks) {
            nodes.push({
                id: `metadata:framework:${framework.name}`,
                kind: 'framework',
                label: framework.name,
                value: framework.evidence,
                confidence: deterministicToolConfidence,
                provenance: [],
            });
        }
        for (const packageManager of evidence.packageManagers) {
            nodes.push({
                id: `metadata:package-manager:${packageManager.name}`,
                kind: 'package-manager',
                label: packageManager.name,
                value: packageManager.path,
                confidence: deterministicToolConfidence,
                provenance: [],
            });
        }
        for (const configurationFile of evidence.configurationFiles) {
            nodes.push({
                id: `metadata:configuration:${configurationFile.name}`,
                kind: 'configuration-file',
                label: configurationFile.name,
                value: configurationFile.path,
                confidence: deterministicToolConfidence,
                provenance: [],
            });
        }
        for (const dependency of evidence.dependencies) {
            nodes.push({
                id: `metadata:dependency:${dependency.packageName}`,
                kind: 'dependency',
                label: dependency.packageName,
                value: dependency,
                confidence: deterministicToolConfidence,
                provenance: [],
            });
        }
        return Object.freeze(nodes);
    }
}
