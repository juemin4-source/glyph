/**
 * premise-to-contract.ts — 前提类型映射到写作契约 (CN-INT-02)
 *
 * 将前提五步法输出 (internExtern, storyType, genreJudgment) 映射为
 * ChapterPacket Layer 1 写作契约约束。
 *
 * 设计约束：
 * - 纯函数，无副作用
 * - 所有映射规则集中在此文件，便于审查和调整
 */

import type { PremiseFiveStepState, PremiseCard } from '../../../contracts/premise.contract';
import type { WritingContract } from '../../../contracts/chapter-packet.contract';

// ═══════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════

/**
 * 从前提数据生成写作契约初始值。
 *
 * @param premiseCard - 已确认的前提卡 (含 storyType)
 * @param fiveStep - 前提五步法状态 (含 internExtern, genreJudgment)
 * @returns 可写入 layer1 的 Partial<WritingContract>
 */
export function premiseToWritingContract(
  premiseCard: PremiseCard,
  fiveStep: PremiseFiveStepState,
): Partial<WritingContract> {
  const { internExtern } = fiveStep;
  const { storyType } = premiseCard;

  const narrativeDistance = deriveNarrativeDistance(internExtern);
  const expositionStrategy = deriveExpositionStrategy(storyType);
  const characterVoice = deriveCharacterVoice(storyType);
  const taboos = deriveTaboos(fiveStep);

  return {
    narrativeDistance,
    expositionStrategy,
    characterVoice,
    taboos,
    // voiceSamples left empty — user fills manually
  };
}

/**
 * 检查前提是否已足够生成写作契约。
 */
export function isPremiseReadyForContract(
  premiseCard: PremiseCard | null | undefined,
  fiveStep: PremiseFiveStepState | null | undefined,
): boolean {
  if (!premiseCard || !fiveStep) return false;
  if (premiseCard.status !== 'confirmed') return false;
  if (!fiveStep.internExtern.internalDrive && !fiveStep.internExtern.externalDrive) return false;
  return true;
}

// ═══════════════════════════════════════════════
//  Mapping Rules
// ═══════════════════════════════════════════════

/**
 * narrativeDistance: 内驱/外驱决定距离
 *
 * 强内驱 → close (深心理)
 * 强外驱 → distant (广行动)
 * 均衡   → medium
 */
function deriveNarrativeDistance(
  internExtern: { internalDrive: string; externalDrive: string },
): WritingContract['narrativeDistance'] {
  const internalLen = internExtern.internalDrive.length;
  const externalLen = internExtern.externalDrive.length;
  const ratio = internalLen / (externalLen || 1);

  if (ratio > 2) return 'close';       // 强内驱 → 贴近人物心理
  if (ratio < 0.5) return 'distant';   // 强外驱 → 广阔叙事视角
  return 'medium';                      // 均衡
}

/**
 * expositionStrategy: 故事类型决定
 *
 * high_concept     → balanced
 * deep_drill       → explain_all
 * character_driven → show_dont_tell
 * world_driven     → balanced
 */
function deriveExpositionStrategy(
  storyType: PremiseCard['storyType'],
): WritingContract['expositionStrategy'] {
  switch (storyType) {
    case 'deep_drill': return 'explain_all';
    case 'character_driven': return 'show_dont_tell';
    case 'high_concept': return 'balanced';
    case 'world_driven': return 'balanced';
    default: return 'balanced';
  }
}

/**
 * characterVoice: 故事类型决定
 *
 * character_driven → distinct
 * deep_drill       → distinct
 * high_concept     → moderate
 * world_driven     → uniform
 */
function deriveCharacterVoice(
  storyType: PremiseCard['storyType'],
): WritingContract['characterVoice'] {
  switch (storyType) {
    case 'character_driven': return 'distinct';
    case 'deep_drill': return 'distinct';
    case 'high_concept': return 'moderate';
    case 'world_driven': return 'uniform';
    default: return 'moderate';
  }
}

/**
 * taboos: 从类型判断 + 变体核心冲突推断
 */
function deriveTaboos(fiveStep: PremiseFiveStepState): string[] {
  const taboos: string[] = [];

  // 从类型判断提取禁忌线索
  if (fiveStep.genreJudgment) {
    const { primaryGenre, reasoning } = fiveStep.genreJudgment;
    if (primaryGenre === '悬疑') taboos.push('过早揭示真凶');
    if (primaryGenre === '言情') taboos.push('主角性格突转');
    if (primaryGenre === '科幻') taboos.push('技术设定前后矛盾');
    if (reasoning) taboos.push(reasoning); // Use reasoning as a taboo hint
  }

  // 从选定变体提取禁忌
  const selectedVariant = fiveStep.variants.find(v => v.selected);
  if (selectedVariant?.coreConflict) {
    taboos.push(`避免弱化核心冲突：「${selectedVariant.coreConflict}」`);
  }

  return taboos;
}
