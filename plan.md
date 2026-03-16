# OpenRouter Free Proxy 实现计划（Plan）

## 📅 总体进度安排（极简版，符合本地小工具定位）
> ✅ **设计原则：最小够用，无冗余功能，启动快，配置少，维护简单**

| 阶段 | 内容 | 预计耗时 |
|------|------|----------|
| 1 | 项目初始化（最简依赖） | 15分钟 |
| 2 | 核心功能实现（单文件核心逻辑） | 1小时 |
| 3 | Web管理界面 + 联调 | 30分钟 |
| 4 | 功能测试 | 15分钟 |
| **总计** | | **2小时** |

### 简化说明：
1. 去掉不必要的工程化配置（lint、format、构建步骤等，本地工具不需要）
2. 依赖最小化，只保留必须的4个依赖
3. 代码结构简化，核心逻辑集中，方便后续修改
4. 直接用tsx运行，无需编译，开发启动快

---

## 📝 详细待办事项清单（待审阅，可勾选完成）
### 🔹 前置准备
- [ ] 环境检查：本地安装 Node.js ≥ 18，npm/yarn 可用（验收标准：终端执行 `node -v` 显示版本 ≥ 18）

### 🔹 阶段1：项目初始化
- [ ] 创建项目目录结构：src/、public/ 文件夹（验收标准：目录结构符合最终项目结构要求）
- [ ] 初始化 package.json，安装所有依赖（验收标准：执行 `npm install` 无报错，node_modules 生成）
- [ ] 编写 tsconfig.json 最简配置（验收标准：执行 `npx tsc --noEmit` 无类型错误）
- [ ] 编写 .gitignore 文件（验收标准：包含 node_modules、.env、config.json 等忽略项）
- [ ] 创建 .env 文件模板，写入 OPENROUTER_API_KEY 配置项（验收标准：.env 文件存在，格式正确）

### 🔹 阶段2：核心功能实现
- [ ] 实现 config.ts 模块：读写 config.json、加载环境变量（验收标准：可正常读写配置，默认模型自动生成）
- [ ] 实现 models.ts 模块：获取OpenRouter模型列表、过滤免费模型、缓存（验收标准：调用 fetchModels() 可返回正确的免费模型列表）
- [ ] 实现请求转发逻辑：全量透传参数、流式响应支持（验收标准：代理请求可正常返回OpenRouter响应）

### 🔹 阶段3：API与Web界面
- [ ] 实现 Hono 服务入口 server.ts：路由配置、CORS、静态文件服务（验收标准：服务启动后可访问 http://localhost:8765）
- [ ] 实现 /v1/chat/completions 接口：透传请求、补全默认模型（验收标准：curl 测试接口返回正常）
- [ ] 实现 /admin/models 接口：返回免费模型列表和当前选中模型（验收标准：接口返回数据格式正确，包含所有免费模型）
- [ ] 实现 /admin/model 接口：保存默认模型到 config.json（验收标准：调用接口后 config.json 文件更新）
- [ ] 编写 public/index.html Web管理界面：模型列表展示、切换、刷新功能（验收标准：页面可正常加载，点击切换模型可调用接口成功）

### 🔹 阶段4：测试与验证
- [ ] 基础接口测试：curl 测试流式和非流式请求（验收标准：两种请求都返回正常结果）
- [ ] OpenCode 集成测试：配置 base_url 后可正常调用（验收标准：opencode run 命令可返回正确结果）
- [ ] 模型切换测试：Web页面切换模型后，OpenCode请求自动使用新模型（验收标准：切换后无需重启服务，后续请求立即使用新模型）
- [ ] 异常测试：API Key 错误、模型不存在等场景处理（验收标准：返回友好错误信息，服务不崩溃）

### 🔹 收尾
- [ ] 编写 README.md：使用说明、启动步骤、配置方法（验收标准：新用户按照README可成功启动服务）
- [ ] 整体功能验证：所有功能正常工作（验收标准：所有验收标准通过）
---

## 🚀 阶段1：项目初始化与基础配置
### 子任务
1. 创建项目目录结构
2. 初始化 package.json 与依赖安装
3. 配置 TypeScript、tsup（打包工具）
4. 配置 .gitignore、.env.example

