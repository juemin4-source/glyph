/**
 * settingApi — 织梦机 v2 WorldRule / CharacterCard / FactionCard API layer.
 *
 * Handles JSON string conversion for FactionCard fields:
 * - Rust stores resources & representative_character_ids as JSON strings
 * - TS contracts use string[]; conversion happens here.
 */
import { invoke } from '@tauri-apps/api/core';
import type {
  WorldRule, CreateWorldRuleInput, UpdateWorldRuleInput,
  CharacterCard, CreateCharacterCardInput, UpdateCharacterCardInput,
  FactionCard, CreateFactionCardInput, UpdateFactionCardInput,
} from '../contracts/setting.contract';

// ---- WorldRule ----

export async function createWorldRule(input: CreateWorldRuleInput): Promise<WorldRule> {
  return invoke('create_world_rule', { input });
}

export async function listWorldRules(projectId: string): Promise<WorldRule[]> {
  return invoke('list_world_rules', { input: { projectId } });
}

export async function getWorldRule(id: string): Promise<WorldRule | null> {
  return invoke('get_world_rule', { input: { id } });
}

export async function updateWorldRule(input: UpdateWorldRuleInput): Promise<WorldRule> {
  return invoke('update_world_rule', { input });
}

export async function deleteWorldRule(id: string): Promise<void> {
  return invoke('delete_world_rule', { input: { id } });
}

// ---- CharacterCard ----

export async function createCharacterCard(input: CreateCharacterCardInput): Promise<CharacterCard> {
  return invoke('create_character_card', { input });
}

export async function listCharacterCards(projectId: string): Promise<CharacterCard[]> {
  return invoke('list_character_cards', { input: { projectId } });
}

export async function getCharacterCard(id: string): Promise<CharacterCard | null> {
  return invoke('get_character_card', { input: { id } });
}

export async function updateCharacterCard(input: UpdateCharacterCardInput): Promise<CharacterCard> {
  return invoke('update_character_card', { input });
}

export async function deleteCharacterCard(id: string): Promise<void> {
  return invoke('delete_character_card', { input: { id } });
}

// ---- FactionCard (with JSON string conversion) ----

function parseFactionCard(data: Record<string, unknown>): FactionCard {
  return {
    ...data as unknown as FactionCard,
    resources: typeof data.resources === 'string'
      ? JSON.parse(data.resources as string)
      : (data.resources as string[]),
    representativeCharacterIds: typeof data.representativeCharacterIds === 'string'
      ? JSON.parse(data.representativeCharacterIds as string)
      : (data.representativeCharacterIds as string[]),
  };
}

function stringifyFactionInput(input: CreateFactionCardInput | UpdateFactionCardInput): Record<string, unknown> {
  return {
    ...input,
    resources: JSON.stringify(input.resources),
    representativeCharacterIds: JSON.stringify(input.representativeCharacterIds),
  };
}

export async function createFactionCard(input: CreateFactionCardInput): Promise<FactionCard> {
  const data = await invoke<Record<string, unknown>>('create_faction_card', {
    input: stringifyFactionInput(input),
  });
  return parseFactionCard(data);
}

export async function listFactionCards(projectId: string): Promise<FactionCard[]> {
  const data = await invoke<Record<string, unknown>[]>('list_faction_cards', {
    input: { projectId },
  });
  return data.map(parseFactionCard);
}

export async function getFactionCard(id: string): Promise<FactionCard | null> {
  const data = await invoke<Record<string, unknown> | null>('get_faction_card', {
    input: { id },
  });
  return data ? parseFactionCard(data) : null;
}

export async function updateFactionCard(input: UpdateFactionCardInput): Promise<FactionCard> {
  const data = await invoke<Record<string, unknown>>('update_faction_card', {
    input: stringifyFactionInput(input),
  });
  return parseFactionCard(data);
}

export async function deleteFactionCard(id: string): Promise<void> {
  return invoke('delete_faction_card', { input: { id } });
}

// ── CN-MET-03: Canvas 3 Sparrow Mode 9+3 API ──

import type {
  SaveSparrowStepInput, SaveSparrowStepOutput,
  SaveProtagonistStepInput, SaveProtagonistStepOutput,
  MarkStepUsableInput, MarkStepUsableOutput,
  GenerateSparrowAiInput, GenerateSparrowAiOutput,
  GenerateTianDiRenAiInput, GenerateTianDiRenAiOutput,
  SaveTianDiRenLayerInput, SaveTianDiRenLayerOutput,
  GetSparrowModuleInput, SparrowModuleResponse,
  SparrowStepState, CharacterStep3, TianDiRenLayer, SparrowStepId,
} from '../contracts/setting.contract';

