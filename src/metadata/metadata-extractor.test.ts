import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { EvidenceGraph } from '../runtime/graph/evidence-graph.js';
import { MetadataExtractor } from './metadata-extractor.js';

let temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories) {
    fs.rmSync(directory, { recursive: true, force: true });
  }

  temporaryDirectories = [];
});

describe('MetadataExtractor', () => {
  it('scans repository', () => {
    const repositoryPath = createRepository({
      'package.json': JSON.stringify({ name: 'sample-repo', dependencies: { react: '^18.0.0' } }),
      'src/index.ts': 'export const value = 1;',
      'README.md': '# sample',
    });

    const result = new MetadataExtractor({ repositoryPath }).extract();

    expect(result.summary.repository.name).toBe(path.basename(repositoryPath));
    expect(result.summary.files.map((file) => file.relativePath)).toContain('src/index.ts');
  });

  it('detects languages', () => {
    const repositoryPath = createRepository({
      'src/index.ts': 'export const value = 1;',
      'src/app.js': 'export const value = 1;',
      'scripts/build.py': 'print("hello")',
      'cmd/main.go': 'package main',
      'src/lib.rs': 'fn main() {}',
      'src/Main.java': 'class Main {}',
    });

    const result = new MetadataExtractor({ repositoryPath }).extract();

    expect(result.summary.languages.map((language) => language.name)).toEqual([
      'Go',
      'Java',
      'JavaScript',
      'Python',
      'Rust',
      'TypeScript',
    ]);
  });

  it('detects frameworks', () => {
    const repositoryPath = createRepository({
      'package.json': JSON.stringify({
        name: 'sample-repo',
        dependencies: {
          react: '^18.0.0',
          next: '^14.0.0',
          express: '^4.0.0',
          '@nestjs/core': '^10.0.0',
          vue: '^3.0.0',
          '@angular/core': '^17.0.0',
        },
      }),
      'next.config.js': 'module.exports = {}',
      'src/App.tsx': 'export const App = () => null;',
    });

    const result = new MetadataExtractor({ repositoryPath }).extract();

    expect(result.summary.frameworks.map((framework) => framework.name)).toEqual([
      'Angular',
      'Express',
      'NestJS',
      'Next.js',
      'React',
      'Vue',
    ]);
  });

  it('detects package manager', () => {
    const repositoryPath = createRepository({
      'package.json': JSON.stringify({ name: 'sample-repo' }),
      'pnpm-lock.yaml': 'lockfileVersion: 5.4',
      'yarn.lock': '',
    });

    const result = new MetadataExtractor({ repositoryPath }).extract();

    expect(result.summary.packageManagers.map((manager) => manager.name)).toEqual(['package.json', 'pnpm-lock', 'yarn.lock']);
  });

  it('deterministic output', () => {
    const repositoryPath = createRepository({
      'package.json': JSON.stringify({ name: 'sample-repo', dependencies: { react: '^18.0.0' } }),
      'src/index.ts': 'export const value = 1;',
    });

    const extractor = new MetadataExtractor({ repositoryPath });

    expect(extractor.extract()).toEqual(extractor.extract());
  });

  it('empty repository', () => {
    const repositoryPath = createRepository({});

    const result = new MetadataExtractor({ repositoryPath }).extract();

    expect(result.summary.files).toEqual([]);
    expect(result.summary.languages).toEqual([]);
    expect(result.summary.frameworks).toEqual([]);
  });

  it('nested folders', () => {
    const repositoryPath = createRepository({
      'src/components/Button.tsx': 'export const Button = () => null;',
      'src/components/forms/Input.tsx': 'export const Input = () => null;',
    });

    const result = new MetadataExtractor({ repositoryPath }).extract();

    expect(result.summary.directories.map((directory) => directory.relativePath)).toContain('src/components/forms');
  });

  it('metadata added to EvidenceGraph', () => {
    const repositoryPath = createRepository({
      'package.json': JSON.stringify({ name: 'sample-repo', dependencies: { react: '^18.0.0' } }),
      'src/index.ts': 'export const value = 1;',
    });

    const result = new MetadataExtractor({ repositoryPath }).extract();
    const evidenceGraph = new EvidenceGraph();

    evidenceGraph.apply({
      nodes: result.summary.files.slice(0, 1).map((file) => ({
        id: `file:${file.relativePath}`,
        kind: 'file',
        label: file.relativePath,
        value: file,
        confidence: { score: 1, source: 'tool' as const },
        provenance: [{ sourceType: 'tool', sourceId: 'metadata-extractor', createdAt: result.extractedAt, runId: 'run-1', external: false }],
      })),
      provenance: { sourceType: 'tool', sourceId: 'metadata-extractor', createdAt: result.extractedAt, runId: 'run-1', external: false },
    });

    expect(evidenceGraph.listNodes()).toHaveLength(1);
  });
});

function createRepository(entries: Record<string, string>): string {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'archmind-metadata-'));
  temporaryDirectories.push(repositoryPath);

  for (const [relativePath, content] of Object.entries(entries)) {
    const absolutePath = path.join(repositoryPath, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }

  return repositoryPath;
}