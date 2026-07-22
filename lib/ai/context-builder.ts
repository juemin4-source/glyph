/**
 * context-builder.ts — AI Context Builder v2 (织梦机 v2.0.2 / W02)
 *
 * Single entry point that constructs a unified AI context from current canvas
 * data and upstream canvas data based on the canvas hierarchy:
 *   premise → structure → setting → packet → text
 *
 * Each step includes its own data plus all upstream data.
 * Missing upstream data is handled gracefully: available data only, no throw.
 */

import type { ContextBuildInput, AiBuiltContext } from '../../contracts/ai-context.contract';
import type { PremiseCard } from '../../contracts/premise.contract';
import type { StructureNode } from '../../contracts/structure.contract';
import type { WorldRule, CharacterCard } from '../../contracts/setting.contract';
import type { ChapterPacket } from '../../contracts/chapter-packet.contract';

const MAX_CONTEXT_CHARS = 48_000;

// Public API

export async function buildContext(input: ContextBuildInput): Promise<AiBuiltContext> {
  const canvasType = resolveCanvasType(input.canvasId);
  const contextData = await loadUpstreamData(canvasType, input.projectId);
  const systemPrompt = composeSystemPrompt(canvasType, input.outputType, input.additionalPrompt);
  const { writable, forbidden } = resolveTargets(input.outputType, canvasType);

  return {
    systemPrompt,
    contextData: serializeContext(contextData),
    writableTargets: writable,
    forbiddenTargets: forbidden,
    outputFormat: input.outputType,
  };
}

function serializeContext(contextData: Record<string, unknown>): string {
  const serialized = JSON.stringify(contextData, null, 2);
  if (serialized.length <= MAX_CONTEXT_CHARS) return serialized;
  return serialized.slice(0, MAX_CONTEXT_CHARS)
    + `\n\n[Context truncated at ${MAX_CONTEXT_CHARS} characters. Narrow the active chapter or related entities for more detail.]`;
}

// ---------------------------------------------------------------------------
// Canvas type resolution
// ---------------------------------------------------------------------------

function resolveCanvasType(canvasId: string): string {
  const lower = canvasId.toLowerCase();
  if (lower.includes('premise')) return 'premise';
  if (lower.includes('structure') || lower.includes('plot')) return 'structure';
  if (lower.includes('setting') || lower.includes('world') || lower.includes('rule')) return 'setting';
  if (lower.includes('packet') || lower.includes('chapter')) return 'packet';
  if (lower.includes('draft') || lower.includes('text') || lower.includes('edit')) return 'text';
  return 'premise'; // safest default — no upstream dependencies
}

// ---------------------------------------------------------------------------
// Upstream data loading
// ---------------------------------------------------------------------------

async function loadUpstreamData(canvasType: string, projectId: string): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {
    canvasType,
  };

  // Premise always available (base level)
  data.premise = await loadPremiseData(projectId);

  switch (canvasType) {
    case 'premise':
      break;

    case 'structure':
      data.structureNodes = await loadStructureData(projectId);
      break;

    case 'setting':
      data.structureNodes = await loadStructureData(projectId);
      data.worldRules = await loadWorldRules(projectId);
      data.characterCards = await loadCharacterCards(projectId);
      break;

    case 'packet':
      data.structureNodes = await loadStructureData(projectId);
      data.worldRules = await loadWorldRules(projectId);
      data.characterCards = await loadCharacterCards(projectId);
      data.chapterPackets = await loadChapterPackets(projectId);
      break;

    case 'text':
      data.worldRules = await loadWorldRules(projectId);
      data.characterCards = await loadCharacterCards(projectId);
      data.chapterPackets = await loadChapterPackets(projectId);
      break;

    default:
      break;
  }

  return data;
}

// Each loader imports from the API layer.
// On failure (e.g., tables don't exist yet), return empty array.

async function loadPremiseData(projectId: string): Promise<PremiseCard[]> {
  try {
    const { listPremiseCards } = await import('../../api/premiseApi');
    return await listPremiseCards(projectId);
  } catch {
    return [];
  }
}

