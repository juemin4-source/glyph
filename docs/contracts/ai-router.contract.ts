/**
 * ai-router.contract.ts — AI Intent Routing Types (织梦机 v2 / W01)
 *
 * Defines the route classification contract for the AI command router.
 * The router analyzes user messages and determines the appropriate AI action.
 *
 * [v2.1.1-AI] Added provider selection, tri-state enforcement, DecisionLog fields.
 */

import type { AiOutputType } from '../../lib/ai-output';

/**
 * Enum of all possible AI route intents.
 */
export type AiRoute =
  | 'discuss'
  | 'suggest'
  | 'write_preview'
  | 'generatePacket'
  | 'generateDraft'
  | 'assumption_flow'
  | 'unrecognized';

/**
 * Input for the intent routing pipeline.
 */
export interface RouteInput {
  message: string;
  canvasId: string;
  projectId: string;
  history?: string;
  /** [v2.1.1-AI] Optional preferred provider ID. Router resolves if not set. */
  providerId?: string;
  /** [v2.1.1-AI] Optional preferred model ID. Router resolves if not set. */
  modelId?: string;
  /** [v2.1.1-AI] Optional override for output type. Router uses intent detection if not set. */
  outputType?: AiOutputType;
}

/**
 * [v2.1.1-AI] Tri-state enforcement result from Router.
 */
export interface TriStateEnforcement {
  /** The enforced AI output mode. */
  mode: AiOutputType;
  /** Whether DB writes are blocked by this mode. */
  writeBlocked: boolean;
  /** Human-readable reason why writes are blocked (for error display). */
  blockReason?: string;
}

/**
 * [v2.1.1-AI] Log entry for a Router AI call.
 */
export interface RouterCallLog {
  intent: string;
  providerId: string;
  modelId: string;
  tokensIn: number;
  tokensOut: number;
  status: 'success' | 'error';
  errorMessage?: string;
  timestamp: number;
}

/**
 * Output from the intent routing pipeline.
 */
export interface RouteOutput {
  intent: string;
  confidence: number;
  parameters: Record<string, unknown>;
  fallbackReason?: string;
  /** [v2.1.1-AI] Resolved provider ID for this call. */
  providerId: string;
  /** [v2.1.1-AI] Resolved model ID for this call. */
  modelId: string;
  /** Resolved provider endpoint used for the actual request. */
  endpoint?: string;
  /** Provider-specific request timeout in milliseconds. */
  timeoutMs?: number;
  /** [v2.1.1-AI] Tri-state enforcement. */
  triState: TriStateEnforcement;
  /** [v2.1.1-AI] Whether DB writes are allowed (derived from triState). */
  dbWriteAllowed: boolean;
  /** [v2.1.1-AI] DecisionLog ID after call execution (set after executeLlmCall). */
  decisionLogId?: string;
}

/**
 * [v2.1.1-AI] Result of resolving provider and model.
 */
export interface ProviderModelResolution {
  providerId: string;
  modelId: string;
  providerName: string;
  endpoint: string;
}

/**
 * [v2.1.1-AI] Error response when no provider is configured.
 */
export interface RouterError {
  status: 'error';
  errorMessage: string;
}
