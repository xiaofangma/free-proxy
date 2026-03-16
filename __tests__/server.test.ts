import request from 'supertest';
import { Hono } from 'hono';
import app from '../src/server';
import { getConfig, setConfig } from '../src/config';
import { proxyRequest } from '../src/proxy';

// Mock依赖
jest.mock('../src/config');
jest.mock('../src/proxy');

const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const mockSetConfig = setConfig as jest.MockedFunction<typeof setConfig>;
const mockProxyRequest = proxyRequest as jest.MockedFunction<typeof proxyRequest>;

describe('API endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfig.mockResolvedValue({ default_model: 'default-model:free' });
  });

  test('GET /admin/models should return free models and current model', async () => {
    const res = await request(app.fetch).get('/admin/models');
    expect(res.status).toBe(200);
    expect(res.body.current).toBe('default-model:free');
    expect(Array.isArray(res.body.models)).toBe(true);
  });

  test('PUT /admin/model should update default model', async () => {
    mockSetConfig.mockResolvedValue({ default_model: 'new-model:free' });
    
    const res = await request(app.fetch)
      .put('/admin/model')
      .send({ model: 'new-model:free' });
    
    expect(res.status).toBe(200);
    expect(res.body.model).toBe('new-model:free');
    expect(mockSetConfig).toHaveBeenCalledWith({ default_model: 'new-model:free' });
  });

  test('PUT /admin/model should reject non-free model', async () => {
    const res = await request(app.fetch)
      .put('/admin/model')
      .send({ model: 'paid-model' });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid free model');
  });

  test('POST /v1/chat/completions should forward request to OpenRouter', async () => {
    mockProxyRequest.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        id: 'test-id',
        model: 'default-model:free',
        choices: [{ message: { role: 'assistant', content: 'Hello' } }]
      }),
      headers: new Headers()
    } as any);

    const res = await request(app.fetch)
      .post('/v1/chat/completions')
      .send({
        messages: [{ role: 'user', content: 'Hi' }]
      });
    
    expect(res.status).toBe(200);
    expect(res.body.choices[0].message.content).toBe('Hello');
    expect(mockProxyRequest).toHaveBeenCalledWith(
      '/chat/completions',
      'POST',
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'default-model:free' // 应该自动补全默认模型
      }),
      expect.any(Object)
    );
  });

  test('POST /v1/chat/completions should use model from request if provided', async () => {
    mockProxyRequest.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ model: 'custom-model:free' }),
      headers: new Headers()
    } as any);

    await request(app.fetch)
      .post('/v1/chat/completions')
      .send({
        model: 'custom-model:free',
        messages: [{ role: 'user', content: 'Hi' }]
      });
    
    expect(mockProxyRequest).toHaveBeenCalledWith(
      '/chat/completions',
      'POST',
      expect.objectContaining({
        model: 'custom-model:free' // 应该使用请求指定的模型
      }),
      expect.any(Object)
    );
  });

  test('POST /v1/chat/completions should handle streaming response', async () => {
    mockProxyRequest.mockResolvedValueOnce({
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"He"}}]}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"llo"}}]}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        }
      }),
      headers: new Headers({ 'Content-Type': 'text/event-stream' })
    } as any);

    const res = await request(app.fetch)
      .post('/v1/chat/completions')
      .send({
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true
      });
    
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('data: {"choices":[{"delta":{"content":"He"}}]');
    expect(res.text).toContain('data: [DONE]');
  });

  test('API should return error when proxy fails', async () => {
    mockProxyRequest.mockRejectedValueOnce(new Error('OpenRouter API error'));
    
    const res = await request(app.fetch)
      .post('/v1/chat/completions')
      .send({ messages: [{ role: 'user', content: 'Hi' }] });
    
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('OpenRouter API error');
  });
});