function parseSparrowStepRecord(data: Record<string, unknown>): SparrowStepState {
  return {
    stepId: data.stepId as SparrowStepId,
    label: data.stepId as string, // label will be derived in UI from stepId
    content: (data.content as string) || '',
    isExpanded: true,
    isRequired: data.stepId === 'step_3',
    isComplete: !!data.isComplete,
    aiGenerated: false,
    doNotAskAgain: !!data.doNotAskAgain,
  };
}

function parseProtagonistStepRecord(data: Record<string, unknown>): CharacterStep3 {
  return {
    stepType: data.stepType as CharacterStep3['stepType'],
    characterId: (data.characterId as string) || '',
    description: (data.description as string) || '',
    isUsable: !!data.isUsable,
  };
}

export async function saveSparrowStep(input: SaveSparrowStepInput): Promise<SaveSparrowStepOutput> {
  return invoke<SaveSparrowStepOutput>('save_sparrow_step', { input });
}

export async function saveProtagonistStep(input: SaveProtagonistStepInput): Promise<SaveProtagonistStepOutput> {
  return invoke<SaveProtagonistStepOutput>('save_protagonist_step', { input });
}

export async function markStepUsable(input: MarkStepUsableInput): Promise<MarkStepUsableOutput> {
  return invoke<MarkStepUsableOutput>('mark_step_usable', { input });
}

export async function generateSparrowAi(input: GenerateSparrowAiInput): Promise<GenerateSparrowAiOutput> {
  return invoke<GenerateSparrowAiOutput>('generate_sparrow_ai', { input });
}

export async function saveTianDiRenLayer(input: SaveTianDiRenLayerInput): Promise<SaveTianDiRenLayerOutput> {
  return invoke<SaveTianDiRenLayerOutput>('save_tiandiren_layer', { input });
}

export async function generateTianDiRenAi(input: GenerateTianDiRenAiInput): Promise<GenerateTianDiRenAiOutput> {
  // [v2.1.1-AI] Use Router instead of Rust placeholder stub
  try {
    const { route, executeLlmCall } = await import('../lib/ai/command-router');
    const fieldName = input.field === 'tian' ? '天（宏观力量）' :
      input.field === 'di' ? '地（环境社会）' : '人（角色视角）';

    const prompt = `你是一个世界观构建助手。请为项目生成「${fieldName}」视角的设定内容。` +
      `\n\n请以 JSON 格式返回，包含以下字段：\n` +
      `- content: 详细设定内容（800-1500字）\n` +
      `- keyPoints: 关键点数组\n` +
      `- suggestions: 建议注意事项`;

    const routeOutput = await route({
      message: prompt.slice(0, 100),
      canvasId: 'setting',
      projectId: input.projectId,
      outputType: 'suggest',
    });
    const llmResult = await executeLlmCall(routeOutput, [
      { role: 'user', content: prompt },
    ]);

    // Try to parse structured output
    try {
      const parsed = JSON.parse(llmResult.content);
      return {
        projectId: input.projectId,
        field: input.field,
        suggestedContent: parsed.content || llmResult.content,
      };
    } catch {
      return {
        projectId: input.projectId,
        field: input.field,
        suggestedContent: llmResult.content,
      };
    }
  } catch (err: any) {
    // Fallback: try the Rust command (may still return placeholder in dev)
    try {
      return await invoke<GenerateTianDiRenAiOutput>('generate_tiandiren_ai', { input });
    } catch {
      throw err; // Re-throw the original error
    }
  }
}

/**
 * getSparrowLastSavedAt — 查询设定画板最近保存时间 (CN-INT-01).
 * 返回 Unix ms 时间戳，0 表示未保存过。
 */
export async function getSparrowLastSavedAt(projectId: string): Promise<number> {
  const result = await invoke<{ updatedAt: number }>('get_sparrow_last_saved_at', { input: { projectId } });
  return result.updatedAt;
}

export async function getSparrowModule(input: GetSparrowModuleInput): Promise<SparrowModuleResponse> {
  const data = await invoke<Record<string, unknown>>('get_sparrow_module', { input });
  const steps = ((data.steps as Record<string, unknown>[]) || []).map(parseSparrowStepRecord);
  const protagonistSteps = ((data.protagonistSteps as Record<string, unknown>[]) || []).map(parseProtagonistStepRecord);
  const tianDiRen = data.tianDiRen
    ? {
        tian: (data.tianDiRen as Record<string, unknown>).tian as string || '',
        di: (data.tianDiRen as Record<string, unknown>).di as string || '',
        ren: (data.tianDiRen as Record<string, unknown>).ren as string || '',
        isExpanded: false,
      }
    : null;

  return {
    exists: !!data.exists,
    steps,
    protagonistSteps,
    tianDiRen,
  };
}
