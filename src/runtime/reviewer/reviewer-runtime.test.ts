import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../events/event-bus.js';
import { EvidenceGraph } from '../graph/evidence-graph.js';
import { ReviewDecision } from './review-decision.js';
import { ReviewerRuntime } from './reviewer-runtime.js';

const createRuntime = () => new ReviewerRuntime({ evidenceGraph: new EvidenceGraph(), eventBus: new EventBus() });

const createValidInput = () => ({
  runId: 'run-1',
  workItemId: 'work-1',
  capability: 'ArchitectureAgent',
  confidence: 0.95,
  generatedEvidenceIds: ['node-1', 'node-2'],
  findings: ['Repository detected', 'Architecture detected'],
  evidenceGraph: new EvidenceGraph().snapshot('run-1'),
});

describe('ReviewerRuntime', () => {
  it('approve valid result', () => {
    const reviewer = createRuntime();

    const result = reviewer.review(createValidInput());

    expect(result.decision).toBe(ReviewDecision.APPROVED);
  });

  it('reject missing evidence', () => {
    const reviewer = createRuntime();

    expect(() => reviewer.validate({ ...createValidInput(), generatedEvidenceIds: [] })).toThrow('No evidence produced');
  });

  it('reject invalid confidence', () => {
    const reviewer = createRuntime();

    expect(() => reviewer.validate({ ...createValidInput(), confidence: 2 })).toThrow('Invalid confidence');
  });

  it('request reanalysis', () => {
    const reviewer = createRuntime();

    const result = reviewer.review({ ...createValidInput(), confidence: 0.2 });

    expect(result.decision).toBe(ReviewDecision.REANALYSIS_REQUIRED);
  });

  it('deterministic behavior', () => {
    const reviewer = createRuntime();

    const first = reviewer.review(createValidInput());
    const second = reviewer.review(createValidInput());

    expect(first.decision).toBe(second.decision);
    expect(first.reasons).toEqual(second.reasons);
  });

  it('immutable outputs', () => {
    const reviewer = createRuntime();

    const result = reviewer.review(createValidInput());

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.reasons)).toBe(true);
    expect(Object.isFrozen(result.evidenceIds)).toBe(true);
  });

  it('events emitted', () => {
    const eventBus = new EventBus();
    const publishSpy = vi.spyOn(eventBus, 'publish');
    const reviewer = new ReviewerRuntime({ evidenceGraph: new EvidenceGraph(), eventBus });

    reviewer.review(createValidInput());

    expect(publishSpy.mock.calls.map((call) => call[0]?.type)).toEqual([
      'ReviewerRequested',
      'ReviewerApproved',
    ]);
  });

  it('reanalysis event emitted', () => {
    const eventBus = new EventBus();
    const publishSpy = vi.spyOn(eventBus, 'publish');
    const reviewer = new ReviewerRuntime({ evidenceGraph: new EvidenceGraph(), eventBus });

    reviewer.review({ ...createValidInput(), confidence: 0.2 });

    expect(publishSpy.mock.calls.map((call) => call[0]?.type)).toEqual([
      'ReviewerRequested',
      'ReviewerReanalysisRequested',
    ]);
  });
});