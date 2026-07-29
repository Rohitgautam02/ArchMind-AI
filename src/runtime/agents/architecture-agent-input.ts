import type { WorkItem } from '../planner/work-item.js';

export interface ArchitectureAgentInput {
  readonly runId: string;
  readonly workItem: WorkItem;
}