/**
 * ZhangNode — L4 (Zhang) custom @xyflow node for StructureGraph.
 * Smallest, densest node with purple accent.
 */
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const COLOR = '#CE93D8';
const BG_COLOR = 'rgba(206, 147, 216, 0.08)';

function ZhangNode({ data, selected }: NodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Top} className="c2-node-handle" style={{ background: COLOR }} />
      <div
        className="c2-node-container c2-node-zhang"
        style={{
          borderColor: selected ? '#fff' : COLOR,
          boxShadow: selected ? `0 0 10px ${COLOR}44, 0 2px 6px rgba(0,0,0,0.25)` : '0 2px 6px rgba(0,0,0,0.15)',
          background: BG_COLOR,
          minWidth: 110,
          padding: '6px 10px',
        }}
      >
        <div className="c2-node-layer-badge" style={{ background: COLOR, color: '#1a1a2e', fontSize: '0.55rem' }}>章</div>
        <div className="c2-node-title" style={{ fontSize: '0.8rem' }}>{String(data.title || '未命名章')}</div>
        <div className="c2-node-meta" style={{ fontSize: '0.65rem' }}>
          {String(data.sceneCount ?? 0)} 场 · {String(data.wordCount ?? 0)} 字
        </div>
        {!!data.summary && <div className="c2-node-summary" style={{ fontSize: '0.65rem' }}>{String(data.summary)}</div>}
      </div>
      <Handle type="source" position={Position.Bottom} className="c2-node-handle" style={{ background: COLOR }} />
    </>
  );
}

export default memo(ZhangNode);
