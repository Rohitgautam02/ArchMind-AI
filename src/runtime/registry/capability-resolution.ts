import type { ComponentDescriptor } from './component-descriptor.js';

export type VersionConstraint = string | undefined;

export interface CapabilityResolutionRequest {
  readonly capability: string;
  readonly versionConstraint?: VersionConstraint;
}

export interface CapabilityResolutionResult {
  readonly capability: string;
  readonly versionConstraint?: VersionConstraint;
  readonly candidates: readonly ComponentDescriptor[];
  readonly selected: ComponentDescriptor;
}

export class CapabilityResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CapabilityResolutionError';
  }
}

export class CapabilityNotFoundError extends CapabilityResolutionError {
  constructor(capability: string, versionConstraint?: VersionConstraint) {
    super(`No matching capability found for '${capability}'${versionConstraint ? ` with version constraint '${versionConstraint}'` : ''}`);
    this.name = 'CapabilityNotFoundError';
  }
}

export class AmbiguousCapabilityResolutionError extends CapabilityResolutionError {
  constructor(capability: string, candidates: readonly ComponentDescriptor[]) {
    super(
      `Ambiguous capability resolution for '${capability}'. Matching candidates: ${candidates.map((candidate) => candidate.id).join(', ')}`,
    );
    this.name = 'AmbiguousCapabilityResolutionError';
  }
}

export function resolveCapabilityCandidates(
  candidates: readonly ComponentDescriptor[],
  request: CapabilityResolutionRequest,
): CapabilityResolutionResult {
  const compatibleCandidates = request.versionConstraint
    ? candidates.filter((candidate) => satisfiesVersionConstraint(candidate.version, request.versionConstraint))
    : [...candidates];

  const orderedCandidates = [...compatibleCandidates].sort((left, right) => compareCandidates(left, right));

  if (orderedCandidates.length === 0) {
    throw new CapabilityNotFoundError(request.capability, request.versionConstraint);
  }

  const highestPriority = orderedCandidates[0].priority;
  const highestPriorityCandidates = orderedCandidates.filter((candidate) => candidate.priority === highestPriority);

  if (highestPriorityCandidates.length > 1) {
    throw new AmbiguousCapabilityResolutionError(request.capability, highestPriorityCandidates);
  }

  return {
    capability: request.capability,
    versionConstraint: request.versionConstraint,
    candidates: orderedCandidates,
    selected: orderedCandidates[0],
  };
}

export function listCapabilityNames(components: readonly ComponentDescriptor[]): readonly string[] {
  return [...new Set(components.map((component) => component.capability))].sort((left, right) => left.localeCompare(right));
}

export function compareCandidates(left: ComponentDescriptor, right: ComponentDescriptor): number {
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  const versionComparison = compareVersions(right.version, left.version);

  if (versionComparison !== 0) {
    return versionComparison;
  }

  return left.id.localeCompare(right.id);
}

export function satisfiesVersionConstraint(version: string, versionConstraint: VersionConstraint): boolean {
  if (!versionConstraint) {
    return true;
  }

  const clauses = versionConstraint.trim().split(/\s+/).filter(Boolean);

  if (clauses.length === 0) {
    return true;
  }

  return clauses.every((clause) => satisfiesClause(version, clause));
}

function satisfiesClause(version: string, clause: string): boolean {
  if (clause.startsWith('^')) {
    return satisfiesCaret(version, clause.slice(1));
  }

  if (clause.startsWith('~')) {
    return satisfiesTilde(version, clause.slice(1));
  }

  const operatorMatch = clause.match(/^(<=|>=|<|>|=)?(.+)$/);

  if (!operatorMatch) {
    return compareVersions(version, clause) === 0;
  }

  const operator = operatorMatch[1] ?? '=';
  const targetVersion = operatorMatch[2]?.trim() ?? '';
  const comparison = compareVersions(version, targetVersion);

  switch (operator) {
    case '=':
      return comparison === 0;
    case '>':
      return comparison > 0;
    case '>=':
      return comparison >= 0;
    case '<':
      return comparison < 0;
    case '<=':
      return comparison <= 0;
    default:
      return false;
  }
}

function satisfiesCaret(version: string, targetVersion: string): boolean {
  const { major, minor, patch } = parseVersion(targetVersion);
  const candidate = parseVersion(version);

  if (candidate.major !== major) {
    return false;
  }

  if (candidate.minor < minor) {
    return false;
  }

  if (candidate.minor === minor && candidate.patch < patch) {
    return false;
  }

  return true;
}

function satisfiesTilde(version: string, targetVersion: string): boolean {
  const { major, minor, patch } = parseVersion(targetVersion);
  const candidate = parseVersion(version);

  if (candidate.major !== major || candidate.minor !== minor) {
    return false;
  }

  return candidate.patch >= patch;
}

function compareVersions(left: string, right: string): number {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);

  if (leftVersion.major !== rightVersion.major) {
    return leftVersion.major - rightVersion.major;
  }

  if (leftVersion.minor !== rightVersion.minor) {
    return leftVersion.minor - rightVersion.minor;
  }

  if (leftVersion.patch !== rightVersion.patch) {
    return leftVersion.patch - rightVersion.patch;
  }

  return 0;
}

function parseVersion(version: string): { readonly major: number; readonly minor: number; readonly patch: number } {
  const [major = '0', minor = '0', patch = '0'] = version.trim().split('.');

  return {
    major: Number.parseInt(major, 10) || 0,
    minor: Number.parseInt(minor, 10) || 0,
    patch: Number.parseInt(patch, 10) || 0,
  };
}