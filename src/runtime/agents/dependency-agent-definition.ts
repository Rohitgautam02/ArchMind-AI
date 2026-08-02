import { z } from 'zod';
import type { AgentDefinition, AgentContext } from './agent-runtime.js';
import type { EvidenceNode, Provenance } from '../contracts.js';

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
2. Identify duplicate dependencies: Check for multiple versions of the same package (if available in workspaces/monorepos).
3. Identify security/health risks: Use your heuristic knowledge to flag deprecated, abandoned, or notoriously insecure packages. Provide a clear reason and severity.
4. Calculate a health score from 0 (terrible) to 100 (perfect) based on your findings.

Base your entire analysis STRICTLY on the deterministic evidence provided in the user prompt. Do not invent packages that do not exist in the evidence.`;
  },

  buildUserPrompt(context: AgentContext): string {
    const packageJsonNodes = context.graphSnapshot.nodes.filter(n => n.kind === 'metadata:package-json');
    const moduleNodes = context.graphSnapshot.nodes.filter(n => n.kind === 'ast:module');
    
    let prompt = `Analyze the following deterministic evidence to assess dependency health:\n\n`;
    
    prompt += `=== PACKAGE.JSON FILES ===\n`;
    for (const node of packageJsonNodes) {
      prompt += `[${node.id}]:\n`;
      prompt += JSON.stringify(node.value, null, 2) + '\n\n';
    }

    prompt += `=== AST IMPORTED MODULES ===\n`;
    const uniqueImports = Array.from(new Set(moduleNodes.map(n => n.label)));
    prompt += JSON.stringify(uniqueImports, null, 2) + '\n\n';

    return prompt;
  },

  mapToEvidence(output: DependencyAgentOutput, context: AgentContext) {
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
    };

    nodes.push({
      id: `${context.runId}:analysis:dependency-health`,
      kind: 'analysis:dependency-health',
      label: `Dependency Health Score: ${output.healthScore}/100`,
      value: {
        unusedPackages: output.unusedPackages,
        duplicateDependencies: output.duplicateDependencies,
        risks: output.risks,
        healthScore: output.healthScore
      },
      confidence: { score: confidence, source: 'provider' as const, rationale: 'Inferred from package.json and AST imports' },
      provenance: Object.freeze([provenance]),
    });
    
    generatedEvidenceLabels.push(`Dependency Health Score: ${output.healthScore}`);
    if (output.unusedPackages.length > 0) {
      generatedEvidenceLabels.push(`Found ${output.unusedPackages.length} unused packages.`);
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
