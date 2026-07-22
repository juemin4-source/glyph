/**
 * ShiweiNode — L2 (Shiwei) custom @xyflow node for StructureGraph.
 * Medium-large node with blue accent.
 */
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const COLOR = '#4A9EFF';
const BG_COLOR = 'rgba(74, 158, 255, 0.08)';

function ShiweiNode({ data, selected }: NodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Top} className="c2-node-handle" style={{ background: COLOR }} />
      <div
        className="c2-node-container c2-node-shiwei"
        style={{
          borderColor: selected ? '#fff' : COLOR,
          boxShadow: selected ? `0 0 16px ${COLOR}44, 0 3px 10px rgba(0,0,0,0.35)` : '0 3px 10px rgba(0,0,0,0.25)',
          background: BG_COLOR,
          minWidth: 150,
        }}
      >
        <div className="c2-node-layer-badge" style={{ background: COLOR, color: '#fff' }}>始位</div>
        <div className="c2-node-title">{String(data.title || '未命名始位')}</div>
        {!!data.timePeriod && <div className="c2-node-meta">时期: {String(data.timePeriod)}</div>}
        {!!data.summary && <div className="c2-node-summary">{String(data.summary)}</div>}
        <div className="c2-node-child-count">{String(data.childCount ?? 0)} 个后</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="c2-node-handle" style={{ background: COLOR }} />
    </>
  );
}

export default memo(ShiweiNode);
