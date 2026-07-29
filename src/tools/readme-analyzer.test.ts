import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MetadataExtractor } from '../metadata/metadata-extractor.js';
import { ReadmeAnalyzer } from './readme-analyzer.js';

describe('ReadmeAnalyzer', () => {
  it('extracts title, sections, technologies, installation, and usage', () => {
    const repositoryPath = createRepository();
    const metadata = new MetadataExtractor({ repositoryPath }).extract();
    const analyzer = new ReadmeAnalyzer();

    const result = analyzer.execute(metadata);

    expect(result.output.title).toBe('ArchMind AI');
    expect(result.output.sections.map((section) => section.heading)).toEqual(['Installation', 'Usage']);
    expect(result.output.technologies).toContain('TypeScript');
    expect(result.output.installationInstructions).toContain('npm install');
    expect(result.output.usageSection).toContain('npm run dev');
  });
});

function createRepository(): string {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'archmind-readme-'));
  fs.writeFileSync(path.join(repositoryPath, 'README.md'), '# ArchMind AI\n\n## Installation\n\n```bash\nnpm install\n```\n\n## Usage\n\nUse TypeScript and run `npm run dev`.\n');
  return repositoryPath;
}