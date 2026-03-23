# OpenClaw 双按钮配置改造计划

## 目标

把当前单个“更新 OpenClaw 配置”按钮拆成两个明确动作，降低小白误解：

1. `设为 OpenClaw 默认模型`
2. `设为 OpenClaw 备用模型`

核心目的不是只把 `free-proxy` provider 写进去，而是让用户点击后，`openclaw.json` 里的实际使用模型也切到 `free-proxy/auto`。
---

## 关键结论

基于现有代码和 OpenClaw 配置文档，模型默认/备用位置应使用：

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "free-proxy/auto",
        "fallbacks": ["free-proxy/auto"]
      },
      "models": {
        "free-proxy/auto": {}
      }
    }
  }
}
```

不是现在项目里写的 `agents.defaults.models['free-proxy/auto']` 这一层就够了；那只是 allowlist/模型声明，不等于“被设成默认模型”。

所以这次改造的本质是：

- 保留 `models.providers.free-proxy`
- 保留/补齐 `agents.defaults.models['free-proxy/auto']`
- 再明确写入 `agents.defaults.model.primary` 或 `agents.defaults.model.fallbacks`

---

## 当前问题

现状在 `src/openclaw-config.ts`：

1. 只写了 `models.providers.free-proxy`
2. 只写了 `agents.defaults.models['free-proxy/auto'] = {}`
3. 没有写 `agents.defaults.model.primary`
4. 没有写 `agents.defaults.model.fallbacks`

结果是：

- 用户点了“更新 OpenClaw 配置”
- `free-proxy` provider 的确进了配置文件
- 但 OpenClaw 的默认模型没切过去
- 小白会理解成“free-proxy 没生效”

---

## 改造范围

### 需要修改

- `src/openclaw-config.ts`
- `src/server.ts`
- `public/index.html`
- `__tests__/openclaw-config.test.ts`

### 暂不修改

- `research.md`
- 其他 provider / fallback 核心路由

本次只解决 OpenClaw 配置写入语义不完整的问题，不扩展成通用配置编辑器。

---

## 方案设计

### 一、把配置动作拆成两种模式

后端不再用语义模糊的“mergeConfig”表达单一行为，而是改成基于模式写入：

- `default`：设为默认模型
- `fallback`：设为备用模型

建议保留一个统一入口函数：

```ts
type OpenClawModelMode = 'default' | 'fallback';

async function configureOpenClawModel(mode: OpenClawModelMode): Promise<ConfigureResult> {
  // 读取配置
  // 备份
  // 注入 free-proxy provider
  // 注入 agents.defaults.models['free-proxy/auto']
  // 按 mode 修改 primary 或 fallbacks
  // 写回文件
}
```

这样最简单，避免复制两套大段 JSON merge 逻辑。

---

### 二、统一确保基础结构存在

无论点哪个按钮，都先确保以下结构存在：

```json
{
  "models": {
    "providers": {
      "free-proxy": {
        "baseUrl": "http://localhost:8765/v1",
        "apiKey": "any_string",
        "api": "openai-completions",
        "models": [{ "id": "auto", "name": "auto" }]
      }
    }
  },
  "agents": {
    "defaults": {
      "models": {
        "free-proxy/auto": {}
      }
    }
  }
}
```

这里要注意两个点：

1. `free-proxy/auto` 是 agent 引用模型名
2. provider 内部 `models` 里的 `id` 仍然是 `auto`

即：

- provider 注册层：`free-proxy + auto`
- agent 选择层：`free-proxy/auto`

---

### 三、默认模型按钮的写入逻辑

点击“设为 OpenClaw 默认模型”时，目标是强制把 OpenClaw 默认模型切成我们的模型。

#### 写入规则

1. 确保 `agents.defaults.model` 存在
2. 将 `agents.defaults.model.primary` 直接设为 `free-proxy/auto`
3. 不强制改写用户现有 `fallbacks`
4. 但如果 `fallbacks` 不存在，允许保持为空，不做额外扩展

建议逻辑：

```ts
const targetModel = 'free-proxy/auto';

