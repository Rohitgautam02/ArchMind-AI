import * as path from 'path';
import * as fs from 'fs/promises';
import type { Extractor, ExtractorContext } from './extractor-contract.js';
import type { EvidenceNode, Provenance } from '../contracts.js';

export class PackageJsonExtractor implements Extractor {
  readonly id = 'PackageJsonExtractor';

  async canHandle(context: ExtractorContext): Promise<boolean> {
    try {
      const packagePath = path.join(context.targetPath, 'package.json');
      await fs.access(packagePath);
      return true;
    } catch {
      return false;
    }
  }

  async extract(context: ExtractorContext): Promise<ExtractorResult> {
    const packagePath = path.join(context.targetPath, 'package.json');
    const content = await fs.readFile(packagePath, 'utf8');
    const pkg = JSON.parse(content);

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
          id: `${context.runId}:package-json`,
          kind: 'metadata:package-json',
          label: 'package.json',
          value: {
            name: pkg.name,
            version: pkg.version,
            dependencies: pkg.dependencies ?? {},
            devDependencies: pkg.devDependencies ?? {},
            scripts: pkg.scripts ?? {},
            engines: pkg.engines ?? {},
            workspaces: pkg.workspaces ?? [],
          },
          confidence: { score: 1.0, source: 'tool' as const, rationale: 'Parsed directly from package.json' },
          provenance: Object.freeze([provenance]),
        })
      ],
      edges: []
    };
  }
}
