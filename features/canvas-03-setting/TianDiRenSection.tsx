/**
 * TianDiRenSection — Canvas 3 Sparrow Mode Heaven/Earth/Human three-layer expansion
 *
 * Collapsible section with three textarea fields (tian/di/ren) each with:
 * - Natural language placeholder (no methodology jargon)
 * - AI regenerate button per field
 * - Do-not-ask-again toggle per field
 * - Save flow: manual edit + confirm
 *
 * Styling consistent with SparrowStepCard pattern.
 */

import React, { useState, useCallback } from 'react';
import { Button } from '../../components/ui';
import DoNotAskAgainToggle from '../common/method-step/DoNotAskAgainToggle';
import type { TianDiRenLayer } from '../../contracts/setting.contract';
import './sparrow.css';

export interface TianDiRenSectionProps {
  projectId: string;
  tianDiRen: TianDiRenLayer | null;
  onSave: (tian: string, di: string, ren: string) => Promise<void>;
  onAiGenerate: (field: 'tian' | 'di' | 'ren') => Promise<string>;
  loading?: boolean;
}

interface FieldConfig {
  key: 'tian' | 'di' | 'ren';
  label: string;
  placeholder: string;
}

const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: 'tian',
    label: '天',
    placeholder: '更大的力量如何影响故事？',
  },
  {
    key: 'di',
    label: '地',
    placeholder: '环境和社会如何塑造角色？',
  },
  {
    key: 'ren',
    label: '人',
    placeholder: '人和人之间的关系张力在哪里？',
  },
];

export default function TianDiRenSection({
  projectId: _projectId,
  tianDiRen,
  onSave,
  onAiGenerate,
  loading = false,
}: TianDiRenSectionProps) {
  const [isExpanded, setIsExpanded] = useState(tianDiRen?.isExpanded ?? false);
  const [tian, setTian] = useState(tianDiRen?.tian ?? '');
  const [di, setDi] = useState(tianDiRen?.di ?? '');
  const [ren, setRen] = useState(tianDiRen?.ren ?? '');
  const [doNotAskAgain, setDoNotAskAgain] = useState<Record<'tian' | 'di' | 'ren', boolean>>({
    tian: false,
    di: false,
    ren: false,
  });
  const [generatingField, setGeneratingField] = useState<'tian' | 'di' | 'ren' | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync local state when tianDiRen prop changes (e.g., after load)
  React.useEffect(() => {
    if (tianDiRen) {
      setTian(tianDiRen.tian);
      setDi(tianDiRen.di);
      setRen(tianDiRen.ren);
    }
  }, [tianDiRen]);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleAiGenerate = useCallback(
    async (field: 'tian' | 'di' | 'ren') => {
      setGeneratingField(field);
      try {
        const content = await onAiGenerate(field);
        if (content) {
          if (field === 'tian') setTian(content);
          else if (field === 'di') setDi(content);
          else if (field === 'ren') setRen(content);
        }
      } finally {
        setGeneratingField(null);
      }
    },
    [onAiGenerate]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(tian, di, ren);
    } finally {
      setSaving(false);
    }
  }, [tian, di, ren, onSave]);

  const handleDoNotAskAgainChange = useCallback(
    (field: 'tian' | 'di' | 'ren', value: boolean) => {
      setDoNotAskAgain(prev => ({ ...prev, [field]: value }));
    },
    []
  );

  const fieldValue = (key: 'tian' | 'di' | 'ren'): string => {
    if (key === 'tian') return tian;
    if (key === 'di') return di;
    return ren;
  };

  const setFieldValue = (key: 'tian' | 'di' | 'ren', value: string) => {
    if (key === 'tian') setTian(value);
    else if (key === 'di') setDi(value);
    else if (key === 'ren') setRen(value);
  };

  const hasContent = tian.trim() || di.trim() || ren.trim();

  return (
    <div className="tiandiren-section">
      {/* Header — clickable to expand/collapse */}
      <div className="tiandiren-header" onClick={handleToggleExpand}>
        <div className="tiandiren-icon">&#x25CB;</div>
        <div className="tiandiren-title">展开视角</div>
        {hasContent && (
          <span className="tiandiren-count">
            已填写 {[tian, di, ren].filter(s => s.trim()).length}/3
          </span>
        )}
        <span className={`tiandiren-chevron ${isExpanded ? 'tiandiren-chevron-open' : ''}`}>
          ▾
        </span>
      </div>

      {/* Body — expandable */}
      {isExpanded && (
        <div className="tiandiren-body">
          {FIELD_CONFIGS.map(config => (
            <div key={config.key} className="tiandiren-field">
              <div className="tiandiren-field-header">
                <span className="tiandiren-field-label">{config.label}</span>
                <span className="tiandiren-field-hint">{config.placeholder}</span>
              </div>

              <textarea
                className="tiandiren-textarea"
                value={fieldValue(config.key)}
                onChange={(e) => setFieldValue(config.key, e.target.value)}
                placeholder={config.placeholder}
                rows={4}
              />

              <div className="tiandiren-field-footer">
                <DoNotAskAgainToggle
                  checked={doNotAskAgain[config.key]}
                  onChange={(v) => handleDoNotAskAgainChange(config.key, v)}
                />
                <div className="tiandiren-field-actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAiGenerate(config.key)}
                    disabled={loading || generatingField !== null}
                  >
                    {generatingField === config.key ? '生成中...' : 'AI 生成'}
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {/* Section-level save */}
          <div className="tiandiren-footer">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '保存中...' : '保存视角'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
