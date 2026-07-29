import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MetadataExtractor } from '../metadata/metadata-extractor.js';
import { DockerInspector } from './docker-inspector.js';

describe('DockerInspector', () => {
  it('detects Dockerfile and compose manifests', () => {
    const repositoryPath = createRepository();
    const metadata = new MetadataExtractor({ repositoryPath }).extract();
    const inspector = new DockerInspector();

    const result = inspector.execute(metadata);

    expect(result.output.dockerfiles[0]?.baseImages).toEqual(['node:20']);
    expect(result.output.composeFiles[0]?.services).toEqual(['web']);
  });
});

function createRepository(): string {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'archmind-docker-'));
  fs.writeFileSync(path.join(repositoryPath, 'Dockerfile'), 'FROM node:20\nEXPOSE 3000\n');
  fs.writeFileSync(path.join(repositoryPath, 'docker-compose.yml'), 'services:\n  web:\n    image: node:20\n');
  return repositoryPath;
}