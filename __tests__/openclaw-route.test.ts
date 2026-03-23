import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const OPENCLAW_ROUTE_TEST_DIR = join(process.cwd(), '.openclaw-route-test');

process.env.OPENCLAW_TEST_DIR = OPENCLAW_ROUTE_TEST_DIR;

import { app } from '../src/server';

describe('OpenClaw configure route', () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';
    if (existsSync(OPENCLAW_ROUTE_TEST_DIR)) {
      rmSync(OPENCLAW_ROUTE_TEST_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    if (existsSync(OPENCLAW_ROUTE_TEST_DIR)) {
      rmSync(OPENCLAW_ROUTE_TEST_DIR, { recursive: true, force: true });
    }
  });

  test('POST /api/configure-openclaw should reject invalid mode', async () => {
    const res = await app.request('/api/configure-openclaw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'invalid' })
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Invalid mode');
  });

  test('POST /api/configure-openclaw default mode should return explicit success message', async () => {
    const res = await app.request('/api/configure-openclaw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'default' })
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe('已设为 OpenClaw 默认模型');
  });

  test('POST /api/configure-openclaw fallback mode should return explicit message', async () => {
    const res = await app.request('/api/configure-openclaw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'fallback' })
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe('已加入 OpenClaw 备用模型');
  });
});
