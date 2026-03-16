# OpenRouter Free Proxy 规格说明（SPEC）

## 1. 核心需求
- 本地搭建 OpenRouter Free API 的代理服务，生成统一的 base_url `http://localhost:8765`；
- 零配置兼容：在 coding agent（OpenCode/Cursor/Copilot 等）中只需配置 base_url，无需修改其他代码即可直接使用；
- Web 管理页面可一键切换 OpenRouter 免费模型，切换后立即生效；
- 完全兼容 OpenAI 格式的 API 调用，支持流式响应、工具调用等编程常用特性。

> 🔍 技术可行性：**100%可行**。OpenRouter 原生兼容 OpenAI API，代理仅需转发请求即可，无需复杂格式转换。

## 2. 技术规格
### 2.1 服务规格
- 本地服务地址：http://localhost:8765
- API 路径兼容：/v1/chat/completions（和 OpenAI/OpenRouter 一致）
- 支持的请求方法：POST
- 超时时间：30s
- 前后端都采用typescript技术

---

## 3. 项目结构

```
/
├── src/
│   ├── server.ts        # 服务主入口（使用轻量 Hono 框架替代 Express）
│   ├── chat.ts          # /v1/chat/completions 接口处理（注：chat 是 OpenAI API 标准路径名，与使用场景无关，同样支持 coding/代码生成场景）
│   ├── config.ts        # 配置加载与持久化
│   ├── models.ts        # 模型管理（OpenRouter 调用、过滤、缓存）
│   └── proxy.ts         # 请求转发逻辑（处理头转发、错误重试）
├── public/              # Web 管理界面（HTML/CSS/JS）
│   ├── index.html
│   └── app.ts
├── .env                 # 存储 OPENROUTER_API_KEY
├── config.json          # 持久化配置（default_model）
├── package.json
└── tsconfig.json
```

---

## 4. 构建与运行命令

### 4.1 快速启动

```bash
# 1. 安装依赖（首次执行）
npm ci 
# 🔍 说明：ci = clean install，比普通 npm install 更快，且严格锁定依赖版本，避免版本不一致问题

# 2. 启动服务（开发模式，代码修改自动重启）
npm run dev
# 🔍 说明：dev = development，启动带热重载的开发服务

# 3. 启动服务（生产模式，直接运行）
npm start
# 默认监听地址：http://localhost:8765
```

### 4.2 构建与生产运行

```bash
# 编译 TypeScript
npm run build

# 生产运行
npm start
```

### 4.3 测试命令

```bash
# 运行所有测试
npm test

# 运行单测（指定文件）
npm test -- tests/models.test.ts

# 运行单测（指定测试名）
npm test -- -t "should filter free models"

# 测试覆盖率
npm run test:cov
```

**单测推荐工具：** Jest（`@types/jest`, `ts-jest`）

---

## 5. 代码风格规范

### 5.1 格式化与 Lint

- **格式化：** Prettier（单引号、TS 尾随逗号、88 字符行宽）
- **Lint：** ESLint + `@typescript-eslint/recommended`
- **TypeScript：** 严格模式 (`strict: true`)

所有提交前必须通过：

```bash
npm run lint && npm run format && npm run typecheck
```

### 5.2 导入规范

```typescript
// 顺序：标准库 → 第三方 → 本地
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { getModels, filterFreeModels } from './models';
```

- 禁止通配符导入 (`import * as foo from 'bar'`)
- 使用绝对路径（`src/` 根），TS 配置 `baseUrl: ".", paths: { "@/*": ["src/*"] }`

### 5.3 命名约定

- 文件：kebab-case (`chat.ts`, `config-manager.ts`)
- 变量/函数：camelCase (`getConfig`, `isProduction`)
- 类：PascalCase (`ConfigManager`, `ModelFetcher`)
- 常量：UPPER_SNAKE_CASE (`MAX_TIMEOUT_MS`, `DEFAULT_PORT`)
- 枚举：PascalCase，成员 UPPER_SNAKE_CASE

