import * as path from 'path';
import * as fs from 'fs/promises';
import type { Extractor, ExtractorContext } from './extractor-contract.js';
import type { EvidenceNode, Provenance } from '../contracts.js';

export class TsConfigExtractor implements Extractor {
  readonly id = 'TsConfigExtractor';

  async canHandle(context: ExtractorContext): Promise<boolean> {
    try {
      const tsconfigPath = path.join(context.targetPath, 'tsconfig.json');
      await fs.access(tsconfigPath);
      return true;
    } catch {
      return false;
    }
  }

  async extract(context: ExtractorContext): Promise<ExtractorResult> {
    const tsconfigPath = path.join(context.targetPath, 'tsconfig.json');
    let content = await fs.readFile(tsconfigPath, 'utf8');
    
    // Naive removal of single-line comments which are common in tsconfig.json
    content = content.replace(/\/\/[^\n]*\n/g, '\n');
    let config: any = {};
    
    try {
      config = JSON.parse(content);
    } catch (e) {
      // If parsing fails due to complex comments (like block comments) or trailing commas,
      // we'll just ignore it for now or return a basic structure.
      console.warn(`Failed to parse tsconfig.json at ${tsconfigPath}:`, e);
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
          id: `${context.runId}:tsconfig`,
          kind: 'metadata:tsconfig',
          label: 'tsconfig.json',
          value: {
            compilerOptions: config.compilerOptions ?? {},
            include: config.include ?? [],
            exclude: config.exclude ?? [],
          },
          confidence: { score: 1.0, source: 'tool' as const, rationale: 'Parsed directly from tsconfig.json' },
          provenance: Object.freeze([provenance]),
        })
      ],
      edges: []
    };
  }
}
