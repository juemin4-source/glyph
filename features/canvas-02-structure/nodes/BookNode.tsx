/**
 * BookNode — L1 (Book) custom @xyflow node for StructureGraph.
 * Largest, most prominent node with golden accent.
 */
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const COLOR = '#FFD700';
const BG_COLOR = 'rgba(255, 215, 0, 0.08)';

function BookNode({ data, selected }: NodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Top} className="c2-node-handle" style={{ background: COLOR }} />
      <div
        className="c2-node-container c2-node-book"
        style={{
          borderColor: selected ? '#fff' : COLOR,
          boxShadow: selected ? `0 0 20px ${COLOR}44, 0 4px 12px rgba(0,0,0,0.4)` : '0 4px 12px rgba(0,0,0,0.3)',
          background: BG_COLOR,
          minWidth: 180,
        }}
      >
        <div className="c2-node-layer-badge" style={{ background: COLOR, color: '#1a1a2e' }}>作品</div>
        <div className="c2-node-title" style={{ fontSize: '1.1rem' }}>{String(data.title || '未命名作品')}</div>
        {!!data.summary && <div className="c2-node-summary">{String(data.summary)}</div>}
        <div className="c2-node-child-count">{String(data.childCount ?? 0)} 个始位</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="c2-node-handle" style={{ background: COLOR }} />
    </>
  );
}

export default memo(BookNode);
