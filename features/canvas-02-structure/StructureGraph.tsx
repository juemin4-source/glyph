/**
 * StructureGraph — 画板② 结构图 L1-L4 层级导航 (织梦机 v2.1.0)
 *
 * Single ReactFlow instance with node filtering (per spike recommendation).
 * Implements zoom-to-layer navigation, breadcrumb trail, layer state retention.
 * Replaces the previous StructureFlowView.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  useNodesState,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type Viewport,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useProjectStore } from '../../stores/projectStore';
import { confirmStructure } from '../../stores/pipeline-helper';
import * as structureApi from '../../api/structureApi';
import * as chapterPacketApi from '../../api/chapterPacketApi';
import type { Canvas2NodeRecord, LayerType } from '../../contracts/structure.contract';
import { Button, EmptyState } from '../../components/ui';
import { useToast } from '../../components/Toast';
import BookNode from './nodes/BookNode';
import ShiweiNode from './nodes/ShiweiNode';
import HouNode from './nodes/HouNode';
import ZhangNode from './nodes/ZhangNode';
import StructureBreadcrumb, { type BreadcrumbSegment } from './StructureBreadcrumb';
import NodeDetailSidebar from './NodeDetailSidebar';

// ===== Constants =====

const CHILD_LAYER: Record<LayerType, LayerType | null> = {
  book: 'shiwei',
  shiwei: 'hou',
  hou: 'zhang',
  zhang: null,
};

const PARENT_LAYER: Record<LayerType, LayerType | null> = {
  book: null,
  shiwei: 'book',
  hou: 'shiwei',
  zhang: 'hou',
};

const CHILD_LABELS: Record<LayerType, string> = {
  book: '始位',
  shiwei: '后',
  hou: '章',
  zhang: '场景',
};

// Custom node types — must be stable reference
const nodeTypes = {
  bookNode: BookNode,
  shiweiNode: ShiweiNode,
  houNode: HouNode,
  zhangNode: ZhangNode,
};

// ===== Helpers =====

function getNodeType(layerType: LayerType): string {
  return `${layerType}Node` as const;
}

function computeChildLayer(layerType: LayerType): LayerType | null {
  return CHILD_LAYER[layerType];
}

// ===== Component =====

export default function StructureGraph() {
  const projectId = useProjectStore(s => s.currentProjectId);
  const reactFlowInstance = useReactFlow();
  const { showToast } = useToast();

  // Data
  const [allNodes, setAllNodes] = useState<Canvas2NodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Navigation state
  const [currentLayer, setCurrentLayer] = useState<LayerType>('book');
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [navStack, setNavStack] = useState<BreadcrumbSegment[]>([]);

  // Selection
  const [selectedNode, setSelectedNode] = useState<Canvas2NodeRecord | null>(null);

  // Layer state cache (viewport per layer)
  const layerViewportCache = useRef<Record<string, Viewport>>({});

  // ReactFlow nodes state
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);

  // ===== Compute visible nodes based on navigation =====

  const visibleNodes = useMemo(() => {
    if (!allNodes.length) return [];

    switch (currentLayer) {
      case 'book': {
        // Show only the root book node
        return allNodes.filter(n => n.layerType === 'book').slice(0, 1);
      }
      case 'shiwei': {
        // Show book + all its shiwei children
        const book = allNodes.find(n => n.layerType === 'book');
        if (!book) return allNodes.filter(n => n.layerType === 'shiwei');
        return allNodes.filter(n => n.id === book.id || n.parentId === book.id);
      }
      case 'hou': {
        // Show focused shiwei + its hou children
        if (!focusNodeId) return [];
        const parent = allNodes.find(n => n.id === focusNodeId);
        if (!parent) return [];
        return [parent, ...allNodes.filter(n => n.parentId === focusNodeId)];
      }
      case 'zhang': {
        // Show focused hou + its zhang children
        if (!focusNodeId) return [];
        const parent = allNodes.find(n => n.id === focusNodeId);
        if (!parent) return [];
        return [parent, ...allNodes.filter(n => n.parentId === focusNodeId)];
      }
      default:
        return [];
    }
  }, [currentLayer, focusNodeId, allNodes]);

  // ===== Sync visible nodes to ReactFlow =====

  useEffect(() => {
    const flowNodes: Node[] = visibleNodes.map(sn => ({
      id: sn.id,
      type: getNodeType(sn.layerType),
      position: { x: sn.positionX, y: sn.positionY },
      data: {
        ...sn,
        childCount: allNodes.filter(n => n.parentId === sn.id).length,
      },
    }));
    setRfNodes(flowNodes);
  }, [visibleNodes, allNodes, setRfNodes]);

  // ===== Edges derived from parentId =====

  const edges: Edge[] = useMemo(
    () =>
      visibleNodes
        .filter(n => n.parentId)
        .map(n => ({
          id: `e-${n.parentId}-${n.id}`,
          source: n.parentId as string,
          target: n.id,
          type: 'smoothstep' as const,
          style: { stroke: '#555', strokeWidth: 2 },
        })),
    [visibleNodes],
  );

  // ===== Load / Init =====

  const loadStructure = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const tree = await structureApi.getCanvas2StructureTree(projectId);
      let nodes = tree.nodes;

      // If no nodes exist, auto-generate default structure
      if (nodes.length === 0) {
        const genResult = await structureApi.aiGenerateStructure(projectId);
        if (genResult.success) {
          nodes = genResult.nodes;
        }
      }

      setAllNodes(nodes);

      // Set initial navigation to L1 (book)
      const book = nodes.find(n => n.layerType === 'book');
      if (book) {
        setCurrentLayer('book');
        setFocusNodeId(book.id);
        setNavStack([{ type: 'book', nodeId: book.id, label: book.title }]);
      } else if (nodes.length > 0) {
        // No book node, show the first node
        setCurrentLayer(nodes[0].layerType);
        setFocusNodeId(nodes[0].id);
        setNavStack([{ type: nodes[0].layerType, nodeId: nodes[0].id, label: nodes[0].title }]);
      }

      setInitialized(true);
    } catch (e) {
      console.error('[StructureGraph] Failed to load', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadStructure();
  }, [loadStructure]);

  // ===== Fit view on navigation change =====

  const prevNavRef = useRef<string>('');
  useEffect(() => {
    if (!rfNodes.length || !reactFlowInstance) return;

    const navKey = `${currentLayer}-${focusNodeId}`;
    if (navKey === prevNavRef.current) return;
    prevNavRef.current = navKey;

    // Save current viewport before navigating
    const currentVp = reactFlowInstance.getViewport();
    if (currentVp) {
      layerViewportCache.current[prevNavRef.current] = currentVp;
    }

    // Restore cached viewport for new layer, or fit view
    const cachedVp = layerViewportCache.current[navKey];
    if (cachedVp) {
      setTimeout(() => reactFlowInstance.setViewport(cachedVp, { duration: 200 }), 50);
    } else {
      setTimeout(() => reactFlowInstance.fitView({ padding: 0.2, duration: 300 }), 50);
    }
  }, [currentLayer, focusNodeId, rfNodes.length, reactFlowInstance]);

  // ===== Navigation =====

  const navigateToLayer = useCallback((
    targetLayer: LayerType,
    targetNodeId: string | null,
    label: string,
  ) => {
    // Save current viewport
    const prevKey = `${currentLayer}-${focusNodeId}`;
    const vp = reactFlowInstance?.getViewport();
    if (vp) layerViewportCache.current[prevKey] = vp;

    setCurrentLayer(targetLayer);
    setFocusNodeId(targetNodeId);
    setSelectedNode(null);

    if (targetLayer === 'book') {
      // Reset to root
      const book = allNodes.find(n => n.layerType === 'book');
      if (book) {
        setNavStack([{ type: 'book', nodeId: book.id, label: book.title }]);
      }
    } else {
      // Build new stack
      const currentStack = [...navStack];
      // Trim stack to the layer we're navigating to
      const layerIndex = ['book', 'shiwei', 'hou', 'zhang'].indexOf(targetLayer);
      if (layerIndex >= 0) {
        const trimmed = currentStack.slice(0, layerIndex);
        trimmed.push({ type: targetLayer, nodeId: targetNodeId, label });
        setNavStack(trimmed);
      }
    }
  }, [currentLayer, focusNodeId, allNodes, navStack, reactFlowInstance]);

  const handleNodeDoubleClick = useCallback(async (_: React.MouseEvent, node: Node) => {
    const record = allNodes.find(n => n.id === node.id);
    if (!record) return;

    const childLayer = computeChildLayer(record.layerType);

    if (childLayer) {
      // Non-leaf node — navigate to child layer (existing logic)
      const hasChildren = allNodes.some(n => n.parentId === record.id);
      if (!hasChildren) return;

      navigateToLayer(childLayer, record.id, record.title);
    } else {
      // L4 (Zhang) — leaf node → navigate to Canvas 4 (packet)
      try {
        const packet = await chapterPacketApi.getPacketByStructureNodeId({ structureNodeId: record.id });
        if (packet) {
          useProjectStore.getState().setStageNavigation('packet', packet.id);
        } else {
          showToast?.('还没有对应的细纲包，请先在画板④创建', 'info');
        }
      } catch (e) {
        console.error('[StructureGraph] Failed to find packet for L4 node', e);
        showToast?.('查找细纲包失败', 'error');
      }
    }
  }, [allNodes, navigateToLayer, showToast]);

  const handleBreadcrumbNavigate = useCallback((segment: BreadcrumbSegment) => {
    const targetLayer = segment.type;
    const targetNodeId = segment.nodeId;

    if (targetLayer === 'book') {
      const book = allNodes.find(n => n.layerType === 'book');
      if (book) {
        navigateToLayer('book', book.id, book.title);
      }
    } else {
      navigateToLayer(targetLayer, targetNodeId, segment.label);
    }
  }, [allNodes, navigateToLayer]);

  // ===== Selection =====

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const record = allNodes.find(n => n.id === node.id);
    if (record) setSelectedNode(record);
  }, [allNodes]);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // ===== Position Persistence =====

  const handleNodeDragEnd = useCallback(
    (_event: unknown, node: Node) => {
      if (!projectId) return;
      // Update local state
      setAllNodes(prev => prev.map(n =>
        n.id === node.id
          ? { ...n, positionX: Math.round(node.position.x), positionY: Math.round(node.position.y) }
          : n,
      ));
      // Persist to DB (fire-and-forget)
      structureApi.updateCanvas2NodePosition({
        id: node.id,
        positionX: Math.round(node.position.x),
        positionY: Math.round(node.position.y),
      }).catch(e => console.error('[StructureGraph] Failed to save position', e));
    },
    [projectId],
  );

  // ===== Node Operations =====

  const handleSaveNode = useCallback(async (input: Partial<Canvas2NodeRecord>) => {
    if (!projectId || !input.id) return;
    try {
      const existing = allNodes.find(n => n.id === input.id);
      if (!existing) return;

      const updated = await structureApi.saveCanvas2Node({
        id: input.id,
        projectId,
        parentId: existing.parentId,
        layerType: existing.layerType,
        title: input.title ?? existing.title,
        summary: input.summary ?? existing.summary,
        timePeriod: existing.timePeriod,
        chapterRange: existing.chapterRange,
        sceneCount: existing.sceneCount,
        wordCount: existing.wordCount,
        positionX: existing.positionX,
        positionY: existing.positionY,
        expanded: existing.expanded,
        sortOrder: existing.sortOrder,
      });

      setAllNodes(prev => prev.map(n => n.id === updated.id ? updated : n));
      setSelectedNode(updated);

      // Update nav stack label if needed
      setNavStack(prev => prev.map(s =>
        s.nodeId === updated.id ? { ...s, label: updated.title } : s,
      ));
    } catch (e) {
      console.error('[StructureGraph] Failed to save node', e);
    }
  }, [projectId, allNodes]);

  const handleDeleteNode = useCallback(async (id: string) => {
    if (!projectId) return;

    // Find all descendants
    const findDescendants = (parentId: string, acc: Set<string>) => {
      for (const n of allNodes) {
        if (n.parentId === parentId && !acc.has(n.id)) {
          acc.add(n.id);
          findDescendants(n.id, acc);
        }
      }
    };

    const ids = new Set<string>([id]);
    findDescendants(id, ids);

    try {
      for (const deleteId of [...ids].reverse()) {
        await structureApi.deleteCanvas2Node(deleteId);
      }
      setAllNodes(prev => prev.filter(n => !ids.has(n.id)));
      setSelectedNode(null);
    } catch (e) {
      console.error('[StructureGraph] Failed to delete node', e);
    }
  }, [projectId, allNodes]);

  const handleAddChild = useCallback(async (parentId: string) => {
    if (!projectId) return;
    const parent = allNodes.find(n => n.id === parentId);
    if (!parent) return;

    const childLayer = computeChildLayer(parent.layerType);
    if (!childLayer) return;

    const siblings = allNodes.filter(n => n.parentId === parentId);
    const sortOrder = siblings.length;
    const offset = siblings.length * 200 - 100;

    try {
      const child = await structureApi.saveCanvas2Node({
        projectId,
        parentId,
        layerType: childLayer,
        title: `新${CHILD_LABELS[parent.layerType]}`,
        summary: '',
        timePeriod: '',
        chapterRange: '',
        sceneCount: 0,
        wordCount: 0,
        positionX: parent.positionX + (siblings.length % 3 === 0 ? offset : 0),
        positionY: parent.positionY + 180,
        expanded: true,
        sortOrder,
      });
      setAllNodes(prev => [...prev, child]);
    } catch (e) {
      console.error('[StructureGraph] Failed to add child', e);
    }
  }, [projectId, allNodes]);

  const handleConfirm = useCallback(async () => {
    if (!projectId) return;
    try {
      await confirmStructure(projectId);
    } catch (e) {
      console.error('[StructureGraph] Failed to confirm structure', e);
    }
  }, [projectId]);

  // ===== Layer state for ready badge =====

  const hasL1L2 = useMemo(() => {
    const hasBook = allNodes.some(n => n.layerType === 'book');
    const hasShiwei = allNodes.some(n => n.layerType === 'shiwei');
    return hasBook && hasShiwei;
  }, [allNodes]);

  // ===== Render =====

  if (loading) {
    return <EmptyState title="加载结构图..." />;
  }

  if (allNodes.length === 0) {
    return (
      <div className="c2-empty">
        <EmptyState
          title="还没有结构节点"
          description="点击下方按钮自动生成默认结构（作品 + 三始位）"
          action={
            <Button variant="primary" size="lg" onClick={loadStructure}>
              生成默认结构
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="c2-wrapper">
      {/* Top bar: breadcrumb + actions */}
      <div className="c2-topbar">
        <StructureBreadcrumb
          segments={navStack}
          onNavigate={handleBreadcrumbNavigate}
        />
        <div className="c2-topbar-actions">
          {hasL1L2 && <span className="c2-ready-badge">结构就绪</span>}
          <Button variant="secondary" size="sm" onClick={loadStructure}>
            刷新
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirm}>
            确认结构 &#10003;
          </Button>
        </div>
      </div>

      <div className="c2-flex">
        <div className="c2-flow">
          <ReactFlow
            nodes={rfNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            onPaneClick={handlePaneClick}
            onNodeDrag={handleNodeDragEnd}
            fitView={false}
            colorMode="dark"
            minZoom={0.1}
            maxZoom={3}
            defaultEdgeOptions={{ style: { stroke: '#555', strokeWidth: 2 } }}
          >
            <Background color="#2a2a3a" gap={20} size={1} />
            <Controls showInteractive={false} />
            {allNodes.length < 500 && <MiniMap
              nodeColor={(n) => {
                const colors: Record<string, string> = {
                  bookNode: '#FFD700',
                  shiweiNode: '#4A9EFF',
                  houNode: '#22C55E',
                  zhangNode: '#CE93D8',
                };
                return n.type ? colors[n.type as keyof typeof colors] : '#555';
              }}
              style={{ background: '#1a1a2e' }}
            />}
          </ReactFlow>
        </div>

        {/* Sidebar */}
        <NodeDetailSidebar
          node={selectedNode}
          onSave={handleSaveNode}
          onDelete={handleDeleteNode}
          onAddChild={handleAddChild}
          onClose={() => setSelectedNode(null)}
        />
      </div>

      {/* Status bar */}
      <div className="c2-statusbar">
        <span className="c2-status-info">
          层级: {navStack.length}/4 &middot; 节点: {allNodes.length} &middot; 当前可见: {rfNodes.length}
        </span>
      </div>
    </div>
  );
}
