/**
 * useUpstreamDetection — 上游变更检测钩子 (CN-INT-01)
 *
 * 通过轮询后端时间戳 API 检测上游画板数据的变更。
 * 检测到变更时自动调用 store.markStale() 标记下游画板为 stale。
 *
 * 简化版：不依赖事件系统，通过定时器轮询比较时间戳。
 * 后端时间戳 API 由 T-004 实现；API 函数调用失败时（invoke 不可用）静默忽略。
 *
 * 使用方式：
 * ```tsx
 * const projectId = useProjectStore(s => s.currentProjectId);
 * useUpstreamDetection(projectId);
 * ```
 *
 * @param projectId  当前项目 ID，为 null 时跳过检测
 * @param pollIntervalMs  轮询间隔（默认 5000ms）
 */
import { useEffect, useRef } from 'react';
import { useProjectStore } from '../stores/projectStore';
import * as premiseApi from '../api/premiseApi';
import * as structureApi from '../api/structureApi';
import * as settingApi from '../api/settingApi';
import * as chapterPacketApi from '../api/chapterPacketApi';
import type { CanvasStage } from '../contracts/project.contract';

// ── Types ──

interface TimestampRecord {
  premise: number;
  structure: number;
  setting: number;
  packet: number;
  text: number;
}

const DEFAULT_INTERVAL = 5000;

// ── Hook ──

export function useUpstreamDetection(
  projectId: string | null,
  pollIntervalMs: number = DEFAULT_INTERVAL,
): void {
  const markStale = useProjectStore(s => s.markStale);
  const lastTimestamps = useRef<TimestampRecord>({
    premise: 0,
    structure: 0,
    setting: 0,
    packet: 0,
    text: 0,
  });

  useEffect(() => {
    if (!projectId) return;

    let isCancelled = false;

    /**
     * Check a single upstream canvas by calling its timestamp API.
     * If the timestamp changed since last check, mark it stale.
     */
    const checkCanvas = async (canvas: CanvasStage, fetcher: () => Promise<number>) => {
      try {
        const ts = await fetcher();
        if (isCancelled) return;

        const prev = lastTimestamps.current[canvas];
        if (prev !== 0 && ts !== prev) {
          lastTimestamps.current[canvas] = ts;
          markStale(canvas);
        } else if (prev === 0 && ts > 0) {
          // First successful fetch — just store the timestamp, don't mark stale
          lastTimestamps.current[canvas] = ts;
        }
      } catch {
        // Backend invoke not available (T-004 will implement) — skip silently
      }
    };

    /**
     * Poll all upstream canvases.
     */
    const tick = async () => {
      if (!projectId || isCancelled) return;

      await Promise.all([
        checkCanvas('premise', () => premiseApi.getPremiseUpdatedAt(projectId)),
        checkCanvas('structure', () => structureApi.getStructureUpdatedAt(projectId)),
        checkCanvas('setting', () => settingApi.getSparrowLastSavedAt(projectId)),
        checkCanvas('packet', () => chapterPacketApi.getPacketsUpdatedAt(projectId)),
      ]);
    };

    // Initial load of timestamps
    tick();

    // Periodic polling
    const intervalId = setInterval(tick, pollIntervalMs);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [projectId, markStale, pollIntervalMs]);
}
