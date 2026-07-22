/**
 * PremiseStepVariants — 画板① 第三步：前提变体
 *
 * AI generates 3 premise variant cards based on wishlist + intern/extern.
 * Each variant: title, one-line summary, core conflict.
 * User selects one. Can regenerate.
 */

import React from 'react';
import { Button } from '../../components/ui';
import AiFillCard from '../common/method-step/AiFillCard';
import type { PremiseVariant } from '../../contracts/premise.contract';

interface PremiseStepVariantsProps {
  variants: PremiseVariant[];
  selectedVariantId: string | null;
  onSelectVariant: (id: string) => void;
  onConfirm: () => void;
  onReTrigger: () => void;
  confirmed: boolean;
  loading: boolean;
  doNotAskAgain: boolean;
  onDoNotAskAgainChange: (v: boolean) => void;
}

export default function PremiseStepVariants({
  variants,
  selectedVariantId,
  onSelectVariant,
  onConfirm,
  onReTrigger,
  confirmed,
  loading,
  doNotAskAgain,
  onDoNotAskAgainChange,
}: PremiseStepVariantsProps) {
  const hasSelection = selectedVariantId !== null;

  return (
    <AiFillCard
      title="前提变体 | 选择你觉得最有潜力的方向"
      onConfirm={onConfirm}
      onReTrigger={onReTrigger}
      loading={loading}
      confirmed={confirmed}
      confirmDisabled={!hasSelection}
      confirmLabel={hasSelection ? '确认选择并继续' : '请先选择一个变体'}
      showReTrigger={true}
      doNotAskAgain={doNotAskAgain}
      onDoNotAskAgainChange={onDoNotAskAgainChange}
      aiContent={
        <div className="premise-ai-hint">
          AI 根据你的愿望清单和创作动机，生成了 3 个前提变体。点击一个变体来选中它。
        </div>
      }
    >
      {variants.length === 0 && !loading && (
        <div className="premise-empty-variants">
          还没有生成前提变体，点击「重新生成」让 AI 为你生成。
        </div>
      )}

      <div className="premise-variant-grid">
        {variants.map((variant, index) => {
          const isSelected = variant.id === selectedVariantId;
          return (
            <div
              key={variant.id}
              className={`premise-variant-card ${isSelected ? 'premise-variant-card-selected' : ''}`}
              onClick={() => onSelectVariant(variant.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectVariant(variant.id);
                }
              }}
            >
              {isSelected && <div className="premise-variant-check">✓</div>}
              <div className="premise-variant-number">变体 {index + 1}</div>
              <div className="premise-variant-title">{variant.title}</div>
              <div className="premise-variant-summary">{variant.summary}</div>
              <div className="premise-variant-divider" />
              <div className="premise-variant-conflict-label">核心冲突</div>
              <div className="premise-variant-conflict">{variant.coreConflict}</div>
            </div>
          );
        })}
      </div>
    </AiFillCard>
  );
}