if (!config.agents.defaults.model || typeof config.agents.defaults.model === 'string') {
  config.agents.defaults.model = {};
}

config.agents.defaults.model.primary = targetModel;
```

#### 为什么不顺手覆盖 `fallbacks`

因为“设默认模型”是强动作；但用户原来已有备用链时，不应该被我们顺带清空或重排。

本次遵循最小有效剂量：

- 只解决“默认模型不生效”
- 不篡改用户原有备用链

---

### 四、备用模型按钮的写入逻辑

点击“设为 OpenClaw 备用模型”时，要分两种情况。

#### 情况 A：用户没有 `agents.defaults.model`

只增加：

- `models.providers.free-proxy`
- `agents.defaults.models['free-proxy/auto']`

不创建 `primary`
不创建 `fallbacks`

原因：

- 用户没有配置默认模型时，说明他可能还没建立自己的主模型策略
- 这时如果我们擅自创建 `fallbacks`，语义不完整，因为没有明确 primary
- 你要求的也是：没有 defaults 时，只增加 models 和 agent 里的 models

这里我会严格按你的产品规则执行。

#### 情况 B：用户已有 `agents.defaults.model`

把我们的模型加入 `fallbacks`：

1. 如果 `model` 是字符串，需要先标准化成对象
2. 保留原有 primary
3. 在 `fallbacks` 末尾追加 `free-proxy/auto`
4. 去重，避免重复追加

关键逻辑：

```ts
const targetModel = 'free-proxy/auto';
const modelConfig = config.agents.defaults.model;

if (typeof modelConfig === 'string') {
  config.agents.defaults.model = {
    primary: modelConfig,
    fallbacks: [targetModel]
  };
} else {
  const fallbacks = Array.isArray(modelConfig.fallbacks) ? modelConfig.fallbacks : [];
  config.agents.defaults.model.fallbacks = [...new Set([...fallbacks, targetModel])];
}
```

#### 关键判断

“用户配置文件里面没有 defaults” 这里建议代码层拆成更精确的 2 层：

1. 没有 `agents.defaults`
2. 有 `agents.defaults`，但没有 `agents.defaults.model`

你的产品语义本质上是：

- 没有主模型链时，不主动替用户建 fallback 链
- 只有已有主模型链时，才把我们追加成备用模型

所以判断条件最好落在 `agents.defaults.model` 是否存在，而不是仅判断 `defaults`。

---

## 数据结构兼容策略

### 1. `agents.defaults.model` 可能是字符串

OpenClaw 允许：

```json
{
  "agents": {
    "defaults": {
      "model": "openai/gpt-4.1"
    }
  }
}
```

如果要追加 fallback，必须先转成对象：

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "openai/gpt-4.1",
        "fallbacks": ["free-proxy/auto"]
      }
    }
  }
}
```

这是本次最关键的兼容点。

### 2. `fallbacks` 必须去重

用户可能已经点过一次“设为备用模型”，不能无限追加重复项。

### 3. 非法 JSON 仍然直接报错

现有策略正确：若配置文件存在但 JSON 非法，直接返回错误，不进行覆盖写入。

### 4. 继续保留备份机制

每次改写前继续生成 `openclaw.bakN`。

这个不能删，因为本次改动会真正触碰用户默认模型。

---

## 后端改造计划

### 1) `src/openclaw-config.ts`

#### 目标

把现有 `mergeConfig()` 改成“带模式写入”的配置函数。

#### 建议重构点

新增小函数，减少主函数复杂度：

```ts
type OpenClawModelMode = 'default' | 'fallback';

function ensureBaseConfig(config: Record<string, unknown>): MutableOpenClawConfig
function ensureFreeProxyProvider(config: MutableOpenClawConfig): void
function ensureAgentModelEntry(config: MutableOpenClawConfig): void
function applyDefaultModel(config: MutableOpenClawConfig): void
function applyFallbackModel(config: MutableOpenClawConfig): void
```

