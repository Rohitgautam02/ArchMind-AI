import { describe, expect, it } from 'vitest';
import { MetadataExtractor } from '../metadata/metadata-extractor.js';
import { MetadataParser } from './metadata-parser.js';
import { ToolRegistry } from './tool-registry.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('MetadataParser', () => {
  it('normalizes metadata evidence', () => {
    const repositoryPath = createRepository();
    const metadata = new MetadataExtractor({ repositoryPath }).extract();
    const parser = new MetadataParser();

    const result = parser.execute(metadata);

    expect(result.output.repository.rootPath).toBe(repositoryPath);
    expect(result.output.languages.map((language) => language.name)).toContain('TypeScript');
  });

  it('is immutable', () => {
    const repositoryPath = createRepository();
    const metadata = new MetadataExtractor({ repositoryPath }).extract();
    const parser = new MetadataParser();

    const result = parser.execute(metadata);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.output.languages)).toBe(true);
  });
});

function createRepository(): string {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'archmind-metadata-parser-'));
  fs.writeFileSync(path.join(repositoryPath, 'package.json'), JSON.stringify({ name: 'sample', dependencies: { react: '^18.0.0' } }));
  fs.mkdirSync(path.join(repositoryPath, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repositoryPath, 'src', 'index.ts'), 'export const value = 1;');
  return repositoryPath;
}