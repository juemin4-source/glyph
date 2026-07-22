/**
 * PacketRefinedView — 画板④ 精细润色模式视图
 *
 * All layers fully editable with extra features:
 * - Word count on narrative fields
 * - Timestamps per node
 * - Inline comments on nodes
 */

import React from 'react';
import type { WritingContract, ActiveContext, NarrativeCompression, ExecutionLayer } from '../../contracts/chapter-packet.contract';
import { Badge } from '../../components/ui';

interface PacketRefinedViewProps {
  layer1: WritingContract;
  layer2: ActiveContext;
  layer3: NarrativeCompression;
  layer4: ExecutionLayer;
  onLayer1Change: (value: WritingContract) => void;
  onLayer2Change: (value: ActiveContext) => void;
  onLayer3Change: (value: NarrativeCompression) => void;
  onLayer4Change: (value: ExecutionLayer) => void;
  editingSince?: number; // timestamp when editing started
}

// ── Timestamp helper ──

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Inline Comment ──

interface InlineCommentProps {
  text: string;
  onTextChange?: (text: string) => void;
}

function InlineComment({ text, onTextChange }: InlineCommentProps) {
  const [editing, setEditing] = React.useState(false);
  return (
    <div className="packet-refined-comment">
      {editing ? (
        <textarea
          className="packet-refined-comment-input"
          value={text}
          onChange={e => { onTextChange?.(e.target.value); }}
          onBlur={() => setEditing(false)}
          autoFocus
          rows={2}
          placeholder="添加注释..."
        />
      ) : (
        <span
          className="packet-refined-comment-text"
          onClick={() => onTextChange && setEditing(true)}
        >
          {text || '点击添加注释...'}
        </span>
      )}
    </div>
  );
}

// ── Word count display ──

function WordCount({ text }: { text: string }) {
  return (
    <span className="packet-refined-word-count">
      {text.length} 字
    </span>
  );
}

// ── Main Component ──

export default function PacketRefinedView({
  layer1,
  layer2,
  layer3,
  layer4,
  onLayer1Change,
  onLayer2Change,
  onLayer3Change,
  onLayer4Change,
  editingSince,
}: PacketRefinedViewProps) {
  return (
    <div className="packet-refined-view">
      {/* Editing timestamp */}
      {editingSince && (
        <div className="packet-refined-timestamp-bar">
          编辑开始于 {formatTimestamp(editingSince)}
        </div>
      )}

      {/* L1: Writing Contract */}
      <div className="packet-layer packet-layer-expanded">
        <div className="packet-layer-header" style={{ cursor: 'default' }}>
          <span className="packet-layer-arrow">▾</span>
          <span className="packet-layer-title">写作契约</span>
          <Badge variant="default">L1 · 可编辑</Badge>
        </div>
        <div className="packet-layer-body">
          <div className="packet-layer-fields">
            <div className="packet-field-row">
              <label className="packet-field-label">叙事距离</label>
              <select
                className="packet-refined-select"
                value={layer1.narrativeDistance}
                onChange={e => onLayer1Change({ ...layer1, narrativeDistance: e.target.value as WritingContract['narrativeDistance'] })}
              >
                <option value="close">近距</option>
                <option value="medium">中距</option>
                <option value="distant">远距</option>
              </select>
            </div>
            <InlineComment text="" />
          </div>
        </div>
      </div>

      {/* L2: Active Setting */}
      <div className="packet-layer packet-layer-expanded">
        <div className="packet-layer-header" style={{ cursor: 'default' }}>
          <span className="packet-layer-arrow">▾</span>
          <span className="packet-layer-title">活跃设定</span>
          <Badge variant="default">L2 · 可编辑</Badge>
        </div>
        <div className="packet-layer-body">
          <div className="packet-layer-fields">
            <div className="packet-field-row">
              <label className="packet-field-label">前情提要 <WordCount text={layer2.recap} /></label>
              <textarea
                className="packet-textarea"
                value={layer2.recap}
                onChange={e => onLayer2Change({ ...layer2, recap: e.target.value })}
                rows={3}
                placeholder="一句话前情提要..."
              />
            </div>
            <InlineComment text="" />
          </div>
        </div>
      </div>

      {/* L3: Narrative Compression */}
      <div className="packet-layer packet-layer-expanded">
        <div className="packet-layer-header" style={{ cursor: 'default' }}>
          <span className="packet-layer-arrow">▾</span>
          <span className="packet-layer-title">剧情压缩</span>
          <Badge variant="status">L3 · 可编辑</Badge>
        </div>
        <div className="packet-layer-body">
          <div className="packet-layer-fields">
            <div className="packet-field-row">
              <label className="packet-field-label">
                压缩叙事 <WordCount text={layer3.narrative} />
              </label>
              <textarea
                className="packet-textarea"
                value={layer3.narrative}
                onChange={e => onLayer3Change({ ...layer3, narrative: e.target.value })}
                rows={5}
                placeholder="用 80-250 字概括本章剧情..."
              />
            </div>

            <div className="packet-field-row">
              <label className="packet-field-label">释放信息</label>
              <textarea
                className="packet-textarea"
                value={layer3.releases.join('\n')}
                onChange={e => onLayer3Change({ ...layer3, releases: e.target.value.split('\n').filter(Boolean) })}
                rows={3}
                placeholder="每行一条释放信息"
              />
            </div>

            <InlineComment text="" />

            <div className="packet-field-row">
              <label className="packet-field-label">临时假设 ({layer3.assumptions.length})</label>
              <textarea
                className="packet-textarea packet-textarea-mono"
                value={JSON.stringify(layer3.assumptions, null, 2)}
                onChange={e => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    if (Array.isArray(parsed)) {
                      onLayer3Change({ ...layer3, assumptions: parsed });
                    }
                  } catch { /* ignore */ }
                }}
                rows={4}
              />
            </div>
          </div>
        </div>
      </div>

      {/* L4: Execution Layer - fully editable */}
      <div className="packet-layer packet-layer-expanded">
        <div className="packet-layer-header" style={{ cursor: 'default' }}>
          <span className="packet-layer-arrow">▾</span>
          <span className="packet-layer-title">执行层</span>
          <Badge variant="canon">L4 · 可编辑</Badge>
        </div>
        <div className="packet-layer-body">
          <div className="packet-layer-fields">
            <div className="packet-field-row">
              <label className="packet-field-label">场景 JSON <WordCount text={JSON.stringify(layer4.scenes, null, 2)} /></label>
              <textarea
                className="packet-textarea packet-textarea-mono"
                value={JSON.stringify(layer4.scenes, null, 2)}
                onChange={e => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    if (Array.isArray(parsed)) {
                      onLayer4Change({ ...layer4, scenes: parsed });
                    }
                  } catch { /* ignore */ }
                }}
                rows={8}
              />
            </div>

            <div className="packet-field-row">
              <label className="packet-field-label">执行禁忌</label>
              <textarea
                className="packet-textarea"
                value={layer4.taboos.join('\n')}
                onChange={e => onLayer4Change({ ...layer4, taboos: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                rows={3}
                placeholder="每行一条"
              />
            </div>

            <InlineComment text="" />
          </div>
        </div>
      </div>

      {/* Timestamp footer */}
      {editingSince && (
        <div className="packet-refined-timestamp-footer">
          最后编辑: {formatTimestamp(Date.now())}
        </div>
      )}
    </div>
  );
}
