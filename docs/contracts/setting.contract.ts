export interface WorldRule {
  id: string;
  projectId: string;
  title: string;
  ruleText: string;
  cost: string;
  enforcer: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateWorldRuleInput {
  projectId: string;
  title: string;
  ruleText: string;
  cost: string;
  enforcer: string;
}

export interface UpdateWorldRuleInput {
  id: string;
  title: string;
  ruleText: string;
  cost: string;
  enforcer: string;
}

export interface CharacterCard {
  id: string;
  projectId: string;
  name: string;
  hook: string;
  currentWant: string;
  realBlock: string;
  archetype: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateCharacterCardInput {
  projectId: string;
  name: string;
  hook: string;
  currentWant: string;
  realBlock: string;
  archetype: string;
  description: string;
}

export interface UpdateCharacterCardInput {
  id: string;
  name: string;
  hook: string;
  currentWant: string;
  realBlock: string;
  archetype: string;
  description: string;
}

export interface FactionCard {
  id: string;
  projectId: string;
  name: string;
  trueGoal: string;
  publicSlogan: string;
  resources: string[];
  representativeCharacterIds: string[];
  dailyInterface: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateFactionCardInput {
  projectId: string;
  name: string;
  trueGoal: string;
  publicSlogan: string;
  resources: string[];
  representativeCharacterIds: string[];
  dailyInterface: string;
}

export interface UpdateFactionCardInput {
  id: string;
  name: string;
  trueGoal: string;
  publicSlogan: string;
  resources: string[];
  representativeCharacterIds: string[];
  dailyInterface: string;
}

// ── CN-MET-03: Canvas 3 Sparrow Mode 9+3 Types ──

export type SparrowStepId =
  | 'step_1' | 'step_2' | 'step_3' | 'step_4' | 'step_5'
  | 'step_6' | 'step_7' | 'step_8' | 'step_9';

export interface SparrowStepState {
  stepId: SparrowStepId;
  label: string;
  content: string;
  isExpanded: boolean;
  isRequired: boolean;
  isComplete: boolean;
  aiGenerated?: boolean;
  doNotAskAgain?: boolean;
}

export type ProtagonistStepType = 'capability' | 'agency' | 'vulnerability';

export interface CharacterStep3 {
  stepType: ProtagonistStepType;
  characterId: string;
  description: string;
  isUsable: boolean;
}

export interface TianDiRenLayer {
  tian: string;
  di: string;
  ren: string;
  isExpanded: boolean;
}

export interface SparrowModule {
  steps: SparrowStepState[];
  protagonistSteps: CharacterStep3[];
  tianDiRen?: TianDiRenLayer;
}

// ── CN-MET-03: Sparrow Step Input/Output Types ──

export interface SaveSparrowStepInput {
  projectId: string;
  stepId: SparrowStepId;
  content: string;
  isComplete: boolean;
  doNotAskAgain?: boolean;
}

export interface SaveSparrowStepOutput {
  projectId: string;
  stepId: SparrowStepId;
  saved: boolean;
}

export interface SaveProtagonistStepInput {
  projectId: string;
  stepType: ProtagonistStepType;
  characterId: string;
  description: string;
  isUsable: boolean;
}

export interface SaveProtagonistStepOutput {
  projectId: string;
  stepType: ProtagonistStepType;
  saved: boolean;
}

export interface MarkStepUsableInput {
  projectId: string;
  stepType: ProtagonistStepType;
  characterId: string;
  isUsable: boolean;
}

export interface MarkStepUsableOutput {
  projectId: string;
  stepType: ProtagonistStepType;
  isUsable: boolean;
}

export interface GenerateSparrowAiInput {
  projectId: string;
  stepId: SparrowStepId;
}

export interface GenerateSparrowAiOutput {
  projectId: string;
  stepId: SparrowStepId;
  suggestedContent: string;
}

export interface SaveTianDiRenLayerInput {
  projectId: string;
  tian: string;
  di: string;
  ren: string;
}

export interface SaveTianDiRenLayerOutput {
  projectId: string;
  saved: boolean;
}

export interface GetSparrowModuleInput {
  projectId: string;
}

export interface SparrowModuleResponse {
  exists: boolean;
  steps: SparrowStepState[];
  protagonistSteps: CharacterStep3[];
  tianDiRen: TianDiRenLayer | null;
}

export interface GenerateTianDiRenAiInput {
  projectId: string;
  field: 'tian' | 'di' | 'ren';
}

export interface GenerateTianDiRenAiOutput {
  projectId: string;
  field: string;
  suggestedContent: string;
}
