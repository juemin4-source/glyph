/**
 * SparrowStepList — Canvas 3 Sparrow Mode 9+3 main component
 *
 * Orchestrates the 9 sparrow steps + 3 protagonist substeps.
 * Loads/saves state via settingApi. Renders natural language only.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { EmptyState } from '../../components/ui';
import { useToast } from '../../components/Toast';
import * as settingApi from '../../api/settingApi';
import PipelineIndicator from '../common/pipeline-indicator/PipelineIndicator';
import type {
  SparrowStepId, SparrowStepState, CharacterStep3, TianDiRenLayer,
} from '../../contracts/setting.contract';
import SparrowStepCard from './SparrowStepCard';
import SparrowProtagonistSteps from './SparrowProtagonistSteps';
import TianDiRenSection from './TianDiRenSection';
import './sparrow.css';

/**
 * 9 step definitions: internal stepId → natural language label.
 * No methodology jargon ("Sparrow", "9+3") is ever shown to the user.
 */
const STEP_DEFS: { stepId: SparrowStepId; label: string; required: boolean }[] = [
  { stepId: 'step_1', label: '你的故事开始之前，世界是什么样的？', required: false },
  { stepId: 'step_2', label: '是什么事件打破了一切平静？', required: false },
  { stepId: 'step_3', label: '你的世界最核心的异质元素是什么？', required: true },
  { stepId: 'step_4', label: '谁拥有权力，谁没有？', required: false },
  { stepId: 'step_5', label: '这个世界藏着哪些潜规则？', required: false },
  { stepId: 'step_6', label: '日常生活是什么样子？', required: false },
  { stepId: 'step_7', label: '什么在威胁这个世界？', required: false },
  { stepId: 'step_8', label: '世界如何随时间变化？', required: false },
  { stepId: 'step_9', label: '世界的命运是什么？', required: false },
];