#### 主流程伪代码

```ts
export async function configureOpenClawModel(mode: OpenClawModelMode): Promise<ConfigureResult> {
  const status = await detectOpenClawConfig();
  if (status.exists && !status.isValid) {
    return { success: false, error: 'Invalid JSON' };
  }

  const existingConfig = status.exists ? clone(status.content) : {};
  const config = ensureBaseConfig(existingConfig);

  const backup = createBackupIfNeeded(status.exists);

  ensureFreeProxyProvider(config);
  ensureAgentModelEntry(config);

  if (mode === 'default') {
    applyDefaultModel(config);
  } else {
    applyFallbackModel(config);
  }

  writeConfig(config);
  return { success: true, backup };
}
```

---

### 2) `src/server.ts`

#### 目标

把现有单接口改成模式化接口。

#### 推荐接口方案

继续保留一个接口，前端传 mode：

```ts
app.post('/api/configure-openclaw', async (c) => {
  const { mode } = await c.req.json();
  // mode: 'default' | 'fallback'
});
```

原因：

- 改动最小
- 现有前端接法最好迁移
- 不需要新增两条几乎重复的路由

#### 入参校验

```ts
if (mode !== 'default' && mode !== 'fallback') {
  return c.json({ success: false, error: 'Invalid mode' }, 400);
}
```

#### 成功文案建议区分

- `default` -> `已设为 OpenClaw 默认模型`
- `fallback` -> `已加入 OpenClaw 备用模型`

这样小白能直接看懂“到底改了什么”。

---

## 前端改造计划

### 1) `public/index.html` 的按钮文案

当前只有一个按钮：

- `更新 OpenClaw 配置`

改成两个按钮：

- `设为 OpenClaw 默认模型`
- `设为 OpenClaw 备用模型`

未检测到配置文件时也可以显示这两个按钮；后端会负责创建配置文件。

#### 推荐渲染

```js
actionsEl.innerHTML = `
  <button class="btn btn-primary" onclick="configureOpenClaw('default', event)">设为 OpenClaw 默认模型</button>
  <button class="btn btn-secondary" onclick="configureOpenClaw('fallback', event)">设为 OpenClaw 备用模型</button>
`;
```

### 2) 前端调用参数

```js
await fetch('/api/configure-openclaw', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mode })
});
```

### 3) toast 文案区分

根据 mode 区分：

- 默认模型：`已把 free-proxy/auto 设为 OpenClaw 默认模型`
- 备用模型：`已把 free-proxy/auto 加入 OpenClaw 备用模型`

这样可以直接消除“到底有没有生效”的歧义。

### 4) 页面辅助说明同步更新

当前页面只提示：

```text
在 OpenClaw 中使用：/model free-proxy/auto
```

建议补一行轻提示：

- 默认模型按钮：会修改 OpenClaw 的默认模型
- 备用模型按钮：只会把它加入备用链，不会覆盖你现在的主模型

这是小白最需要的心理预期。

---

## 关键代码草案

### 1. 常量

```ts
const FREE_PROXY_PROVIDER_ID = 'free-proxy';
const FREE_PROXY_MODEL_ID = 'auto';
const FREE_PROXY_AGENT_MODEL = 'free-proxy/auto';
```

### 2. provider 注入

```ts
config.models.providers[FREE_PROXY_PROVIDER_ID] = {
  baseUrl,
  apiKey: 'any_string',
  api: 'openai-completions',
  models: [{ id: FREE_PROXY_MODEL_ID, name: FREE_PROXY_MODEL_ID }]
};
```

### 3. agent allowlist 注入

```ts
config.agents.defaults.models[FREE_PROXY_AGENT_MODEL] =
  config.agents.defaults.models[FREE_PROXY_AGENT_MODEL] || {};
```