### 5.4 类型与类型提示

- **必须**为所有公共函数提供完整类型签名
- 禁止使用 `any`（包括 `Object`）；使用 `unknown` 或具体接口
- 可空类型使用 `T | null`
- 函数参数 ≤ 5 个；超过需重构为对象参数

示例：

```typescript
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function createCompletion(
  messages: ChatMessage[],
  model?: string,
  options?: Partial<CompletionOptions>
): Promise<CompletionResponse> { ... }
```

### 5.5 错误处理

- **禁止**裸 `catch`；必须指定异常类型
- 异步函数必须处理拒绝（`await` + `try/catch`）
- HTTP 错误：使用 `next(err)` 传递至 Express 错误中间件
- 对外部服务（OpenRouter）错误：记录日志 + 返回 JSON 错误对象
- 错误响应格式：

```json
{
  "error": {
    "message": "模型 'xxx' 不可用",
    "type": "model_not_found",
    "code": 404
  }
}
```

### 5.6 日志规范

- 使用 `winston` 或 `pino`（JSON 格式）
- 级别：`error`（外部 API 失败）、`warn`（配置回退）、`info`（启动/切换模型）、`debug`（详细请求）
- 禁止 `console.log` 用于生产日志；仅调试可用

### 5.7 配置管理

- 环境变量：`.env`（`OPENROUTER_API_KEY`，必填；`PORT=8765`，可选）
- 运行时配置：`config.json`（JSON，持久化）：
  ```json
  {
    "default_model": "meta-llama/llama-3.2-3b-instruct:free"
  }
  ```
- 配置加载：`src/config.ts` 提供 `getConfig()`、`setConfig()`，文件变更时热重载（仅开发）

### 5.8 异步与并发

- 异步 I/O 必须使用 `async/await`
- 并行请求使用 `Promise.all`（如同时获取模型列表和验证）
- 禁止回调范式

### 5.9 安全性

- API Key 禁止硬编码、禁止日志输出
- 使用 `helmet` 设置安全头
- 启用 CORS 限制（仅允许 `localhost` 或 `null`）

---

## 6. API 设计规范

### 6.1 端点

```
POST /v1/chat/completions
GET  /v1/models              (可选，返回可用免费模型列表)
GET  /admin/models           (Web 管理页获取全部模型)
PUT  /admin/model            (切换默认模型)
```

### 6.2 Chat Completion 请求/响应

**请求转发规则：**
- 所有 OpenAI 标准参数**全量透传**到 OpenRouter，无额外限制
- 重点支持 coding 常用参数：`tools`、`tool_choice`、`response_format`、`stream`、`temperature`、`max_tokens`、`top_p`、`stop`、`presence_penalty` 等
- 模型优先级：
  1. 请求中指定 `model` → 直接使用该模型
  2. 未指定 `model` → 使用 Web 页面设置的默认模型
  3. 默认模型未配置 → 自动使用 OpenRouter 免费自动路由 `openrouter/auto:free`

**响应处理：**
- 非流式请求：直接返回 OpenRouter 原始 JSON 响应
- 流式请求：**零缓冲透传 SSE 流**，确保 coding agent 实时输出代码
- 错误处理：保留 OpenRouter 原始错误码和错误信息，方便调试

**技术优化：**
- 自动重试：OpenRouter 请求超时/失败时自动重试 1-2 次，提升稳定性
- CORS 支持：允许本地所有端口访问，适配各类 IDE 插件和工具调用
- 请求头全量转发：保留 `Authorization`、`Content-Type`、`OpenAI-Organization` 等所有请求头

### 6.3 模型管理 API

- `GET /admin/models` → `{ models: ModelInfo[], current: string }`
- `PUT /admin/model` → `{ model: string }`，保存至 `config.json`

---

## 7. 模型功能

