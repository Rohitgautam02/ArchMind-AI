import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MetadataExtractor } from '../metadata/metadata-extractor.js';
import { DependencyScanner } from './dependency-scanner.js';

describe('DependencyScanner', () => {
  it('extracts deterministic dependency records', () => {
    const repositoryPath = createRepository();
    const metadata = new MetadataExtractor({ repositoryPath }).extract();
    const scanner = new DependencyScanner();

    const result = scanner.execute(metadata);

    expect(result.output.dependencies.map((dependency) => dependency.package)).toEqual(['express', 'react', 'vitest']);
    expect(result.output.dependencies[0]?.source).toBe('package.json');
  });
});

function createRepository(): string {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'archmind-deps-'));
  fs.writeFileSync(path.join(repositoryPath, 'package.json'), JSON.stringify({
    name: 'sample',
    dependencies: { react: '^18.0.0', express: '^4.0.0' },
    devDependencies: { vitest: '^2.0.0' },
  }));
  return repositoryPath;
}