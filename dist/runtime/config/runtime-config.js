export const defaultRuntimeConfig = {
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
