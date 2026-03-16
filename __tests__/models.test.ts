import { describe, test, expect } from '@jest/globals';
import { filterFreeModels } from '../src/models';

describe('models module', () => {
  test('filterFreeModels should only return models with :free suffix', () => {
    const models = [
      { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B', context_length: 4096, pricing: { prompt: '0', completion: '0' }, description: '' },
      { id: 'openai/gpt-4o', name: 'GPT-4o', context_length: 4096, pricing: { prompt: '0', completion: '0' }, description: '' },
      { id: 'anthropic/claude-3-haiku:free', name: 'Claude 3 Haiku', context_length: 4096, pricing: { prompt: '0', completion: '0' }, description: '' },
      { id: 'deepseek/deepseek-chat:free', name: 'DeepSeek Chat', context_length: 4096, pricing: { prompt: '0', completion: '0' }, description: '' },
      { id: 'google/gemini-1.5-flash', name: 'Gemini 1.5 Flash', context_length: 4096, pricing: { prompt: '0', completion: '0' }, description: '' }
    ] as any;

    const freeModels = filterFreeModels(models);
    expect(freeModels.length).toBe(3);
    expect(freeModels.map(m => m.id)).toEqual([
      'anthropic/claude-3-haiku:free',
      'deepseek/deepseek-chat:free',
      'meta-llama/llama-3.2-3b-instruct:free'
    ]);
  });

  test('filterFreeModels should return empty array when no free models', () => {
    const models = [
      { id: 'openai/gpt-4o', name: 'GPT-4o', context_length: 4096, pricing: { prompt: '0', completion: '0' }, description: '' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', context_length: 4096, pricing: { prompt: '0', completion: '0' }, description: '' }
    ] as any;

    const freeModels = filterFreeModels(models);
    expect(freeModels.length).toBe(0);
  });

  test('filterFreeModels should sort by name', () => {
    const models = [
      { id: 'z-model:free', name: 'Zebra Model', context_length: 4096, pricing: { prompt: '0', completion: '0' }, description: '' },
      { id: 'a-model:free', name: 'Alpha Model', context_length: 4096, pricing: { prompt: '0', completion: '0' }, description: '' },
      { id: 'm-model:free', name: 'Middle Model', context_length: 4096, pricing: { prompt: '0', completion: '0' }, description: '' }
    ] as any;

    const freeModels = filterFreeModels(models);
    expect(freeModels[0].name).toBe('Alpha Model');
    expect(freeModels[1].name).toBe('Middle Model');
    expect(freeModels[2].name).toBe('Zebra Model');
  });
});
