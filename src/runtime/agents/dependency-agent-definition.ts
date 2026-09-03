import { z } from 'zod';
import type { AgentDefinition, AgentContext } from './agent-runtime.js';
import type { EvidenceNode, Provenance } from '../contracts.js';
import { DependencyScanner, type DependencyRecord, type DependencyUsageAnalysis, type DependencyManifestSection, type DependencyType, type LockfileDependencyRecord, type DuplicateDependencyVersion } from '../../tools/dependency-scanner.js';

export const dependencyAgentOutputSchema = z.object({
  unusedPackages: z.array(z.string()).describe("Packages listed in package.json dependencies (ignore devDependencies) but not imported in the AST"),
  duplicateDependencies: z.array(z.string()).describe("Multiple versions of the same package"),
  risks: z.array(z.object({
    package: z.string(),
    reason: z.string(),
    severity: z.enum(['low', 'medium', 'high'])
  })),
  healthScore: z.number().min(0).max(100).describe("Overall dependency health score from 0 to 100")
});

export type DependencyAgentOutput = z.infer<typeof dependencyAgentOutputSchema>;

export const dependencyAgentDefinition: AgentDefinition<DependencyAgentOutput> = {
  outputSchema: dependencyAgentOutputSchema,
  requiredEvidence: ['metadata:package-json', 'ast:module'],
  producedEvidence: ['analysis:dependency-health'],

  buildSystemPrompt(): string {
    return `You are an expert Dependency Analysis AI.
Your task is to analyze the provided deterministic evidence (package.json contents and AST import modules) to evaluate the dependency health of this repository.

Instructions:
1. Identify unused dependencies: Cross-reference the "dependencies" listed in the package.json against the actual "ast:module" imports. Do NOT flag "devDependencies" (like webpack, jest, eslint) as unused, as they are often invoked via CLI rather than source code.
2. Use the deterministic resolved dependency and duplicate-version evidence supplied in the user prompt. Do not independently determine resolved versions or duplicate versions.
3. Identify security/health risks: Use your heuristic knowledge to flag deprecated, abandoned, or notoriously insecure packages. Provide a clear reason and severity.
4. Calculate a health score from 0 (terrible) to 100 (perfect) based on your findings.

Base your entire analysis STRICTLY on the deterministic evidence provided in the user prompt. Do not invent packages that do not exist in the evidence.`;
  },

  buildUserPrompt(context: AgentContext): string {
    const packageJsonNodes = context.graphSnapshot.nodes.filter(n => n.kind === 'metadata:package-json');
    const moduleNodes = context.graphSnapshot.nodes.filter(n => n.kind === 'ast:module');
    const usageAnalysis = analyzeGraphEvidence(packageJsonNodes, moduleNodes);
    
    let prompt = `Analyze the following deterministic evidence to assess dependency health:\n\n`;
    
    prompt += `=== PACKAGE.JSON FILES ===\n`;
    for (const node of packageJsonNodes) {
      prompt += `[${node.id}]:\n`;
      prompt += JSON.stringify(node.value, null, 2) + '\n\n';
    }

    prompt += `=== AST IMPORTED MODULES ===\n`;
    const uniqueImports = Array.from(new Set(moduleNodes.map(n => n.label)));
    prompt += JSON.stringify(uniqueImports, null, 2) + '\n\n';
    prompt += `=== DETERMINISTIC DIRECT DEPENDENCY USAGE ===\n`;
    prompt += JSON.stringify(usageAnalysis, null, 2) + '\n\n';
    const lockfileEvidence = analyzeLockfileEvidence(context.graphSnapshot.nodes);
    prompt += `=== DETERMINISTIC RESOLVED DEPENDENCIES ===\n`;
    prompt += JSON.stringify(lockfileEvidence.resolvedDependencies, null, 2) + '\n\n';
    prompt += `=== DETERMINISTIC DUPLICATE VERSIONS ===\n`;
    prompt += JSON.stringify(lockfileEvidence.duplicateVersions, null, 2) + '\n\n';

    return prompt;
  },

  mapToEvidence(output: DependencyAgentOutput, context: AgentContext) {
    const packageJsonNodes = context.graphSnapshot.nodes.filter(n => n.kind === 'metadata:package-json');
    const moduleNodes = context.graphSnapshot.nodes.filter(n => n.kind === 'ast:module');
    const usageAnalysis = analyzeGraphEvidence(packageJsonNodes, moduleNodes);
    const lockfileEvidence = analyzeLockfileEvidence(context.graphSnapshot.nodes);
    const nodes = [];
    const generatedEvidenceLabels: string[] = [];
    let confidence = 0.85;

    if (output.healthScore < 50) {
      confidence = 0.9;
    }

    const provenance: Provenance = {
      sourceType: 'provider',
      sourceId: 'dependency-agent-1',
      createdAt: new Date().toISOString(),
      runId: context.runId,
      external: false,
      supportingEvidenceIds: Object.freeze([...new Set([
        ...usageAnalysis.declaredAndImported.flatMap((finding) => finding.supportingEvidenceIds),
        ...usageAnalysis.declaredButNotImported.flatMap((finding) => finding.supportingEvidenceIds),
        ...usageAnalysis.importedButUndeclared.flatMap((finding) => finding.supportingEvidenceIds),
        ...lockfileEvidence.supportingEvidenceIds,
      ])].sort((left, right) => left.localeCompare(right))),
    };

    nodes.push({
      id: `${context.runId}:analysis:dependency-health`,
      kind: 'analysis:dependency-health',
      label: `Dependency Health Score: ${output.healthScore}/100`,
      value: {
        unusedPackages: usageAnalysis.declaredButNotImported
          .filter((finding) => finding.runtimeUnused)
          .map((finding) => finding.package),
        duplicateDependencies: [],
        risks: output.risks,
        healthScore: output.healthScore,
        directDependencyUsage: usageAnalysis,
        resolvedDependencies: lockfileEvidence.resolvedDependencies,
        duplicateVersions: lockfileEvidence.duplicateVersions,
      },
      confidence: { score: confidence, source: 'provider' as const, rationale: 'Direct usage derived deterministically; score and risks synthesized by provider' },
      provenance: Object.freeze([provenance]),
    });
    
    generatedEvidenceLabels.push(`Dependency Health Score: ${output.healthScore}`);
    const runtimeUnusedCount = usageAnalysis.declaredButNotImported.filter((finding) => finding.runtimeUnused).length;
    if (runtimeUnusedCount > 0) {
      generatedEvidenceLabels.push(`Found ${runtimeUnusedCount} unused runtime packages.`);
    }
    if (output.risks.length > 0) {
      generatedEvidenceLabels.push(`Identified ${output.risks.length} dependency risks.`);
    }

    return {
      nodes,
      confidence,
      generatedEvidenceLabels,
    };
  }
};

