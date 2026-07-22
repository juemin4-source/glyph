/**
 * SparrowProtagonistSteps — Canvas 3 Sparrow Mode protagonist 3 steps
 *
 * Collapsed by default, 3 substeps: capability / agency / vulnerability.
 * Each substep has text area + AI suggest + "Mark as usable" toggle.
 */

import React, { useState, useCallback } from 'react';
import { Button } from '../../components/ui';
import DoNotAskAgainToggle from '../common/method-step/DoNotAskAgainToggle';
import type { ProtagonistStepType, CharacterStep3 } from '../../contracts/setting.contract';
import './sparrow.css';

export interface SparrowProtagonistStepsProps {
  steps: CharacterStep3[];
  projectId: string;
  onSaveStep?: (stepType: ProtagonistStepType, description: string) => void;
  onMarkUsable?: (stepType: ProtagonistStepType, isUsable: boolean) => void;
}

const STEP_LABELS: Record<ProtagonistStepType, string> = {
  capability: '能力：主角能做什么？',
  agency: '选择：主角做出什么选择？',
  vulnerability: '弱点：什么在阻碍主角？',
};

const STEP_SHORT_LABELS: Record<ProtagonistStepType, string> = {
  capability: 'What can your protagonist do?',
  agency: 'What choices does your protagonist make?',
  vulnerability: 'What holds your protagonist back?',
};

export default function SparrowProtagonistSteps({
  steps,
  projectId,
  onSaveStep,
  onMarkUsable,
}: SparrowProtagonistStepsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStepData = (type: ProtagonistStepType): CharacterStep3 => {
    return steps.find(s => s.stepType === type) || {
      stepType: type,
      characterId: '',
      description: '',
      isUsable: false,
    };
  };

  const usableCount = steps.filter(s => s.isUsable).length;

  return (
    <div className="sparrow-protagonist-section">
      {/* Collapsible header */}
      <div
        className="sparrow-protagonist-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="sparrow-protagonist-icon">👤</span>
        <span className="sparrow-protagonist-title">角色设定</span>
        <span className="sparrow-protagonist-count">
          {usableCount}/3 可用
        </span>
        <span className={`sparrow-step-chevron ${isExpanded ? 'sparrow-step-chevron-open' : ''}`}>
          ▾
        </span>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="sparrow-protagonist-body">
          {(['capability', 'agency', 'vulnerability'] as ProtagonistStepType[]).map((type) => {
            const step = getStepData(type);
            return (
              <ProtagonistSubstepCard
                key={type}
                type={type}
                label={STEP_LABELS[type]}
                description={step.description}
                isUsable={step.isUsable}
                onSave={(desc) => onSaveStep?.(type, desc)}
                onToggleUsable={(usable) => onMarkUsable?.(type, usable)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ProtagonistSubstepCardProps {
  type: ProtagonistStepType;
  label: string;
  description: string;
  isUsable: boolean;
  onSave: (description: string) => void;
  onToggleUsable: (isUsable: boolean) => void;
}

function ProtagonistSubstepCard({
  type,
  label,
  description,
  isUsable,
  onSave,
  onToggleUsable,
}: ProtagonistSubstepCardProps) {
  const [editDesc, setEditDesc] = useState(description);
  const [isDirty, setIsDirty] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditDesc(e.target.value);
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    onSave(editDesc);
    setIsDirty(false);
  }, [editDesc, onSave]);

  const handleToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onToggleUsable(e.target.checked);
  }, [onToggleUsable]);

  return (
    <div className="sparrow-protagonist-step">
      <div className="sparrow-protagonist-step-label">{label}</div>
      <textarea
        className="sparrow-protagonist-textarea"
        value={editDesc}
        onChange={handleChange}
        placeholder={`输入${label}...`}
        rows={3}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <label className="sparrow-usable-toggle">
          <input
            type="checkbox"
            checked={isUsable}
            onChange={handleToggle}
          />
          标记为可用（下游环节可引用）
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!editDesc.trim()}
          >
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
