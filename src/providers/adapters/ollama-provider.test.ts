import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { OllamaProvider } from './ollama-provider.js';

describe('OllamaProvider', () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkHealth', () => {
    it('returns healthy when daemon is running', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'llama3' }, { name: 'mistral' }] }),
      } as Response);

      const provider = new OllamaProvider();
      const health = await provider.checkHealth();

      expect(health.isHealthy).toBe(true);
      expect(provider.supportedModels).toEqual(['llama3', 'mistral']);
    });

    it('returns unhealthy when daemon is down', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));

      const provider = new OllamaProvider();
      const health = await provider.checkHealth();

      expect(health.isHealthy).toBe(false);
      expect(health.details).toContain('fetch failed');
    });

    it('returns unhealthy on non-200 response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const provider = new OllamaProvider();
      const health = await provider.checkHealth();

      expect(health.isHealthy).toBe(false);
      expect(health.details).toContain('404');
    });
  });

  describe('invoke', () => {
    it('returns structured response on success', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Hello world',
          prompt_eval_count: 10,
          eval_count: 5,
        }),
      } as Response);

      const provider = new OllamaProvider();
      const result = await provider.invoke<string>({
        model: 'llama3',
        systemPrompt: 'sys',
        userPrompt: 'user',
      });

      expect(result.result).toBe('Hello world');
      expect(result.metrics.promptTokens).toBe(10);
      expect(result.metrics.totalTokens).toBe(15);
      expect(result.modelUsed).toBe('llama3');
    });

    it('parses JSON when expectedSchema is provided', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: '{"key":"value"}',
        }),
      } as Response);

      const provider = new OllamaProvider();
      const result = await provider.invoke<{ key: string }>({
        model: 'llama3',
        systemPrompt: 'sys',
        userPrompt: 'user',
        expectedSchema: { title: 'Test', description: '', fields: {} },
      });

      expect(result.result.key).toBe('value');
    });

    it('retries on fetch failure and succeeds', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'success' }),
      } as Response);

      const provider = new OllamaProvider({ retryDelayMs: 10, maxRetries: 2 });
      const result = await provider.invoke<string>({
        model: 'llama3',
        systemPrompt: 'sys',
        userPrompt: 'user',
      });

      expect(result.result).toBe('success');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('exhausts retries and throws', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));

      const provider = new OllamaProvider({ retryDelayMs: 10, maxRetries: 2 });
      
      await expect(provider.invoke({
        model: 'llama3',
        systemPrompt: 'sys',
        userPrompt: 'user',
      })).rejects.toThrow(/Ollama invoke failed after 3 attempts/); // 1 initial + 2 retries = 3 attempts

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('throws on non-200 API error without retry', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response);

      const provider = new OllamaProvider({ retryDelayMs: 10, maxRetries: 2 });
      
      await expect(provider.invoke({
        model: 'llama3',
        systemPrompt: 'sys',
        userPrompt: 'user',
      })).rejects.toThrow(/Ollama API error: 500 Internal Server Error/);
    });
  });
});
