import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MetadataExtractor } from '../metadata/metadata-extractor.js';
import { PolicyChecker } from './policy-checker.js';

describe('PolicyChecker', () => {
  it('returns structured policy findings', () => {
    const repositoryPath = createRepository();
    const metadata = new MetadataExtractor({ repositoryPath }).extract();
    const checker = new PolicyChecker();

    const result = checker.execute(metadata);

    expect(result.output.findings.map((finding) => finding.rule)).toContain('readme-present');
    expect(result.output.compliant).toBe(true);
  });

  it('flags missing metadata policies', () => {
    const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'archmind-policy-'));
    fs.writeFileSync(path.join(repositoryPath, 'package.json'), JSON.stringify({ name: 'sample' }));
    const metadata = new MetadataExtractor({ repositoryPath }).extract();
    const checker = new PolicyChecker();

    const result = checker.execute(metadata);

    expect(result.output.findings.some((finding) => finding.rule === 'readme-present' && !finding.passed)).toBe(true);
  });
});

function createRepository(): string {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'archmind-policy-ok-'));
  fs.writeFileSync(path.join(repositoryPath, 'package.json'), JSON.stringify({ name: 'sample', dependencies: { react: '^18.0.0' } }));
  fs.writeFileSync(path.join(repositoryPath, 'README.md'), '# Sample');
  return repositoryPath;
}