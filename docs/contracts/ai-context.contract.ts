/**
 * ai-context.contract.ts — AI Context Building Types (织梦机 v2 / W01)
 *
 * Defines the input/output contract for the AI context-building pipeline.
 * Context builder aggregates system prompts and canvas data for AI interactions.
 */

/**
 * Input for building AI context from a canvas + output type.
 */
export interface ContextBuildInput {
  canvasId: string;
  projectId: string;
  outputType: string;
  additionalPrompt?: string;
}

/**
 * The built AI context ready to be sent to an AI provider.
 */
export interface AiBuiltContext {
  systemPrompt: string;
  contextData: string;
  writableTargets: string[];
  forbiddenTargets: string[];
  outputFormat: string;
  skillId?: string;
}
