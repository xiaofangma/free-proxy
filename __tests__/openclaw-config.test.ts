import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { existsSync, writeFileSync, rmSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OPENCLAW_DIR = join(process.cwd(), '.openclaw-test-local');
const CONFIG_PATH = join(OPENCLAW_DIR, 'openclaw.json');

describe('OpenClaw Config', () => {
  beforeEach(() => {
    process.env.OPENCLAW_TEST_DIR = OPENCLAW_DIR;
    if (existsSync(OPENCLAW_DIR)) {
      rmSync(OPENCLAW_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (existsSync(OPENCLAW_DIR)) {
      rmSync(OPENCLAW_DIR, { recursive: true, force: true });
    }
    delete process.env.OPENCLAW_TEST_DIR;
  });

  test('detectOpenClawConfig should return not exists initially', async () => {
    const { detectOpenClawConfig } = await import('../src/openclaw-config');
    const result = await detectOpenClawConfig();
    expect(result.exists).toBe(false);
    expect(result.isValid).toBe(false);
  });

  test('configureOpenClawModel default mode should create provider and set primary model', async () => {
    const { configureOpenClawModel } = await import('../src/openclaw-config');
    const result = await configureOpenClawModel('default');
    expect(result.success).toBe(true);
    expect(existsSync(CONFIG_PATH)).toBe(true);

    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    expect(config.models.providers['free-proxy']).toBeDefined();
    expect(config.agents.defaults.models['free-proxy/auto']).toBeDefined();
    expect(config.agents.defaults.model.primary).toBe('free-proxy/auto');
  });

  test('configureOpenClawModel fallback mode should only inject provider and allowlist when defaults.model is missing', async () => {
    const { configureOpenClawModel } = await import('../src/openclaw-config');
    const result = await configureOpenClawModel('fallback');

    expect(result.success).toBe(true);
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    expect(config.models.providers['free-proxy']).toBeDefined();
    expect(config.agents.defaults.models['free-proxy/auto']).toBeDefined();
    expect(config.agents.defaults.model).toBeUndefined();
  });

  test('configureOpenClawModel fallback mode should append fallback when defaults.model.primary exists', async () => {
    const { configureOpenClawModel } = await import('../src/openclaw-config');
    mkdirSync(OPENCLAW_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify({
      agents: {
        defaults: {
          model: {
            primary: 'openrouter/auto:free',
            fallbacks: ['groq/llama-3.1-8b-instant']
          }
        }
      }
    }));

    const result = await configureOpenClawModel('fallback');
    expect(result.success).toBe(true);

    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    expect(config.agents.defaults.model.primary).toBe('openrouter/auto:free');
    expect(config.agents.defaults.model.fallbacks).toEqual([
      'groq/llama-3.1-8b-instant',
      'free-proxy/auto'
    ]);
  });

  test('configureOpenClawModel fallback mode should convert string model to object with fallback', async () => {
    const { configureOpenClawModel } = await import('../src/openclaw-config');
    mkdirSync(OPENCLAW_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify({
      agents: {
        defaults: {
          model: 'openrouter/auto:free'
        }
      }
    }));

    const result = await configureOpenClawModel('fallback');
    expect(result.success).toBe(true);

    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    expect(config.agents.defaults.model).toEqual({
      primary: 'openrouter/auto:free',
      fallbacks: ['free-proxy/auto']
    });
  });

  test('configureOpenClawModel fallback mode should not duplicate fallback entries', async () => {
    const { configureOpenClawModel } = await import('../src/openclaw-config');
    mkdirSync(OPENCLAW_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify({
      agents: {
        defaults: {
          model: {
            primary: 'openrouter/auto:free',
            fallbacks: ['free-proxy/auto']
          }
        }
      }
    }));

    const first = await configureOpenClawModel('fallback');
    expect(first.success).toBe(true);
    const second = await configureOpenClawModel('fallback');
    expect(second.success).toBe(true);

    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    expect(config.agents.defaults.model.fallbacks).toEqual(['free-proxy/auto']);
  });

  test('configureOpenClawModel default mode should overwrite primary but keep existing fallbacks', async () => {
    const { configureOpenClawModel } = await import('../src/openclaw-config');
    mkdirSync(OPENCLAW_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify({
      agents: {
        defaults: {
          model: {
            primary: 'openrouter/auto:free',
            fallbacks: ['groq/llama-3.1-8b-instant']
          }
        }
      }
    }));

    const result = await configureOpenClawModel('default');
    expect(result.success).toBe(true);

    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    expect(config.agents.defaults.model.primary).toBe('free-proxy/auto');
    expect(config.agents.defaults.model.fallbacks).toEqual(['groq/llama-3.1-8b-instant']);
  });

  test('configureOpenClawModel should create backup when config exists', async () => {
    const { configureOpenClawModel } = await import('../src/openclaw-config');
    mkdirSync(OPENCLAW_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify({ foo: 'bar' }));

    const result = await configureOpenClawModel('default');
    expect(result.success).toBe(true);
    expect(result.backup).toBeDefined();
    expect(String(result.backup)).toMatch(/openclaw\.bak\d+/);
  });

  test('listBackups should list created backups', async () => {
    const { listBackups } = await import('../src/openclaw-config');
    mkdirSync(OPENCLAW_DIR, { recursive: true });
    writeFileSync(join(OPENCLAW_DIR, 'openclaw.bak1'), '{}');
    writeFileSync(join(OPENCLAW_DIR, 'openclaw.bak2'), '{}');

    const backups = await listBackups();
    expect(backups).toEqual(['openclaw.bak2', 'openclaw.bak1']);
  });

  test('restoreBackup should restore valid backup', async () => {
    const { restoreBackup } = await import('../src/openclaw-config');
    mkdirSync(OPENCLAW_DIR, { recursive: true });
    const payload = { hello: 'world' };
    writeFileSync(join(OPENCLAW_DIR, 'openclaw.bak1'), JSON.stringify(payload));

    const restored = await restoreBackup('openclaw.bak1');
    expect(restored.success).toBe(true);

    const content = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    expect(content).toEqual(payload);
  });

  test('configureOpenClawModel should fail on invalid JSON without overwriting file', async () => {
    const { configureOpenClawModel } = await import('../src/openclaw-config');
    mkdirSync(OPENCLAW_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, '{invalid-json', 'utf-8');

    const result = await configureOpenClawModel('default');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid JSON');
    expect(readFileSync(CONFIG_PATH, 'utf-8')).toBe('{invalid-json');
  });
});
