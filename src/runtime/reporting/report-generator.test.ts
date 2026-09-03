import { describe, expect, it, vi, afterEach } from 'vitest';
import { ReportGenerator } from './report-generator.js';
import { EvidenceGraph } from '../graph/evidence-graph.js';
import * as fs from 'fs';

vi.mock('fs');

describe('ReportGenerator', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('generates markdown report from evidence graph', () => {
    const graph = new EvidenceGraph();
    graph.apply({
      provenance: {
        sourceType: 'system',
        sourceId: 'test',
        sourceVersion: '1',
        createdAt: new Date().toISOString(),
        runId: 'run-1',
        external: false,
      },
      nodes: [
        {
          id: 'n1',
          kind: 'metadata:repository',
          label: 'test-repo',
          confidence: { score: 1, source: 'tool' },
          provenance: [],
        },
        {
          id: 'n2',
          kind: 'ArchitectureDetected',
          label: 'monolith',
          confidence: { score: 0.9, source: 'derived' },
          provenance: [],
        },
      ],
    });

    const writeSpy = vi.spyOn(fs, 'writeFileSync');
    
    ReportGenerator.generate(graph, 'test-report.md', 'run-1');
    
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const content = writeSpy.mock.calls[0]?.[1] as string;
    
    expect(content).toContain('# ArchMind AI Analysis Report');
    expect(content).toContain('test-repo');
    expect(content).toContain('monolith');
    expect(content).toContain('90%');
  });

  it('renders deterministic dependency evidence and supporting IDs', () => {
    const graph = createDependencyGraph();
    const writeSpy = vi.spyOn(fs, 'writeFileSync');

    ReportGenerator.generate(graph, 'dependency-report.md', 'run-1');

    const content = writeSpy.mock.calls[0]?.[1] as string;
    expect(content).toContain('Declared and imported');
    expect(content).toContain('Declared but not imported');
    expect(content).toContain('Imported but undeclared');
    expect(content).toContain('express');
    expect(content).toContain('declared ^5.0.0 resolved 5.0.0 (direct (dependencies))');
    expect(content).toContain('accepts');
    expect(content).toContain('transitive');
    expect(content).toContain('node_modules/express/node_modules/accepts');
    expect(content).toContain('Duplicate Resolved Versions');
    expect(content).toContain('4.17.15');
    expect(content).toContain('evidence: run-1:package-json');
    expect(content).toContain('run-1:duplicate:lodash');
    expect(content).not.toContain('provider-only-duplicate');
  });

  it('preserves compatibility when optional dependency fields are absent', () => {
    const graph = new EvidenceGraph();
    graph.apply({
      provenance: createProvenance(),
      nodes: [{
        id: 'dependency-health',
        kind: 'analysis:dependency-health',
        label: 'Dependency Health Score: 80/100',
        value: {
          healthScore: 80,
          unusedPackages: [],
          risks: [],
        },
        confidence: { score: 0.9, source: 'provider' },
        provenance: [],
      }],
    });
    const writeSpy = vi.spyOn(fs, 'writeFileSync');

    ReportGenerator.generate(graph, 'compat-report.md', 'run-1');

    const content = writeSpy.mock.calls[0]?.[1] as string;
    expect(content).toContain('Health Score: 80/100');
    expect(content).not.toContain('Duplicate Resolved Versions');
  });
});

function createDependencyGraph(): EvidenceGraph {
  const provenance = createProvenance();
  const graph = new EvidenceGraph();
  graph.apply({
    provenance,
    nodes: [
      {
        id: 'run-1:package-json',
        kind: 'metadata:package-json',
        label: 'package.json',
        value: {},
        confidence: { score: 1, source: 'tool' },
        provenance: [provenance],
      },
      {
        id: 'run-1:dependency-health',
        kind: 'analysis:dependency-health',
        label: 'Dependency Health Score: 80/100',
        value: {
          healthScore: 80,
          unusedPackages: ['lodash'],
          risks: [{ package: 'express' }],
          directDependencyUsage: {
            declaredAndImported: [{ package: 'express', version: '^5.0.0', dependencyType: 'dependencies', supportingEvidenceIds: ['run-1:package-json', 'run-1:module:express'], importedEvidenceIds: ['run-1:module:express'], runtimeUnused: false }],
            declaredButNotImported: [{ package: 'lodash', version: '^4.0.0', dependencyType: 'dependencies', supportingEvidenceIds: ['run-1:package-json'], importedEvidenceIds: [], runtimeUnused: true }],
            importedButUndeclared: [{ package: 'axios', supportingEvidenceIds: ['run-1:module:axios'] }],
          },
          resolvedDependencies: [
            { package: 'express', declaredVersion: '^5.0.0', resolvedVersion: '5.0.0', isDirect: true, dependencyType: 'dependencies', location: 'node_modules/express', supportingEvidenceIds: ['run-1:resolved:express'] },
            { package: 'accepts', resolvedVersion: '2.0.0', isDirect: false, location: 'node_modules/express/node_modules/accepts', supportingEvidenceIds: ['run-1:resolved:accepts'] },
          ],
          duplicateVersions: [{ package: 'lodash', versions: ['4.17.15', '4.17.21'], locations: ['node_modules/a/node_modules/lodash', 'node_modules/lodash'], supportingEvidenceIds: ['run-1:duplicate:lodash'] }],
          duplicateDependencies: ['provider-only-duplicate'],
        },
        confidence: { score: 0.9, source: 'provider' },
        provenance: [{ ...provenance, supportingEvidenceIds: ['run-1:package-json', 'run-1:resolved:express', 'run-1:duplicate:lodash'] }],
      },
    ],
  });
  return graph;
}

function createProvenance() {
  return { sourceType: 'tool' as const, sourceId: 'test', createdAt: '2026-07-28T00:00:00.000Z', runId: 'run-1', external: false };
}
