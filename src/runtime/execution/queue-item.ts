import type { WorkItem } from '../planner/work-item.js';

export interface QueueItem extends WorkItem {
  readonly runId: string;
  readonly sequence: number;
}