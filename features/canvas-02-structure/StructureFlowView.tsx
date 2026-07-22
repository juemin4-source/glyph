/**
 * StructureFlowView — 画板② 结构图 (织梦机 v2.1.0)
 *
 * Updated to use the new StructureGraph L1-L4 hierarchy view.
 * Replaces the previous single-node-type ReactFlow implementation.
 * Backward compatible — existing structure_nodes table data is preserved
 * for chapter packet references.
 */
import { ReactFlowProvider } from '@xyflow/react';
import StructureGraph from './StructureGraph';

export default function StructureFlowView() {
  return (
    <ReactFlowProvider>
      <StructureGraph />
    </ReactFlowProvider>
  );
}
