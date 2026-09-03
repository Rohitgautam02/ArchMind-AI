import { describe, expect, it } from 'vitest';
import type { AgentContext } from './agent-runtime.js';
import { dependencyAgentDefinition } from './dependency-agent-definition.js';
import type { GraphSnapshot, EvidenceNode } from '../contracts.js';
import { ToolRegistry } from '../../tools/tool-registry.js';
import { ProviderRegistry } from '../../providers/provider-registry.js';
import type { DuplicateDependencyVersion, LockfileDependencyRecord } from '../../tools/dependency-scanner.js';
import { AgentRuntime } from './agent-runtime.js';
import { EvidenceGraph } from '../graph/evidence-graph.js';

describe('DependencyAgent definition', () => {
  it('includes deterministic usage findings and evidence support in its output', () => {
    const packageNode = node('run-1:package-json', 'metadata:package-json', 'package.json', {
      dependencies: { express: '^4.0.0', lodash: '^4.0.0' },
      devDependencies: { vitest: '^2.0.0' },
      peerDependencies: {},
      optionalDependencies: {},
    });
    const expressNode = node('run-1:module:express', 'ast:module', 'express');
    const resolvedExpress: LockfileDependencyRecord = {
      package: 'express',
      resolvedVersion: '5.0.0',
      location: 'node_modules/express',
      isDirect: true,
      declaredVersion: '^5.0.0',
      dependencyType: 'dependencies',
      supportingEvidenceIds: ['run-1:resolved:express'],
    };
    const duplicateLodash: DuplicateDependencyVersion = {
      package: 'lodash',
      versions: ['4.17.15', '4.17.21'],
      locations: ['node_modules/a/node_modules/lodash', 'node_modules/lodash'],
      supportingEvidenceIds: ['run-1:resolved:lodash-a', 'run-1:resolved:lodash-root'],
    };
    const resolvedNode = node('run-1:resolved:express', 'dependency:resolved', 'express', resolvedExpress);
    const duplicateNode = node('run-1:duplicate:lodash', 'dependency:duplicate-version', 'lodash', duplicateLodash);
    const context: AgentContext = {
      runId: 'run-1',
      workItem: { id: 'work-1', capability: 'DependencyAnalysis', status: 'PENDING', dependencies: [] },
      graphSnapshot: snapshot([packageNode, expressNode, resolvedNode, duplicateNode]),
      tools: new ToolRegistry(),
      providers: new ProviderRegistry(),
    };

    const prompt = dependencyAgentDefinition.buildUserPrompt(context, []);
    const output = dependencyAgentDefinition.mapToEvidence({
      unusedPackages: ['incorrect-provider-claim'],
      duplicateDependencies: ['provider-must-not-replace-deterministic-result'],
      risks: [],
      healthScore: 80,
    }, context, []);
    const value = output.nodes[0]?.value as {
      directDependencyUsage: { declaredAndImported: readonly unknown[]; declaredButNotImported: readonly unknown[] };
      unusedPackages: readonly string[];
      resolvedDependencies: readonly LockfileDependencyRecord[];
      duplicateVersions: readonly DuplicateDependencyVersion[];
    };

    expect(prompt).toContain('declaredAndImported');
    expect(prompt).toContain('express');
    expect(prompt).toContain('resolvedVersion');
    expect(prompt).toContain('4.17.15');
    expect(prompt).not.toContain('package-lock.json contents');
    expect(value.unusedPackages).toEqual(['lodash']);
    expect(value.directDependencyUsage.declaredAndImported).toHaveLength(1);
    expect(value.directDependencyUsage.declaredButNotImported).toHaveLength(2);
    expect(value.resolvedDependencies).toEqual([resolvedExpress]);
    expect(value.duplicateVersions).toEqual([duplicateLodash]);
    expect(output.nodes[0]?.provenance[0]?.supportingEvidenceIds).toEqual([
      'run-1:duplicate:lodash',
      'run-1:module:express',
      'run-1:package-json',
      'run-1:resolved:express',
    ]);
  });

  it('preserves deterministic evidence IDs through AgentRuntime graph writes', async () => {
    const evidenceGraph = new EvidenceGraph();
    const providerRegistry = new ProviderRegistry();
    providerRegistry.register({
      name: 'dependency-test-provider',
      defaultModel: 'test',
      supportedModels: ['test'],
      checkHealth: async () => ({ isHealthy: true, details: 'ok' }),
      invoke: async () => ({
        result: { unusedPackages: [], duplicateDependencies: [], risks: [], healthScore: 80 },
        rawText: '{}',
        modelUsed: 'test',
        providerName: 'dependency-test-provider',
        metrics: { durationMs: 1 },
      }),
    });
    const runtime = new AgentRuntime({ evidenceGraph, tools: new ToolRegistry(), providerRegistry });
    const packageNode = node('run-1:package-json', 'metadata:package-json', 'package.json', {
      dependencies: { express: '^5.0.0' },
      devDependencies: {},
      peerDependencies: {},
      optionalDependencies: {},
    });
    const moduleNode = node('run-1:module:express', 'ast:module', 'express');
    const resolvedNode = node('run-1:resolved:express', 'dependency:resolved', 'express', {
      package: 'express',
      resolvedVersion: '5.0.0',
      location: 'node_modules/express',
      isDirect: true,
      declaredVersion: '^5.0.0',
      dependencyType: 'dependencies',
      supportingEvidenceIds: ['run-1:resolved:express'],
    });
    evidenceGraph.apply({
      nodes: [packageNode, moduleNode, resolvedNode],
      provenance: { sourceType: 'tool', sourceId: 'test', createdAt: '2026-07-28T00:00:00.000Z', runId: 'run-1', external: false },
    });

    const result = await runtime.execute({
      runId: 'run-1',
      workItem: { id: 'work-1', capability: 'DependencyAnalysis', status: 'PENDING', dependencies: [] },
      agentDefinition: dependencyAgentDefinition,
      agentId: 'dependency-agent-1',
      agentVersion: '1.0.0',
    });

    expect(result.status).toBe('success');
    expect(evidenceGraph.getNode('run-1:analysis:dependency-health')?.provenance[0]?.supportingEvidenceIds).toEqual([
      'run-1:module:express',
      'run-1:package-json',
      'run-1:resolved:express',
    ]);
  });
});

function node(id: string, kind: string, label: string, value?: unknown): EvidenceNode {
  return { id, kind, label, value, confidence: { score: 1, source: 'tool' }, provenance: [] };
}

function snapshot(nodes: readonly EvidenceNode[]): GraphSnapshot {
  return { runId: 'run-1', nodes, edges: [], derivedFacts: [], conflicts: [], hypotheses: [], provenance: [], createdAt: '2026-07-28T00:00:00.000Z' };
}