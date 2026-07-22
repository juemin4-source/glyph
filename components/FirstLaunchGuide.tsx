/**
 * FirstLaunchGuide — 3-step tutorial overlay for 织梦机 v1.2 (P1-02).
 *
 * Visual design matches canon-guide prototype:
 * - Backdrop with backdrop-filter blur
 * - Slide-up animation on the card
 * - Canon level cards with colored dots, names, descriptions (step 1)
 * - "不再显示" checkbox button
 * - Button styling matching prototype design tokens
 *
 * Shows on first entry per project (localStorage flag).
 * "?" button in sidebar reopens guide.
 */

import { useState } from 'react';
import { Globe, Link, Palette, Lightbulb, Check, ArrowRight, ArrowLeft } from 'lucide-react';

interface FirstLaunchGuideProps {
  projectId: string;
  onDismiss: () => void;
}

const CANON_LEVELS = [
  { key: 'none',    label: '未收录',   desc: '灵感笔记，尚未确认',     color: '#666666' },
  { key: 'draft',   label: '草案正典', desc: '初步认定，还在打磨',     color: '#CE93D8' },
  { key: 'project', label: '项目正典', desc: '团队认可，纳入正典',     color: '#90CAF9' },
  { key: 'core',    label: '核心正典', desc: '不可更改的基石设定',     color: '#FFB74D' },
];

const STEPS = [
  {
    title: '世界构建入门',
    description: '织梦机用「正典」来管理你的设定稳定性。每个设定有四个等级：',
    icon: <Globe size={36} />,
    showLevels: true,
  },
  {
    title: '在文档中写入 [[对象名]]',
    description:
      'WikiLink 是织梦机的核心——用 [[对象名]] 创建双向链接。双击已存在的链接可以跳转，双击不存在的链接可以快速创建新对象。',
    icon: <Link size={36} />,
    highlight: '在编辑器中输入 [[张三]] 试试',
  },
  {
    title: '画板可以可视化你的世界结构',
    description:
      '角色关系图、时间线、设定推演图——三种画板帮你从不同角度审视你的世界。拖拽节点、创建连线、缩放查看。',
    icon: <Palette size={36} />,
    highlight: '切换到「画板」标签页查看角色关系图',
  },
];

