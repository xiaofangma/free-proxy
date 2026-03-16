import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { stream } from 'hono/streaming';
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

// 转发请求到OpenRouter
async function proxyRequest(
  path: string,
  method: string,
  body: any,
  headers: Record<string, string>
): Promise<Response> {
  const config = await getConfig();
  
  // 始终使用默认模型，忽略请求中传入的模型名
  body.model = config.default_model;

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

  return await fetch(`${ENV.OPENROUTER_BASE_URL}${path}`, {
    method,
    headers: proxyHeaders,
    body: JSON.stringify(body)
  });
}

// 1. Chat Completions 接口
app.post('/v1/chat/completions', async (c) => {
  try {
    const body = await c.req.json();
    const headers = Object.fromEntries(c.req.raw.headers.entries());
    
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
      }, {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      } as any);
    }

    // 非流式响应
    const data = await response.json();
    return c.json(data, { status: response.status as any });
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
    console.error('Error fetching models:', err);
    return c.json({ 
      error: err.message,
      details: err.toString(),
      stack: err.stack
    }, 500);
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
