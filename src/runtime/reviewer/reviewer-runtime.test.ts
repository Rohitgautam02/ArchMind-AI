import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../events/event-bus.js';
import { EvidenceGraph } from '../graph/evidence-graph.js';
import { ReviewDecision } from './review-decision.js';
import { ReviewerRuntime } from './reviewer-runtime.js';
import type { EvidenceNode, Provenance } from '../contracts.js';
import type { ReviewerInput } from './reviewer-input.js';

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

  it('approves valid deterministic dependency evidence', () => {
    const fixture = createDependencyFixture();

    expect(fixture.reviewer.review(fixture.input).decision).toBe(ReviewDecision.APPROVED);
  });

  it('rejects missing dependency-health evidence', () => {
    const fixture = createDependencyFixture();

    expect(fixture.reviewer.review({ ...fixture.input, generatedEvidenceIds: ['missing'] }).decision).toBe(ReviewDecision.REJECTED);
  });

  it('rejects unresolved supporting evidence', () => {
    const fixture = createDependencyFixture({ usageSupportIds: ['missing-evidence'] });

    expect(fixture.reviewer.review(fixture.input).decision).toBe(ReviewDecision.REJECTED);
  });

  it('rejects declared usage inconsistent with manifest or imports', () => {
    const fixture = createDependencyFixture({ declaredAndImportedPackage: 'lodash' });

    expect(fixture.reviewer.review(fixture.input).decision).toBe(ReviewDecision.REJECTED);
  });

  it('rejects provider-only unused package claims', () => {
    const fixture = createDependencyFixture({ unusedPackages: ['axios'] });

    expect(fixture.reviewer.review(fixture.input).decision).toBe(ReviewDecision.REJECTED);
  });

  it('rejects resolved version mismatches', () => {
    const fixture = createDependencyFixture({ resolvedVersion: '9.9.9' });

    expect(fixture.reviewer.review(fixture.input).decision).toBe(ReviewDecision.REJECTED);
  });

  it('rejects duplicate version mismatches', () => {
    const fixture = createDependencyFixture({ duplicateVersions: ['1.0.0', '3.0.0'] });

    expect(fixture.reviewer.review(fixture.input).decision).toBe(ReviewDecision.REJECTED);
  });

  it('rejects duplicate claims with one resolved version', () => {
    const fixture = createDependencyFixture({ duplicateVersions: ['1.0.0'] });

    expect(fixture.reviewer.review(fixture.input).decision).toBe(ReviewDecision.REJECTED);
  });

  it('rejects wrong evidence kinds for dependency support', () => {
    const fixture = createDependencyFixture({ usageSupportIds: ['run-1:resolved:express'] });

    expect(fixture.reviewer.review(fixture.input).decision).toBe(ReviewDecision.REJECTED);
  });

  it('rejects supporting evidence from another run', () => {
    const fixture = createDependencyFixture({ manifestRunId: 'run-2' });

    expect(fixture.reviewer.review(fixture.input).decision).toBe(ReviewDecision.REJECTED);
  });

  it('approves valid duplicate and resolved evidence', () => {
    const fixture = createDependencyFixture();

    expect(fixture.reviewer.review(fixture.input).decision).toBe(ReviewDecision.APPROVED);
  });
});

interface DependencyFixtureOptions {
  readonly usageSupportIds?: readonly string[];
  readonly declaredAndImportedPackage?: string;
  readonly unusedPackages?: readonly string[];
  readonly resolvedVersion?: string;
  readonly duplicateVersions?: readonly string[];
  readonly manifestRunId?: string;
}

