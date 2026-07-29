export type WorkItemPriority = 'Low' | 'Normal' | 'High';

export interface WorkItem {
  readonly id: string;
  readonly capability: string;
  readonly priority: WorkItemPriority;
  readonly dependencies: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}