function analyzeGraphEvidence(packageJsonNodes: readonly EvidenceNode[], moduleNodes: readonly EvidenceNode[]): DependencyUsageAnalysis {
  const dependencies = packageJsonNodes.flatMap((node) => dependencyRecordsFromNode(node));
  return DependencyScanner.analyzeUsage(dependencies, moduleNodes);
}

function dependencyRecordsFromNode(node: EvidenceNode): readonly DependencyRecord[] {
  const value = node.value;
  if (!isRecord(value)) {
    return [];
  }

  const sections: readonly [DependencyManifestSection, DependencyType][] = [
    ['dependencies', 'runtime'],
    ['devDependencies', 'development'],
    ['peerDependencies', 'peer'],
    ['optionalDependencies', 'optional'],
  ];

  return sections.flatMap(([section, type]) => {
    const values = value[section];
    if (!isRecordOfStrings(values)) {
      return [];
    }

    return Object.entries(values).map(([packageName, version]) => ({
      package: packageName,
      version,
      type,
      source: 'package.json' as const,
      section,
      supportingEvidenceIds: [node.id],
    }));
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRecordOfStrings(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'string');
}

interface LockfileEvidence {
  readonly resolvedDependencies: readonly LockfileDependencyRecord[];
  readonly duplicateVersions: readonly DuplicateDependencyVersion[];
  readonly supportingEvidenceIds: readonly string[];
}

function analyzeLockfileEvidence(nodes: readonly EvidenceNode[]): LockfileEvidence {
  const resolvedDependencies = nodes
    .filter((node) => node.kind === 'dependency:resolved')
    .map((node) => node.value)
    .filter(isLockfileDependencyRecord);
  const duplicateVersions = nodes
    .filter((node) => node.kind === 'dependency:duplicate-version')
    .map((node) => node.value)
    .filter(isDuplicateDependencyVersion);
  const supportingEvidenceIds = nodes
    .filter((node) => node.kind === 'dependency:resolved' || node.kind === 'dependency:duplicate-version')
    .map((node) => node.id)
    .sort((left, right) => left.localeCompare(right));

  return {
    resolvedDependencies: Object.freeze(resolvedDependencies),
    duplicateVersions: Object.freeze(duplicateVersions),
    supportingEvidenceIds: Object.freeze([...new Set(supportingEvidenceIds)]),
  };
}

function isLockfileDependencyRecord(value: unknown): value is LockfileDependencyRecord {
  return isRecord(value)
    && typeof value.package === 'string'
    && typeof value.resolvedVersion === 'string'
    && typeof value.location === 'string'
    && typeof value.isDirect === 'boolean'
    && Array.isArray(value.supportingEvidenceIds)
    && value.supportingEvidenceIds.every((id) => typeof id === 'string');
}

function isDuplicateDependencyVersion(value: unknown): value is DuplicateDependencyVersion {
  return isRecord(value)
    && typeof value.package === 'string'
    && Array.isArray(value.versions)
    && value.versions.every((version) => typeof version === 'string')
    && Array.isArray(value.locations)
    && value.locations.every((location) => typeof location === 'string')
    && Array.isArray(value.supportingEvidenceIds)
    && value.supportingEvidenceIds.every((id) => typeof id === 'string');
}
