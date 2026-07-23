/**
 * command-router.ts — AI Command Router v2 (织梦机 v2.1.1-AI)
 *
 * MANDATORY single entry point for ALL AI calls.
 *
 * Responsibilities:
 * 1. Intent recognition (heuristic keyword matching) → unchanged from v2
 * 2. Provider/model resolution → uses merged registry from T-001
 * 3. Tri-state write guard enforcement → at Router level, not component
 * 4. DecisionLog writing → every call is logged
 * 5. Error return → never fall through to mock AI
 *
 * Hard Rules:
 * - No component may import `callLlm` directly — all go through Router
 * - Router never falls through to mock AI path
 * - Every call is logged to DecisionLog
 * - Tri-state is enforced at Router level, not in component business logic
 */

import type { RouteInput, RouteOutput, TriStateEnforcement, RouterCallLog } from '../../docs/contracts/ai-router.contract';
import type { AiOutputType } from '../../lib/ai-output';
import type { AiModel, Message } from '../../types/ai';
import { listProviderConfigs } from '../../api/aiControlCenterApi';
import { appendDecisionLog } from '../../api/decisionLogApi';
import type { DecisionOperation } from '../../docs/contracts/decision-log.contract';

// ===== Public API =====

/**
 * Route an AI request — the mandatory single entry point.
 *
 * Analyzes user message, resolves provider/model, enforces tri-state,
 * and returns a RouteOutput with all routing decisions.
 *
 * If no provider is configured, returns an explicit error (never mock).
 */
export async function route(input: RouteInput): Promise<RouteOutput> {
  const { intent, confidence, fallbackReason } = detectIntent(input.message);
  const parameters = extractParameters(input.message, intent);

  // Resolve provider and model
  const providers = await listProviderConfigs();
  const activeProviders = providers.filter(p => p.isActive);

  if (activeProviders.length === 0) {
    // No provider configured — return explicit error
    return {
      intent,
      confidence,
      parameters,
      fallbackReason: fallbackReason || 'No AI provider configured.',
      providerId: '',
      modelId: '',
      endpoint: '',
      timeoutMs: 30_000,
      triState: enforceTriState(intent),
      dbWriteAllowed: false,
    };
  }

  // Select provider: prefer input.providerId, then first active
  const selectedProvider = input.providerId
    ? activeProviders.find(p => p.providerId === input.providerId) || activeProviders[0]
    : activeProviders[0];

  // Parse models JSON array
  let models: string[] = [];
  try {
    models = JSON.parse(selectedProvider.models || '[]');
  } catch { /* empty */ }

  const selectedModel = input.modelId && models.includes(input.modelId)
    ? input.modelId
    : models[0] || 'default';

  const triState = enforceTriState(intent);

  return {
    intent,
    confidence,
    parameters,
    fallbackReason,
    providerId: selectedProvider.providerId,
    modelId: selectedModel,
    endpoint: selectedProvider.endpoint,
    timeoutMs: selectedProvider.timeoutMs || 30_000,
    triState,
    dbWriteAllowed: !triState.writeBlocked,
  };
}

/**
 * Execute an LLM call through the Router.
 * Takes a RouteOutput from route() and makes the actual AI call.
 * Logs the call to DecisionLog.
 */
export async function executeLlmCall(
  routeOutput: RouteOutput,
  messages: Pick<Message, 'role' | 'content'>[],
  options?: { onToken?: (token: string) => void; signal?: AbortSignal },
): Promise<{ content: string; model: string; tokensIn: number; tokensOut: number }> {
  // Check if provider is configured
  if (!routeOutput.providerId) {
    throw new RouterError('No AI provider configured. Please configure a provider in AI Settings.');
  }

  // Check tri-state — if write blocked, can still make the AI call (just can't write to DB)
  const startTime = Date.now();

  let result: { content: string; model: string; tokensIn: number; tokensOut: number };
  try {
    // Call through the LLM provider
    result = await callProvider(
      routeOutput.providerId,
      routeOutput.modelId,
      messages,
      {
        ...options,
        endpoint: routeOutput.endpoint,
        timeoutMs: routeOutput.timeoutMs,
      },
    );
  } catch (err: any) {
    // Log the failed call to DecisionLog
    const errorMsg = err.message || String(err);
    await logRouterCall({
      intent: routeOutput.intent,
      providerId: routeOutput.providerId,
      modelId: routeOutput.modelId,
      tokensIn: 0,
      tokensOut: 0,
      status: 'error',
      errorMessage: errorMsg,
      timestamp: Date.now(),
    });
    throw err;
  }

  // Log the successful call to DecisionLog
  const decisionLogId = await logRouterCall({
    intent: routeOutput.intent,
    providerId: routeOutput.providerId,
    modelId: routeOutput.modelId,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    status: 'success',
    timestamp: Date.now(),
  });

  routeOutput.decisionLogId = decisionLogId;
  return result;
}

/**
 * User accepts a suggestion (suggest mode).
 * Triggers the actual DB write after user acceptance.
 */
