import * as path from 'path';
import * as fs from 'fs/promises';
import type { Extractor, ExtractorContext, ExtractorResult } from './extractor-contract.js';
import type { EvidenceNode, EvidenceEdge, Provenance } from '../contracts.js';

export class ArchitectureDetector implements Extractor {
  readonly id = 'ArchitectureDetector';

  async canHandle(context: ExtractorContext): Promise<boolean> {
    try {
      const srcPath = path.join(context.targetPath, 'src');
      const stat = await fs.stat(srcPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async extract(context: ExtractorContext): Promise<ExtractorResult> {
    const srcPath = path.join(context.targetPath, 'src');
    const folders = await this.#getTopLevelFolders(srcPath);
    
    const nodes: EvidenceNode[] = [];
    const edges: EvidenceEdge[] = [];

    const provenance: Provenance = {
      sourceType: 'metadata',
      sourceId: this.id,
      createdAt: new Date().toISOString(),
      runId: context.runId,
      external: false,
    };

    const addArchitecture = (name: string, rationale: string) => {
      nodes.push(Object.freeze({
        id: `${context.runId}:architecture:${name.toLowerCase().replace(/ /g, '-')}`,
        kind: 'architecture:pattern',
        label: name,
        confidence: { score: 0.9, source: 'tool' as const, rationale },
        provenance: Object.freeze([provenance]),
      }));
    };

    // Heuristics
    const hasControllers = folders.includes('controllers');
    const hasServices = folders.includes('services');
    const hasRepositories = folders.includes('repositories');
    const hasDomain = folders.includes('domain');
    const hasInfrastructure = folders.includes('infrastructure');
    const hasApplication = folders.includes('application');
    const hasComponents = folders.includes('components');
    const hasPages = folders.includes('pages');
    const hasApp = folders.includes('app');

    if (hasControllers && hasServices && hasRepositories) {
      addArchitecture('Layered Architecture', 'Found controllers, services, and repositories folders');
    }

    if (hasDomain && hasInfrastructure && hasApplication) {
      addArchitecture('Clean Architecture / DDD', 'Found domain, infrastructure, and application folders');
    }

    if (hasComponents && (hasPages || hasApp)) {
      addArchitecture('Component-Based UI', 'Found components and pages/app folders');
    }

    return { nodes, edges };
  }

  async #getTopLevelFolders(dir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name.toLowerCase());
    } catch {
      return [];
    }
  }
}
