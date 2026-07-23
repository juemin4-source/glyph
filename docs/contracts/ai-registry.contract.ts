/**
 * ai-registry.contract.ts — AI Skill Registry Types (织梦机 v2 / W01)
 *
 * Defines the contract for registering and listing AI skills.
 * Each skill defines a prompt template with input/output schemas.
 */

/**
 * A registered AI skill record.
 */
export interface SkillRecord {
  id: string;
  skillId: string;
  name: string;
  promptTemplate: string;
  inputSchema: string;
  outputSchema: string;
  version: string;
}

/**
 * Output from listing all registered skills.
 */
export interface ListSkillsOutput {
  skills: SkillRecord[];
}

/**
 * Input for registering a new AI skill.
 */
export interface RegisterSkillInput {
  skillId: string;
  name: string;
  promptTemplate: string;
  inputSchema: string;
  outputSchema: string;
  version: string;
}

/**
 * Result of testing a provider connection.
 */
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
  models: string[];
}
