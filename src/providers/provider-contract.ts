

export interface ProviderRequest {
  readonly model: string;
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly expectedSchema?: Record<string, unknown>;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly timeoutMs?: number;
}

export interface ProviderResponse<T = unknown> {
  readonly result: T;
  readonly rawText: string;
  readonly modelUsed: string;
  readonly providerName: string;
  readonly metrics: {
    readonly promptTokens?: number;
    readonly completionTokens?: number;
    readonly totalTokens?: number;
    readonly durationMs: number;
  };
}

export interface ProviderHealth {
  readonly isHealthy: boolean;
  readonly details: string;
}

export interface ProviderAdapter {
  readonly name: string;
  readonly defaultModel: string;
  readonly supportedModels: readonly string[];

  checkHealth(): Promise<ProviderHealth>;
  invoke<T>(request: ProviderRequest): Promise<ProviderResponse<T>>;
}
