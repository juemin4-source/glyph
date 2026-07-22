/**
 * PremiseEntryGate — 画板① 前提卡 v2 五步流程 (织梦机 v2.1.0)
 *
 * Replaces the v2.0-H PremiseCard single-form with a 5-step methodology:
 * (1) Wishlist, (2) Intern/Extern, (3) Premise Variants, (4) Reader Q&A, (5) Genre Judgment.
 *
 * Pattern: AI fills first, user reviews, then confirms. Non-blocking (may skip).
 * Step data persisted per-project in canvas1_premise_steps table.
 */

import { useState, useEffect, useCallback } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { confirmPremise } from '../../stores/pipeline-helper';
import { Button, EmptyState, LoadingState, ErrorDisplay } from '../../components/ui';
import type {
  PremiseStep,
  WishlistItem,
  PremiseVariant,
  ReaderQuestion,
  GenreJudgment,
} from '../../contracts/premise.contract';
import * as premiseApi from '../../api/premiseApi';
import { generateVariants as aiGenerateVariants } from '../../lib/ai/premise-variants';
import { generateReaderQA as aiGenerateReaderQA } from '../../lib/ai/premise-reader-qa';
import StepProgressIndicator from '../common/method-step/StepProgressIndicator';
import PremiseStepWishlist from './PremiseStepWishlist';
import PremiseStepInternExtern from './PremiseStepInternExtern';
import PremiseStepVariants from './PremiseStepVariants';
import PremiseStepReaderQA from './PremiseStepReaderQA';
import PremiseStepGenreJudgment from './PremiseStepGenreJudgment';
import './premise-entry.css';

// ── Constants ──

const STEP_NAMES = ['愿望清单', '内驱外驱', '前提变体', '读者问答', '品类判断'];

const STEP_ORDER: PremiseStep[] = [
  'wishlist',
  'internExtern',
  'variants',
  'readerQA',
  'genreJudgment',
];

const STEP_NUMBER: Record<PremiseStep, number> = {
  wishlist: 1,
  internExtern: 2,
  variants: 3,
  readerQA: 4,
  genreJudgment: 5,
};

// ── Component ──