async function loadStructureData(projectId: string): Promise<StructureNode[]> {
  try {
    const { listStructureNodes } = await import('../../api/structureApi');
    return await listStructureNodes(projectId);
  } catch {
    return [];
  }
}

async function loadWorldRules(projectId: string): Promise<WorldRule[]> {
  try {
    const { listWorldRules } = await import('../../api/settingApi');
    return await listWorldRules(projectId);
  } catch {
    return [];
  }
}

async function loadCharacterCards(projectId: string): Promise<CharacterCard[]> {
  try {
    const { listCharacterCards } = await import('../../api/settingApi');
    return await listCharacterCards(projectId);
  } catch {
    return [];
  }
}

async function loadChapterPackets(projectId: string): Promise<ChapterPacket[]> {
  try {
    const { listChapterPackets } = await import('../../api/chapterPacketApi');
    return await listChapterPackets(projectId);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// System prompt composition
// ---------------------------------------------------------------------------

function composeSystemPrompt(canvasType: string, outputType: string, additional?: string): string {
  const base = canvasPrompt(canvasType);
  const mode = modePrompt(outputType);
  let prompt = `${base}\n\n${mode}`;

  if (additional) {
    prompt += `\n\nAdditional instructions:\n${additional}`;
  }

  return prompt;
}

function canvasPrompt(canvasType: string): string {
  switch (canvasType) {
    case 'premise':
      return 'You are a creative writing assistant analyzing a story premise. '
        + 'Help the user develop their story concept, explore themes, and identify narrative opportunities.';
    case 'structure':
      return 'You are a narrative structure analyst. '
        + 'Help the user develop plot structure, pacing, and narrative architecture based on their premise.';
    case 'setting':
      return 'You are a world-building consultant. '
        + 'Help the user create consistent and compelling fictional worlds, including rules, characters, and factions.';
    case 'packet':
      return 'You are a chapter packet generator. '
        + 'Help the user develop chapter-by-chapter content including plot lines, character arcs, and scene breakdowns.';
    case 'text':
      return 'You are a writing assistant for prose. '
        + 'Help the user write and refine their story text, maintaining voice, tone, and narrative consistency.';
    default:
      return 'You are a creative writing assistant. Help the user develop their story.';
  }
}

function modePrompt(outputType: string): string {
  switch (outputType) {
    case 'discuss':
      return 'Mode: Discussion. Respond conversationally. Do not modify any data.';
    case 'suggest':
      return 'Mode: Suggestion. Provide options and alternatives for the user to consider.';
    case 'write_preview':
      return 'Mode: Write Preview. Generate content that can be written into the current canvas.';
    case 'generatePacket':
      return 'Mode: Generate Packet. Create chapter packet content with structural data.';
    case 'generateDraft':
      return 'Mode: Generate Draft. Write prose text for the specified chapter.';
    case 'assumption_flow':
      return 'Mode: Temporary Hypothesis. Work with assumed data that won\'t affect formal records.';
    default:
      return 'Mode: Discussion. Respond conversationally.';
  }
}

// ---------------------------------------------------------------------------
// Target resolution
// ---------------------------------------------------------------------------

function resolveTargets(
  outputType: string,
  canvasType: string,
): { writable: string[]; forbidden: string[] } {
  switch (outputType) {
    case 'discuss':
    case 'suggest':
      return { writable: [], forbidden: ['*'] };

    case 'write_preview':
      return {
        writable: [canvasType === 'premise' ? 'premise_cards' : `${canvasType}_tables`],
        forbidden: ['*'],
      };

    case 'generatePacket':
      return {
        writable: ['chapter_packets'],
        forbidden: ['premise_cards', 'structure_nodes', 'world_rules', 'character_cards'],
      };

    case 'generateDraft':
      return {
        writable: ['quick_drafts', 'text_canvas'],
        forbidden: ['premise_cards', 'structure_nodes', 'world_rules', 'character_cards', 'chapter_packets'],
      };

    case 'assumption_flow':
      return {
        writable: ['assumption_data'],
        forbidden: ['premise_cards', 'structure_nodes', 'world_rules', 'character_cards', 'chapter_packets', 'quick_drafts', 'text_canvas'],
      };

    default:
      return { writable: [], forbidden: ['*'] };
  }
}
