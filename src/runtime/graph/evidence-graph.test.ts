import { describe, expect, it } from 'vitest';
import type { Confidence, Provenance } from '../contracts.js';
import { EvidenceGraph } from './evidence-graph.js';
import type { EvidenceEdge } from './evidence-edge.js';
import type { EvidenceNode } from './evidence-node.js';
import type { GraphUpdate } from './graph-update.js';

const createConfidence = (score: number, source: Confidence['source'] = 'derived'): Confidence => ({
  score,
  source,
  rationale: 'test',
  threshold: 0.5,
});

const createProvenance = (runId: string, sourceId: string): Provenance => ({
  sourceType: 'metadata',
  sourceId,
  createdAt: '2026-07-28T00:00:00.000Z',
  runId,
  external: false,
});

const createNode = (overrides: Partial<EvidenceNode> = {}): EvidenceNode => ({
  id: overrides.id ?? 'node-1',
  kind: overrides.kind ?? 'package',
  label: overrides.label ?? 'React',
  value: overrides.value ?? 'react',
  confidence: overrides.confidence ?? createConfidence(0.8),
  provenance: overrides.provenance ?? [createProvenance('run-1', 'source-1')],
});

const createEdge = (overrides: Partial<EvidenceEdge> = {}): EvidenceEdge => ({
  id: overrides.id ?? 'edge-1',
  from: overrides.from ?? 'node-1',
  to: overrides.to ?? 'node-2',
  relation: overrides.relation ?? 'dependsOn',
  confidence: overrides.confidence ?? createConfidence(0.8),
  provenance: overrides.provenance ?? [createProvenance('run-1', 'source-2')],
});

describe('EvidenceGraph', () => {
  it('add node', () => {
    const graph = new EvidenceGraph();

    graph.apply({ nodes: [createNode()], provenance: createProvenance('run-1', 'update-1') });

    expect(graph.getNode('node-1')).toBeDefined();
    expect(graph.listNodes()).toHaveLength(1);
  });

  it('add edge', () => {
    const graph = new EvidenceGraph();

    graph.apply({ edges: [createEdge()], provenance: createProvenance('run-1', 'update-1') });

    expect(graph.getEdge('edge-1')).toBeDefined();
    expect(graph.listEdges()).toHaveLength(1);
  });

  it('apply update', () => {
    const graph = new EvidenceGraph();
    const update: GraphUpdate = {
      nodes: [createNode()],
      edges: [createEdge()],
      provenance: createProvenance('run-1', 'update-1'),
    };

    graph.apply(update);

    expect(graph.listNodes()).toHaveLength(1);
    expect(graph.listEdges()).toHaveLength(1);
  });

  it('snapshot', () => {
    const graph = new EvidenceGraph();

    graph.apply({ nodes: [createNode()], provenance: createProvenance('run-1', 'update-1') });

    const snapshot = graph.snapshot('run-2');

    expect(snapshot.runId).toBe('run-2');
    expect(snapshot.nodes).toHaveLength(1);
  });

  it('merge', () => {
    const graph = new EvidenceGraph();
    const snapshot = {
      runId: 'run-2',
      nodes: [createNode({ id: 'node-2', label: 'Node 2' })],
      edges: [createEdge({ id: 'edge-2', from: 'node-2', to: 'node-3' })],
      derivedFacts: [],
      conflicts: [],
      hypotheses: [],
      provenance: [createProvenance('run-2', 'snapshot-1')],
      createdAt: '2026-07-28T00:00:00.000Z',
    };

    graph.merge(snapshot);

    expect(graph.getNode('node-2')).toBeDefined();
    expect(graph.getEdge('edge-2')).toBeDefined();
  });

  it('duplicate node', () => {
    const graph = new EvidenceGraph();

    graph.apply({ nodes: [createNode({ label: 'First' })], provenance: createProvenance('run-1', 'update-1') });
    graph.apply({ nodes: [createNode({ label: 'Second', provenance: [createProvenance('run-2', 'update-2')] })], provenance: createProvenance('run-2', 'update-2') });

    expect(graph.getNode('node-1')?.label).toBe('Second');
  });

  it('confidence merge', () => {
    const graph = new EvidenceGraph();

    graph.apply({ nodes: [createNode({ confidence: createConfidence(0.6) })], provenance: createProvenance('run-1', 'update-1') });
    graph.apply({ nodes: [createNode({ confidence: createConfidence(0.9), provenance: [createProvenance('run-2', 'update-2')] })], provenance: createProvenance('run-2', 'update-2') });

    expect(graph.getNode('node-1')?.confidence.score).toBe(0.9);
  });

  it('provenance preserved', () => {
    const graph = new EvidenceGraph();

    graph.apply({ nodes: [createNode()], provenance: createProvenance('run-1', 'update-1') });
    graph.apply({ nodes: [createNode({ provenance: [createProvenance('run-2', 'update-2')] })], provenance: createProvenance('run-2', 'update-2') });

    expect(graph.getNode('node-1')?.provenance).toHaveLength(2);
  });

  it('conflict recorded', () => {
    const graph = new EvidenceGraph();

    graph.apply({ nodes: [createNode({ label: 'Alpha' })], provenance: createProvenance('run-1', 'update-1') });
    graph.apply({ nodes: [createNode({ label: 'Beta', provenance: [createProvenance('run-2', 'update-2')] })], provenance: createProvenance('run-2', 'update-2') });

    expect(graph.listConflicts()).toHaveLength(1);
    expect(graph.listConflicts()[0]?.subjectType).toBe('node');
  });

  it('deterministic ordering', () => {
    const graph = new EvidenceGraph();

    graph.apply({ nodes: [createNode({ id: 'node-b' }), createNode({ id: 'node-a' })], provenance: createProvenance('run-1', 'update-1') });
    graph.apply({ edges: [createEdge({ id: 'edge-b' }), createEdge({ id: 'edge-a' })], provenance: createProvenance('run-1', 'update-2') });

    expect(graph.listNodes().map((node) => node.id)).toEqual(['node-a', 'node-b']);
    expect(graph.listEdges().map((edge) => edge.id)).toEqual(['edge-a', 'edge-b']);
  });

  it('clear', () => {
    const graph = new EvidenceGraph();

    graph.apply({ nodes: [createNode()], provenance: createProvenance('run-1', 'update-1') });
    graph.clear();

    expect(graph.listNodes()).toEqual([]);
    expect(graph.listEdges()).toEqual([]);
    expect(graph.listConflicts()).toEqual([]);
  });
});