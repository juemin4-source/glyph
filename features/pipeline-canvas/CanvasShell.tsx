/**
 * CanvasShell — 通用画板外壳 (织梦机 v2)
 *
 * Wraps each stage's content with a consistent status-based UI.
 * locked → EmptyState with grey hint
 * ready → EmptyState with "就绪" message + action button
 * active → renders children
 * done → green confirmation + children
 */

import React from 'react';
import { Button, EmptyState } from '../../components/ui';
import './canvas-shell.css';

type CanvasStatus = 'locked' | 'ready' | 'active' | 'done';

interface CanvasShellProps {
  stage: string;
  status: CanvasStatus;
  children?: React.ReactNode;
  onStageClick?: (stage: string) => void;
}

const STAGE_NAMES: Record<string, string> = {
  premise: '前提',
  structure: '大纲',
  setting: '设定',
  packet: '细纲',
  text: '正文',
};

const STATUS_MESSAGES: Record<string, { icon: string; title: string; desc: string }> = {
  locked: {
    icon: '\u{1F512}',
    title: '尚未开放',
    desc: '请先完成前置画板的内容，本画板将自动解锁。',
  },
  ready: {
    icon: '○',
    title: '就绪',
    desc: '该画板已准备就绪，可以开始创作。',
  },
  active: {
    icon: '▷',
    title: '进行中',
    desc: '',
  },
  done: {
    icon: '✅',
    title: '已完成',
    desc: '该画板的所有内容已完成。',
  },
};

export default function CanvasShell({ stage, status, children, onStageClick }: CanvasShellProps) {
  const stageName = STAGE_NAMES[stage] || stage;
  const msg = STATUS_MESSAGES[status] || STATUS_MESSAGES.locked;

  if (status === 'locked') {
    return (
      <div className="canvas-shell">
        <EmptyState
          title={`${stageName} — ${msg.title}`}
          description={msg.desc}
          icon={<span>{msg.icon}</span>}
        />
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div className="canvas-shell">
        <EmptyState
          title={`${stageName} — ${msg.title}`}
          description={msg.desc}
          icon={<span>{msg.icon}</span>}
          action={
            onStageClick && (
              <Button variant="primary" onClick={() => onStageClick(stage)}>
                进入 {stageName}
              </Button>
            )
          }
        />
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="canvas-shell">
        <div className="canvas-shell-done-banner">
          {msg.icon} {stageName} — {msg.title}
        </div>
        <div className="canvas-shell-content-padded">
          {children}
        </div>
      </div>
    );
  }

  // active — render children
  return (
    <div className="canvas-shell">
      <div className="canvas-shell-content">
        {children}
      </div>
    </div>
  );
}