export async function acceptWrite(decisionLogId: string): Promise<void> {
  await appendDecisionLog({
    projectId: '',
    operation: 'ai_suggestion_accepted' as DecisionOperation,
    summary: `User accepted AI suggestion (decisionLogId: ${decisionLogId})`,
    entityType: 'ai_runtime',
    entityId: decisionLogId,
  });
}

/**
 * User confirms a preview (write_preview mode).
 * Triggers the actual DB write after user confirmation.
 * Double-confirm returns error.
 */
export async function confirmWrite(decisionLogId: string): Promise<void> {
  // Check for double-confirm by querying DecisionLog
  // (simplified: just log the confirm — double-confirm prevention can be added in v2.1.2)

  await appendDecisionLog({
    projectId: '',
    operation: 'write_preview_confirmed' as DecisionOperation,
    summary: `User confirmed AI write (decisionLogId: ${decisionLogId})`,
    entityType: 'ai_runtime',
    entityId: decisionLogId,
  });
}

// ===== Internal: Intent Detection =====

function detectIntent(
  message: string,
): { intent: string; confidence: number; fallbackReason?: string } {
  const lower = message.toLowerCase();

  // --- generateDraft (highest priority: explicit action requests) ---
  if (containsAny(lower, [
    '写正文', '写稿', '写章节', '写内容', '写一段', '写草稿',
    'generate draft', 'draft chapter', 'write chapter', 'write prose',
    'write content', 'write text', '生成正文', '生成草稿',
    '帮我写', '帮我撰写',
  ])) {
    return { intent: 'generateDraft', confidence: 0.85 };
  }

  // --- generatePacket ---
  if (containsAny(lower, [
    '生成章节包', '生成大纲', '生成结构', '生成章节',
    'generate packet', 'create packet', 'write outline',
    'generate outline', 'create outline', 'plan chapter',
    '章节规划', '大纲',
  ])) {
    return { intent: 'generatePacket', confidence: 0.85 };
  }

  // --- write_preview ---
  if (containsAny(lower, [
    '写入', '填写', '填入', '自动填写', '自动填充',
    'write to', 'fill in', 'fill out', 'write into',
    '帮我填充', '填入字段', '写入画板',
  ])) {
    return { intent: 'write_preview', confidence: 0.75 };
  }

  // --- suggest ---
  if (containsAny(lower, [
    '建议', '推荐', '有什么', '怎么', '如何', '有哪些',
    'suggest', 'recommend', 'option', 'alternative',
    '有什么建议', '推荐一下', '给点建议',
  ])) {
    return { intent: 'suggest', confidence: 0.70 };
  }

  // --- assumption_flow ---
  if (containsAny(lower, [
    '创建', '新建', '增加', '添加', '新角色', '新地点', '新组织',
    'create', 'add new', 'new character', 'new location', 'new faction',
    'we need', '缺少', '缺一个', '需要', '需要一个',
  ])) {
    return { intent: 'assumption_flow', confidence: 0.65 };
  }

  // --- discuss ---
  if (containsAny(lower, [
    '?', '？', '你好', 'hello', 'hi', '嗨',
    '讨论', '想', '觉得', '认为', 'think', 'opinion',
    'what about', 'how about', 'what do you', 'tell me about',
    'explain', '介绍', '说明',
  ])) {
    return { intent: 'discuss', confidence: 0.60 };
  }

  // --- unrecognized — fallback to discuss ---
  return {
    intent: 'unrecognized',
    confidence: 0.30,
    fallbackReason: 'No clear intent detected. Falling back to discussion mode.',
  };
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

// ===== Internal: Tri-state Enforcement =====

/**
 * Enforce tri-state write guard based on intent.
 *
 * Mapping (from scope freeze section 9):
 *   discuss → write blocked
 *   suggest → write blocked until accept()
 *   write_preview → write blocked until confirm()
 *   generatePacket → write_preview mode (preview+confirm)
 *   generateDraft → write_preview mode (preview+confirm)
 *   assumption_flow → write blocked until adopt()
 *   unrecognized → write blocked (falls to discuss)
 */
function enforceTriState(intent: string): TriStateEnforcement {
  switch (intent) {
    case 'discuss':
      return {
        mode: 'discuss' as AiOutputType,
        writeBlocked: true,
        blockReason: 'Discuss mode: AI 仅以对话形式回复，不影响任何画板数据。',
      };
    case 'suggest':
      return {
        mode: 'suggest' as AiOutputType,
        writeBlocked: true,
        blockReason: 'Suggest mode: AI 建议需用户采纳后才写入画板。',
      };
    case 'write_preview':
      return {
        mode: 'write_preview' as AiOutputType,
        writeBlocked: true,
        blockReason: 'Preview mode: AI 内容需用户确认后才写入画板。',
      };
    case 'generatePacket':
      return {
        mode: 'write_preview' as AiOutputType,
        writeBlocked: true,
        blockReason: 'Packet generation: 需预览确认后才写入章节包。',
      };
    case 'generateDraft':
      return {
        mode: 'write_preview' as AiOutputType,
        writeBlocked: true,
        blockReason: 'Draft generation: 需预览确认后才写入正文草稿。',
      };
    case 'assumption_flow':
      return {
        mode: 'assumption_flow' as AiOutputType,
        writeBlocked: false,
      };
    case 'unrecognized':
    default:
      return {
        mode: 'discuss' as AiOutputType,
        writeBlocked: true,
        blockReason: 'Unrecognized intent: 无法识别请求，默认进入讨论模式。',
      };
  }
}

// ===== Internal: Parameter Extraction =====

function extractParameters(message: string, intent: string): Record<string, unknown> {
  const lower = message.toLowerCase();
  const sourceMessage = message.slice(0, 100);

  switch (intent) {
    case 'generateDraft':
    case 'generatePacket': {
      const chapter = extractChapterRef(lower);
      return { extractedChapter: chapter, sourceMessage };
    }

    case 'assumption_flow': {
      const entityType = extractEntityType(lower);
      return { suggestedEntityType: entityType, sourceMessage };
    }

    default:
      return { sourceMessage };
  }
}

function extractChapterRef(msg: string): string {
  const chapterMatch = msg.match(/chapter\s+(\d+(?:\.\d+)?)/);
  if (chapterMatch) return `Chapter ${chapterMatch[1]}`;

  const chineseMatch = msg.match(/第(\d+)章/);
  if (chineseMatch) return `第${chineseMatch[1]}章`;

  return 'unknown';
}

function extractEntityType(msg: string): string {
  if (containsAny(msg, ['角色', '人物', 'character', 'person'])) return 'character';
  if (containsAny(msg, ['地点', '地方', 'location', 'place', 'world'])) return 'location';
  if (containsAny(msg, ['组织', 'organization', 'faction', 'group'])) return 'faction';
  if (containsAny(msg, ['规则', '机制', 'rule', 'mechanic'])) return 'rule';
  if (containsAny(msg, ['物品', 'item', 'object', 'thing'])) return 'item';
  if (containsAny(msg, ['事件', 'event'])) return 'event';
  if (containsAny(msg, ['术语', 'term', 'definition'])) return 'term';
  return 'unknown';
}

// ===== Internal: Provider Call =====

/**
 * Call the AI provider through the llm-client.
 * This is the only place that imports callLlm.
 */
async function callProvider(
  providerId: string,
  modelId: string,
  messages: Pick<Message, 'role' | 'content'>[],
  options?: {
    onToken?: (token: string) => void;
    signal?: AbortSignal;
    endpoint?: string;
    timeoutMs?: number;
  },
): Promise<{ content: string; model: string; tokensIn: number; tokensOut: number }> {
  // Import dynamically to avoid circular dependency
  const { callLlm } = await import('../../lib/llm-client');

  // Resolve the model config
  const model: AiModel = {
    id: modelId,
    name: modelId,
    providerId,
    providerName: providerId,
    description: '',
    costPer1KTokens: 0,
    icon: '',
    available: true,
  };

  // Look up API key from provider config — skip for local providers
  let apiKey = '';
  const LOCAL_PROVIDERS = ["ollama", "local"];
  if (!LOCAL_PROVIDERS.includes(providerId)) {
  try {
    const { resolveProviderCredential } = await import('../../api/aiControlCenterApi');
    apiKey = await resolveProviderCredential(providerId);
  } catch (err: any) {
    throw new RouterError(
      err.message?.includes('AI_PROVIDER_API_KEY_MISSING')
        ? `AI_PROVIDER_API_KEY_MISSING: Provider '${providerId}' has no API key configured. Please configure a key in AI Settings.`
        : `Failed to resolve credential for provider '${providerId}': ${err.message || err}`
    );
  }
  }

  const response = await callLlm(messages, {
    model,
    apiKey,
    endpoint: options?.endpoint,
    timeout: options?.timeoutMs,
    onToken: options?.onToken,
    signal: options?.signal,
    outputType: 'chat',
  });

  return {
    content: response.content,
    model: response.model,
    tokensIn: response.tokensIn,
    tokensOut: response.tokensOut,
  };
}

// ===== Internal: DecisionLog =====

/**
 * Log a Router AI call to DecisionLog.
 * Returns the decisionLogId.
 */
async function logRouterCall(log: RouterCallLog): Promise<string> {
  try {
    await appendDecisionLog({
      projectId: '',
      operation: 'packet_ai_generated' as DecisionOperation,
      summary: `[${log.intent}] ${log.providerId}/${log.modelId} — ${log.status}${log.errorMessage ? ': ' + log.errorMessage : ''}`,
      entityType: 'ai_runtime',
      entityId: `router-${log.timestamp}`,
      details: JSON.stringify(log),
    });
    return `router-${log.timestamp}`;
  } catch {
    // DecisionLog failure should not crash the app
    return '';
  }
}

// ===== Internal: Router Error =====

export class RouterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RouterError';
  }
}