function createDependencyFixture(options: DependencyFixtureOptions = {}): { readonly reviewer: ReviewerRuntime; readonly input: ReviewerInput } {
  const runId = 'run-1';
  const manifestRunId = options.manifestRunId ?? runId;
  const provenance = createProvenance(manifestRunId);
  const manifest = node('run-1:package-json', 'metadata:package-json', {
    dependencies: { express: '^5.0.0', lodash: '^4.0.0' },
    devDependencies: {},
    peerDependencies: {},
    optionalDependencies: {},
  }, provenance);
  const expressModule = node('run-1:module:express', 'ast:module', undefined, provenance, 'express');
  const resolvedExpress = node('run-1:resolved:express', 'dependency:resolved', {
    package: 'express',
    resolvedVersion: '5.0.0',
    location: 'node_modules/express',
    isDirect: true,
    declaredVersion: '^5.0.0',
    dependencyType: 'dependencies',
    supportingEvidenceIds: ['run-1:resolved:express'],
  }, provenance, 'express');
  const duplicateLodash = node('run-1:duplicate:lodash', 'dependency:duplicate-version', {
    package: 'lodash',
    versions: ['4.17.15', '4.17.21'],
    locations: ['node_modules/a/node_modules/lodash', 'node_modules/lodash'],
    supportingEvidenceIds: ['run-1:resolved:lodash-a', 'run-1:resolved:lodash-root'],
  }, provenance, 'lodash');
  const resolvedLodashA = node('run-1:resolved:lodash-a', 'dependency:resolved', {
    package: 'lodash', resolvedVersion: '4.17.15', location: 'node_modules/a/node_modules/lodash', isDirect: false,
    supportingEvidenceIds: ['run-1:resolved:lodash-a'],
  }, provenance, 'lodash');
  const resolvedLodashRoot = node('run-1:resolved:lodash-root', 'dependency:resolved', {
    package: 'lodash', resolvedVersion: '4.17.21', location: 'node_modules/lodash', isDirect: true,
    declaredVersion: '^4.0.0', dependencyType: 'dependencies', supportingEvidenceIds: ['run-1:resolved:lodash-root'],
  }, provenance, 'lodash');
  const declaredPackage = options.declaredAndImportedPackage ?? 'express';
  const usageSupportIds = options.usageSupportIds ?? ['run-1:package-json', 'run-1:module:express'];
  const usage = {
    declaredAndImported: [{ package: declaredPackage, version: declaredPackage === 'express' ? '^5.0.0' : '^4.0.0', dependencyType: 'dependencies', supportingEvidenceIds: usageSupportIds, importedEvidenceIds: ['run-1:module:express'], runtimeUnused: false }],
    declaredButNotImported: [{ package: 'lodash', version: '^4.0.0', dependencyType: 'dependencies', supportingEvidenceIds: ['run-1:package-json'], importedEvidenceIds: [], runtimeUnused: true }],
    importedButUndeclared: [],
  };
  const health = node('run-1:dependency-health', 'analysis:dependency-health', {
    directDependencyUsage: usage,
    unusedPackages: options.unusedPackages ?? ['lodash'],
    resolvedDependencies: [{ package: 'express', resolvedVersion: options.resolvedVersion ?? '5.0.0', location: 'node_modules/express', isDirect: true, declaredVersion: '^5.0.0', dependencyType: 'dependencies', supportingEvidenceIds: ['run-1:resolved:express'] }],
    duplicateVersions: [{
      package: 'lodash',
      versions: options.duplicateVersions ?? ['4.17.15', '4.17.21'],
      locations: ['node_modules/a/node_modules/lodash', 'node_modules/lodash'],
      supportingEvidenceIds: ['run-1:resolved:lodash-a', 'run-1:resolved:lodash-root'],
    }],
    duplicateDependencies: [],
    risks: [],
    healthScore: 80,
  }, provenance);
  const graph = new EvidenceGraph();
  graph.apply({ nodes: [manifest, expressModule, resolvedExpress, duplicateLodash, resolvedLodashA, resolvedLodashRoot, health], provenance });
  return {
    reviewer: new ReviewerRuntime({ evidenceGraph: graph, eventBus: new EventBus() }),
    input: { runId, workItemId: 'work-1', capability: 'DependencyAnalysis', confidence: 0.95, generatedEvidenceIds: [health.id], findings: ['Dependency analysis'], evidenceGraph: graph.snapshot(runId) },
  };
}

function createProvenance(runId: string): Provenance {
  return { sourceType: 'tool', sourceId: 'test-fixture', createdAt: '2026-07-28T00:00:00.000Z', runId, external: false };
}

function node(id: string, kind: string, value: unknown, provenance: Provenance, label = kind): EvidenceNode {
  return { id, kind, label, value, confidence: { score: 1, source: 'tool' }, provenance: [provenance] };
}