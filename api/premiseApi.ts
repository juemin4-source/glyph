/**
 * premiseApi — 织梦机 v2 PremiseCard API layer.
 *
 * Handles JSON string conversion for readerQuestions:
 * - Rust stores reader_questions as a JSON string (e.g. '["q1","q2"]')
 * - TS contracts use string[]; conversion happens here.
 */
import { invoke } from '@tauri-apps/api/core';
import type { PremiseCard, CreatePremiseInput, UpdatePremiseInput } from '../contracts/premise.contract';
import type {
  SaveWishlistInput, SaveWishlistOutput,
  SaveVariantSelectionInput, SaveVariantSelectionOutput,
  SaveGenreJudgmentInput, SaveGenreJudgmentOutput,
  PremiseStepStateResponse, GetPremiseStepStateInput,
  GenerateVariantsInput, GenerateVariantsOutput,
  GenerateReaderQAInput, GenerateReaderQAOutput,
} from '../contracts/premise.contract';

function parseCard(data: Record<string, unknown>): PremiseCard {
  return {
    ...data as unknown as PremiseCard,
    readerQuestions: typeof data.readerQuestions === 'string'
      ? JSON.parse(data.readerQuestions as string)
      : (data.readerQuestions as string[]),
  };
}

function stringifyCard(input: CreatePremiseInput | UpdatePremiseInput): Record<string, unknown> {
  return {
    ...input,
    readerQuestions: JSON.stringify(input.readerQuestions),
  };
}

export async function createPremiseCard(input: CreatePremiseInput): Promise<PremiseCard> {
  const data = await invoke<Record<string, unknown>>('create_premise_card', {
    input: stringifyCard(input),
  });
  return parseCard(data);
}

export async function listPremiseCards(projectId: string): Promise<PremiseCard[]> {
  const data = await invoke<Record<string, unknown>[]>('list_premise_cards', {
    input: { projectId },
  });
  return data.map(parseCard);
}

export async function getPremiseCard(id: string): Promise<PremiseCard | null> {
  const data = await invoke<Record<string, unknown> | null>('get_premise_card', {
    input: { id },
  });
  return data ? parseCard(data) : null;
}

export async function updatePremiseCard(input: UpdatePremiseInput): Promise<PremiseCard> {
  const data = await invoke<Record<string, unknown>>('update_premise_card', {
    input: stringifyCard(input),
  });
  return parseCard(data);
}

export async function deletePremiseCard(id: string): Promise<void> {
  await invoke('delete_premise_card', { input: { id } });
}

// ===== CN-MET-01: Premise Five-Step API Functions =====

export async function saveWishlist(input: SaveWishlistInput): Promise<SaveWishlistOutput> {
  // Serialize wishlist array to JSON string
  const payload = {
    ...input,
    wishlist: JSON.stringify(input.wishlist),
  };
  return invoke<SaveWishlistOutput>('save_wishlist', { input: payload });
}

export async function generateVariants(input: GenerateVariantsInput): Promise<GenerateVariantsOutput> {
  return invoke<GenerateVariantsOutput>('generate_variants', {
    input: {
      ...input,
      wishlist: JSON.stringify(input.wishlist),
    },
  });
}

export async function saveVariantSelection(input: SaveVariantSelectionInput): Promise<SaveVariantSelectionOutput> {
  return invoke<SaveVariantSelectionOutput>('save_variant_selection', { input });
}

export async function generateReaderQA(input: GenerateReaderQAInput): Promise<GenerateReaderQAOutput> {
  return invoke<GenerateReaderQAOutput>('generate_reader_qa', {
    input: {
      ...input,
      variants: JSON.stringify(input.variants),
    },
  });
}

export async function saveGenreJudgment(input: SaveGenreJudgmentInput): Promise<SaveGenreJudgmentOutput> {
  return invoke<SaveGenreJudgmentOutput>('save_genre_judgment', { input });
}

/**
 * getPremiseUpdatedAt — 查询前提画板最近更新时间 (CN-INT-01).
 * 返回 Unix ms 时间戳，0 表示不存在。
 */
export async function getPremiseUpdatedAt(projectId: string): Promise<number> {
  const result = await invoke<{ updatedAt: number }>('get_premise_updated_at', { input: { projectId } });
  return result.updatedAt;
}

export async function getPremiseStepState(input: GetPremiseStepStateInput): Promise<PremiseStepStateResponse> {
  const data = await invoke<Record<string, unknown>>('get_premise_step_state', { input });
  // Parse JSON string fields if state exists
  if (data.exists && data.state) {
    const state = data.state as Record<string, unknown>;
    return {
      exists: true,
      state: {
        ...state,
        wishlist: typeof state.wishlist === 'string' ? JSON.parse(state.wishlist as string) : state.wishlist,
        internExtern: typeof state.internExtern === 'string' ? JSON.parse(state.internExtern as string) : state.internExtern,
        variants: typeof state.variants === 'string' ? JSON.parse(state.variants as string) : state.variants,
        qa: typeof state.qa === 'string' ? JSON.parse(state.qa as string) : state.qa,
        genreJudgment: typeof state.genreJudgment === 'string' && state.genreJudgment !== 'null'
          ? JSON.parse(state.genreJudgment as string)
          : null,
        completedSteps: typeof state.completedSteps === 'string' ? JSON.parse(state.completedSteps as string) : state.completedSteps,
        skippedSteps: typeof state.skippedSteps === 'string' ? JSON.parse(state.skippedSteps as string) : state.skippedSteps,
        doNotAskAgain: typeof state.doNotAskAgain === 'string' ? JSON.parse(state.doNotAskAgain as string) : state.doNotAskAgain,
      },
    } as PremiseStepStateResponse;
  }
  return { exists: false, state: null };
}
