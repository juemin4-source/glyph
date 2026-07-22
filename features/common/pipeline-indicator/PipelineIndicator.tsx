/**
 * PipelineIndicator — 画板上游变更指示器 (CN-INT-01)
 *
 * 当上游画板数据发生变更时（stale），显示橙色 "上游已更新" badge。
 * 点击 badge 触发 onRefresh 回调刷新当前画板数据。
 * 没有 stale 上游时不渲染（返回 null）。
 *
 * Props:
 * - staleUpstreams: 上游画板名称列表（含自然语言标签）
 * - onRefresh: 用户点击 badge 后的刷新回调
 *
 * 自然语言标签示例：
 *   [{ canvas: 'premise', label: '前提' }] → "上游已更新：前提"
 *   [{ canvas: 'premise', label: '前提' }, { canvas: 'structure', label: '大纲' }]
 *     → "上游已更新：前提、大纲"
 */
import React from 'react';
import type { UpstreamStaleEntry } from '../../../contracts/pipeline-integrator.contract';
import './pipeline-indicator.css';

interface PipelineIndicatorProps {
  staleUpstreams: UpstreamStaleEntry[];
  onRefresh: () => void;
}

export default function PipelineIndicator({
  staleUpstreams,
  onRefresh,
}: PipelineIndicatorProps) {
  if (!staleUpstreams || staleUpstreams.length === 0) {
    return null;
  }

  const label = staleUpstreams.map(u => u.label).join('、');
  const title = staleUpstreams.length === 1
    ? `上游（${label}）已更新，点击刷新`
    : `上游（${label}）已更新，点击刷新`;

  return (
    <div className="pipeline-indicator" title={title}>
      <span className="pipeline-indicator-icon">⟳</span>
      <button
        className="pipeline-indicator-badge"
        onClick={onRefresh}
        type="button"
      >
        上游已更新：{label}
      </button>
    </div>
  );
}