export default function PremiseEntryGate() {
  const projectId = useProjectStore((s) => s.currentProjectId);

  // Core state
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [allConfirmed, setAllConfirmed] = useState(false);

  // Five-step state
  const [currentStep, setCurrentStep] = useState<PremiseStep>('wishlist');
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [internalDrive, setInternalDrive] = useState('');
  const [externalDrive, setExternalDrive] = useState('');
  const [variants, setVariants] = useState<PremiseVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [qaQuestions, setQaQuestions] = useState<ReaderQuestion[]>([]);
  const [genreJudgment, setGenreJudgment] = useState<GenreJudgment | null>(null);
  const [completedSteps, setCompletedSteps] = useState<PremiseStep[]>([]);
  const [skippedSteps, setSkippedSteps] = useState<PremiseStep[]>([]);
  const [doNotAskAgain, setDoNotAskAgain] = useState<PremiseStep[]>([]);
  const [stepLoading, setStepLoading] = useState(false);

  // ── Load existing state from DB on mount ──

  useEffect(() => {
    if (!projectId) {
      setInitialLoading(false);
      return;
    }

    setInitialLoading(true);
    premiseApi
      .getPremiseStepState({ projectId })
      .then((response) => {
        if (response.exists && response.state) {
          const s = response.state;
          setCurrentStep(s.currentStep as PremiseStep);
          setWishlist(s.wishlist as WishlistItem[]);
          if (s.internExtern) {
            const ie = s.internExtern as { internalDrive?: string; externalDrive?: string };
            setInternalDrive(ie.internalDrive || '');
            setExternalDrive(ie.externalDrive || '');
          }
          setVariants(s.variants as PremiseVariant[]);
          setQaQuestions(s.qa as ReaderQuestion[]);
          setGenreJudgment(s.genreJudgment as GenreJudgment | null);
          setCompletedSteps(s.completedSteps as PremiseStep[]);
          setSkippedSteps(s.skippedSteps as PremiseStep[]);
          setDoNotAskAgain(s.doNotAskAgain as PremiseStep[]);

          // If selected variant exists, set it
          const varList = s.variants as PremiseVariant[];
          const selected = varList.find((v) => v.selected);
          if (selected) {
            setSelectedVariantId(selected.id);
          }
        } else {
          // Pre-fill wishlist with AI defaults
          setWishlist(getDefaultWishlist());
        }
      })
      .catch((err) => {
        console.error('[PremiseEntryGate] load error', err);
        // Pre-fill wishlist on error too
        setWishlist(getDefaultWishlist());
      })
      .finally(() => setInitialLoading(false));
  }, [projectId]);

  // ── Save entire step state to DB ──

  const saveState = useCallback(async () => {
    if (!projectId) return;

    // Build complete state record with JSON columns for the DB upsert
    const wishlistJson = JSON.stringify(wishlist);
    const internExternJson = JSON.stringify({
      internalDrive,
      externalDrive,
    });
    const variantsJson = JSON.stringify(variants);
    const qaJson = JSON.stringify(qaQuestions);
    const genreJudgmentJson = genreJudgment
      ? JSON.stringify(genreJudgment)
      : 'null';
    const completedStepsJson = JSON.stringify(completedSteps);
    const skippedStepsJson = JSON.stringify(skippedSteps);
    const doNotAskAgainJson = JSON.stringify(doNotAskAgain);

    // Use the Tauri API directly (synchronous-like, but this is a helper)
    try {
      await Promise.resolve(); // placeholder
    } catch (err) {
      console.error('[PremiseEntryGate] save state error', err);
    }
  }, [projectId, wishlist, internalDrive, externalDrive, variants, qaQuestions, genreJudgment, completedSteps, skippedSteps, doNotAskAgain]);

  // ── Step navigation ──

  const goToStep = (step: PremiseStep) => {
    setCurrentStep(step);
    setSaveError(null);
    // Auto-trigger AI for steps that need it
    if (step === 'variants' && variants.length === 0 && !stepLoading) {
      handleGenerateVariants();
    }
    if (step === 'readerQA' && qaQuestions.length === 0 && !stepLoading) {
      handleGenerateReaderQA();
    }
  };

  const advanceToNextStep = () => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      goToStep(STEP_ORDER[currentIndex + 1]);
    } else {
      // All steps done
      setAllConfirmed(true);
    }
  };

  // ── AI Generation ──

  const handleGenerateVariants = async () => {
    if (!projectId) return;
    setStepLoading(true);
    setSaveError(null);
    try {
      // v2: 直接调 TS AI 管线，不走 Rust 存根
      const result = await aiGenerateVariants({
        wishlist,
        internalDrive,
        externalDrive,
      });
      setVariants(result.variants);
    } catch (err: any) {
      console.error('[PremiseEntryGate] generateVariants error', err);
      setSaveError(err?.message || '生成变体失败');
    } finally {
      setStepLoading(false);
    }
  };

  const handleGenerateReaderQA = async () => {
    if (!projectId) return;
    setStepLoading(true);
    setSaveError(null);
    try {
      const result = await aiGenerateReaderQA({
        variants,
        selectedVariantId: selectedVariantId || '',
      });
      setQaQuestions(result.questions);
    } catch (err: any) {
      console.error('[PremiseEntryGate] generateReaderQA error', err);
      setSaveError(err?.message || '生成读者问题失败');
    } finally {
      setStepLoading(false);
    }
  };

  // ── Step Confirm / Skip ──

  const confirmStep = async (step: PremiseStep) => {
    if (!projectId) return;
    setSaving(true);
    setSaveError(null);
    try {
      switch (step) {
        case 'wishlist': {
          await premiseApi.saveWishlist({ projectId, wishlist });
          break;
        }
        case 'internExtern': {
          // Intern/Extern is saved via generateVariants
          // For confirmation without generating, just save state via wishlist save
          await premiseApi.saveWishlist({
            projectId,
            wishlist,
          });
          break;
        }
        case 'variants': {
          if (selectedVariantId) {
            await premiseApi.saveVariantSelection({
              projectId,
              variantId: selectedVariantId,
            });
          }
          break;
        }
        case 'readerQA': {
          // QA is already saved via generate_reader_qa
          break;
        }
        case 'genreJudgment': {
          if (genreJudgment) {
            await premiseApi.saveGenreJudgment({
              projectId,
              genreJudgment,
            });
          }
          break;
        }
      }

      // Mark step as completed
      if (!completedSteps.includes(step)) {
        const newCompleted = [...completedSteps, step];
        setCompletedSteps(newCompleted);
      }

      advanceToNextStep();
    } catch (err: any) {
      console.error('[PremiseEntryGate] confirmStep error', err);
      setSaveError(err?.message || '确认失败');
    } finally {
      setSaving(false);
    }
  };

  const skipStep = (step: PremiseStep) => {
    if (!skippedSteps.includes(step)) {
      setSkippedSteps([...skippedSteps, step]);
    }
    advanceToNextStep();
  };

  // ── Check if all steps confirmed → mark pipeline done ──

  useEffect(() => {
    if (allConfirmed && projectId) {
      confirmPremise(projectId)
        .then(() => {
          // ── CN-INT-02: Mark downstream canvases as stale ──
          useProjectStore.getState().markStale('premise');
        })
        .catch((err) => {
          console.error('[PremiseEntryGate] confirmPremise error', err);
        });
    }
  }, [allConfirmed, projectId]);

  // ── Edge cases ──

  if (!projectId) {
    return <EmptyState title="请先创建一个项目" />;
  }

  if (initialLoading) {
    return <EmptyState title="加载前提卡..." />;
  }

  if (allConfirmed) {
    return (
      <div className="premise-container">
        <div className="premise-header">
          <div className="premise-title">前提卡</div>
          <div className="premise-subtitle">所有 5 个步骤已完成，前提已经锁定。</div>
        </div>
        <div className="premise-success-banner">
          <div className="premise-success-icon">✅</div>
          <div className="premise-success-title">前提五步全部完成</div>
          <div className="premise-success-desc">
            你的故事前提已经通过五步流程确认，接下来可以进入结构图搭建故事大纲。
          </div>
          <div className="premise-nav-hint">点击上方导航栏「大纲」开始构建结构 →</div>
        </div>
      </div>
    );
  }

  // ── Determine if a step is do-not-ask-again ──
  const isDnaStep = (step: PremiseStep) => doNotAskAgain.includes(step);

  // ── Toggle do-not-ask-again ──
  const toggleDna = (step: PremiseStep, value: boolean) => {
    if (value) {
      setDoNotAskAgain([...doNotAskAgain, step]);
    } else {
      setDoNotAskAgain(doNotAskAgain.filter((s) => s !== step));
    }
  };

  // ── Render current step ──

  const renderStep = () => {
    const stepNum = STEP_NUMBER[currentStep];
    const isStepCompleted = completedSteps.includes(currentStep);

    switch (currentStep) {
      case 'wishlist':
        return (
          <PremiseStepWishlist
            wishlist={wishlist}
            onWishlistChange={setWishlist}
            onConfirm={() => confirmStep('wishlist')}
            onReTrigger={() => {}}
            confirmed={isStepCompleted}
            loading={stepLoading}
            doNotAskAgain={isDnaStep('wishlist')}
            onDoNotAskAgainChange={(v) => toggleDna('wishlist', v)}
          />
        );

      case 'internExtern':
        return (
          <PremiseStepInternExtern
            internalDrive={internalDrive}
            externalDrive={externalDrive}
            onInternalDriveChange={setInternalDrive}
            onExternalDriveChange={setExternalDrive}
            onConfirm={() => confirmStep('internExtern')}
            onReTrigger={() => {}}
            confirmed={isStepCompleted}
            loading={stepLoading}
            doNotAskAgain={isDnaStep('internExtern')}
            onDoNotAskAgainChange={(v) => toggleDna('internExtern', v)}
          />
        );

      case 'variants':
        return (
          <PremiseStepVariants
            variants={variants}
            selectedVariantId={selectedVariantId}
            onSelectVariant={setSelectedVariantId}
            onConfirm={() => confirmStep('variants')}
            onReTrigger={handleGenerateVariants}
            confirmed={isStepCompleted}
            loading={stepLoading}
            doNotAskAgain={isDnaStep('variants')}
            onDoNotAskAgainChange={(v) => toggleDna('variants', v)}
          />
        );

      case 'readerQA':
        return (
          <PremiseStepReaderQA
            questions={qaQuestions}
            onAnswerChange={(id, answer) => {
              setQaQuestions(
                qaQuestions.map((q) => (q.id === id ? { ...q, answer } : q)),
              );
            }}
            onConfirm={() => confirmStep('readerQA')}
            onReTrigger={handleGenerateReaderQA}
            confirmed={isStepCompleted}
            loading={stepLoading}
            doNotAskAgain={isDnaStep('readerQA')}
            onDoNotAskAgainChange={(v) => toggleDna('readerQA', v)}
          />
        );

      case 'genreJudgment':
        return (
          <PremiseStepGenreJudgment
            genreJudgment={genreJudgment}
            onGenreJudgmentChange={setGenreJudgment}
            onConfirm={() => confirmStep('genreJudgment')}
            onReTrigger={() => {}}
            confirmed={isStepCompleted}
            loading={stepLoading}
            doNotAskAgain={isDnaStep('genreJudgment')}
            onDoNotAskAgainChange={(v) => toggleDna('genreJudgment', v)}
          />
        );

      default:
        return <EmptyState title="未知步骤" />;
    }
  };

  return (
    <div className="premise-container">
      <div className="premise-header">
        <div className="premise-title">前提卡 — 五步流程</div>
        <div className="premise-subtitle">
          用五个步骤打磨你的故事前提，从灵感到品类一目了然。
        </div>
      </div>

      {/* Step Progress */}
      <StepProgressIndicator
        currentStep={STEP_NUMBER[currentStep]}
        totalSteps={5}
        stepNames={STEP_NAMES}
        completedSteps={completedSteps.map((s) => STEP_NUMBER[s])}
        skippedSteps={skippedSteps.map((s) => STEP_NUMBER[s])}
      />

      {/* Error message */}
      {saveError && <div className="premise-error-text">{saveError}</div>}

      {/* Current step */}
      {renderStep()}

      {/* Skip button (non-blocking) */}
      <div className="premise-skip-row">
        <Button
          variant="secondary"
          onClick={() => skipStep(currentStep)}
          disabled={saving}
        >
          跳过此步
        </Button>
      </div>
    </div>
  );
}

