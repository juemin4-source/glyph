// ===== LLM Client — Zhimengji v2.0.2 (W03) =====
// Cleared: Tauri invoke path, pseudo-streaming, dead code. Single fetch path.
//
// v2.0.2 adds:
// - StructuredLlmCallOptions with outputSchema support
// - Provider-aware model routing (chat / structured / generation / detection)
// - Automatic output parsing when outputSchema is provided
//
// 2026-07-13 sanitize:
// - Removed Tauri invoke('call_llm') fallback path
// - Removed callLlmStream (dead export — Router uses callLlm)
// - Removed mapTauriError (no longer needed)
// - Single fetch path with structured error reporting

import type { Message, AiModel } from '../types/ai';
import { parseStructuredOutput } from './ai/structured-parser';
import type { ParseResult } from './ai/structured-parser';

export interface LlmCallOptions {
  model: AiModel;
  endpoint?: string;
  apiKey?: string;
  timeout?: number;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
}

/**
 * Extended options for structured LLM calls.
 * Adds schema hints, strict mode, and output-type routing.
 */
export interface StructuredLlmCallOptions extends LlmCallOptions {
  /** JSON schema for structured output (object, not stringified) */
  outputSchema?: Record<string, unknown>;
  /** If true, require exact schema match */
  strictMode?: boolean;
  /** Output type for provider-aware model routing */
  outputType?: 'discuss' | 'suggest' | 'write_preview' | 'detection' | 'chat' | 'structured' | 'generation';
}

export interface LlmResponse {
  content: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  /** Present when outputSchema was provided: the parsed result */
  parsed?: ParseResult;
}

export type LlmErrorCode = 'timeout' | 'auth_failed' | 'network_error' | 'rate_limited' | 'server_error' | 'unknown';

export class LlmError extends Error {
  code: LlmErrorCode;
  constructor(code: LlmErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'LlmError';
  }
}

const FREELLM_ENDPOINT = 'http://localhost:3001/v1';

/** Provider endpoint map for direct API calls (fallback fetch path). */
const PROVIDER_ENDPOINTS: Record<string, string> = {
  'google': 'https://generativelanguage.googleapis.com/v1beta',
  'openai': 'https://api.openai.com/v1',
  'anthropic': 'https://api.anthropic.com/v1',
  'zhipu': 'https://open.bigmodel.cn/api/paas/v4',
  'ollama': 'http://localhost:11434/v1',
  'free_llm_api': FREELLM_ENDPOINT,
};

function getEndpointForProvider(providerId: string): string {
  return PROVIDER_ENDPOINTS[providerId] || FREELLM_ENDPOINT;
}

/** Convert a configured base URL into the OpenAI-compatible chat endpoint. */
function getChatEndpoint(providerId: string, configuredEndpoint?: string): string {
  const base = (configuredEndpoint || getEndpointForProvider(providerId)).replace(/\/+$/, '');
  if (/\/(chat\/completions|messages|generateContent)(\?|$)/.test(base)) return base;
  if (providerId === 'google') return `${base}/openai/chat/completions`;
  if (providerId === 'anthropic') return `${base}/messages`;
  return `${base}/chat/completions`;
}

function createRequestSignal(signal: AbortSignal | undefined, timeout: number): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(Math.max(1_000, timeout));
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

/**
 * Provider-aware model routing.
 * Maps outputType to recommended model characteristics for model selection.
 */
