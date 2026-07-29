import * as path from 'path';
import * as fs from 'fs/promises';
import type { Extractor, ExtractorContext, ExtractorResult } from './extractor-contract.js';
import type { EvidenceNode, EvidenceEdge, Provenance } from '../contracts.js';

export class FrameworkDetector implements Extractor {
  readonly id = 'FrameworkDetector';

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
    
    const allDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {})
    };

    const nodes: EvidenceNode[] = [];
    const edges: EvidenceEdge[] = [];

    const provenance: Provenance = {
      sourceType: 'metadata',
      sourceId: this.id,
      createdAt: new Date().toISOString(),
      runId: context.runId,
      external: false,
    };

    const addFramework = (name: string, kind: string, rationale: string) => {
      nodes.push(Object.freeze({
        id: `${context.runId}:framework:${name.toLowerCase()}`,
        kind: `framework:${kind}`,
        label: name,
        confidence: { score: 1.0, source: 'tool' as const, rationale },
        provenance: Object.freeze([provenance]),
      }));
    };

    if (allDeps['react']) {
      if (allDeps['next']) {
        addFramework('Next.js', 'frontend', 'Found next and react dependencies');
      } else {
        addFramework('React', 'frontend', 'Found react dependency');
      }
    }

    if (allDeps['@angular/core']) {
      addFramework('Angular', 'frontend', 'Found @angular/core dependency');
    }

    if (allDeps['vue']) {
      addFramework('Vue', 'frontend', 'Found vue dependency');
    }

    if (allDeps['express']) {
      addFramework('Express', 'backend', 'Found express dependency');
    }

    if (allDeps['@nestjs/core']) {
      addFramework('NestJS', 'backend', 'Found @nestjs/core dependency');
    }
    
    if (allDeps['typescript']) {
      addFramework('TypeScript', 'language', 'Found typescript dependency');
    }

    return { nodes, edges };
  }
}
