import { ProviderError } from '../../runtime/errors/runtime-errors.js';
export class OllamaProvider {
    name = 'ollama';
    #baseUrl;
    #defaultModel;
    #maxRetries;
    #retryDelayMs;
    #supportedModels = [];
    constructor(config) {
        this.#baseUrl = config?.baseUrl ?? 'http://127.0.0.1:11434';
        this.#defaultModel = config?.defaultModel ?? 'llama3';
        this.#maxRetries = config?.maxRetries ?? 3;
        this.#retryDelayMs = config?.retryDelayMs ?? 1000;
    }
    get defaultModel() {
        return this.#defaultModel;
    }
    get supportedModels() {
        return Object.freeze([...this.#supportedModels]);
    }
    async checkHealth() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const response = await fetch(`${this.#baseUrl}/api/tags`, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                return { isHealthy: false, details: `Ollama daemon returned status ${response.status}` };
            }
            const data = await response.json();
            this.#supportedModels = data.models?.map((m) => m.name) ?? [];
            return { isHealthy: true, details: `Ollama daemon is running. ${this.#supportedModels.length} models available.` };
        }
        catch (error) {
            return { isHealthy: false, details: `Failed to connect to Ollama at ${this.#baseUrl}: ${error instanceof Error ? error.message : String(error)}` };
        }
    }
    async invoke(request) {
        let attempts = 0;
        let lastError;
        while (attempts <= this.#maxRetries) {
            try {
                return await this.#executeRequest(request);
            }
            catch (error) {
                attempts += 1;
                lastError = error instanceof Error ? error : new Error(String(error));
                if (error.name === 'AbortError') {
                    // Timeouts are retried
                }
                else if (error instanceof SyntaxError) {
                    // JSON parse errors might be retried
                }
                else {
                    // Other network errors could be retried
                }
                if (attempts <= this.#maxRetries) {
                    await new Promise((resolve) => setTimeout(resolve, this.#retryDelayMs * attempts));
                }
            }
        }
        throw new ProviderError(`Ollama invoke failed after ${attempts} attempts. Last error: ${lastError?.message}`);
    }
    async #executeRequest(request) {
        const startTime = Date.now();
        const model = request.model || this.#defaultModel;
        const timeoutMs = request.timeoutMs ?? 30000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const payload = {
            model,
            system: request.systemPrompt,
            prompt: request.userPrompt,
            stream: false,
            format: request.expectedSchema ? 'json' : undefined,
            options: {
                temperature: request.temperature ?? 0.1,
                num_predict: request.maxTokens,
            },
        };
        const response = await fetch(`${this.#baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'unknown');
            throw new ProviderError(`Ollama API error: ${response.status} ${errorText}`);
        }
        const data = await response.json();
        const rawText = data.response;
        let result;
        if (request.expectedSchema) {
            // NOTE: Architectural Boundary
            // The Provider Adapter's responsibility is network I/O, retries, and returning a generic parsed object.
            // We explicitly trust JSON.parse here. Strict schema validation (e.g., Zod) against expectedSchema 
            // is intentionally deferred to the AgentRuntime boundary before mapping to Evidence.
            result = JSON.parse(rawText);
        }
        else {
            result = rawText;
        }
        return Object.freeze({
            result,
            rawText,
            modelUsed: model,
            providerName: this.name,
            metrics: Object.freeze({
                promptTokens: data.prompt_eval_count,
                completionTokens: data.eval_count,
                totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
                durationMs: Date.now() - startTime,
            }),
        });
    }
}