function getModelRequirements(outputType?: string): { requiresStructured: boolean; priority: string } {
  switch (outputType) {
    case 'structured':
    case 'detection':
      return { requiresStructured: true, priority: 'accuracy' };
    case 'suggest':
    case 'write_preview':
    case 'generation':
      return { requiresStructured: false, priority: 'creativity' };
    case 'discuss':
    case 'chat':
    default:
      return { requiresStructured: false, priority: 'balance' };
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function calculateCost(tokensIn: number, tokensOut: number, model: AiModel): number {
  return ((tokensIn + tokensOut) / 1000) * model.costPer1KTokens;
}
export async function callLlm(
  messages: Pick<Message, 'role' | 'content'>[],
  options: StructuredLlmCallOptions
): Promise<LlmResponse> {
  const { model, apiKey, timeout = 30000, signal, outputSchema, strictMode, outputType } = options;
  const token = apiKey || '';
  const requestSignal = createRequestSignal(signal, timeout);

  // Provider-aware model routing hint
  getModelRequirements(outputType);

  try {
    const baseUrl = (options.endpoint || getEndpointForProvider(model.providerId)).replace(/\/+$/, '');
    const isGemini = model.providerId === 'google';
    const isAnthropic = model.providerId === 'anthropic';
    const apiUrl = isGemini
      ? baseUrl + '/models/' + model.name + ':generateContent' + (token ? '?key=' + encodeURIComponent(token) : '')
      : isAnthropic
        ? (/\/messages$/.test(baseUrl) ? baseUrl : baseUrl + '/messages')
        : getChatEndpoint(model.providerId, baseUrl);

    const systemText = messages
      .filter(message => message.role === 'system')
      .map(message => message.content)
      .join('\n\n');
    const conversation = messages.filter(message => message.role !== 'system');

    const requestBody = isGemini
      ? JSON.stringify({
          ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
          contents: conversation.map(message => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: message.content }],
          })),
          generationConfig: { maxOutputTokens: 4096 },
        })
      : isAnthropic
        ? JSON.stringify({
            model: model.name,
            max_tokens: 4096,
            ...(systemText ? { system: systemText } : {}),
            messages: conversation.map(message => ({
              role: message.role === 'assistant' ? 'assistant' : 'user',
              content: message.content,
            })),
          })
        : JSON.stringify({
            model: model.name,
            messages: messages.map(message => ({ role: message.role, content: message.content })),
            max_tokens: 4096,
          });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(isAnthropic
          ? (token ? { 'x-api-key': token, 'anthropic-version': '2023-06-01' } : { 'anthropic-version': '2023-06-01' })
          : isGemini
            ? {}
            : (token ? { 'Authorization': 'Bearer ' + token } : {})),
      },
      body: requestBody,
      signal: requestSignal,
    });

    if (!response.ok) {
      let detail = '';
      try { const errBody = await response.text(); detail = errBody.slice(0, 300); } catch { /* ignore */ }
      if (response.status === 401) throw new LlmError('auth_failed', 'API Key 认证失败');
      if (response.status === 429) throw new LlmError('rate_limited', '请求频率过高');
      if (response.status >= 500) throw new LlmError('server_error', '服务端错误 (' + response.status + ') ' + detail);
      throw new LlmError('unknown', '请求失败 (' + response.status + ') ' + detail);
    }

    const data = await response.json();
    let content = '';
    if (isGemini) {
      content = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || '';
    } else if (isAnthropic) {
      content = data.content?.map((part: { type?: string; text?: string }) => part.type === 'text' ? (part.text || '') : '').join('') || '';
    } else {
      content = data.choices?.[0]?.message?.content || '';
    }
    const tokensIn = data.usage?.prompt_tokens || data.usage?.input_tokens || estimateTokens(JSON.stringify(messages));
    const tokensOut = data.usage?.completion_tokens || data.usage?.output_tokens || estimateTokens(content);

    let parsed: ParseResult | undefined;
    if (outputSchema && content) {
      parsed = parseStructuredOutput({
        rawContent: content,
        schema: JSON.stringify(outputSchema),
        strict: strictMode ?? false,
      });
      if (parsed.status === 'valid' || parsed.status === 'repaired') {
        content = JSON.stringify(parsed.data);
      } else if (parsed.status === 'fallback' && parsed.fallbackText) {
        content = parsed.fallbackText;
      }
    }

    return {
      content,
      model: data.model || model.name,
      tokensIn,
      tokensOut,
      cost: calculateCost(tokensIn, tokensOut, model),
      parsed,
    };
  } catch (e) {
    if (e instanceof LlmError) throw e;
    if ((e as Error).name === 'AbortError') throw new LlmError('timeout', '请求已取消');
    if ((e as TypeError).message?.includes('fetch')) {
      throw new LlmError('network_error', '网络连接失败');
    }
    throw new LlmError('unknown', (e as Error).message || '未知错误');
  }
}
export async function callLlmStream(
  messages: Pick<Message, 'role' | 'content'>[],
  options: StructuredLlmCallOptions
): Promise<LlmResponse> {
  const { model, apiKey, onToken, timeout = 30000, signal, outputSchema, strictMode } = options;
  const endpoint = options.endpoint || FREELLM_ENDPOINT;
  const token = apiKey || '';
  let fullContent = '';
  let tokensOut = 0;

  try {
    const url = endpoint + '/chat/completions';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ model: model.name, messages, max_tokens: 4096, stream: true }),
      signal,
    });

    if (!response.ok) {
      let detail = '';
      try { const errBody = await response.text(); detail = errBody.slice(0, 300); } catch { /* ignore */ }
      if (response.status === 401) throw new LlmError('auth_failed', 'API Key 认证失败');
      if (response.status === 429) throw new LlmError('rate_limited', '请求频率过高');
      if (response.status >= 500) throw new LlmError('server_error', '服务端错误 (' + response.status + ') ' + detail);
      throw new LlmError('unknown', '请求失败 (' + response.status + ') ' + detail);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new LlmError('network_error', '无法读取响应流');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices?.[0]?.delta?.content || '';
          if (delta && onToken) onToken(delta);
          fullContent += delta;
        } catch { /* skip unparseable chunks */ }
      }
    }
    tokensOut = estimateTokens(fullContent);
    const tokensIn = estimateTokens(JSON.stringify(messages));

    let parsed: ParseResult | undefined;
    if (outputSchema && fullContent) {
      parsed = parseStructuredOutput({
        rawContent: fullContent, schema: JSON.stringify(outputSchema), strict: strictMode ?? false,
      });
      if (parsed.status === 'valid' || parsed.status === 'repaired') fullContent = JSON.stringify(parsed.data);
      else if (parsed.status === 'fallback' && parsed.fallbackText) fullContent = parsed.fallbackText;
    }

    return { content: fullContent, model: model.name, tokensIn, tokensOut, cost: calculateCost(tokensIn, tokensOut, model), parsed };
  } catch (e) {
    if (e instanceof LlmError) throw e;
    if ((e as Error).name === 'AbortError') throw new LlmError('timeout', '请求已取消');
    throw new LlmError('unknown', (e as Error).message || '未知错误');
  }
}
export async function testConnection(
  endpoint: string,
  apiKey: string
): Promise<{ success: boolean; latency: number; models: string[]; error?: string }> {
  const start = performance.now();
  try {
    const url = endpoint + '/models';
    const response = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + apiKey },
      signal: AbortSignal.timeout(10000),
    });
    const latency = Math.round(performance.now() - start);
    if (!response.ok) {
      return { success: false, latency, models: [], error: 'HTTP ' + response.status + ': ' + response.statusText };
    }
    const data = await response.json();
    const models = (data.data || data.models || []).map((m: any) => m.id || m.name || m);
    return { success: true, latency, models };
  } catch (e: any) {
    const latency = Math.round(performance.now() - start);
    return { success: false, latency, models: [], error: e.message || '连接失败' };
  }
}

