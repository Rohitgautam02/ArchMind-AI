import type { EvidenceGraph } from './evidence-graph.js';
import type { Confidence } from '../contracts.js';

export class ConfidenceEngine {
  readonly #evidenceGraph: EvidenceGraph;

  constructor(evidenceGraph: EvidenceGraph) {
    this.#evidenceGraph = evidenceGraph;
  }

  /**
   * Recursively calculates the derived confidence of a node based on its supporting evidence.
   */
  calculateDerivedConfidence(baseScore: number, supportingEvidenceIds: string[]): number {
    if (supportingEvidenceIds.length === 0) {
      return baseScore;
    }

    const supportingScores = supportingEvidenceIds.map(id => {
      const node = this.#evidenceGraph.getNode(id);
      return node ? node.confidence.score : 0;
    });

    // We use a weighted average formula: 
    // Derived Confidence = (Base Score + Average of Supporting Scores) / 2
    const sum = supportingScores.reduce((acc, score) => acc + score, 0);
    const averageSupport = sum / supportingScores.length;

    return (baseScore + averageSupport) / 2;
  }
}
