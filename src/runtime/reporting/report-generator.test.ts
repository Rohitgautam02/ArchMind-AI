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
});
