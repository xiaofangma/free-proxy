# OpenRouter Free Proxy

本地 OpenRouter 免费模型代理服务，开箱即用，零配置修改即可支持所有 OpenAI 兼容的编码工具（OpenCode/Cursor/Copilot 等）。

## 🌟 特性

- 🚀 **开箱即用**：仅需配置 API Key 即可启动
- 🔄 **动态模型切换**：Web 界面一键切换免费模型，无需重启服务
- ⚡ **零侵入**：无需修改现有工具配置，仅需更新 Base URL
- 📦 **轻量级**：仅 5 个核心文件，代码总量 < 500 行
- 🌊 **原生流式响应**：完全支持流式输出，无延迟
- 🔒 **本地部署**：所有配置保存在本地，数据安全

## 📦 安装

```bash
git clone <repository-url>
cd or_free_proxy
npm install
```

## ⚙️ 配置

### 1. 设置 OpenRouter API Key

编辑 `.env` 文件，添加你的 OpenRouter API Key：

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
# 可选：自定义端口
# PORT=8765
```

> 👉 获取 API Key: https://openrouter.ai/keys

### 2. 启动服务

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm start
```

服务启动后访问：http://localhost:8765

## 🔧 使用方法

### Web 管理界面

访问 http://localhost:8765 即可看到管理界面：
- 查看所有可用免费模型
- 一键切换默认模型
- 刷新模型列表（每小时自动缓存）

### 配置编码工具

将你的编码工具（OpenCode/Cursor/Copilot 等）的 Base URL 配置为：
```
http://localhost:8765/v1
```

- **API Key**: 可以随意填写任意字符串（代理会自动使用你在 `.env` 中配置的 OpenRouter API Key）
- **模型名**: 可以随意填写任意字符串（代理会自动忽略请求中的模型参数，强制使用你在 Web 管理界面选择的默认免费模型）

> 💡 设计说明：很多编码工具会校验模型名是否在其内置支持列表中，所以你只需要填写一个工具能识别的模型名即可，代理会在转发请求时自动替换为实际选择的 OpenRouter 免费模型。

### 示例：OpenCode 配置

#### 方式1：快速临时使用
直接在 OpenCode 中运行：
```bash
/config set base_url http://localhost:8765/v1
/config set api_key any_string
/config set model gpt-4o
```

#### 方式2：永久配置（支持 `/model` 命令快速切换）
编辑你的 OpenCode 配置文件（`~/.opencode/config.json`），添加新的 provider：
```json
{
  "model": "or-free-proxy",
  "provider": {
    "openrouter-free": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "OpenRouter Free Proxy",
      "options": {
        "baseURL": "http://localhost:8765/v1",
        "apiKey": "any_string"
      },
      "models": {
        "or-free-proxy": {
          "name": "or-free-proxy",
          "limit": {
            "context": 128000,
            "output": 4096
          },
          "modalities": {
            "input": ["text"],
            "output": ["text"]
          }
        }
      }
    },
    // 你原来的其他 provider 配置...
  }
}
```

配置完成后，就可以直接用命令快速切换到本地代理：
```bash
/model or-free-proxy
```

切换后所有请求都会通过本地代理发送，使用你在 Web 界面选择的免费模型。

## 📝 API 接口

### 1. Chat Completions (OpenAI 兼容)
```
POST /v1/chat/completions
```
完全兼容 OpenAI 接口规范，支持流式响应。

### 2. 获取模型列表
```
GET /admin/models?refresh=true
```
返回所有免费模型和当前选中的默认模型。

### 3. 切换默认模型
```
PUT /admin/model
Content-Type: application/json

{
  "model": "llama-3.2-3b-instruct:free"
}
```
切换成功后立即生效，无需重启服务。

## 🧪 测试

### 测试非流式请求
```bash
curl http://localhost:8765/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "写一个快速排序的Python代码"}],
    "temperature": 0.7
  }'
```

### 测试流式请求
```bash
curl http://localhost:8765/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "写一个快速排序的Python代码"}],
    "stream": true
  }'
```

## 📁 项目结构

```
/
├── src/
│   ├── config.ts      # 配置读写模块
│   ├── models.ts      # 模型获取与过滤模块
│   └── server.ts      # 主服务入口（包含代理逻辑）
├── public/
│   └── index.html     # Web 管理界面
├── .env               # 环境变量配置
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 🎯 完成标准

- ✅ 执行 `npm start` 服务正常启动，访问 http://localhost:8765 可看到管理界面
- ✅ 模型列表加载正常，点击切换按钮可正常切换默认模型，无需重启服务
- ✅ curl 测试接口返回正常，支持流式响应
- ✅ OpenCode 配置 base_url = `http://localhost:8765/v1` 后，可正常调用生成代码
- ✅ 切换模型后，OpenCode 后续请求自动使用新模型，无需修改任何配置

## 📄 许可证

MIT
