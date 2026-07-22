/**
 * PacketDetailModeSelector — 画板④ 三档细纲模式选择器
 *
 * Segmented control for sketch / standard / refined modes.
 * Persists to DB via setDetailMode API.
 */

import React from 'react';
import type { DetailMode } from '../../contracts/chapter-packet.contract';

interface ModeOption {
  value: DetailMode;
  label: string;
  icon: string;
  description: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    value: 'sketch',
    label: '快速草图',
    icon: '⚡',
    description: 'L1-L3 摘要模式，L4 折叠',
  },
  {
    value: 'standard',
    label: '标准大纲',
    icon: '📋',
    description: '四层可见，L4 只读审查',
  },
  {
    value: 'refined',
    label: '精细润色',
    icon: '✨',
    description: '全层可编辑，字数/时间/评论',
  },
];

interface PacketDetailModeSelectorProps {
  currentMode: DetailMode;
  onModeChange: (mode: DetailMode) => void;
  disabled?: boolean;
  doNotAskAgain?: boolean;
  onDoNotAskAgainChange?: (checked: boolean) => void;
}

export default function PacketDetailModeSelector({
  currentMode,
  onModeChange,
  disabled = false,
  doNotAskAgain = false,
  onDoNotAskAgainChange,
}: PacketDetailModeSelectorProps) {
  return (
    <div className="packet-mode-selector">
      <div className="packet-mode-selector-label">细纲模式</div>
      <div className="packet-mode-selector-tabs">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`packet-mode-selector-tab ${currentMode === opt.value ? 'packet-mode-selector-active' : ''}`}
            onClick={() => onModeChange(opt.value)}
            disabled={disabled}
            title={opt.description}
          >
            <span className="packet-mode-selector-tab-icon">{opt.icon}</span>
            <span className="packet-mode-selector-tab-label">{opt.label}</span>
          </button>
        ))}
      </div>
      {onDoNotAskAgainChange !== undefined && (
        <label className="packet-mode-dna-toggle">
          <input
            type="checkbox"
            checked={doNotAskAgain}
            onChange={(e) => onDoNotAskAgainChange(e.target.checked)}
            disabled={disabled}
          />
          <span className="packet-mode-dna-label">不再询问</span>
        </label>
      )}
    </div>
  );
}
