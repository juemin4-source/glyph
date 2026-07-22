/**
 * HouNode — L3 (Hou) custom @xyflow node for StructureGraph.
 * Medium node with green/teal accent.
 */
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const COLOR = '#22C55E';
const BG_COLOR = 'rgba(34, 197, 94, 0.08)';

function HouNode({ data, selected }: NodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Top} className="c2-node-handle" style={{ background: COLOR }} />
      <div
        className="c2-node-container c2-node-hou"
        style={{
          borderColor: selected ? '#fff' : COLOR,
          boxShadow: selected ? `0 0 14px ${COLOR}44, 0 2px 8px rgba(0,0,0,0.3)` : '0 2px 8px rgba(0,0,0,0.2)',
          background: BG_COLOR,
          minWidth: 130,
        }}
      >
        <div className="c2-node-layer-badge" style={{ background: COLOR, color: '#fff' }}>后</div>
        <div className="c2-node-title">{String(data.title || '未命名后')}</div>
        {!!data.chapterRange && <div className="c2-node-meta">章节: {String(data.chapterRange)}</div>}
        {!!data.summary && <div className="c2-node-summary">{String(data.summary)}</div>}
        <div className="c2-node-child-count">{String(data.childCount ?? 0)} 个章</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="c2-node-handle" style={{ background: COLOR }} />
    </>
  );
}

export default memo(HouNode);