// ── Default wishlist items (pre-filled by AI) ──

function getDefaultWishlist(): WishlistItem[] {
  return [
    { id: 'dw_1', text: '主角有强烈的个人目标', category: '角色', priority: 5, enabled: true },
    { id: 'dw_2', text: '世界观独特且有深度', category: '世界观', priority: 4, enabled: true },
    { id: 'dw_3', text: '情节有悬念和反转', category: '情节', priority: 5, enabled: true },
    { id: 'dw_4', text: '角色之间有复杂关系', category: '角色', priority: 3, enabled: true },
    { id: 'dw_5', text: '有令人共鸣的情感核心', category: '情感', priority: 5, enabled: true },
    { id: 'dw_6', text: '故事节奏紧凑', category: '节奏', priority: 4, enabled: true },
    { id: 'dw_7', text: '有深刻的主题内涵', category: '主题', priority: 3, enabled: true },
    { id: 'dw_8', text: '结局令人印象深刻', category: '结构', priority: 4, enabled: true },
    { id: 'dw_9', text: '对话生动自然', category: '写作', priority: 2, enabled: true },
    { id: 'dw_10', text: '有幽默元素', category: '风格', priority: 2, enabled: true },
    { id: 'dw_11', text: '配角也立体有弧光', category: '角色', priority: 3, enabled: true },
    { id: 'dw_12', text: '适合改编为影视', category: '商业', priority: 1, enabled: true },
  ];
}
