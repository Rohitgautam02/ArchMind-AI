import * as path from 'path';
import * as fs from 'fs/promises';
import type { Extractor, ExtractorContext } from './extractor-contract.js';
import type { EvidenceNode, Provenance } from '../contracts.js';

export class ReadmeExtractor implements Extractor {
  readonly id = 'ReadmeExtractor';

  async canHandle(context: ExtractorContext): Promise<boolean> {
    try {
      const readmePath = path.join(context.targetPath, 'README.md');
      await fs.access(readmePath);
      return true;
    } catch {
      return false;
    }
  }

  async extract(context: ExtractorContext): Promise<ExtractorResult> {
    const readmePath = path.join(context.targetPath, 'README.md');
    const content = await fs.readFile(readmePath, 'utf8');

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
          id: `${context.runId}:readme`,
          kind: 'metadata:readme',
          label: 'README.md',
          value: {
            content,
            length: content.length,
          },
          confidence: { score: 1.0, source: 'tool' as const, rationale: 'Parsed directly from README.md' },
          provenance: Object.freeze([provenance]),
        })
      ],
      edges: []
    };
  }
}
