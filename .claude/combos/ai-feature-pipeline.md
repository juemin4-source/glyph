# 接 AI 管线阵 AI Feature Pipeline v0.1

> 在织梦机的五画板管线中接入一个新的 AI 能力。
> 从"想要 AI 做什么"到"画板上有一个能用的按钮"。

---

## 触发条件

需要在织梦机中添加一个新的 AI 功能时：
- 某个画板需要一个"AI 生成"按钮
- 需要新的意图识别（route intent）
- 需要新的结构化输出解析（structured output）
- 现有 AI 按钮不满足需求

## 架构原则（必须先读）

```
UI 按钮
  │
  ▼
Router (lib/ai/command-router.ts) ← 单一入口，所有 AI 调用必经此路
  │
  ▼
Context Builder (lib/ai/context-builder.ts) ← 拼上下文 + 当前画板数据
  │
  ▼
LLM Client (lib/llm-client.ts) ← 单一 fetch 路径，无 Tauri invoke fallback
  │
  ▼
Provider v2 (Rust ai_commands: save_provider_config / resolve_provider_credential)
  │
  ▼
Parser (lib/ai/structured-parser.ts) ← 解析 AI 输出
  │
  ▼
用户确认/修改/拒绝
```

硬规则：
- **不得直接 `import { callLlm } from 'llm-client'`** — 全走 Router
- **不得调 Rust 侧的 AI 命令** — `build_context`、`route_intent`、`parse_*` 已删除
- **不得在新代码中使用 v1 BYOK** — `store_api_key` 等已删除
- **不得静默 fallback** — 失败必须上报，不吞错误

## 连招表

```
分析 → 注册 → 实现 → 接线 → 验证
```

| 顺序 | 节点 | 做什么 | 产出 |
|------|------|--------|------|
| 1 | 分析 | 确定 AI 的输入（当前画板数据）和输出（结构化 JSON） | 契约定义 |
| 2 | 注册 | 在 Router 中添加新 intent，在 Context Builder 中添加数据装配 | `command-router.ts` + `context-builder.ts` |
| 3 | 实现 | 写调用逻辑：`Router → callLlm → parse` | 功能函数 |
| 4 | 接线 | 画板上加按钮 → 调 Router → 显示结果 | UI 组件 |
| 5 | 验证 | 点按钮 → 看结果 → 看错误上报是否正确 | 手动确认 |

## 节点 1：分析

确定：
```
input:  当前画板有什么数据可喂给 AI？
output: AI 应该返回什么结构？
intent: router 应该识别什么关键词？
```

## 节点 2：注册

在 `lib/ai/command-router.ts` 中添加：
- `detectIntent()` 中的关键词匹配
- 新 intent 的 `triState` 策略

在 `lib/ai/context-builder.ts` 中添加：
- 新 canvasType 的数据装配
- 上游依赖画板的数据加载

## 节点 3：实现

在 `lib/` 或 `api/` 中写功能函数。典型的调用模式：

```typescript
import { route } from './ai/command-router';
import { buildContext } from './ai/context-builder';

async function myAiFeature(projectId: string, message: string) {
  // 1. Route
  const routeResult = await route({ message, canvasId, projectId });
  if (!routeResult.dbWriteAllowed) throw new Error(routeResult.fallbackReason);

  // 2. Build context
  const context = await buildContext({ canvasId, projectId, outputType: 'my_type' });

  // 3. Call LLM (Router handles this)
  const response = await routeResult.executeLlmCall?.(context);
  return response;
}
```

## 节点 4：接线

在画板组件中：
```tsx
<button onClick={async () => {
  setLoading(true);
  try {
    const result = await myAiFeature(projectId, message);
    setResult(result);
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    setLoading(false);
  }
}}>
  AI 生成
</button>
```

## 节点 5：验证

- 按钮点了 → loading 状态出现？
- AI 返回了 → 结果显示？
- API key 错误 → 红色错误提示，不静默？
- 网络断开 → 明确错误提示？
- 超时 → 超时提示？

## 依赖的软技能

| 软技能 | 用途 |
|--------|------|
| `lib/ai/command-router.ts` | 路由 AI 请求，解析 intent |
| `lib/ai/context-builder.ts` | 构建 AI 上下文 |
| `lib/llm-client.ts` | 单一 fetch 路径调 LLM |
| `lib/ai/structured-parser.ts` | 解析 AI 结构化输出 |
| Rust `resolve_provider_credential` | 获取 API key（唯一凭据源） |

## 与 ElyHa 参考架构的对应

| ElyHa | 织梦机对应 |
|-------|-----------|
| `AIService` | `Router + Context Builder` |
| `LLM Adapter`（mock/legacy） | `llm-client.ts`（单一 fetch） |
| `LangGraph` 多 Agent | 未实现（未来可以加） |
| `LLM Preset` | `ai_provider_config` |
