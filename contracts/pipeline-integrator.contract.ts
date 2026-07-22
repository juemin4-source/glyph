/**
 * pipeline-integrator.contract.ts — CN-INT-01
 *
 * Cross-canvas pipeline integration types.
 * Defines the dependency graph, stale detection, and navigation targets
 * for the five-canvas pipeline (premise → structure → setting → packet → text).
 */
import type { CanvasStage } from './project.contract';

// ── Pipeline Status ──

export type PipelineStatus = 'up-to-date' | 'stale' | 'updating';

// ── Canvas Link ──

export interface PipelineLink {
  sourceCanvas: CanvasStage;
  targetCanvas: CanvasStage;
  staleSince?: number;
}

// ── Upstream Status per Canvas ──

export interface UpstreamStaleEntry {
  canvas: CanvasStage;
  label: string;
}

export interface UpstreamStatus {
  canvas: CanvasStage;
  status: PipelineStatus;
  staleUpstreams: UpstreamStaleEntry[];
  lastRefreshAt: number;
}

// ── Labels (natural language, no methodology jargon) ──

export const STAGE_LABELS: Record<CanvasStage, string> = {
  premise: '前提',
  structure: '大纲',
  setting: '设定',
  packet: '细纲',
  text: '正文',
};

// ── Dependency Graph ──
//
// premise → structure, setting, packet
// structure → packet
// setting → text
// packet → text

/** Given an upstream canvas, which downstream canvases become stale. */
export const UPSTREAM_DOWNSTREAM: Record<CanvasStage, CanvasStage[]> = {
  premise: ['structure', 'setting', 'packet'],
  structure: ['packet'],
  setting: ['text'],
  packet: ['text'],
  text: [],
};

/** Given a canvas, which upstream canvases feed into it. */
export const CANVAS_DEPENDENCIES: Record<CanvasStage, CanvasStage[]> = {
  premise: [],
  structure: ['premise'],
  setting: ['premise'],
  packet: ['premise', 'structure'],
  text: ['setting', 'packet'],
};

/** Default set of pipeline links for the five-canvas layout. */
export const DEFAULT_PIPELINE_LINKS: PipelineLink[] = [
  { sourceCanvas: 'premise', targetCanvas: 'structure' },
  { sourceCanvas: 'premise', targetCanvas: 'setting' },
  { sourceCanvas: 'premise', targetCanvas: 'packet' },
  { sourceCanvas: 'structure', targetCanvas: 'packet' },
  { sourceCanvas: 'setting', targetCanvas: 'text' },
  { sourceCanvas: 'packet', targetCanvas: 'text' },
];

/** All canvas stages in pipeline order. */
export const ALL_CANVAS_STAGES: CanvasStage[] = [
  'premise',
  'structure',
  'setting',
  'packet',
  'text',
];

/** Create initial upstream status record (all up-to-date). */
export function createInitialUpstreamStatus(): Record<CanvasStage, UpstreamStatus> {
  const now = Date.now();
  return {
    premise:  { canvas: 'premise',  status: 'up-to-date', staleUpstreams: [], lastRefreshAt: now },
    structure:{ canvas: 'structure',status: 'up-to-date', staleUpstreams: [], lastRefreshAt: now },
    setting:  { canvas: 'setting',  status: 'up-to-date', staleUpstreams: [], lastRefreshAt: now },
    packet:   { canvas: 'packet',   status: 'up-to-date', staleUpstreams: [], lastRefreshAt: now },
    text:     { canvas: 'text',     status: 'up-to-date', staleUpstreams: [], lastRefreshAt: now },
  };
}
