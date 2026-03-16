import { getConfig, setConfig, ENV } from '../src/config';
import { existsSync, unlinkSync } from 'node:fs';

const CONFIG_PATH = 'config.json';

describe('config module', () => {
  // 测试前清理配置文件
  beforeEach(() => {
    if (existsSync(CONFIG_PATH)) {
      unlinkSync(CONFIG_PATH);
    }
    // 清除缓存
    jest.resetModules();
  });

  test('should create default config file if not exists', async () => {
    expect(existsSync(CONFIG_PATH)).toBe(false);
    const config = await getConfig();
    expect(existsSync(CONFIG_PATH)).toBe(true);
    expect(config.default_model).toBe('openrouter/auto:free');
  });

  test('should read existing config file correctly', async () => {
    // 预创建配置文件
    await import('node:fs/promises').then(fs => fs.writeFile(CONFIG_PATH, JSON.stringify({
      default_model: 'meta-llama/llama-3.2-3b-instruct:free'
    })));
    
    const config = await getConfig();
    expect(config.default_model).toBe('meta-llama/llama-3.2-3b-instruct:free');
  });

  test('should update config and save to file', async () => {
    await setConfig({ default_model: 'test-model:free' });
    const config = await getConfig();
    expect(config.default_model).toBe('test-model:free');
    
    // 验证文件内容
    const content = await import('node:fs/promises').then(fs => fs.readFile(CONFIG_PATH, 'utf-8'));
    expect(JSON.parse(content).default_model).toBe('test-model:free');
  });

  test('should load environment variables correctly', () => {
    expect(ENV.PORT).toBe(8765);
    expect(ENV.OPENROUTER_API_KEY).toBeDefined();
  });
});