- **模型列表获取：** 调用官方 API `GET https://openrouter.ai/api/v1/models`（需携带 OPENROUTER_API_KEY）
- **免费模型过滤规则：** 自动筛选所有 `id` 以 `:free` 后缀结尾的模型，按名称排序，过滤掉不可用/已过期的免费模型
- **缓存优化：** 模型列表默认缓存 1 小时，减少 API 调用；Web 页面点击"刷新"按钮时强制重新拉取最新列表
- **实时生效：** 在 Web 页面切换默认模型后，立即写入 `config.json`，后续所有请求立即使用新模型，无需重启服务
- **模型别名支持（可选）：** 可配置简短别名，如 `free-coding` 映射到 `meta-llama/llama-3.2-3b-instruct:free`，简化 agent 配置

---

## 8. 测试规范

- 使用 **Jest** + `supertest`（API 测试）
- 测试文件：`__tests__/` 或同目录 `*.test.ts`
- 覆盖：路由、配置、模型过滤、错误处理
- Mock 外部依赖（OpenRouter API），使用 `jest-fetch-mock` 或 `nock`

示例测试结构：

```typescript
describe('POST /v1/chat/completions', () => {
  it('should use default model when not specified', async () => {
    const res = await request(app).post('/v1/chat/completions').send({
      messages: [{ role: 'user', content: 'Hi' }]
    });
    expect(res.status).toBe(200);
    expect(res.body.model).toBe(config.default_model);
  });
});
```

---

## 9. 部署与运行

### 9.1 环境要求

- Node.js ≥ 18
- npm 或 yarn

### 9.2 启动步骤（3步完成）

```bash
# 1. 安装依赖
npm ci

# 2. 配置 API Key
echo "OPENROUTER_API_KEY=你的OpenRouter API Key" > .env
# 🔍 提示：OpenRouter API Key 可在 https://openrouter.ai/keys 免费申请

# 3. 启动服务
npm start
# 访问 Web 管理页面：http://localhost:8765
```

### 9.3 Docker（可选）

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8765
CMD ["npm", "start"]
```

---

## 10. Web 管理界面规范

- 单文件 SPA（HTML + Vanilla JS 或 Preact）
- 显示免费模型列表（带刷新按钮）
- 选中模型 → `PUT /admin/model`
- 提示：成功/错误（显示 API 返回的错误信息）

---

## 11. 常见陷阱与检查清单

- ✅ 所有 API 调用必须解析 JSON 异常（`response.json()` 失败处理）
- ✅ `.env` 文件禁止提交；`.gitignore` 包含 `config.json`（生产可提交，但敏感环境用 .env）
- ✅ OpenRouter 请求设置 `HTTP-Referer` 和 `X-Title` 头（用于 attribution）
- ✅ 错误中间件必须返回 JSON（非 HTML）
- ✅ 单测覆盖率 > 80%

---

## 12. Git 提交规范

- 使用 Conventional Commits：`feat:`, `fix:`, `docs:`, `test:`, `refactor:`
- 提交前运行 `npm run lint && npm run test`
- 禁止提交调试代码、`.env`、`node_modules`

---

## 13. 持续集成（建议）

```yaml
# .github/workflows/ci.yml
- name: Install
  run: npm ci
- name: Lint
  run: npm run lint
- name: Typecheck
  run: npm run typecheck
- name: Test
  run: npm test -- --coverage
```

---

## 14. 方案优势（针对 Coding 场景优化）

✅ **零侵入适配**：完全兼容 OpenAI API 格式，所有支持 OpenAI 的 coding agent（OpenCode/Cursor/Copilot/Continue 等）无需修改代码，仅需修改 base_url 即可使用

✅ **模型一键切换**：Web 页面可视化切换免费模型，无需修改 agent 配置，测试不同模型的编码效果非常方便

✅ **成本为零**：所有请求均走 OpenRouter 免费模型，无任何费用产生

✅ **高性能低延迟**：本地代理仅做转发，无额外性能损耗，响应速度与直接调用 OpenRouter 一致

✅ **完整功能支持**：支持流式输出、工具调用、结构化输出等所有 coding 必需的 API 特性

---

**文档版本：** 2.0（优化版）  
**最后更新：** 2025-12-20