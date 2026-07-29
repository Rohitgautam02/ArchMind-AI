import type { MetadataResult } from '../metadata/metadata-result.js';
import type { EvidenceNode } from '../runtime/contracts.js';
import { deterministicToolConfidence, freezeToolValue, type ToolEvidenceDraft, type ToolExecutionResult } from './tool-result.js';
import type { Tool } from './tool-contract.js';
import { validateAgainstSchema } from './tool-contract.js';
import type { ToolMetadata, ToolSchema } from './tool-metadata.js';

export interface NormalizedMetadataRepository {
  readonly name: string;
  readonly rootPath: string;
  readonly branch?: string;
  readonly commitHash?: string;
}

export interface NormalizedMetadataLanguage {
  readonly name: string;
  readonly evidence: readonly string[];
}

export interface NormalizedMetadataFramework {
  readonly name: string;
  readonly evidence: readonly string[];
}

export interface NormalizedMetadataPackageManager {
  readonly name: string;
  readonly path: string;
}

export interface NormalizedMetadataConfigurationFile {
  readonly name: string;
  readonly path: string;
}

export interface NormalizedMetadataDependency {
  readonly packageName: string;
  readonly version: string;
  readonly source: string;
}

export interface NormalizedMetadataEvidence {
  readonly repository: NormalizedMetadataRepository;
  readonly languages: readonly NormalizedMetadataLanguage[];
  readonly frameworks: readonly NormalizedMetadataFramework[];
  readonly packageManagers: readonly NormalizedMetadataPackageManager[];
  readonly configurationFiles: readonly NormalizedMetadataConfigurationFile[];
  readonly dependencies: readonly NormalizedMetadataDependency[];
}

const inputSchema: ToolSchema = Object.freeze({
  title: 'MetadataResult',
  description: 'Input metadata extracted from the repository filesystem.',
  fields: Object.freeze({
    extractedAt: Object.freeze({ type: 'string', required: true }),
    summary: Object.freeze({ type: 'object', required: true }),
  }),
});

const outputSchema: ToolSchema = Object.freeze({
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

export class MetadataParser implements Tool<MetadataResult, NormalizedMetadataEvidence> {
  readonly metadata: ToolMetadata = Object.freeze({
    id: 'metadata-parser@1.0.0',
    name: 'metadata-parser',
    capability: 'metadata.normalize',
    version: '1.0.0',
    inputSchema,
    outputSchema,
  });

  validate(input: unknown) {
    return validateAgainstSchema(input, this.metadata.inputSchema);
  }

  execute(input: MetadataResult): ToolExecutionResult<NormalizedMetadataEvidence> {
    const evidence: NormalizedMetadataEvidence = freezeToolValue({
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

  #toEvidenceNodes(evidence: NormalizedMetadataEvidence): readonly EvidenceNode[] {
    const nodes: EvidenceNode[] = [];

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