import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { AnalysisService } from './analysis-service.js';

const sampleRepoPath = path.resolve(__dirname, '..', '..', 'examples', 'sample-repo');

describe('AnalysisService', () => {
  it('analyzes a repository and returns a valid result', async () => {
    const service = new AnalysisService();
    const result = await service.analyze(sampleRepoPath);

    expect(result.runId).toBeTruthy();
    expect(result.graphSnapshot).toBeDefined();
    expect(result.graphSnapshot.nodes.length).toBeGreaterThan(0);
    expect(result.graphSnapshot.createdAt).toBeTruthy();
    expect(result.pipelineResult).toBeDefined();
    expect(result.pipelineResult.runId).toBe(result.runId);
  });

  it('getGraph returns the snapshot for a completed run', async () => {
    const service = new AnalysisService();
    const result = await service.analyze(sampleRepoPath);

    const graph = service.getGraph(result.runId);
    expect(graph).toBeDefined();
    expect(graph!.runId).toBe(result.runId);
    expect(graph!.nodes.length).toBe(result.graphSnapshot.nodes.length);
  });

  it('getRun returns the run record for a completed run', async () => {
    const service = new AnalysisService();
    const result = await service.analyze(sampleRepoPath);

    const run = service.getRun(result.runId);
    expect(run).toBeDefined();
    expect(run!.runId).toBe(result.runId);
  });

  it('listRuns contains the completed run', async () => {
    const service = new AnalysisService();
    const result = await service.analyze(sampleRepoPath);

    const runs = service.listRuns();
    expect(runs.length).toBeGreaterThanOrEqual(1);
    expect(runs.some((r) => r.runId === result.runId)).toBe(true);
  });

  it('returns undefined for unknown run IDs', () => {
    const service = new AnalysisService();

    expect(service.getGraph('nonexistent')).toBeUndefined();
    expect(service.getRun('nonexistent')).toBeUndefined();
  });

  it('produces a JSON-serializable graph snapshot', async () => {
    const service = new AnalysisService();
    const result = await service.analyze(sampleRepoPath);

    const serialized = JSON.stringify(result.graphSnapshot);
    expect(serialized).toBeTruthy();

    const parsed = JSON.parse(serialized);
    expect(parsed.runId).toBe(result.runId);
    expect(parsed.nodes.length).toBe(result.graphSnapshot.nodes.length);
    expect(parsed.edges.length).toBe(result.graphSnapshot.edges.length);
  });

  it('rejects concurrent analysis', async () => {
    const service = new AnalysisService();

    const first = service.analyze(sampleRepoPath);

    await expect(service.analyze(sampleRepoPath)).rejects.toThrow(
      'An analysis is already in progress'
    );

    await first;
  });

  it('throws for a nonexistent repository path', async () => {
    const service = new AnalysisService();

    await expect(service.analyze('/nonexistent/path/to/repo')).rejects.toThrow(
      'does not exist'
    );
  });

  it('graph snapshot contains expected deterministic node kinds', async () => {
    const service = new AnalysisService();
    const result = await service.analyze(sampleRepoPath);
    const kinds = new Set(result.graphSnapshot.nodes.map((n) => n.kind));

    expect(kinds.has('metadata:repository')).toBe(true);
    expect(kinds.has('metadata:package-json')).toBe(true);
  });

  it('run provenance is associated with the returned runId', async () => {
    const service = new AnalysisService();
    const result = await service.analyze(sampleRepoPath);

    for (const node of result.graphSnapshot.nodes) {
      const hasMatchingProvenance = node.provenance.some(
        (p) => p.runId === result.runId
      );
      expect(hasMatchingProvenance).toBe(true);
    }
  });
});
