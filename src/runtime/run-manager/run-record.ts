import type { RunContext } from './run-context.js';
import { RunStatus } from './run-status.js';

export interface RunRecord {
  readonly runId: string;
  readonly status: RunStatus;
  readonly context: RunContext;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly cancelledAt?: string;
  readonly failureReason?: string;
}

export interface RunRecordInput {
  readonly runId: string;
  readonly status: RunStatus;
  readonly context: RunContext;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly cancelledAt?: string;
  readonly failureReason?: string;
}