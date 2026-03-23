import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const OPENCLAW_DIR = process.env.OPENCLAW_TEST_DIR || join(homedir(), '.openclaw');
const OPENCLAW_CONFIG_PATH = join(OPENCLAW_DIR, 'openclaw.json');
const FREE_PROXY_PROVIDER_ID = 'free_proxy';
const FREE_PROXY_MODEL_ID = 'auto';
const FREE_PROXY_AGENT_MODEL = 'free_proxy/auto';

export interface OpenClawConfigResult {
  exists: boolean;
  isValid: boolean;
  content?: object;
  path?: string;
}

export interface ConfigureResult {
  success: boolean;
  backup?: string | null;
  error?: string;
}

export type OpenClawModelMode = 'default' | 'fallback';

interface ProviderModel {
  id: string;
  name: string;
}

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  api: string;
  models: ProviderModel[];
}

interface DefaultsModelConfig {
  primary?: string;
  fallbacks?: string[];
}

interface OpenClawConfigShape {
  models?: {
    providers?: Record<string, ProviderConfig>;
  };
  agents?: {
    defaults?: {
      models?: Record<string, object>;
      model?: string | DefaultsModelConfig;
    };
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getNextBackupPath(): string {
  const files = existsSync(OPENCLAW_DIR) ? readdirSync(OPENCLAW_DIR) : [];
  const existingBackups = files.filter(f => /^openclaw\.bak\d+$/.test(f));
  const nextNum = existingBackups.length > 0
    ? Math.max(...existingBackups.map(f => parseInt(f.replace('openclaw.bak', ''), 10) || 0)) + 1
    : 1;
  return join(OPENCLAW_DIR, `openclaw.bak${nextNum}`);
}

function ensureRoot(config: OpenClawConfigShape): Required<Pick<OpenClawConfigShape, 'models' | 'agents'>> & OpenClawConfigShape {
  if (!isPlainObject(config.models)) {
    config.models = {};
  }
  if (!isPlainObject(config.models.providers)) {
    config.models.providers = {};
  }
  if (!isPlainObject(config.agents)) {
    config.agents = {};
  }
  if (!isPlainObject(config.agents.defaults)) {
    config.agents.defaults = {};
  }
  if (!isPlainObject(config.agents.defaults.models)) {
    config.agents.defaults.models = {};
  }
  return config as Required<Pick<OpenClawConfigShape, 'models' | 'agents'>> & OpenClawConfigShape;
}

function ensureFreeProxyProvider(config: OpenClawConfigShape): void {
  const withRoot = ensureRoot(config);
  const providers = withRoot.models.providers!;
  const baseUrl = `http://localhost:${process.env.PORT || 8765}/v1`;
  providers[FREE_PROXY_PROVIDER_ID] = {
    baseUrl,
    apiKey: 'any_string',
    api: 'openai-completions',
    models: [{ id: FREE_PROXY_MODEL_ID, name: FREE_PROXY_MODEL_ID }]
  };
}

function ensureAgentModelAllowlist(config: OpenClawConfigShape): void {
  const withRoot = ensureRoot(config);
  const defaults = withRoot.agents.defaults!;
  const models = defaults.models!;
  models[FREE_PROXY_AGENT_MODEL] = models[FREE_PROXY_AGENT_MODEL] || {};
}

function applyDefaultMode(config: OpenClawConfigShape): void {
  const withRoot = ensureRoot(config);
  const defaults = withRoot.agents.defaults!;
  const currentModel = defaults.model;
  if (!isPlainObject(currentModel)) {
    defaults.model = { primary: FREE_PROXY_AGENT_MODEL };
    return;
  }

  const currentFallbacks = Array.isArray(currentModel.fallbacks)
    ? currentModel.fallbacks.filter(item => typeof item === 'string')
    : undefined;

  defaults.model = {
    ...currentModel,
    primary: FREE_PROXY_AGENT_MODEL,
    ...(currentFallbacks ? { fallbacks: currentFallbacks } : {})
  };
}

function applyFallbackMode(config: OpenClawConfigShape): void {
  const withRoot = ensureRoot(config);
  const defaults = withRoot.agents.defaults!;
  const currentModel = defaults.model;

  if (!currentModel) {
    return;
  }

  if (typeof currentModel === 'string') {
    defaults.model = {
      primary: currentModel,
      fallbacks: [FREE_PROXY_AGENT_MODEL]
    };
    return;
  }

  if (!isPlainObject(currentModel)) {
    return;
  }

  const existingFallbacks = Array.isArray(currentModel.fallbacks)
    ? currentModel.fallbacks.filter(item => typeof item === 'string')
    : [];

  defaults.model = {
    ...currentModel,
    fallbacks: [...new Set([...existingFallbacks, FREE_PROXY_AGENT_MODEL])]
  };
}

export async function detectOpenClawConfig(): Promise<OpenClawConfigResult> {
  const result: OpenClawConfigResult = {
    exists: false,
    isValid: false,
    path: OPENCLAW_CONFIG_PATH
  };

  if (!existsSync(OPENCLAW_CONFIG_PATH)) {
    return result;
  }

  result.exists = true;

  try {
    const content = readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8');
    result.content = JSON.parse(content);
    result.isValid = true;
  } catch {
    result.isValid = false;
  }

  return result;
}

export async function configureOpenClawModel(mode: OpenClawModelMode): Promise<ConfigureResult> {
  const status = await detectOpenClawConfig();

  if (status.exists && !status.isValid) {
    return { success: false, error: 'Invalid JSON' };
  }

  let existingConfig: OpenClawConfigShape = {};

  if (status.exists && status.isValid) {
    existingConfig = (status.content as OpenClawConfigShape) || {};
  }

  const backupPath = getNextBackupPath();

  if (status.exists) {
    const content = readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8');
    writeFileSync(backupPath, content, 'utf-8');
  } else {
    if (!existsSync(OPENCLAW_DIR)) {
      mkdirSync(OPENCLAW_DIR, { recursive: true });
    }
  }

  const newConfig: OpenClawConfigShape = JSON.parse(JSON.stringify(existingConfig));
  ensureFreeProxyProvider(newConfig);
  ensureAgentModelAllowlist(newConfig);

  if (mode === 'default') {
    applyDefaultMode(newConfig);
  }

  if (mode === 'fallback') {
    applyFallbackMode(newConfig);
  }

  writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');

  return {
    success: true,
    backup: status.exists ? backupPath : null
  };
}

export async function mergeConfig(): Promise<ConfigureResult> {
  return configureOpenClawModel('default');
}

export async function listBackups(): Promise<string[]> {
  if (!existsSync(OPENCLAW_DIR)) {
    return [];
  }

  const files = readdirSync(OPENCLAW_DIR);
  const backups = files
    .filter(f => /^openclaw\.bak\d+$/.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.replace('openclaw.bak', '')) || 0;
      const numB = parseInt(b.replace('openclaw.bak', '')) || 0;
      return numB - numA;
    });
  
  return backups;
}

export async function restoreBackup(backupName: string): Promise<{ success: boolean; error?: string }> {
  const backupPath = join(OPENCLAW_DIR, backupName);
  
  if (!existsSync(backupPath)) {
    return { success: false, error: 'Backup file not found' };
  }

  try {
    const content = readFileSync(backupPath, 'utf-8');
    JSON.parse(content);
  } catch {
    return { success: false, error: 'Invalid JSON' };
  }

  writeFileSync(OPENCLAW_CONFIG_PATH, readFileSync(backupPath, 'utf-8'), 'utf-8');
  
  return { success: true };
}
