/**
 * feedbackApi — 织梦机 v2.0.1 Feedback API layer.
 *
 * Feedback entries are stored as DecisionLog entries with operation='feedback'.
 * ListFeedback filters decision_logs by operation='feedback'.
 */
import { invoke } from '@tauri-apps/api/core';
import type { DecisionLogEntry } from '../contracts/decision-log.contract';

export interface SubmitFeedbackInput {
  projectId: string;
  rating: number;  // 1-5
  feedbackText: string;  // optional, can be ""
}

export interface ListFeedbackInput {
  projectId: string;
}

export async function submitFeedback(
  input: SubmitFeedbackInput,
): Promise<DecisionLogEntry> {
  return invoke('submit_feedback', { input });
}

export async function listFeedback(
  projectId: string,
): Promise<DecisionLogEntry[]> {
  return invoke('list_feedback', { input: { projectId } });
}
