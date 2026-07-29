export enum RunStatus {
  CREATED = 'CREATED',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export const terminalRunStatuses: readonly RunStatus[] = [
  RunStatus.COMPLETED,
  RunStatus.CANCELLED,
  RunStatus.FAILED,
] as const;