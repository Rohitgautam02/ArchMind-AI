import type { WorkItem } from './work-item.js';

export interface ExecutionPlan {
  readonly runId: string;
  readonly workItems: readonly WorkItem[];
  readonly createdAt: string;
}