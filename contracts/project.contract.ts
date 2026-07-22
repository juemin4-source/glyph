// PipelineState 类型定义
export type CanvasStage = 'premise' | 'structure' | 'setting' | 'packet' | 'text';
export type CanvasStatus = 'locked' | 'ready' | 'active' | 'done';

export interface PipelineState {
  projectId: string;
  currentStage: CanvasStage;
  canvasStages: CanvasStageState[];
  createdAt: number;
  updatedAt: number;
}

export interface CanvasStageState {
  stage: CanvasStage;
  status: CanvasStatus;
}
