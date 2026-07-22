import { create } from 'zustand';
import type { PipelineState, CanvasStage, CanvasStatus } from '../contracts/project.contract';
import type {
  PipelineStatus,
  PipelineLink,
  UpstreamStatus,
  UpstreamStaleEntry,
} from '../contracts/pipeline-integrator.contract';
import {
  DEFAULT_PIPELINE_LINKS,
  UPSTREAM_DOWNSTREAM,
  STAGE_LABELS,
  createInitialUpstreamStatus,
} from '../contracts/pipeline-integrator.contract';

// ── State interface ──

interface ProjectState {
  // UI 运行时状态（不 persist）
  currentProjectId: string | null;
  currentStage: CanvasStage | null;
  canvasStages: { stage: CanvasStage; status: CanvasStatus }[];
  loading: boolean;
  error: string | null;

  // ── CN-INT-01: Pipeline integration state ──
  pipelineLinks: PipelineLink[];
  upstreamStatus: Record<CanvasStage, UpstreamStatus>;
  targetPacketId: string | null;

  // Actions - existing
  setProjectId: (id: string) => void;
  setPipelineState: (state: PipelineState) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;

  // Actions - CN-INT-01
  setUpstreamStatus: (canvas: CanvasStage, status: UpstreamStatus) => void;
  markStale: (upstreamCanvas: CanvasStage) => void;
  markRefreshed: (canvas: CanvasStage) => void;
  setStageNavigation: (stage: CanvasStage, packetId?: string) => void;
}

// ── Store ──

export const useProjectStore = create<ProjectState>((set) => ({
  currentProjectId: null,
  currentStage: null,
  canvasStages: [],
  loading: false,
  error: null,

  // ── CN-INT-01 initial state ──
  pipelineLinks: DEFAULT_PIPELINE_LINKS,
  upstreamStatus: createInitialUpstreamStatus(),
  targetPacketId: null,

  // ── Existing actions ──

  setProjectId: (id) => set({ currentProjectId: id }),
  setPipelineState: (state) => set({
    currentStage: state.currentStage as CanvasStage,
    canvasStages: state.canvasStages.map(cs => ({
      stage: cs.stage as CanvasStage,
      status: cs.status as CanvasStatus,
    })),
  }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () => set({
    currentProjectId: null,
    currentStage: null,
    canvasStages: [],
    loading: false,
    error: null,
    pipelineLinks: DEFAULT_PIPELINE_LINKS,
    upstreamStatus: createInitialUpstreamStatus(),
    targetPacketId: null,
  }),

  // ── CN-INT-01 actions ──

  /**
   * Replace the full UpstreamStatus for a given canvas (e.g. on initial backend load).
   */
  setUpstreamStatus: (canvas, status) => set(state => ({
    upstreamStatus: { ...state.upstreamStatus, [canvas]: status },
  })),

  /**
   * Mark all downstream canvases of `upstreamCanvas` as stale.
   * Called when upstream data has been saved/updated.
   */
  markStale: (upstreamCanvas) => set(state => {
    const downstreams = UPSTREAM_DOWNSTREAM[upstreamCanvas];
    if (!downstreams || downstreams.length === 0) return state;

    const label = STAGE_LABELS[upstreamCanvas] || upstreamCanvas;
    const newUpstreamStatus = { ...state.upstreamStatus };
    let changed = false;

    for (const target of downstreams) {
      const current = newUpstreamStatus[target];
      const alreadyStale = current.staleUpstreams.some(u => u.canvas === upstreamCanvas);
      const newStaleUpstreams: UpstreamStaleEntry[] = alreadyStale
        ? current.staleUpstreams
        : [...current.staleUpstreams, { canvas: upstreamCanvas, label }];

      newUpstreamStatus[target] = {
        ...current,
        status: 'stale',
        staleUpstreams: newStaleUpstreams,
      };
      changed = true;
    }

    return changed ? { upstreamStatus: newUpstreamStatus } : state;
  }),

  /**
   * Clear stale status for a canvas after the user refreshes its data.
   */
  markRefreshed: (canvas) => set(state => ({
    upstreamStatus: {
      ...state.upstreamStatus,
      [canvas]: {
        ...state.upstreamStatus[canvas],
        status: 'up-to-date',
        staleUpstreams: [],
        lastRefreshAt: Date.now(),
      },
    },
  })),

  /**
   * Navigate to a specific stage, optionally targeting a packet (for T-003).
   */
  setStageNavigation: (stage, packetId) => set({
    currentStage: stage,
    targetPacketId: packetId ?? null,
  }),
}));
