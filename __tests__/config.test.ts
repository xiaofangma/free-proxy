import { jest } from '@jest/globals';
import { getConfig, setConfig, ENV } from '../src/config';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';

const CONFIG_PATH = 'config.json';

describe('config module', () => {
  beforeEach(() => {
    if (existsSync(CONFIG_PATH)) {
      unlinkSync(CONFIG_PATH);
    }
  });

  afterEach(() => {
    if (existsSync(CONFIG_PATH)) {
      unlinkSync(CONFIG_PATH);
    }
  });

  test('should create default config file if not exists', async () => {
    expect(existsSync(CONFIG_PATH)).toBe(false);
    const config = await getConfig();
    expect(existsSync(CONFIG_PATH)).toBe(true);
    expect(config.default_model).toBe('openrouter/auto:free');
  });

  test('should update config and save to file', async () => {
    await setConfig({ default_model: 'test-model:free' });
    const config = await getConfig();
    expect(config.default_model).toBe('test-model:free');
  });

  test('should load environment variables correctly', () => {
    expect(ENV.PORT).toBe(8765);
    expect(ENV.OPENROUTER_API_KEY).toBeDefined();
  });
});
