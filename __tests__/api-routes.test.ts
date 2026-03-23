import { describe, test, expect, beforeAll } from '@jest/globals';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { resetRateLimitState } from '../src/rate-limit';

const originalFetch = global.fetch;
const TEST_RATE_LIMIT_FILE = join(process.cwd(), 'rate-limit-state.api-routes.test.json');
type ServerModule = typeof import('../src/server');
let app: ServerModule['app'];

beforeAll(async () => {
  delete process.env.https_proxy;
  delete process.env.http_proxy;
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;
  ({ app } = await import('../src/server'));
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env.RATE_LIMIT_FILE = TEST_RATE_LIMIT_FILE;
  resetRateLimitState();
  if (existsSync(TEST_RATE_LIMIT_FILE)) {
    rmSync(TEST_RATE_LIMIT_FILE, { force: true });
  }
});

beforeEach(() => {
  process.env.RATE_LIMIT_FILE = TEST_RATE_LIMIT_FILE;
  resetRateLimitState();
  if (existsSync(TEST_RATE_LIMIT_FILE)) {
    rmSync(TEST_RATE_LIMIT_FILE, { force: true });
  }
});

describe('API Routes', () => {
  test('GET /api/provider-keys should return provider key status object', async () => {
    const res = await app.request('/api/provider-keys', { method: 'GET' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('openrouter');
    expect(json).toHaveProperty('groq');
    expect(json).toHaveProperty('opencode');
  });

  test('PUT /admin/model should set selected model', async () => {
    const res = await app.request('/admin/model', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openrouter/auto:free' })
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.model).toBe('openrouter/auto:free');
  });

  test('POST /api/custom-models/verify should validate input', async () => {
    const res = await app.request('/api/custom-models/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: '', modelId: '' })
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  test('GET /api/custom-models should return list shape', async () => {
    const res = await app.request('/api/custom-models', { method: 'GET' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.models)).toBe(true);
  });

  test('GET /api/health-check should return health payload', async () => {
    const res = await app.request('/api/health-check', { method: 'GET' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('provider_health');
    expect(json).toHaveProperty('hint');
  });

  test('POST /v1/chat/completions should route gemini to generateContent', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-fallback-key';
    process.env.GEMINI_API_KEY = 'AIza-test';
    const requestedUrls: string[] = [];
    global.fetch = (async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      requestedUrls.push(url);

      if (url.includes(':generateContent')) {
        return new Response(JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'ok' }], role: 'model' },
              finishReason: 'STOP'
            }
          ],
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 1,
            totalTokenCount: 2
          },
          modelVersion: 'gemini-3.1-flash-lite-preview',
          responseId: 'resp-1'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        choices: [{ message: { content: 'unexpected' } }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    const res = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini/gemini-3.1-flash-lite-preview',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1
      })
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.choices?.[0]?.message?.content).toBe('ok');
    expect(json.object).toBe('chat.completion');
    expect(requestedUrls.some(url => url.includes(':generateContent'))).toBe(true);
  });
});
