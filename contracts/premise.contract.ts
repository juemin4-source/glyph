export interface PremiseCard {
  id: string;
  projectId: string;
  premiseText: string;
  readerQuestions: string[];
  storyType: 'high_concept' | 'deep_drill' | 'character_driven' | 'world_driven' | '';
  status: 'draft' | 'confirmed';
  createdAt: number;
  updatedAt: number;
}

export interface CreatePremiseInput {
  projectId: string;
  premiseText: string;
  readerQuestions: string[];
  storyType: PremiseCard['storyType'];
  status: PremiseCard['status'];
}

export interface UpdatePremiseInput {
  id: string;
  premiseText: string;
  readerQuestions: string[];
  storyType: PremiseCard['storyType'];
  status: PremiseCard['status'];
}

export interface ConfirmPremiseInput {
  projectId: string;
}

// ── CN-MET-01: Premise Five-Step Method Types ──

export type PremiseStep = 'wishlist' | 'internExtern' | 'variants' | 'readerQA' | 'genreJudgment';

export interface WishlistItem {
  id: string;
  text: string;
  category?: string;
  priority?: number;
  enabled: boolean;
}

export interface PremiseVariant {
  id: string;
  title: string;
  summary: string;
  coreConflict: string;
  selected?: boolean;
}

export interface ReaderQuestion {
  id: string;
  question: string;
  answer?: string;
  category?: string;
}

export interface GenreJudgment {
  primaryGenre: string;
  subGenres: string[];
  confidence: 'low' | 'medium' | 'high';
  reasoning?: string;
}

export interface PremiseFiveStepState {
  currentStep: PremiseStep;
  wishlist: WishlistItem[];
  internExtern: {
    internalDrive: string;
    externalDrive: string;
  };
  variants: PremiseVariant[];
  qa: ReaderQuestion[];
  genreJudgment: GenreJudgment | null;
  completedSteps: PremiseStep[];
  skippedSteps: PremiseStep[];
  doNotAskAgain: PremiseStep[];
}

// ── Step Input/Output Types for API ──

export interface SaveWishlistInput {
  projectId: string;
  wishlist: WishlistItem[];
}

export interface SaveWishlistOutput {
  projectId: string;
  step: PremiseStep;
  saved: boolean;
}

export interface GenerateVariantsInput {
  projectId: string;
  wishlist: WishlistItem[];
  internalDrive: string;
  externalDrive: string;
}

export interface GenerateVariantsOutput {
  variants: PremiseVariant[];
}

export interface SaveVariantSelectionInput {
  projectId: string;
  variantId: string;
}

export interface SaveVariantSelectionOutput {
  step: PremiseStep;
  selectedVariantId: string;
}

export interface GenerateReaderQAInput {
  projectId: string;
  variants: PremiseVariant[];
  selectedVariantId: string;
}

export interface GenerateReaderQAOutput {
  questions: ReaderQuestion[];
}

export interface SaveGenreJudgmentInput {
  projectId: string;
  genreJudgment: GenreJudgment;
}

export interface SaveGenreJudgmentOutput {
  step: PremiseStep;
  genreJudgment: GenreJudgment;
}

export interface GetPremiseStepStateInput {
  projectId: string;
}

export interface PremiseStepStateResponse {
  exists: boolean;
  state: PremiseFiveStepState | null;
}

// ── CN-INT-02: Premise→WritingContract mapping ──

import type { WritingContract } from './chapter-packet.contract';

export interface PremiseToContractMapping {
  narrativeDistance: WritingContract['narrativeDistance'];
  expositionStrategy: WritingContract['expositionStrategy'];
  characterVoice: WritingContract['characterVoice'];
  taboos: string[];
}

export type PremiseContractInput = {
  projectId: string;
  packetId: string;
};