export default function SparrowStepList() {
  const projectId = useProjectStore(s => s.currentProjectId);
  const upstreamStatus = useProjectStore(s => s.upstreamStatus.setting);
  const markRefreshed = useProjectStore(s => s.markRefreshed);
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [allExpanded, setAllExpanded] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── CN-INT-01: Refresh upstream data ──

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setRefreshKey(k => k + 1);
    markRefreshed('setting');
  }, [markRefreshed]);

  // Step states
  const [steps, setSteps] = useState<SparrowStepState[]>(() =>
    STEP_DEFS.map(def => ({
      stepId: def.stepId,
      label: def.label,
      content: '',
      isExpanded: true,
      isRequired: def.required,
      isComplete: false,
      aiGenerated: false,
      doNotAskAgain: false,
    }))
  );

  // Protagonist steps
  const [protagonistSteps, setProtagonistSteps] = useState<CharacterStep3[]>([
    { stepType: 'capability', characterId: '', description: '', isUsable: false },
    { stepType: 'agency', characterId: '', description: '', isUsable: false },
    { stepType: 'vulnerability', characterId: '', description: '', isUsable: false },
  ]);

  // Tian-Di-Ren layer
  const [tianDiRen, setTianDiRen] = useState<TianDiRenLayer | null>(null);

  // Load existing state from backend
  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      try {
        const data = await settingApi.getSparrowModule({ projectId });
        if (data.exists) {
          // Merge loaded steps with definitions
          setSteps(prev => prev.map(defStep => {
            const loaded = data.steps.find(s => s.stepId === defStep.stepId);
            return loaded ? { ...defStep, ...loaded } : defStep;
          }));

          if (data.protagonistSteps.length > 0) {
            setProtagonistSteps(prev => prev.map(pStep => {
              const loaded = data.protagonistSteps.find(
                ps => ps.stepType === pStep.stepType
              );
              return loaded || pStep;
            }));
          }

          // Load Tian-Di-Ren layer
          if (data.tianDiRen) {
            setTianDiRen(data.tianDiRen);
          }
        }
      } catch (e) {
        console.error('Failed to load sparrow module', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId, refreshKey]);

  // ── Step handlers ──

  const getStep = useCallback((stepId: SparrowStepId) => {
    return steps.find(s => s.stepId === stepId);
  }, [steps]);

  const updateStepField = useCallback(
    (stepId: SparrowStepId, field: Partial<SparrowStepState>) => {
      setSteps(prev => prev.map(s =>
        s.stepId === stepId ? { ...s, ...field } : s
      ));
    },
    []
  );

  const handleToggleExpand = useCallback(
    (stepId: SparrowStepId) => {
      const step = getStep(stepId);
      if (step) updateStepField(stepId, { isExpanded: !step.isExpanded });
    },
    [getStep, updateStepField]
  );

  const handleContentChange = useCallback(
    (stepId: SparrowStepId, content: string) => {
      updateStepField(stepId, { content });
    },
    [updateStepField]
  );

  const handleDoNotAskAgainChange = useCallback(
    (stepId: SparrowStepId, value: boolean) => {
      updateStepField(stepId, { doNotAskAgain: value });
    },
    [updateStepField]
  );

  const handleConfirm = useCallback(
    async (stepId: SparrowStepId) => {
      if (!projectId) return;
      const step = getStep(stepId);
      if (!step) return;
      setSaving(stepId);
      try {
        await settingApi.saveSparrowStep({
          projectId,
          stepId,
          content: step.content,
          isComplete: true,
          doNotAskAgain: step.doNotAskAgain,
        });
        updateStepField(stepId, { isComplete: true });
        showToast(`「${step.label}」已保存`, 'success');
      } catch (e) {
        console.error('Failed to save sparrow step', e);
        showToast('保存失败', 'error');
      } finally {
        setSaving(null);
      }
    },
    [projectId, getStep, updateStepField, showToast]
  );

  const handleReTrigger = useCallback(
    async (stepId: SparrowStepId) => {
      if (!projectId) return;
      const step = getStep(stepId);
      if (!step) return;
      setSaving(stepId);
      try {
        const result = await settingApi.generateSparrowAi({
          projectId,
          stepId,
        });
        updateStepField(stepId, {
          content: result.suggestedContent,
          aiGenerated: true,
        });
      } catch (e) {
        console.error('Failed to generate AI content', e);
        showToast('AI 生成失败', 'error');
      } finally {
        setSaving(null);
      }
    },
    [projectId, getStep, updateStepField, showToast]
  );

  // ── Protagonist step handlers ──

  const handleSaveProtagonistStep = useCallback(
    async (stepType: CharacterStep3['stepType'], description: string) => {
      if (!projectId) return;
      try {
        await settingApi.saveProtagonistStep({
          projectId,
          stepType,
          characterId: '',
          description,
          isUsable: protagonistSteps.find(s => s.stepType === stepType)?.isUsable ?? false,
        });
        setProtagonistSteps(prev => prev.map(s =>
          s.stepType === stepType ? { ...s, description } : s
        ));
        showToast('角色设定已保存', 'success');
      } catch (e) {
        console.error('Failed to save protagonist step', e);
        showToast('保存失败', 'error');
      }
    },
    [projectId, protagonistSteps, showToast]
  );

  const handleMarkUsable = useCallback(
    async (stepType: CharacterStep3['stepType'], isUsable: boolean) => {
      if (!projectId) return;
      try {
        await settingApi.markStepUsable({
          projectId,
          stepType,
          characterId: '',
          isUsable,
        });
        setProtagonistSteps(prev => prev.map(s =>
          s.stepType === stepType ? { ...s, isUsable } : s
        ));
      } catch (e) {
        console.error('Failed to mark step usable', e);
      }
    },
    [projectId]
  );

  // ── Tian-Di-Ren handlers ──

  const handleSaveTianDiRen = useCallback(
    async (tian: string, di: string, ren: string) => {
      if (!projectId) return;
      await settingApi.saveTianDiRenLayer({ projectId, tian, di, ren });
      setTianDiRen(prev => prev ? { ...prev, tian, di, ren } : { tian, di, ren, isExpanded: true });
      showToast('视角已保存', 'success');
    },
    [projectId, showToast]
  );

  const handleAiGenerateTianDiRen = useCallback(
    async (field: 'tian' | 'di' | 'ren'): Promise<string> => {
      if (!projectId) return '';
      try {
        const result = await settingApi.generateTianDiRenAi({ projectId, field });
        return result?.suggestedContent || '';
      } catch (e) {
        console.error('AI generation failed for TianDiRen', e);
        showToast('AI 生成失败', 'error');
        return '';
      }
    },
    [projectId, showToast]
  );

  // ── All expand/collapse toggle ──

  const handleToggleAll = useCallback(() => {
    const newExpanded = !allExpanded;
    setAllExpanded(newExpanded);
    setSteps(prev => prev.map(s => ({ ...s, isExpanded: newExpanded })));
  }, [allExpanded]);

  // ── Render ──

  if (loading) {
    return <EmptyState title="加载中..." />;
  }

  if (!projectId) {
    return <EmptyState title="请先创建项目" />;
  }

  const completedCount = steps.filter(s => s.isComplete).length;

  return (
    <div className="sparrow-wrapper">
      {/* CN-INT-01: Upstream stale indicator */}
      <PipelineIndicator
        staleUpstreams={upstreamStatus.staleUpstreams}
        onRefresh={handleRefresh}
      />
      {/* Header */}
      <div className="sparrow-header">
        <div className="sparrow-header-title">
          世界观构建 · {completedCount}/{steps.length} 已完成
        </div>
        <button className="sparrow-toggle-all" onClick={handleToggleAll}>
          {allExpanded ? '全部收起' : '全部展开'}
        </button>
      </div>

      {/* 9 expanded steps */}
      {steps.map((step, index) => (
        <SparrowStepCard
          key={step.stepId}
          stepNumber={index + 1}
          stepId={step.stepId}
          label={step.label}
          content={step.content}
          isExpanded={step.isExpanded}
          isRequired={step.isRequired}
          isComplete={step.isComplete}
          aiGenerated={step.aiGenerated}
          doNotAskAgain={step.doNotAskAgain}
          loading={saving === step.stepId}
          onToggleExpand={() => handleToggleExpand(step.stepId)}
          onContentChange={(content) => handleContentChange(step.stepId, content)}
          onConfirm={() => handleConfirm(step.stepId)}
          onReTrigger={() => handleReTrigger(step.stepId)}
          onDoNotAskAgainChange={(v) => handleDoNotAskAgainChange(step.stepId, v)}
        />
      ))}

      {/* Protagonist 3 steps (collapsed) */}
      <SparrowProtagonistSteps
        steps={protagonistSteps}
        projectId={projectId}
        onSaveStep={handleSaveProtagonistStep}
        onMarkUsable={handleMarkUsable}
      />

      {/* Tian-Di-Ren Heaven/Earth/Human three-layer expansion */}
      <TianDiRenSection
        projectId={projectId}
        tianDiRen={tianDiRen}
        onSave={handleSaveTianDiRen}
        onAiGenerate={handleAiGenerateTianDiRen}
        loading={saving !== null}
      />
    </div>
  );
}
