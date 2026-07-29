import * as path from 'path';
import * as fs from 'fs/promises';
import type { Extractor, ExtractorContext } from './extractor-contract.js';
import type { EvidenceNode, Provenance } from '../contracts.js';

export class DockerfileExtractor implements Extractor {
  readonly id = 'DockerfileExtractor';

  async canHandle(context: ExtractorContext): Promise<boolean> {
    try {
      const dockerfilePath = path.join(context.targetPath, 'Dockerfile');
      await fs.access(dockerfilePath);
      return true;
    } catch {
      return false;
    }
  }

  async extract(context: ExtractorContext): Promise<ExtractorResult> {
    const dockerfilePath = path.join(context.targetPath, 'Dockerfile');
    const content = await fs.readFile(dockerfilePath, 'utf8');
    
    const lines = content.split('\n');
    const baseImages: string[] = [];
    const exposedPorts: string[] = [];
    const buildStages: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toUpperCase().startsWith('FROM ')) {
        const parts = trimmed.split(' ');
        if (parts.length > 1) {
          baseImages.push(parts[1]);
          if (parts.length >= 4 && parts[2].toUpperCase() === 'AS') {
            buildStages.push(parts[3]);
          }
        }
      } else if (trimmed.toUpperCase().startsWith('EXPOSE ')) {
        const parts = trimmed.split(' ');
        if (parts.length > 1) {
          exposedPorts.push(parts[1]);
        }
      }
    }

    const provenance: Provenance = {
      sourceType: 'metadata',
      sourceId: this.id,
      createdAt: new Date().toISOString(),
      runId: context.runId,
      external: false,
    };

    return {
      nodes: [
        Object.freeze({
          id: `${context.runId}:dockerfile`,
          kind: 'metadata:dockerfile',
          label: 'Dockerfile',
          value: {
            baseImages,
            exposedPorts,
            buildStages,
          },
          confidence: { score: 1.0, source: 'tool' as const, rationale: 'Parsed directly from Dockerfile' },
          provenance: Object.freeze([provenance]),
        })
      ],
      edges: []
    };
  }
}
