/**
 * DoNotAskAgainToggle — 通用"不再询问"开关组件
 *
 * Toggle switch for "Do not ask again" on AI-assisted steps.
 * Reusable across all method-step canvases.
 */

import React from 'react';
import './step-progress.css';

interface DoNotAskAgainToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export default function DoNotAskAgainToggle({
  checked,
  onChange,
  label = '不再询问',
}: DoNotAskAgainToggleProps) {
  return (
    <label className="dna-toggle">
      <input
        type="checkbox"
        className="dna-toggle-checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="dna-toggle-slider" />
      <span className="dna-toggle-label">{label}</span>
    </label>
  );
}