### 关键代码
#### 1.1 package.json 依赖（最简版，仅4个运行时依赖）
```json
{
  "name": "openrouter-free-proxy",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "tsx src/server.ts"
  },
  "dependencies": {
    "@hono/node-server": "^1.11.0",
    "dotenv": "^16.4.5",
    "hono": "^4.2.9",
    "tsx": "^4.9.0",
    "typescript": "^5.4.5"
  }
}
```
> 简化说明：
> 1. 移除所有不必要的dev依赖（eslint、prettier、tsup等），本地工具不需要构建和代码检查
> 2. 移除build步骤，直接用tsx运行源码，启动更快
> 3. 保留2个命令：`npm run dev`（开发热重载）、`npm start`（直接运行）
> 4. 总共仅5个依赖，体积小，安装快

#### 1.2 tsconfig.json（最简配置）
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```
> 简化说明：移除路径别名、outDir等不必要配置，只保留类型检查必须的配置

#### 1.3 .gitignore
```
node_modules/
dist/
.env
config.json
*.log
.DS_Store
```

---

## ⚙️ 阶段2：核心功能模块实现
### 子任务
1. 配置模块（config.ts）：读写配置文件、环境变量加载
2. 模型模块（models.ts）：获取OpenRouter模型、免费模型过滤、缓存
3. 代理模块（proxy.ts）：请求转发、流式响应、重试逻辑

### 关键代码
#### 2.1 src/config.ts
```typescript
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

interface Config {
  default_model: string;
}

const CONFIG_PATH = 'config.json';
const DEFAULT_CONFIG: Config = {
  default_model: 'openrouter/auto:free'
};

let cachedConfig: Config | null = null;

// 读取配置
export async function getConfig(): Promise<Config> {
  if (cachedConfig) return cachedConfig;
  
  if (!existsSync(CONFIG_PATH)) {
    await writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    cachedConfig = DEFAULT_CONFIG;
    return cachedConfig;
  }

  const content = await readFile(CONFIG_PATH, 'utf-8');
  cachedConfig = JSON.parse(content) as Config;
  return cachedConfig;
}

// 保存配置
export async function setConfig(config: Partial<Config>): Promise<Config> {
  const currentConfig = await getConfig();
  const newConfig = { ...currentConfig, ...config };
  await writeFile(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
  cachedConfig = newConfig;
  return newConfig;
}

// 环境变量
export const ENV = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  PORT: Number(process.env.PORT) || 8765
} as const;
```

#### 2.2 src/models.ts
```typescript
import fetch from 'node-fetch';
import { ENV } from './config';

interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
}

