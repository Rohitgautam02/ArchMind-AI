import type { Confidence } from '../runtime/contracts.js';

export interface ToolEvidenceNode {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly value?: unknown;
  readonly confidence: Confidence;
}

export interface ToolEvidenceEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly relation: string;
  readonly confidence: Confidence;
}

export interface ToolEvidenceDraft {
  readonly nodes?: readonly ToolEvidenceNode[];
  readonly edges?: readonly ToolEvidenceEdge[];
}

export interface ToolExecutionResult<TOutput = unknown> {
  readonly toolId: string;
  readonly toolName: string;
  readonly capability: string;
  readonly version: string;
  readonly output: Readonly<TOutput>;
  readonly evidence?: ToolEvidenceDraft;
}

export const deterministicToolConfidence: Confidence = Object.freeze({
  score: 1,
  source: 'tool',
});

export function freezeToolValue<T>(value: T): Readonly<T> {
  return deepFreeze(structuredClone(value));
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Object.isFrozen(value)) {
    return value;
  }

  for (const property of Object.keys(value as object)) {
    const nestedValue = (value as Record<string, unknown>)[property];
    if (nestedValue && typeof nestedValue === 'object') {
      deepFreeze(nestedValue);
    }
  }

  return Object.freeze(value);
}