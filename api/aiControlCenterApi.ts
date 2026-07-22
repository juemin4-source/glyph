/**
 * aiControlCenterApi.ts — AI Control Center v2 API layer
 *
 * Provides functions for provider config CRUD, connection testing,
 * and skill registry operations.
 */

import { invoke } from '@tauri-apps/api/core';
import type { SkillRecord } from '../contracts/ai-registry.contract';
import type { ConnectionTestResult } from '../contracts/ai-registry.contract';
import type { AiProviderConfigV2, SaveProviderConfigInput, ResolveProviderCredentialOutput } from '../types/ai';

// ===== Provider Configuration =====

export async function listProviderConfigs(): Promise<AiProviderConfigV2[]> {
  return invoke<AiProviderConfigV2[]>('list_providers_v2');
}

export async function saveProviderConfig(input: SaveProviderConfigInput): Promise<AiProviderConfigV2> {
  return invoke<AiProviderConfigV2>('save_provider_config', { input });
}

export async function deleteProviderConfig(id: string): Promise<void> {
  await invoke('delete_provider_config', { input: { id } });
}

/**
 * [v2.1.1-AI] Resolve a provider's API key for runtime use.
 * This is the ONLY way components/Router should obtain a provider credential.
 * Throws AI_PROVIDER_API_KEY_MISSING if the provider has no key configured.
 */
export async function resolveProviderCredential(providerId: string): Promise<string> {
  const result = await invoke<ResolveProviderCredentialOutput>('resolve_provider_credential', {
    input: { providerId },
  });
  return result.apiKey;
}

export async function testProviderConnection(
  providerId: string,
  endpoint: string,
  apiKey: string,
  model: string,
): Promise<ConnectionTestResult> {
  return invoke<ConnectionTestResult>('test_provider_connection', {
    input: { providerId, endpoint, apiKey, model },
  });
}

// ===== Skill Registry =====

export async function listSkills(): Promise<SkillRecord[]> {
  const result = await invoke<{ skills: SkillRecord[] }>('list_skills', {
    input: { projectId: 'default' },
  });
  return result.skills;
}

export async function getSkill(skillId: string): Promise<SkillRecord | null> {
  return invoke<SkillRecord | null>('get_skill', { input: { id: skillId } });
}
