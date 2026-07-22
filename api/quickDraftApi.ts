/**
 * quickDraftApi — 织梦机 v2.0.1 QuickDraft API layer.
 *
 * Handles JSON string conversion for chapters field:
 * - Rust stores chapters as a JSON string
 * - Can convert to/from array in API layer as needed
 */
import { invoke } from '@tauri-apps/api/core';
import type {
  QuickDraft,
  QuickDraftGenerateInput,
  QuickDraftGenerateResult,
  QuickDraftTransferInput,
} from '../contracts/quick-draft.contract';

export async function generateQuickDraft(
  input: QuickDraftGenerateInput,
): Promise<QuickDraftGenerateResult> {
  return invoke('quickdraft_generate', { input });
}

export async function transferQuickDraft(
  input: QuickDraftTransferInput,
): Promise<QuickDraft> {
  return invoke('quickdraft_transfer', { input });
}

export async function listQuickDrafts(projectId: string): Promise<QuickDraft[]> {
  return invoke('quickdraft_list_by_project', { input: { projectId } });
}

export async function getQuickDraft(id: string): Promise<QuickDraft | null> {
  return invoke('quickdraft_get', { input: { id } });
}

export async function deleteQuickDraft(id: string): Promise<void> {
  return invoke('quickdraft_delete', { input: { id } });
}
