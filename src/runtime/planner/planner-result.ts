import type { RuntimeMetadata } from '../contracts.js';
import type { ExecutionPlan } from './execution-plan.js';

export interface PlannerRunContext {
  readonly metadata: RuntimeMetadata;
}

export interface PlannerResult {
  readonly runId: string;
  readonly executionPlan: ExecutionPlan;
  readonly inspectedCapabilities: readonly string[];
  readonly evidenceNodeCount: number;
  readonly evidenceEdgeCount: number;
  readonly createdAt: string;
}