import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EvidenceGraph } from '../runtime/graph/evidence-graph.js';
import { MetadataExtractor } from '../metadata/metadata-extractor.js';
import { MetadataParser } from './metadata-parser.js';
import { DependencyScanner } from './dependency-scanner.js';
import { DockerInspector } from './docker-inspector.js';
import { PolicyChecker } from './policy-checker.js';
import { ReadmeAnalyzer } from './readme-analyzer.js';
import { ToolRegistry } from './tool-registry.js';

let repositoryPath = '';

beforeEach(() => {
  repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'archmind-tools-'));
  fs.writeFileSync(path.join(repositoryPath, 'package.json'), JSON.stringify({
    name: 'tool-repo',
    dependencies: { react: '^18.0.0', express: '^4.0.0' },
    devDependencies: { vitest: '^2.0.0' },
  }));
  fs.writeFileSync(path.join(repositoryPath, 'README.md'), '# Tool Repo\n\n## Installation\n\n```bash\nnpm install\n```\n\n## Usage\n\n`npm run dev`\n');
  fs.writeFileSync(path.join(repositoryPath, 'Dockerfile'), 'FROM node:20\nEXPOSE 3000\n');
  fs.writeFileSync(path.join(repositoryPath, 'docker-compose.yml'), 'services:\n  web:\n    image: node:20\n');
});

describe('ToolRegistry', () => {
  it('registers tools and rejects duplicate registrations', () => {
    const registry = createRegistry();

    expect(registry.listCapabilities()).toEqual([
      'dependency.scan',
      'docker.inspect',
      'metadata.normalize',
      'policy.check',
      'readme.analyze',
    ]);

    expect(() => registry.register(new MetadataParser())).toThrow(/already registered/);
  });

  it('discovers tools by capability and resolves versions deterministically', () => {
    const registry = createRegistry();

    expect(registry.discover('metadata.normalize')).toEqual(['metadata-parser@1.0.0']);
    expect(registry.resolve('metadata-parser').metadata.version).toBe('1.0.0');
    expect(registry.resolve('metadata-parser', '1.0.0').metadata.id).toBe('metadata-parser@1.0.0');
  });

  it('executes tools deterministically and applies evidence to the graph', () => {
    const registry = createRegistry();
    const metadata = new MetadataExtractor({ repositoryPath }).extract();
    const evidenceGraph = new EvidenceGraph();

    const result = registry.execute({
      name: 'metadata-parser',
      input: metadata,
      evidenceGraph,
      provenance: {
        sourceType: 'tool',
        sourceId: 'metadata-parser@1.0.0',
        sourceVersion: '1.0.0',
        createdAt: metadata.extractedAt,
        runId: 'run-1',
        external: false,
      },
    });

    expect(result.output.repository.name).toBe(path.basename(repositoryPath));
    expect(evidenceGraph.listNodes().map((node) => node.id)).toContain('metadata:repository');
  });

  it('returns immutable outputs', () => {
    const registry = createRegistry();
    const metadata = new MetadataExtractor({ repositoryPath }).extract();
    const result = registry.execute({ name: 'readme-analyzer', input: metadata });

    expect(Object.isFrozen(result.output)).toBe(true);
    expect(Object.isFrozen(result.output.sections)).toBe(true);
  });
});

function createRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(new MetadataParser());
  registry.register(new DependencyScanner());
  registry.register(new DockerInspector());
  registry.register(new ReadmeAnalyzer());
  registry.register(new PolicyChecker());
  return registry;
}