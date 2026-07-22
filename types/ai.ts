// ===== AI Chat Types for 织梦机 v1.3 =====

export type MessageRole = 'user' | 'assistant' | 'system';

export interface DocCardSection {
  title: string;
  content: string;
}

export interface DocCardData {
  id: string;
  type: 'world' | 'org' | 'character' | 'location' | 'item' | 'term';
  typeLabel: string;
  title: string;
  status: string;
  bodyHTML: string;
  sections?: DocCardSection[];
  edited?: boolean;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  docs?: DocCardData[];
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  modelId: string;
  createdAt: number;
  updatedAt: number;
}

export type ProviderStatus = 'connected' | 'disconnected' | 'error';

export interface ProviderConfig {
  id: string;
  name: string;
  icon: string;
  apiKey: string;
  endpoint: string;
  timeout: number;
  models: string[];
  status: ProviderStatus;
  keyLastEdited?: string;
}

export interface AiModel {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  description: string;
  costPer1KTokens: number;
  icon: string;
  available: boolean;
}

export interface ModelUsage {
  modelId: string;
  modelName: string;
  providerName: string;
  tokens: number;
  cost: number;
  icon: string;
}

export interface DailyUsage {
  date: string;
  dayLabel: string;
  totalTokens: number;
  models: ModelUsage[];
}

export interface UsageStats {
  todayTokens: number;
  maxTokens: number;
  dailyHistory: DailyUsage[];
  totalCostToday: number;
  totalCostMonth: number;
  budgetLimit: number;
}

export interface AiSettingsState {
  providers: ProviderConfig[];
  activeModelId: string;
  budgetLimit: number;
  usageStats: UsageStats;
}

export type SettingsTab = 'api-keys' | 'models' | 'usage' | 'cost';

// ===== Preset provider definitions =====
export const PRESET_PROVIDERS: Array<{ id: string; name: string; icon: string; defaultEndpoint: string; defaultModels: string[] }> = [
  { id: 'openai', name: 'OpenAI', icon: '\u{1F7E2}', defaultEndpoint: 'https://api.openai.com/v1', defaultModels: ['GPT-4o', 'GPT-4', 'GPT-3.5 Turbo'] },
  { id: 'anthropic', name: 'Anthropic', icon: '\u{1F7E0}', defaultEndpoint: 'https://api.anthropic.com/v1', defaultModels: ['Claude 3.5 Sonnet', 'Claude 3 Haiku'] },
  { id: 'google', name: 'Google AI', icon: '\u{1F535}', defaultEndpoint: 'https://generativelanguage.googleapis.com/v1', defaultModels: ['Gemini Pro', 'Gemini Ultra'] },
  { id: 'azure', name: 'Azure OpenAI', icon: '\u{1F7E3}', defaultEndpoint: 'https://<resource>.openai.azure.com', defaultModels: ['GPT-4o', 'GPT-4'] },
  { id: 'local', name: '本地模型', icon: '\u{1F49A}', defaultEndpoint: 'http://localhost:11434/v1', defaultModels: ['Llama 3', 'Mistral', '自定义'] },
  { id: 'deepseek', name: 'DeepSeek', icon: '\u{1F7E4}', defaultEndpoint: 'https://api.deepseek.com/v1', defaultModels: ['DeepSeek V3', 'DeepSeek R1'] },
  { id: 'custom', name: '自定义端点', icon: '⚙️', defaultEndpoint: '', defaultModels: ['自定义'] },
];

export const DEFAULT_MODELS: AiModel[] = [
  { id: 'qwen3:8b', name: 'Qwen 3 8B', providerId: 'ollama', providerName: 'Ollama', description: '本地 · 快速 · 免费', costPer1KTokens: 0, icon: '\u{1F49A}', available: true },
  { id: 'gpt-4o', name: 'GPT-4o', providerId: 'openai', providerName: 'OpenAI', description: 'OpenAI · 最快 · 知识截止 2025-10', costPer1KTokens: 0.01, icon: '\u{1F7E2}', available: true },
  { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', providerId: 'anthropic', providerName: 'Anthropic', description: 'Anthropic · 长上下文 · 知识截止 2026-04', costPer1KTokens: 0.008, icon: '\u{1F7E0}', available: true },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', providerId: 'anthropic', providerName: 'Anthropic', description: 'Anthropic · 轻量快速 · 知识截止 2026-01', costPer1KTokens: 0.002, icon: '\u{1F7E0}', available: true },
  { id: 'gemini-pro', name: 'Gemini Pro', providerId: 'google', providerName: 'Google AI', description: 'Google · 多模态 · 性价比高', costPer1KTokens: 0.003, icon: '\u{1F535}', available: true },
  { id: 'gemini-flash', name: 'Gemini 2.0 Flash', providerId: 'google', providerName: 'Google AI', description: 'Google · 轻量快速 · 超低价格', costPer1KTokens: 0.0005, icon: '\u{1F535}', available: true },
  { id: 'deepseek-v3', name: 'DeepSeek V3', providerId: 'deepseek', providerName: 'DeepSeek', description: 'DeepSeek · 高性价比 · 中文优秀', costPer1KTokens: 0.001, icon: '\u{1F7E4}', available: true },
  { id: 'deepseek-r1', name: 'DeepSeek R1', providerId: 'deepseek', providerName: 'DeepSeek', description: 'DeepSeek · 推理增强 · 长上下文', costPer1KTokens: 0.002, icon: '\u{1F7E4}', available: true },
];

// ===== v2.0.2 AI Infrastructure Types =====

/**
 * Maps each AI role (chat, structured, generation, detection) to a modelId.
 */
export interface ProviderRoleModels {
  chat: string;
  structured: string;
  generation: string;
  detection: string;
}

/**
 * Capability status for a specific provider role.
 */
export interface CapabilityStatus {
  providerId: string;
  role: string;
  status: 'available' | 'unavailable' | 'degraded';
  latencyMs?: number;
}

/**
 * v2 AI provider configuration stored in the ai_provider_config table.
 * [v2.1.1-AI] List responses never expose the full apiKeyEncrypted.
 * Use resolveProviderCredential() to obtain the runtime API key.
 */
export interface AiProviderConfigV2 {
  id: string;
  providerId: string;
  providerName: string;
  /** [v2.1.1-AI] True if this provider has an API key configured (preview available via apiKeyPreview) */
  hasApiKey: boolean;
  /** [v2.1.1-AI] Preview of the API key (first 4 chars + "****"), undefined if no key */
  apiKeyPreview?: string;
  endpoint: string;
  models: string;
  timeoutMs: number;
  isActive: boolean;
  /** [v2.1.1-AI] True if this config was migrated from v1 BYOK api_keys table */
  migratedFromV1?: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Input for saving a v2 provider config.
 */
export interface SaveProviderConfigInput {
  providerId: string;
  providerName: string;
  /** API key to store. Leave empty to keep existing key (when editing). */
  apiKeyEncrypted: string;
  endpoint: string;
  models: string[];
  timeoutMs: number;
  /** [v2.1.1-AI] If true and apiKeyEncrypted is empty, explicitly clear the stored key */
  clearApiKey?: boolean;
}

/**
 * [v2.1.1-AI] Output from resolveProviderCredential.
 */
export interface ResolveProviderCredentialOutput {
  apiKey: string;
}

/**
 * Router configuration for AI intent routing.
 */
export interface RouterConfig {
  defaultModelId: string;
  fallbackProviderIds: string[];
}
