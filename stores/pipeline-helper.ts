import { useProjectStore } from './projectStore';
import { savePipelineState } from '../api/projectApi';

export async function confirmPremise(projectId: string): Promise<void> {
  const store = useProjectStore.getState();
  const prev = store.canvasStages;
  const updatedStages = prev.map(s => ({
    ...s,
    status: s.stage === 'premise' ? 'done' as const
           : s.stage === 'structure' ? 'active' as const
           : s.status as 'locked' | 'ready' | 'active' | 'done',
  }));
  const ps = await savePipelineState({
    projectId,
    currentStage: 'structure' as const,
    canvasStages: updatedStages,
    createdAt: 0,
    updatedAt: Date.now(),
  });
  store.setPipelineState(ps);
}

export async function confirmStructure(projectId: string): Promise<void> {
  const store = useProjectStore.getState();
  const prev = store.canvasStages;
  const updatedStages = prev.map(s => ({
    ...s,
    status: s.stage === 'structure' ? 'done' as const
           : s.stage === 'setting' ? 'active' as const
           : s.status as 'locked' | 'ready' | 'active' | 'done',
  }));
  const ps = await savePipelineState({
    projectId,
    currentStage: 'setting' as const,
    canvasStages: updatedStages,
    createdAt: 0,
    updatedAt: Date.now(),
  });
  store.setPipelineState(ps);
}

export async function confirmSetting(projectId: string): Promise<void> {
  const store = useProjectStore.getState();
  const prev = store.canvasStages;
  const updatedStages = prev.map(s => ({
    ...s,
    status: s.stage === 'setting' ? 'done' as const
           : s.stage === 'packet' ? 'active' as const
           : s.status as 'locked' | 'ready' | 'active' | 'done',
  }));
  const ps = await savePipelineState({
    projectId,
    currentStage: 'packet' as const,
    canvasStages: updatedStages,
    createdAt: 0,
    updatedAt: Date.now(),
  });
  store.setPipelineState(ps);
}

/**
 * confirmPacket — 推进画板④（packet）到 done，解锁画板⑤（text）为 active。
 * createdAt 不由前端传，后端 upsert 时不覆盖。
 */
export async function confirmPacket(projectId: string): Promise<void> {
  const store = useProjectStore.getState();
  const prev = store.canvasStages;
  const updatedStages = prev.map(s => ({
    ...s,
    status: s.stage === 'packet' ? 'done' as const
           : s.stage === 'text' ? 'active' as const
           : s.status as 'locked' | 'ready' | 'active' | 'done',
  }));
  const ps = await savePipelineState({
    projectId,
    currentStage: 'text' as const,
    canvasStages: updatedStages,
    createdAt: 0,
    updatedAt: Date.now(),
  });
  store.setPipelineState(ps);
}