let cachedModels: OpenRouterModel[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1小时缓存

// 获取所有模型
export async function fetchModels(forceRefresh = false): Promise<OpenRouterModel[]> {
  const now = Date.now();
  if (!forceRefresh && cachedModels.length && now - lastFetchTime < CACHE_TTL) {
    return cachedModels;
  }

  const response = await fetch(`${ENV.OPENROUTER_BASE_URL}/models`, {
    headers: {
      'Authorization': `Bearer ${ENV.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:8765',
      'X-Title': 'OpenRouter Free Proxy'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  const data = (await response.json()) as { data: OpenRouterModel[] };
  cachedModels = data.data;
  lastFetchTime = now;
  return cachedModels;
}

// 过滤免费模型
export function filterFreeModels(models: OpenRouterModel[]): OpenRouterModel[] {
  return models
    .filter(model => model.id.endsWith(':free'))
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

#### 2.3 src/proxy.ts
```typescript
import fetch, { Response } from 'node-fetch';
import { ENV } from './config';
import { getConfig } from './config';

// 从环境变量读取OpenRouter API地址，默认值为官方地址
// 转发请求到OpenRouter
export async function proxyRequest(
  path: string,
  method: string,
  body: any,
  headers: Record<string, string>
): Promise<Response> {
  const config = await getConfig();
  
  // 补全默认模型
  if (!body.model) {
    body.model = config.default_model;
  }

  // 构建请求头
  const proxyHeaders: Record<string, string> = {
    'Authorization': `Bearer ${ENV.OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'http://localhost:8765',
    'X-Title': 'OpenRouter Free Proxy',
    'Content-Type': 'application/json'
  };

  // 转发原始请求头（排除host和content-length）
  Object.entries(headers).forEach(([key, value]) => {
    if (!['host', 'content-length', 'authorization'].includes(key.toLowerCase())) {
      proxyHeaders[key] = value;
    }
  });

    // 极简错误处理：直接返回请求结果，不重试（本地使用，失败手动重试即可）
    return await fetch(`${ENV.OPENROUTER_BASE_URL}${path}`, {
      method,
      headers: proxyHeaders,
      body: JSON.stringify(body)
    });
}
```

---

## 🌐 阶段3：API接口与Web管理界面
### 子任务
1. Hono 服务入口（server.ts）：路由配置、CORS、静态文件服务
2. API 接口实现：chat completions、模型管理接口
3. Web 管理界面：HTML + 原生JS实现

### 关键代码
#### 3.1 src/server.ts
```typescript
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { stream } from 'hono/streaming';
import { proxyRequest } from './proxy';
import { getConfig, setConfig, ENV } from './config';
import { fetchModels, filterFreeModels } from './models';

const app = new Hono();

// CORS 配置（允许所有本地端口）
app.use('/*', cors({
  origin: (origin) => {
    if (origin.startsWith('http://localhost:') || origin === 'null') {
      return origin;
    }
    return 'http://localhost:8765';
  }
}));

// 静态文件服务（Web管理界面）
app.use('/*', serveStatic({
  root: './public',
  index: 'index.html'
}));

// 1. Chat Completions 接口
app.post('/v1/chat/completions', async (c) => {
  try {
    const body = await c.req.json();
    const headers = Object.fromEntries(c.req.headers.entries());
    
    const response = await proxyRequest(
      '/chat/completions',
      'POST',
      body,
      headers
    );

    // 流式响应处理
    if (body.stream) {
      return stream(c, async (stream) => {
        if (!response.body) return;
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await stream.write(value);
        }
      }, response.status, Object.fromEntries(response.headers.entries()));
    }

    // 非流式响应
    const data = await response.json();
    return c.json(data, response.status);
  } catch (err: any) {
    return c.json({
      error: {
        message: err.message,
        type: 'internal_error',
        code: 500
      }
    }, 500);
  }
});

// 2. 获取模型列表
app.get('/admin/models', async (c) => {
  try {
    const forceRefresh = c.req.query('refresh') === 'true';
    const models = await fetchModels(forceRefresh);
    const freeModels = filterFreeModels(models);
    const config = await getConfig();
    
    return c.json({
      models: freeModels.map(m => ({
        id: m.id,
        name: m.name,
        context_length: m.context_length
      })),
      current: config.default_model
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 3. 切换默认模型
app.put('/admin/model', async (c) => {
  try {
    const { model } = await c.req.json();
    if (!model || !model.endsWith(':free')) {
      return c.json({ error: 'Invalid free model' }, 400);
    }
    
    const newConfig = await setConfig({ default_model: model });
    return c.json({ model: newConfig.default_model });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 启动服务
console.log(`🚀 OpenRouter Free Proxy starting on http://localhost:${ENV.PORT}`);
serve({
  fetch: app.fetch,
  port: ENV.PORT
});
```

#### 3.2 public/index.html（Web管理界面）
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenRouter Free Proxy 管理</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .btn { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; background: #2563eb; color: white; }
    .btn:disabled { background: #93c5fd; cursor: not-allowed; }
    .model-list { list-style: none; border: 1px solid #e5e7eb; border-radius: 4px; }
    .model-item { padding: 1rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
    .model-item:last-child { border-bottom: none; }
    .model-item.active { background: #eff6ff; }
    .model-name { font-weight: 500; }
    .model-id { color: #6b7280; font-size: 0.875rem; margin-top: 0.25rem; }
    .toast { position: fixed; top: 1rem; right: 1rem; padding: 1rem; border-radius: 4px; color: white; display: none; }
    .toast.success { background: #10b981; }
    .toast.error { background: #ef4444; }
  </style>
</head>
<body>
  <div class="header">
    <h1>OpenRouter Free Proxy</h1>
    <button class="btn" id="refreshBtn">刷新模型列表</button>
  </div>

  <ul class="model-list" id="modelList"></ul>
  
  <div class="toast" id="toast"></div>

  <script>
    const toast = document.getElementById('toast');
    const modelList = document.getElementById('modelList');
    const refreshBtn = document.getElementById('refreshBtn');

    // 显示提示
    function showToast(message, type = 'success') {
      toast.textContent = message;
      toast.className = `toast ${type}`;
      toast.style.display = 'block';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 3000);
    }

    // 加载模型列表
    async function loadModels(forceRefresh = false) {
      try {
        refreshBtn.disabled = true;
        const url = forceRefresh ? '/admin/models?refresh=true' : '/admin/models';
        const res = await fetch(url);
        const data = await res.json();
        
        modelList.innerHTML = '';
        data.models.forEach(model => {
          const li = document.createElement('li');
          li.className = `model-item ${model.id === data.current ? 'active' : ''}`;
          li.innerHTML = `
            <div>
              <div class="model-name">${model.name}</div>
              <div class="model-id">${model.id} (${model.context_length.toLocaleString()} tokens)</div>
            </div>
            <button class="btn" ${model.id === data.current ? 'disabled' : ''} 
                    onclick="selectModel('${model.id}')">
              ${model.id === data.current ? '已选择' : '选择'}
            </button>
          `;
          modelList.appendChild(li);
        });
      } catch (err) {
        showToast('加载模型列表失败', 'error');
      } finally {
        refreshBtn.disabled = false;
      }
    }

    // 选择模型
    async function selectModel(modelId) {
      try {
        const res = await fetch('/admin/model', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelId })
        });
        
        if (res.ok) {
          showToast('模型切换成功');
          loadModels();
        } else {
          showToast('模型切换失败', 'error');
        }
      } catch (err) {
        showToast('网络错误', 'error');
      }
    }

    // 刷新按钮
    refreshBtn.addEventListener('click', () => loadModels(true));

    // 初始化
    loadModels();
  </script>
</body>
</html>
```

---

## ✅ 阶段4：测试与优化
### 子任务
1. 功能测试：验证API接口、流式响应、模型切换
2. 性能优化：缓存、错误处理优化
3. 文档完善：README.md、使用说明

### 测试命令
#### 1. 基础接口测试（curl）
```bash
# 测试非流式请求
curl http://localhost:8765/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "写一个快速排序的Python代码"}],
    "temperature": 0.7
  }'

# 测试流式请求
curl http://localhost:8765/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "写一个快速排序的Python代码"}],
    "stream": true
  }'
```

#### 2. 真实场景测试（opencode 集成测试）
> 直接测试与OpenCode的集成效果，验证模型切换是否生效

```bash
# 步骤1：配置OpenCode使用本地代理
# 编辑OpenCode配置文件，设置base_url为 http://localhost:8765/v1

# 步骤2：在Web管理页面切换到任意免费模型（比如 llama-3.2-3b-instruct:free）

# 步骤3：运行测试命令（必须指定 -m 参数，模型名可随意填写，代理会自动使用Web界面选择的默认模型）
opencode run "你当前使用的模型是什么？帮我写一段200字的Python语言优缺点介绍" -m "or-free-proxy"

# 💡 说明：-m 参数指定的模型名仅用于触发OpenCode使用自定义模型逻辑，实际使用的模型是Web页面选择的默认模型，代理会自动替换

# 步骤4：检查返回结果，验证模型是否正确切换
# ✅ 正常：返回内容包含模型信息，代码生成正确
# ❌ 异常：返回错误信息，需要检查日志排查问题
```

#### 3. 模型切换验证流程
1. 在Web页面选择模型A → 运行opencode测试 → 确认使用模型A
2. 在Web页面切换到模型B → 再次运行opencode测试 → 确认使用模型B
3. 验证切换无需重启服务，立即生效

### 最终项目结构（最简版，仅6个代码文件）
```
/
├── src/
│   ├── server.ts      # 主入口（包含所有核心逻辑，代理、路由都在这里，简化结构）
│   ├── config.ts      # 配置读写（很小的模块，保留）
│   └── models.ts      # 模型获取与过滤（很小的模块，保留）
├── public/
│   └── index.html     # Web管理界面
├── .env
├── .gitignore
├── package.json
└── tsconfig.json
```
> 简化说明：
> 1. 移除proxy.ts，把转发逻辑直接写到server.ts里，减少文件数量
> 2. 移除tsup.config.ts、.env.example等非必须文件
> 3. 总代码量 < 500行，非常容易维护

---

## 🎯 完成标准（本地使用验证）
1. ✅ 执行 `npm start` 服务正常启动，访问 http://localhost:8765 可看到管理界面
2. ✅ 模型列表加载正常，点击切换按钮可正常切换默认模型，无需重启服务
3. ✅ curl 测试接口返回正常，支持流式响应
4. ✅ OpenCode 配置 base_url = `http://localhost:8765/v1` 后，可正常调用生成代码
5. ✅ 切换模型后，OpenCode 后续请求自动使用新模型，无需修改任何配置
