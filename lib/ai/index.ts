/**
 * ai/index.ts — Barrel export for AI infrastructure (织梦机 v2.0.2 / W02)
 *
 * Re-exports all public functions from context-builder and command-router
 * for clean imports.
 */

export { buildContext } from './context-builder';
export { route, executeLlmCall, acceptWrite, confirmWrite, RouterError } from './command-router';
export {
  parseStructuredOutput,
  parseChapterPacket,
  parseWritingContract,
  parseTianDiRen,
  getParseErrorMessage,
  isParseable,
} from './structured-parser';