export default function FirstLaunchGuide({ projectId, onDismiss }: FirstLaunchGuideProps) {
  const [step, setStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleDismiss = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(`zhimengji-guide-done-${projectId}`, 'true');
      } catch {
        /* ignore */
      }
    }
    onDismiss();
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleDismiss();
    }
  };

  const currentStep = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;
  const isFirstStep = step === 0;
  const isLastStep = step === STEPS.length - 1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '1rem',
      }}
      onClick={handleDismiss}
    >
      <div
        style={{
          background: 'var(--bg-surface, #141414)',
          border: '1px solid var(--border-default, #2a2a2a)',
          borderRadius: 16,
          maxWidth: 480,
          width: '100%',
          padding: '2rem 1.75rem',
          animation: 'zmjSlideUp 0.4s ease',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`
@keyframes zmjSlideUp {
  from { opacity: 0; transform: translateY(32px); }
  to   { opacity: 1; transform: translateY(0); }
}
`}</style>

        {/* Progress bar */}
        <div
          style={{
            height: 3,
            background: '#333',
            borderRadius: 2,
            marginBottom: 24,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: '#B7FF00',
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Icon */}
        <div style={{ fontSize: 48, marginBottom: 12, textAlign: 'center' }}>
          {currentStep.icon}
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: '1.35rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
            color: 'var(--text-primary, #e0e0e0)',
            textAlign: 'center',
          }}
        >
          {currentStep.title}
        </h2>

        {/* Description */}
        <p
          style={{
            color: 'var(--text-secondary, #a0a0a0)',
            fontSize: '0.9rem',
            marginBottom: '1.25rem',
            lineHeight: 1.7,
            textAlign: 'center',
          }}
        >
          {currentStep.description}
        </p>

        {/* Canon level cards (step 1 only) */}
        {currentStep.showLevels && (
          <div style={{ marginBottom: '1.25rem' }}>
            {CANON_LEVELS.map(level => (
              <div
                key={level.key}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem',
                  padding: '0.85rem 1rem',
                  borderRadius: 8,
                  marginBottom: '0.5rem',
                  background: `${level.color}0f`,
                  transition: 'background 0.2s',
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    flexShrink: 0,
                    marginTop: '0.2rem',
                    background: level.color,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      marginBottom: '0.1rem',
                      color: 'var(--text-primary, #e0e0e0)',
                    }}
                  >
                    {level.label}
                  </div>
                  <div
                    style={{
                      color: 'var(--text-secondary, #a0a0a0)',
                      fontSize: '0.85rem',
                    }}
                  >
                    {level.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Highlight tip (steps 2-3) */}
        {currentStep.highlight && (
          <div
            style={{
              background: 'rgba(183,255,0,0.08)',
              border: '1px solid rgba(183,255,0,0.2)',
              borderRadius: 8,
              padding: '10px 16px',
              fontSize: 13,
              color: '#B7FF00',
              marginBottom: '1.25rem',
              textAlign: 'center',
            }}
          >
            <Lightbulb size={14} /> {currentStep.highlight}
          </div>
        )}

        {/* Step dots */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 20,
          }}
        >
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: i === step ? '#B7FF00' : '#444',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          {/* "不再显示" checkbox (persistent across all steps) */}
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1.2rem',
              borderRadius: 8,
              font: '500 0.9rem -apple-system, "PingFang SC", sans-serif',
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: 'var(--text-secondary, #888)',
              paddingLeft: '0.6rem',
              transition: 'color 0.15s',
            }}
            onClick={() => setDontShowAgain(!dontShowAgain)}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-primary, #e0e0e0)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary, #888)';
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 3,
                border: '1.5px solid var(--text-secondary, #888)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                transition: 'all 0.2s',
                flexShrink: 0,
                background: dontShowAgain ? '#B7FF00' : 'transparent',
                borderColor: dontShowAgain ? '#B7FF00' : 'var(--text-secondary, #888)',
                color: dontShowAgain ? '#000' : 'transparent',
              }}
            >
              <Check size={16} />
            </span>
            不再显示
          </button>

          {/* Step 1: single "开始使用" button */}
          {isFirstStep && (
            <button
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 1.2rem',
                borderRadius: 8,
                font: '500 0.9rem -apple-system, "PingFang SC", sans-serif',
                border: 'none',
                cursor: 'pointer',
                background: '#B7FF00',
                color: '#000',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = '#c8ff33';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = '#B7FF00';
              }}
              onClick={handleNext}
            >
              开始使用 <ArrowRight size={14} />
            </button>
          )}

          {/* Steps 2-3: back / next / skip */}
          {!isFirstStep && (
            <>
              <button
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 1.2rem',
                  borderRadius: 8,
                  font: '500 0.9rem -apple-system, "PingFang SC", sans-serif',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: '#B7FF00',
                  border: '1px solid #B7FF00',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(183,255,0,0.1)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
                onClick={() => setStep(step - 1)}
              >
                <ArrowLeft size={14} /> 上一步
              </button>
              <button
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 1.2rem',
                  borderRadius: 8,
                  font: '500 0.9rem -apple-system, "PingFang SC", sans-serif',
                  border: 'none',
                  cursor: 'pointer',
                  background: '#B7FF00',
                  color: '#000',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = '#c8ff33';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = '#B7FF00';
                }}
                onClick={handleNext}
              >
                {isLastStep ? '开始构建' : '下一步'}
              </button>
              <button
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 0.8rem',
                  borderRadius: 8,
                  font: '500 0.8rem -apple-system, "PingFang SC", sans-serif',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: 'var(--text-secondary, #888)',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-primary, #e0e0e0)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary, #888)';
                }}
                onClick={handleDismiss}
              >
                跳过
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Check if guide should be shown for a project.
 */
export function shouldShowGuide(projectId: string): boolean {
  try {
    return localStorage.getItem(`zhimengji-guide-done-${projectId}`) !== 'true';
  } catch {
    return true;
  }
}

/**
 * Mark guide as done for a project.
 */
export function markGuideDone(projectId: string): void {
  try {
    localStorage.setItem(`zhimengji-guide-done-${projectId}`, 'true');
  } catch {
    /* ignore */
  }
}
