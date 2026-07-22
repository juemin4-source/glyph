/**
 * StepProgressIndicator — 通用步骤进度指示器
 *
 * Displays "Step X of Y" with visual progress bar.
 * Reusable across canvas method steps (T-002, T-003, T-004, T-005).
 */

import React from 'react';
import './step-progress.css';

interface StepProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepNames?: string[];
  completedSteps?: number[];
  skippedSteps?: number[];
}

export default function StepProgressIndicator({
  currentStep,
  totalSteps,
  stepNames,
  completedSteps = [],
  skippedSteps = [],
}: StepProgressIndicatorProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div className="step-progress">
      <div className="step-progress-label">
        Step {currentStep} of {totalSteps}
      </div>
      <div className="step-progress-bar">
        {steps.map((step) => {
          const isActive = step === currentStep;
          const isCompleted = completedSteps.includes(step);
          const isSkipped = skippedSteps.includes(step);
          let className = 'step-progress-dot';
          if (isActive) className += ' step-progress-dot-active';
          if (isCompleted) className += ' step-progress-dot-completed';
          if (isSkipped) className += ' step-progress-dot-skipped';
          if (step < currentStep) className += ' step-progress-dot-past';

          return (
            <React.Fragment key={step}>
              <div className={className} title={stepNames?.[step - 1] || `Step ${step}`}>
                {isCompleted ? '✓' : isSkipped ? '—' : step}
              </div>
              {step < totalSteps && (
                <div className={`step-progress-line ${step < currentStep ? 'step-progress-line-filled' : ''}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      {stepNames && (
        <div className="step-progress-names">
          {stepNames.map((name, i) => (
            <span key={i} className={`step-progress-name ${i + 1 === currentStep ? 'step-progress-name-active' : ''}`}>
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
