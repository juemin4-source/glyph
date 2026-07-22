/**
 * decisionLogApi — 织梦机 v2 Decision Log API layer.
 *
 * 封装所有 decision_log Tauri command 调用。
 * 提供 append、list、get 三个操作。
 */
import { invoke } from '@tauri-apps/api/core';
import type {
  DecisionLogEntry,
  AppendDecisionLogInput,
  ListDecisionLogsInput,
  GetDecisionLogInput,
} from '../contracts/decision-log.contract';

export async function appendDecisionLog(input: AppendDecisionLogInput): Promise<DecisionLogEntry> {
  return invoke('append_decision_log', { input });
}

export async function listDecisionLogs(projectId: string): Promise<DecisionLogEntry[]> {
  return invoke('list_decision_logs', { input: { projectId } });
}

export async function getDecisionLog(id: string): Promise<DecisionLogEntry | null> {
  return invoke('get_decision_log', { input: { id } });
}
