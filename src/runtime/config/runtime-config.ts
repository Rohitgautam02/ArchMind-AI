export interface RuntimeConfig {
  readonly timeouts: {
    readonly providerTimeoutMs: number;
    readonly agentTimeoutMs: number;
  };
  readonly retryPolicy: {
    readonly maxAttempts: number;
    readonly backoffMs: number;
  };
  readonly reviewer: {
    readonly minimumConfidenceThreshold: number;
  };
  readonly concurrency: {
    readonly maxConcurrentTasks: number;
  };
}

export const defaultRuntimeConfig: RuntimeConfig = {
  timeouts: {
    providerTimeoutMs: 60000,
    agentTimeoutMs: 120000,
  },
  retryPolicy: {
    maxAttempts: 3,
    backoffMs: 1000,
  },
  reviewer: {
    minimumConfidenceThreshold: 0.90,
  },
  concurrency: {
    maxConcurrentTasks: 2,
  },
};
