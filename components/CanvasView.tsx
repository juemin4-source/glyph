import { useState, useMemo, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { WorldObject, Connection, CanvasTab, CanvasTabState, CanvasToolMode, StickyNote, CanvasNodePosition, ObjectType, ConnectionType } from '../types/world';
import { STATUS_DISPLAY, CONNECTION_TYPES, CANVAS_TABS } from '../types/world';
import { TEMPLATES } from '../data/seed';
import ZoomControls from './ZoomControls';
import { ArrowRight, FileText, Calendar, Puzzle, Link } from 'lucide-react';

interface TextAnnotation { id: string; text: string; x: number; y: number; }
interface PartitionZone { id: string; label: string; x: number; y: number; width: number; height: number; }

interface ToolDef { mode: CanvasToolMode; icon: ReactNode; label: string; shortcut?: string; }

const SIDEBAR_TOOLS: ToolDef[] = [
  { mode: 'select', icon: '↖', label: '选择', shortcut: 'V' },
  { mode: 'drag', icon: '✋', label: '拖动画布', shortcut: 'H' },
  { mode: 'addObject', icon: '▦', label: '对象卡' },
  { mode: 'text', icon: 'T', label: '文本' },
  { mode: 'addSticky', icon: '📝', label: '便签' },
  { mode: 'addConnection', icon: <ArrowRight size={14} />, label: '连线' },
  { mode: 'partition', icon: '⊞', label: '分区' },
  { mode: 'template', icon: '◫', label: '模板' },
];

interface CanvasViewProps {
  allObjects: WorldObject[];
  connections: Connection[];
  canvasStates: Record<CanvasTab, CanvasTabState>;
  selectedObjectId: string | null;
  onSelectObject: (objectId: string | null) => void;
  onNavigate: (name: string) => void;
  onUpdateCanvasState: (tabId: CanvasTab, state: Partial<CanvasTabState>) => void;
  onAddConnection: (sourceId: string, targetId: string, type: ConnectionType, label: string) => void;
  onAddSticky: (tabId: CanvasTab, text: string) => void;
  onAddToBoard: (objectId: string, board: string) => void;
  onCreateObject: (templateType: ObjectType) => void;
  onCreateCanvasObject: (templateType: ObjectType, board: CanvasTab, x: number, y: number) => void;
}

const NODE_W = 130;
const NODE_H = 60;

function getNodeCenter(pos: CanvasNodePosition, w: number = NODE_W, h: number = NODE_H) {
  return { x: pos.x + w / 2, y: pos.y + h / 2 };
}

function makeConnectionPath(from: CanvasNodePosition, to: CanvasNodePosition): string {
  const f = getNodeCenter(from);
  const t = getNodeCenter(to);
  const dx = t.x - f.x;
  const dist = Math.sqrt(dx * dx + (t.y - f.y) ** 2);
  if (dist < 1) return '';
  return `M ${f.x} ${f.y} C ${f.x + dx * 0.4} ${f.y}, ${t.x - dx * 0.4} ${t.y}, ${t.x} ${t.y}`;
}

function getLabelPoint(from: CanvasNodePosition, to: CanvasNodePosition) {
  const f = getNodeCenter(from);
  const t = getNodeCenter(to);
  return { x: (f.x + t.x) / 2, y: (f.y + t.y) / 2 };
}

const STATUS_TO_ZONE: Record<string, string> = {
  '占位': '问题区', '草稿': '问题区', '待定': '候选方案区', '待验证': '待验证区', '锁定': '已锁定区', '废弃': '废弃区',
};

const DEDUCTION_ZONE_NAMES = ['问题区', '候选方案区', '已锁定区', '废弃区', '待验证区'];

const TIMELINE_EVENTS = [
  { name: '第一次背叛' },
  { name: '替换计划' },
  { name: '逃离' },
];

let _textId = 0, _zoneId = 0;

export default function CanvasView({
  allObjects, connections, canvasStates,
  selectedObjectId, onSelectObject, onNavigate,
  onUpdateCanvasState, onAddConnection, onAddSticky,
  onAddToBoard, onCreateObject, onCreateCanvasObject
}: CanvasViewProps) {
  const [activeTab, setActiveTab] = useState<CanvasTab>('角色关系图');
  const [toolMode, setToolMode] = useState<CanvasToolMode>('select');
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [connSource, setConnSource] = useState<string | null>(null);
  const [stickyText, setStickyText] = useState('');
  const [showStickyDialog, setShowStickyDialog] = useState(false);
  const [connDialog, setConnDialog] = useState<{ source: string; target: string } | null>(null);
  const [hoveredConn, setHoveredConn] = useState<string | null>(null);
  const [showObjectPool, setShowObjectPool] = useState(false);
  const [poolSearch, setPoolSearch] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; stickyId: string } | null>(null);
  const [textLabels, setTextLabels] = useState<TextAnnotation[]>([]);
  const [partitionZones, setPartitionZones] = useState<PartitionZone[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textInputPos, setTextInputPos] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const state = canvasStates[activeTab];
const scale = state?.scale ?? 1;

  const handleZoomChange = useCallback((newScale: number) => {
    onUpdateCanvasState(activeTab, { scale: newScale });
    }, [activeTab, onUpdateCanvasState]);
const nameToObj = useMemo(() => { const m = new Map<string, WorldObject>(); allObjects.forEach(o => m.set(o.name, o)); return m; }, [allObjects]);

  // Auto-position nodes
  useEffect(() => {
    const newPositions = { ...state.positions };
    let changed = false;
    if (activeTab === '角色关系图') {
      const objectsInBoard = allObjects.filter(o => o.selectedBoards.includes('角色关系图'));
      const cols = 3;
      objectsInBoard.forEach((obj, i) => {
        if (!newPositions[obj.id]) {
          newPositions[obj.id] = { objectId: obj.id, x: 60 + (i % cols) * 300, y: 40 + Math.floor(i / cols) * 200 };
          changed = true;
            }
      });
    } else if (activeTab === '时间线') {
      TIMELINE_EVENTS.forEach((evt, i) => {
        const obj = allObjects.find(o => o.name === evt.name);
        if (obj && !newPositions[obj.id]) { newPositions[obj.id] = { objectId: obj.id, x: 120 + i * 260, y: 100 }; changed = true; }
      });
    } else if (activeTab === '设定推演图') {
      const deductionObjects = allObjects.filter(o => o.selectedBoards.includes('设定推演图'));
      const zoneCounts: Record<string, number> = {};
      DEDUCTION_ZONE_NAMES.forEach(z => { zoneCounts[z] = 0; });
      const zoneLayout: Record<string, { x: number; y: number }> = { '问题区': { x: 30, y: 50 }, '候选方案区': { x: 430, y: 50 }, '已锁定区': { x: 30, y: 250 }, '废弃区': { x: 430, y: 250 }, '待验证区': { x: 30, y: 450 } };
      deductionObjects.forEach(obj => {
        if (!newPositions[obj.id]) {
          const zone = STATUS_TO_ZONE[obj.status] || '问题区';
          const base = zoneLayout[zone] || { x: 30, y: 50 };
          const count = zoneCounts[zone] || 0;
          newPositions[obj.id] = { objectId: obj.id, x: base.x + 10, y: base.y + count * 50 };
          zoneCounts[zone] = count + 1;
          changed = true;
        }
      });
    }
    if (changed) onUpdateCanvasState(activeTab, { positions: newPositions });
  }, [activeTab]);

  const canvasObjects = useMemo(() => {
    let objects = allObjects.filter(o => o.selectedBoards.includes(activeTab));
    if (activeTab === '时间线') {
      TIMELINE_EVENTS.forEach(evt => { const obj = nameToObj.get(evt.name); if (obj && !objects.find(o => o.id === obj.id)) objects = [...objects, obj]; });
    }
    return objects;
  }, [allObjects, activeTab, nameToObj]);

  const wordCount = useMemo(() => {
    return canvasObjects.reduce((sum, obj) => sum + obj.name.length + obj.type.length, 0);
  }, [canvasObjects]);

  const handleFitCanvas = useCallback(() => {
    if (canvasObjects.length === 0) { handleZoomChange(1); return; }
    handleZoomChange(1);
  }, [canvasObjects, handleZoomChange]);

  const displayConnections = useMemo(() => {
    return [...state.connections];
  }, [state.connections]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => { if (toolMode === 'drag') { setPanning(true); setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y }); } }, [toolMode, panOffset]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (panning) { setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y }); }
    if (draggingNode) {
      const pos = state.positions[draggingNode];
      if (pos) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const newX = e.clientX - dragOffset.x - rect.left + panOffset.x;
        const newY = e.clientY - dragOffset.y - rect.top + panOffset.y;
          onUpdateCanvasState(activeTab, { positions: { ...state.positions, [draggingNode]: { ...pos, x: activeTab === '时间线' ? newX : newX, y: activeTab === '时间线' ? pos.y : newY } } });
      }
    }
  }, [panning, draggingNode, dragOffset, state.positions, activeTab, panOffset, onUpdateCanvasState]);

  const handleCanvasMouseUp = useCallback(() => { setPanning(false); setDraggingNode(null); }, []);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, objectId: string) => {
    e.stopPropagation();
    if (toolMode === 'select') onSelectObject(objectId);
    if (toolMode === 'select' || toolMode === 'drag') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) { setDraggingNode(objectId); setDragOffset({ x: e.clientX - (state.positions[objectId]?.x || 0) - rect.left + panOffset.x, y: e.clientY - (state.positions[objectId]?.y || 0) - rect.top + panOffset.y }); }
    }
    if (toolMode === 'addConnection') {
      if (connSource === null) setConnSource(objectId);
      else if (connSource !== objectId) { setConnDialog({ source: connSource, target: objectId }); setConnSource(null); }
      else setConnSource(null);
    }
  }, [toolMode, connSource, state.positions, panOffset, onSelectObject]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (toolMode === 'addObject') { setShowObjectPool(true); setToolMode('select'); return; }
    if (toolMode === 'addSticky') { setShowStickyDialog(true); return; }
    if (toolMode === 'text') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTextInputPos({ x: e.clientX - rect.left + panOffset.x, y: e.clientY - rect.top + panOffset.y });
      setTextInput(''); setShowTextDialog(true); return;
    }
    if (toolMode === 'partition') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPartitionZones(prev => [...prev, { id: `zone_${_zoneId++}`, label: `分区 ${prev.length + 1}`, x: e.clientX - rect.left + panOffset.x - 100, y: e.clientY - rect.top + panOffset.y - 50, width: 200, height: 100 }]);
      return;
    }
    if (toolMode === 'template') { setShowTemplatePicker(true); setToolMode('select'); return; }
  }, [toolMode, panOffset]);

  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent) => {
    if (toolMode !== 'select') return;
    if (e.target !== canvasRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left + panOffset.x;
    const y = e.clientY - rect.top + panOffset.y;
    onCreateCanvasObject('事件', activeTab, x, y);
  }, [toolMode, panOffset, activeTab, onCreateCanvasObject]);

  const handleConfirmText = useCallback(() => { if (textInput.trim()) { setTextLabels(prev => [...prev, { id: `text_${_textId++}`, text: textInput.trim(), x: textInputPos.x, y: textInputPos.y }]); setTextInput(''); setShowTextDialog(false); } }, [textInput, textInputPos]);


  const handleConfirmSticky = useCallback(() => { if (stickyText.trim()) { onAddSticky(activeTab, stickyText.trim()); setStickyText(''); setShowStickyDialog(false); } }, [stickyText, activeTab, onAddSticky]);

  const handleConfirmConnection = useCallback((type: ConnectionType) => { if (connDialog) { onAddConnection(connDialog.source, connDialog.target, type, ''); setConnDialog(null); } }, [connDialog, onAddConnection]);

  const handleSelectFromPool = useCallback((obj: WorldObject) => {
    onAddToBoard(obj.id, activeTab);
    const cnt = Object.keys(state.positions).length;
    onUpdateCanvasState(activeTab, { positions: { ...state.positions, [obj.id]: { objectId: obj.id, x: 40 + (cnt % 3) * 180, y: 40 + Math.floor(cnt / 3) * 120 } } });
    setShowObjectPool(false); setPoolSearch('');
  }, [activeTab, onAddToBoard, onUpdateCanvasState, state.positions]);

  const availableForPool = useMemo(() => { const onCanvas = new Set(Object.keys(state.positions)); return allObjects.filter(o => !onCanvas.has(o.id)); }, [allObjects, state.positions]);

  const filteredPoolItems = useMemo(() => {
    if (!poolSearch.trim()) return availableForPool;
    const q = poolSearch.toLowerCase();
    return availableForPool.filter(o => o.name.toLowerCase().includes(q) || o.type.toLowerCase().includes(q) || o.tags.some(t => t.toLowerCase().includes(q)));
  }, [availableForPool, poolSearch]);

  const handleToolClick = useCallback((mode: CanvasToolMode) => {
    if (mode === 'template') { setShowTemplatePicker(true); return; }
    if (mode === 'addObject') { setShowObjectPool(true); return; }
    setToolMode(prev => prev === mode ? 'select' : mode);
  }, []);

  useEffect(() => { if (!showObjectPool) setPoolSearch(''); }, [showObjectPool]);
  useEffect(() => { if (!contextMenu) return; const h = () => setContextMenu(null); window.addEventListener('click', h); return () => window.removeEventListener('click', h); }, [contextMenu]);

  const renderConnections = () => {
    if (activeTab !== '角色关系图') return null;
    return <g>{displayConnections.map(conn => {
      const from = state.positions[conn.sourceId];
      const to = state.positions[conn.targetId];
      if (!from || !to) return null;
      const path = makeConnectionPath(from, to);
      const isHovered = hoveredConn === conn.id;
      const labelPt = getLabelPoint(from, to);
      return <g key={conn.id}>
        <path d={path} fill="none" stroke={isHovered ? '#1a73e8' : '#555'} strokeWidth={isHovered ? 2.5 : 1.5} strokeDasharray={conn.type === '冲突' ? '6,3' : conn.type === '替代' ? '3,3' : undefined} onMouseEnter={() => setHoveredConn(conn.id)} onMouseLeave={() => setHoveredConn(null)} style={{ cursor: 'pointer', transition: 'stroke 0.2s' }} />
        <g><rect x={labelPt.x - 30} y={labelPt.y - 10} width={60} height={20} rx={4} fill="#1e1e1e" fillOpacity={0.9} stroke={isHovered ? '#1a73e8' : '#444'} strokeWidth={0.5} />
          <text x={labelPt.x} y={labelPt.y + 4} textAnchor="middle" fontSize={11} fill={isHovered ? '#1a73e8' : '#aaa'} style={{ pointerEvents: 'none', fontWeight: isHovered ? 600 : 400 }}>{conn.label || conn.type}</text></g>
      </g>;
    })}</g>;
  };

  const renderNode = (obj: WorldObject) => {
    const pos = state.positions[obj.id];
    if (!pos) return null;
    const sd = STATUS_DISPLAY[obj.status];
    const isSelected = selectedObjectId === obj.id;
    const isConnSource = connSource === obj.id;
    const isTimeline = activeTab === '时间线';
    const isKeyEvent = isTimeline && (obj.name === '第一次背叛' || obj.name === '替换计划');
    const isDiscarded = obj.status === '废弃';

    if (isTimeline) {
      return <div key={obj.id} className="canvas-node" style={{
        position: 'absolute', left: pos.x - panOffset.x, top: pos.y - panOffset.y, width: 200, minHeight: 60,
        background: sd.background, border: sd.border, color: sd.text, borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer',
        boxShadow: isSelected ? '0 0 0 2px #1a73e8, 0 4px 16px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.2)', userSelect: 'none',
        opacity: isDiscarded ? 0.65 : 1, textDecoration: isDiscarded ? 'line-through' : 'none', zIndex: 10, ...(isKeyEvent ? { borderLeft: '4px solid #f44336' } : {}),
      }} onMouseDown={(e) => handleNodeMouseDown(e, obj.id)} onDoubleClick={() => onNavigate(obj.name)}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 1 }}>{obj.name}</div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>{isDiscarded ? '已废弃' : obj.type}</div>
      </div>;
    }

    return <div key={obj.id} className={`canvas-node ${isSelected ? 'selected' : ''}`} style={{
      ...{ border: sd.border, background: sd.background, color: sd.text, borderRadius: 8, padding: '8px 12px', position: 'absolute', cursor: 'pointer', minWidth: 100, maxWidth: 200, fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', userSelect: 'none' },
      left: pos.x - panOffset.x, top: pos.y - panOffset.y,
      opacity: isDiscarded ? 0.7 : 1,
      boxShadow: isConnSource ? '0 0 0 3px #FF9800, 0 4px 16px rgba(0,0,0,0.3)' : isSelected ? '0 0 0 2px #1a73e8, 0 4px 16px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.2)',
      textDecoration: isDiscarded ? 'line-through' : 'none',
    }} onMouseDown={(e) => handleNodeMouseDown(e, obj.id)} onDoubleClick={() => onNavigate(obj.name)}>
      <div className="node-name">{obj.name}</div>
      <div className="node-type">{obj.type}</div>
    </div>;
  };

  const renderTimelineFeatures = () => {
    if (activeTab !== '时间线') return null;
    const axisY = 55;
    const eventItems = TIMELINE_EVENTS.map(evt => { const obj = nameToObj.get(evt.name); if (!obj) return null; const pos = state.positions[obj.id]; if (!pos) return null; return { obj, pos }; }).filter(Boolean) as Array<{ obj: WorldObject; pos: CanvasNodePosition }>;
    if (eventItems.length === 0) return null;
    const mainEventIds = new Set(TIMELINE_EVENTS.map(evt => nameToObj.get(evt.name)?.id).filter(Boolean));
    const pendingObjects = canvasObjects.filter(o => !mainEventIds.has(o.id));

    return <>
      <svg className="canvas-svg" style={{ pointerEvents: 'none', overflow: 'visible' }}>
        <line x1={eventItems[0].pos.x + 100 - panOffset.x} y1={axisY} x2={eventItems[eventItems.length - 1].pos.x + 100 - panOffset.x} y2={axisY} stroke="#555" strokeWidth={2} strokeLinecap="round" />
        {eventItems.map(item => {
          const cx = item.pos.x + 100 - panOffset.x;
          const isKey = item.obj.name === '第一次背叛' || item.obj.name === '替换计划';
          return <g key={item.obj.id}>
            <line x1={cx} y1={axisY} x2={cx} y2={item.pos.y + 5 - panOffset.y} stroke="#444" strokeWidth={1} strokeDasharray="4,3" />
            <circle cx={cx} cy={axisY} r={isKey ? 6 : 4} fill={isKey ? '#f44336' : '#666'} stroke="#1e1e1e" strokeWidth={2} />
            {isKey && <text x={cx} y={axisY - 14} textAnchor="middle" fontSize={10} fill="#f44336" fontWeight={600}>关键转折</text>}
          </g>;
        })}
      </svg>
      <div style={{ position: 'absolute', left: 40 - panOffset.x, top: 220 - panOffset.y, width: 850, minHeight: 100, border: '2px dashed #333', borderRadius: 8, padding: 12, background: '#141414', pointerEvents: 'auto' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8 }}>待排事件区</div>
        {pendingObjects.length === 0 ? <div style={{ fontSize: 11, color: '#555', textAlign: 'center', padding: '12px 0' }}>暂无待排事件</div>
          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{pendingObjects.map(obj => (
            <div key={obj.id} style={{ padding: '4px 10px', background: STATUS_DISPLAY[obj.status].background, border: STATUS_DISPLAY[obj.status].border, color: STATUS_DISPLAY[obj.status].text, borderRadius: 4, fontSize: 11, cursor: 'pointer' }}
              onClick={() => onSelectObject(obj.id)} onDoubleClick={() => onNavigate(obj.name)}>{obj.name}</div>))}</div>}
      </div>
    </>;
  };

  const renderDeductionZones = () => {
    if (activeTab !== '设定推演图') return null;
    const zoneLayout: Record<string, { x: number; y: number; w: number; h: number }> = {
      '问题区': { x: 20, y: 20, w: 390, h: 180 }, '候选方案区': { x: 430, y: 20, w: 390, h: 180 },
      '已锁定区': { x: 20, y: 220, w: 390, h: 180 }, '废弃区': { x: 430, y: 220, w: 390, h: 180 },
      '待验证区': { x: 20, y: 420, w: 800, h: 140 },
    };
    const zoneObjects: Record<string, WorldObject[]> = {};
    DEDUCTION_ZONE_NAMES.forEach(z => { zoneObjects[z] = []; });
    allObjects.filter(o => o.selectedBoards.includes('设定推演图')).forEach(obj => { const zone = STATUS_TO_ZONE[obj.status] || '问题区'; if (!zoneObjects[zone]) zoneObjects[zone] = []; zoneObjects[zone].push(obj); });

    return <>{DEDUCTION_ZONE_NAMES.map(zoneName => {
      const layout = zoneLayout[zoneName];
      if (!layout) return null;
      const objects = zoneObjects[zoneName] || [];
      return <div key={zoneName} className="deduction-zone" style={{ position: 'absolute', left: layout.x - panOffset.x, top: layout.y - panOffset.y, width: layout.w, height: layout.h, border: '2px solid #333', borderRadius: 8, background: '#141414', overflowY: 'auto' }}>
        <div style={{ background: '#1e1e1e', padding: '5px 12px', fontSize: 13, fontWeight: 600, color: '#aaa', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{zoneName}</span><span style={{ fontWeight: 400, fontSize: 11, color: '#666' }}>{objects.length} 项</span>
        </div>
        <div style={{ padding: 6 }}>
          {objects.length === 0 ? <div style={{ fontSize: 11, color: '#555', textAlign: 'center', paddingTop: 20 }}>暂无</div>
            : objects.map(obj => (
              <div key={obj.id} style={{ padding: '5px 10px', marginBottom: 4, background: STATUS_DISPLAY[obj.status].background, border: STATUS_DISPLAY[obj.status].border, color: STATUS_DISPLAY[obj.status].text, borderRadius: 4, fontSize: 12, cursor: 'pointer', ...(obj.status === '废弃' ? { textDecoration: 'line-through', opacity: 0.7 } : {}) }}
                onClick={() => onSelectObject(obj.id)} onDoubleClick={() => onNavigate(obj.name)}>
                <div style={{ fontWeight: 500 }}>{obj.name}</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>{obj.type}{obj.status === '废弃' ? ' · 已废弃' : ''}</div>
              </div>
            ))}
        </div>
      </div>;
    })}</>;
  };

  return (
    <div className="canvas-view">
      <div className="canvas-tabs">
        {CANVAS_TABS.map(tab => (
          <button key={tab} className={`canvas-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => { setActiveTab(tab); setConnSource(null); }}>{tab}</button>
        ))}
      </div>
      <div className="canvas-body">
        <div className="canvas-sidebar" ref={sidebarRef}>
          {SIDEBAR_TOOLS.map(tool => {
            const isActive = toolMode === tool.mode;
            return <button key={tool.mode} className={`canvas-sb-btn ${isActive ? 'active' : ''}`} onClick={() => handleToolClick(tool.mode)} title={tool.label}>
              {tool.icon}<span className="sb-tooltip">{tool.label}{tool.shortcut ? ` (${tool.shortcut})` : ''}</span>
            </button>;
          })}
          <div className="canvas-sb-separator" />
          <button className="canvas-sb-btn" onClick={() => { onUpdateCanvasState(activeTab, { scale: 1, panX: 0, panY: 0 }); setPanOffset({ x: 0, y: 0 }); }} title="适应画布">⊞<span className="sb-tooltip">适应画布</span></button>
        </div>
        <div className="canvas-main">
          <div className="canvas-info-bar">
            <span>节点: {Object.keys(state.positions).length}</span><span>|</span><span>连线: {displayConnections.length}</span>
            {activeTab === '角色关系图' && toolMode === 'addConnection' && <><span>|</span><span style={{ color: '#FF9800' }}>{connSource ? '点击第二个节点建立连线' : '点击一个节点作为连线起点'}</span></>}
          </div>
          <div ref={canvasRef} className="canvas-container" onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp} onClick={handleCanvasClick} onDoubleClick={handleCanvasDoubleClick}
            style={{ cursor: toolMode === 'drag' ? 'grab' : toolMode === 'addConnection' && connSource ? 'crosshair' : toolMode === 'text' ? 'text' : toolMode === 'partition' ? 'crosshair' : 'default' }}>
            {activeTab === '角色关系图' && <svg className="canvas-svg">{renderConnections()}</svg>}
            {renderTimelineFeatures()}
            {renderDeductionZones()}

            {/* Partition zones */}
            {partitionZones.map(zone => (
              <div key={zone.id} className="partition-zone-box" style={{ left: zone.x - panOffset.x, top: zone.y - panOffset.y, width: zone.width, height: zone.height }}>
                <div className="partition-zone-label">{zone.label}</div>
              </div>
            ))}

            {/* Nodes */}
            {activeTab !== '设定推演图' && canvasObjects.map(obj => renderNode(obj))}

            {/* Text annotations */}
            {textLabels.map(label => (
              <div key={label.id} className="text-annotation" style={{ left: label.x - panOffset.x, top: label.y - panOffset.y }}>{label.text}</div>
            ))}

            {/* Sticky notes */}
            {state.stickyNotes.map(note => (
              <div key={note.id} className="canvas-sticky" style={{ left: note.x - panOffset.x, top: note.y - panOffset.y, width: note.width, height: note.height, background: note.color }}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, stickyId: note.id }); }}>{note.text}</div>
            ))}

            {canvasObjects.length === 0 && activeTab !== '时间线' && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: '#666' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
                <div style={{ fontSize: 14 }}>在文档视图中将对象「放入画板」</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {showStickyDialog && (
        <div className="canvas-overlay" onClick={() => setShowStickyDialog(false)}>
          <div className="canvas-overlay-panel" onClick={e => e.stopPropagation()}><h4>添加便签</h4>
            <textarea style={{ width: '100%', height: 80, padding: 8, border: '1px solid #333', borderRadius: 4, fontSize: 13, resize: 'vertical', background: '#0a0a0a', color: '#ccc' }} placeholder="便签内容..." value={stickyText} onChange={e => setStickyText(e.target.value)} autoFocus />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="tb-btn" onClick={() => setShowStickyDialog(false)}>取消</button>
              <button className="tb-btn primary" onClick={handleConfirmSticky}>添加</button>
            </div>
          </div>
        </div>
      )}

      <ZoomControls scale={scale} onZoomChange={handleZoomChange} onFitCanvas={handleFitCanvas} />

      <div className="canvas-status-bar" style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:28,padding:"0 12px",background:"var(--bg-header)",borderTop:"1px solid var(--border-default)",fontSize:'0.6875rem',color:"var(--text-muted)",flexShrink:0}}>
        <div className="canvas-status-left" style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#4CAF50",display:"inline-block"}}></span>
            已保存
          </span>
        </div>
        <div className="canvas-status-right" style={{display:"flex",alignItems:"center",gap:12,marginLeft:"auto"}}>
          <span>{wordCount} 字</span>
          <span>{Object.keys(state.positions).length} 节点</span>
        </div>
      </div>

      {showTextDialog && (
        <div className="canvas-overlay" onClick={() => setShowTextDialog(false)}>
          <div className="canvas-overlay-panel" onClick={e => e.stopPropagation()}><h4>添加文本</h4>
            <textarea style={{ width: '100%', height: 60, padding: 8, border: '1px solid #333', borderRadius: 4, fontSize: 13, resize: 'vertical', background: '#0a0a0a', color: '#ccc' }} placeholder="文本内容..." value={textInput} onChange={e => setTextInput(e.target.value)} autoFocus />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="tb-btn" onClick={() => setShowTextDialog(false)}>取消</button>
              <button className="tb-btn primary" onClick={handleConfirmText}>添加</button>
            </div>
          </div>
        </div>
      )}

      {showObjectPool && (
        <div className="canvas-overlay" onClick={() => { setShowObjectPool(false); setPoolSearch(''); }}>
          <div className="canvas-overlay-panel" onClick={e => e.stopPropagation()}>
            <h4>对象池 — 选择对象添加到画板</h4>
            <input className="pool-search" type="text" placeholder="搜索对象名称、类型、标签..." value={poolSearch} onChange={e => setPoolSearch(e.target.value)} autoFocus />
            <div className="pool-list">
              {filteredPoolItems.length === 0 ? (
                <div className="pool-empty">{poolSearch.trim() ? '无匹配对象' : '所有对象已在此画板中'}</div>
              ) : (
                filteredPoolItems.map(obj => (
                  <div key={obj.id} className="pool-item" onClick={() => handleSelectFromPool(obj)}>
                    <span className="pool-item-type">{obj.type}</span>
                    <span className="pool-item-name">{obj.name}</span>
                    <span style={{ fontSize: 10, color: '#888', background: '#1e1e1e', padding: '1px 5px', borderRadius: 3 }}>{obj.status}</span>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="tb-btn" onClick={() => { setShowObjectPool(false); setPoolSearch(''); }}>取消</button></div>
          </div>
        </div>
      )}

      {connDialog && (
        <div className="canvas-overlay" onClick={() => setConnDialog(null)}>
          <div className="canvas-overlay-panel" style={{ minWidth: 300 }} onClick={e => e.stopPropagation()}>
            <h4>选择连线类型</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CONNECTION_TYPES.map(type => (
                <button key={type} className="tb-btn" style={{ width: 'auto', padding: '6px 12px' }} onClick={() => handleConfirmConnection(type)}>{type}</button>
              ))}
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}><button className="tb-btn" onClick={() => setConnDialog(null)}>取消</button></div>
          </div>
        </div>
      )}

      {showTemplatePicker && (
        <div className="canvas-overlay" onClick={() => setShowTemplatePicker(false)}>
          <div className="canvas-overlay-panel" onClick={e => e.stopPropagation()}>
            <h4>选择画板模板</h4>
            <div className="template-grid">
              <div className="template-card" onClick={() => setShowTemplatePicker(false)}><div className="template-icon"><FileText size={20} /></div><div className="template-name">空白画板</div><div className="template-desc">从空白开始</div></div>
              <div className="template-card" onClick={() => { setShowTemplatePicker(false); setActiveTab('角色关系图'); }}><div className="template-icon"><Link size={20} /></div><div className="template-name">角色关系图</div><div className="template-desc">角色关系布局、连线</div></div>
              <div className="template-card" onClick={() => { setShowTemplatePicker(false); setActiveTab('时间线'); }}><div className="template-icon"><Calendar size={20} /></div><div className="template-name">时间线</div><div className="template-desc">横向时间轴布局</div></div>
              <div className="template-card" onClick={() => { setShowTemplatePicker(false); setActiveTab('设定推演图'); }}><div className="template-icon"><Puzzle size={20} /></div><div className="template-name">设定推演图</div><div className="template-desc">问题→方案→锁定 五区布局</div></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="tb-btn" onClick={() => setShowTemplatePicker(false)}>取消</button></div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div className="canvas-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          <button className="ctx-item" onClick={() => { onCreateObject('事件'); setContextMenu(null); }}>➜ 转为对象</button>
        </div>
      )}
    </div>
  );
}

