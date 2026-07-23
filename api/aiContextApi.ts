/**
 * aiContextApi — 织梦机 v2.0.2 AI Context & Router API layer.
 *
 * 2026-07-13: 不再调 Rust 命令，改走 TS 管线。
 * fetchAiContext → lib/ai/context-builder.ts
 * routeAiMessage → lib/ai/command-router.ts
 */

import type { ContextBuildInput, AiBuiltContext } from '../docs/contracts/ai-context.contract';
import type { RouteInput, RouteOutput } from '../docs/contracts/ai-router.contract';

/**
 * Build AI context for a given canvas and output type.
 * 直接调 TS context-builder，不走 Rust。
 */
export async function fetchAiContext(input: ContextBuildInput): Promise<AiBuiltContext> {
  const { buildContext } = await import('../lib/ai/context-builder');
  return buildContext(input);
}

/**
 * Route a user AI message to the appropriate intent path.
 * 直接调 TS command-router，不走 Rust。
 */
export async function routeAiMessage(input: RouteInput): Promise<RouteOutput> {
  const { route } = await import('../lib/ai/command-router');
  return route(input);
}
