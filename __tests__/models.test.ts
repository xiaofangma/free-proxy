import { fetchModels, filterFreeModels } from '../src/models';
import fetch from 'node-fetch';

// Mock fetch
jest.mock('node-fetch');
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('models module', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  test('fetchModels should call OpenRouter API with correct headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 'model1:free', name: 'Model 1', context_length: 4096 },
          { id: 'model2', name: 'Model 2', context_length: 8192 }
        ]
      })
    } as any);

    const models = await fetchModels(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': expect.stringContaining('Bearer '),
          'HTTP-Referer': 'http://localhost:8765',
          'X-Title': 'OpenRouter Free Proxy'
        })
      })
    );
    expect(models.length).toBe(2);
  });

  test('filterFreeModels should only return models with :free suffix', () => {
    const models = [
      { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B' },
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'anthropic/claude-3-haiku:free', name: 'Claude 3 Haiku' },
      { id: 'deepseek/deepseek-chat:free', name: 'DeepSeek Chat' },
      { id: 'google/gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
    ] as any;

    const freeModels = filterFreeModels(models);
    expect(freeModels.length).toBe(3);
    expect(freeModels.map(m => m.id)).toEqual([
      'anthropic/claude-3-haiku:free',
      'deepseek/deepseek-chat:free',
      'meta-llama/llama-3.2-3b-instruct:free'
    ]);
  });

  test('fetchModels should throw error when API call fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Unauthorized'
    } as any);

    await expect(fetchModels(true)).rejects.toThrow('Failed to fetch models: Unauthorized');
  });

  test('fetchModels should use cache when not force refreshing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    } as any);

    // 第一次调用，请求API
    await fetchModels(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // 第二次调用，使用缓存，不请求API
    await fetchModels(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