### 4. 默认模型写入

```ts
if (!isPlainObject(config.agents.defaults.model)) {
  config.agents.defaults.model = {};
}

config.agents.defaults.model.primary = FREE_PROXY_AGENT_MODEL;
```

### 5. 备用模型写入

```ts
const modelConfig = config.agents.defaults.model;

if (!modelConfig) {
  return;
}

if (typeof modelConfig === 'string') {
  config.agents.defaults.model = {
    primary: modelConfig,
    fallbacks: [FREE_PROXY_AGENT_MODEL]
  };
  return;
}

const existingFallbacks = Array.isArray(modelConfig.fallbacks)
  ? modelConfig.fallbacks.filter((item): item is string => typeof item === 'string')
  : [];

config.agents.defaults.model.fallbacks = [...new Set([...existingFallbacks, FREE_PROXY_AGENT_MODEL])];
```

---

## 测试计划

`__tests__/openclaw-config.test.ts` 至少补以下场景。

### 必测

1. 空配置文件下，`default` 模式会创建：
   - `models.providers.free-proxy`
   - `agents.defaults.models['free-proxy/auto']`
   - `agents.defaults.model.primary === 'free-proxy/auto'`

2. 空配置文件下，`fallback` 模式只创建：
   - `models.providers.free-proxy`
   - `agents.defaults.models['free-proxy/auto']`
   - 不创建 `agents.defaults.model.primary`
   - 不创建 `agents.defaults.model.fallbacks`

3. 已有 `agents.defaults.model.primary` 时，`fallback` 模式会把 `free-proxy/auto` 追加到 `fallbacks`

4. 已有字符串形式 `agents.defaults.model = 'openrouter/auto:free'` 时，`fallback` 模式会自动转成对象结构

5. 连续执行两次 `fallback` 模式不会重复写入 `free-proxy/auto`

6. 已存在非法 JSON 时返回失败，不覆盖原文件

7. 配置文件存在时仍会创建备份

### 可选补测

1. 默认模式不会清空已有 `fallbacks`
2. 默认模式会覆盖已有 `primary`

---

## 风险点与处理

### 风险 1：误判备用模型写入条件

如果只按“有没有 defaults”判断，会误伤这种情况：

```json
{
  "agents": {
    "defaults": {
      "models": {}
    }
  }
}
```

这里有 defaults，但没有 model 主链。按你的产品规则，不应强行创建 fallback 链。

处理：判断 `agents.defaults.model` 是否存在，而不是只看 `defaults`。

### 风险 2：覆盖用户原有模型链

处理：

- `default` 模式只改 `primary`
- `fallback` 模式只追加 `fallbacks`
- 不清空用户已有内容

### 风险 3：重复追加 fallback

处理：`Set` 去重。

### 风险 4：用户以为“备用模型”会立即生效

处理：前端文案明确写“不会覆盖当前主模型”。

---

## 验收标准

### 默认模型按钮

点击后，`openclaw.json` 至少满足：

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "free-proxy/auto"
      }
    }
  }
}
```

### 备用模型按钮

#### 若原本没有 `agents.defaults.model`

不会擅自创建 `primary/fallbacks`，只完成 provider 和 allowlist 注入。

#### 若原本已有 `agents.defaults.model`

会得到：

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "原来的模型",
        "fallbacks": ["...原有内容...", "free-proxy/auto"]
      }
    }
  }
}
```

### UI

- 页面显示两个按钮，而不是一个模糊按钮
- 成功提示能明确区分“默认模型”还是“备用模型”
- 备份功能继续有效

---

## 推荐实施顺序

1. 先重构 `src/openclaw-config.ts` 的配置写入函数
2. 再改 `src/server.ts` 接口入参和成功文案
3. 再改 `public/index.html` 按钮和提示文案
4. 最后补 `__tests__/openclaw-config.test.ts`

这个顺序风险最低，因为核心逻辑先固定，前端只做薄调用。
