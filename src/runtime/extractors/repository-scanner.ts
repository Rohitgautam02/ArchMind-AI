import type { EvidenceNode, Provenance } from '../contracts.js';
import type { Extractor, ExtractorContext } from './extractor-contract.js';

export class RepositoryScanner {
  readonly #extractors: Extractor[] = [];

  register(extractor: Extractor): void {
    this.#extractors.push(extractor);
  }

  async scan(targetPath: string, runId: string): Promise<{ provenance: Provenance; nodes: EvidenceNode[] }> {
    const context: ExtractorContext = { targetPath, runId };
    const nodes: EvidenceNode[] = [];
    
    const scanProvenance: Provenance = {
      sourceType: 'metadata',
      sourceId: 'RepositoryScanner',
      createdAt: new Date().toISOString(),
      runId,
      external: false,
    };

    const runPromises = this.#extractors.map(async (extractor) => {
      try {
        const canHandle = await extractor.canHandle(context);
        if (canHandle) {
          const results = await extractor.extract(context);
          return results;
        }
      } catch (error) {
        console.warn(`Extractor ${extractor.id} failed:`, error);
      }
      return [];
    });

    const resultsArray = await Promise.all(runPromises);
    for (const results of resultsArray) {
      nodes.push(...results);
    }
    
    // Add a base repository node to anchor the analysis
    nodes.push(
      Object.freeze({
        id: `${runId}:repository`,
        kind: 'metadata:repository',
        label: targetPath,
        confidence: { score: 1.0, source: 'tool' as const, rationale: 'Target repository path' },
        provenance: Object.freeze([scanProvenance]),
      })
    );

    return {
      provenance: scanProvenance,
      nodes,
    };
  }
}
