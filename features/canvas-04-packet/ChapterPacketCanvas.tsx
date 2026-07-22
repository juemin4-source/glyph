/**
 * ChapterPacketCanvas — 画板④ 细纲包编辑器 (织梦机 v2 / Round C / T-003)
 *
 * Replaces PacketComingSoon with a full ChapterPacket editor.
 * Supports initialPacketId for canvas-2→canvas-4 navigation (T-003 Sub-A).
 * Integrates detailMode with AI generation (T-003 Sub-B).
 *
 * Architecture:
 * - Reads projectId from projectStore
 * - Loads existing ChapterPackets + upstream data (premise, structure, setting)
 * - Three detail modes: sketch / standard / refined (CN-MET-04)
 * - Four-layer accordion editing (Layer③ default expanded)
 * - Manual create → edit → save → confirm pipeline
 * - Right sidebar with upstream summary
 * - initialPacketId triggers auto-selection on load
 *
 * Dependencies: C1 (contract + api + pipeline-helper.confirmPacket)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import PipelineIndicator from '../common/pipeline-indicator/PipelineIndicator';
import * as chapterPacketApi from '../../api/chapterPacketApi';
import * as premiseApi from '../../api/premiseApi';
import * as structureApi from '../../api/structureApi';
import * as settingApi from '../../api/settingApi';
import { useToast } from '../../components/Toast';
import type {
  ChapterPacket,
  WritingContract,
  ActiveContext,
  NarrativeCompression,
  ExecutionLayer,
  PacketStatus,
  DetailMode,
} from '../../contracts/chapter-packet.contract';
import type { PremiseCard, PremiseFiveStepState } from '../../contracts/premise.contract';
import type { StructureNode } from '../../contracts/structure.contract';
import { premiseToWritingContract, isPremiseReadyForContract } from '../common/pipeline/premise-to-contract';
import type { CharacterCard, WorldRule, FactionCard } from '../../contracts/setting.contract';
import { Button, Input, TextArea, Select, Badge, EmptyState } from '../../components/ui';
import { generateChapterPacketFromUpstream } from '../../lib/generateChapterPacket';
import { testConnection } from '../../lib/llm-client';
import { DEFAULT_MODELS } from '../../types/ai';
import type { AiModel } from '../../types/ai';
import PacketDetailModeSelector from './PacketDetailModeSelector';
import PacketSketchView from './PacketSketchView';
import PacketRefinedView from './PacketRefinedView';
import './chapter-packet.css';

// ══════════════════════════════════════════
//  Helpers
// ══════════════════════════════════════════

/**
 * Safely parse a JSON layer string to its typed interface.
 * If already an object, return as-is (allows API to pre-parse).
 */
function parseLayer<T>(val: unknown, fallback: T): T {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  if (val && typeof val === 'object') { return { ...(fallback as object), ...(val as object) } as T; }
  return fallback;
}

function parsePacket(data: Record<string, unknown>): ChapterPacket {
  return {
    ...(data as unknown as ChapterPacket),
    layer1: JSON.stringify(parseLayer<WritingContract>(data.layer1, DEFAULT_WRITING_CONTRACT)),
    layer2: JSON.stringify(parseLayer<ActiveContext>(data.layer2, DEFAULT_ACTIVE_CONTEXT)),
    layer3: JSON.stringify(parseLayer<NarrativeCompression>(data.layer3, DEFAULT_NARRATIVE_COMPRESSION)),
    layer4: JSON.stringify(parseLayer<ExecutionLayer>(data.layer4, DEFAULT_EXECUTION_LAYER)),
  };
}

// ══════════════════════════════════════════
//  Defaults
// ══════════════════════════════════════════

const DEFAULT_WRITING_CONTRACT: WritingContract = {
  narrativeDistance: 'medium',
  expositionStrategy: 'balanced',
  characterVoice: 'moderate',
  taboos: [],
  voiceSamples: [],
};

const DEFAULT_ACTIVE_CONTEXT: ActiveContext = {
  characters: [],
  scenes: [],
  rules: [],
  recap: '',
  knowledgeSnapshot: {
    characterKnowledge: [],
    readerKnows: [],
    hiddenFromReader: [],
  },
  characterStates: [],
};

const DEFAULT_NARRATIVE_COMPRESSION: NarrativeCompression = {
  lines: [],
  position: { from: '', to: '' },
  chapterFunction: '',
  narrative: '',
  releases: [],
  establishes: [],
  annotations: [],
  assumptions: [],
};

const DEFAULT_EXECUTION_LAYER: ExecutionLayer = {
  scenes: [],
  taboos: [],
};

// ══════════════════════════════════════════
//  Constants
// ══════════════════════════════════════════

const CHAPTER_FUNCTION_OPTIONS = [
  { value: '', label: '选择功能' },
  { value: 'opening', label: '开篇' },
  { value: 'setup', label: '铺垫' },
  { value: 'escalation', label: '升级' },
  { value: 'twist', label: '转折' },
  { value: 'climax', label: '高潮' },
  { value: 'resolution', label: '解决' },
  { value: 'bridge', label: '过渡' },
  { value: 'reveal', label: '揭示' },
];

const DISTANCE_OPTIONS = [
  { value: 'close', label: '近距' },
  { value: 'medium', label: '中距' },
  { value: 'distant', label: '远距' },
];

const STRATEGY_OPTIONS = [
  { value: 'show_dont_tell', label: '展示勿述' },
  { value: 'balanced', label: '平衡' },
  { value: 'explain_all', label: '解释一切' },
];

const VOICE_OPTIONS = [
  { value: 'distinct', label: '鲜明' },
  { value: 'moderate', label: '适中' },
  { value: 'uniform', label: '统一' },
];

const RISK_COLORS: Record<string, string> = {
  low: '#4CAF50',
  medium: '#FF9800',
  high: '#f44336',
};

const RISK_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

// ══════════════════════════════════════════
//  Sub-components
// ══════════════════════════════════════════

interface AccordionSectionProps {
  id: string;
  title: string;
  summary?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionSection({ id: _id, title, summary, expanded, onToggle, children }: AccordionSectionProps) {
  return (
    <div className={`packet-layer ${expanded ? 'packet-layer-expanded' : ''}`}>
      <button className="packet-layer-header" onClick={onToggle} type="button">
        <span className="packet-layer-arrow">{expanded ? '▾' : '▸'}</span>
        <span className="packet-layer-title">{title}</span>
        {!expanded && summary && (
          <span className="packet-layer-summary">{summary}</span>
        )}
      </button>
      {expanded && <div className="packet-layer-body">{children}</div>}
    </div>
  );
}

interface FieldRowProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

function FieldRow({ label, hint, children }: FieldRowProps) {
  return (
    <div className="packet-field-row">
      <div className="packet-field-label-group">
        <label className="packet-field-label">{label}</label>
        {hint && <span className="packet-field-hint">{hint}</span>}
      </div>
      <div className="packet-field-control">{children}</div>
    </div>
  );
}

interface UpstreamSummaryProps {
  premise: PremiseCard | null;
  chapterNodes: StructureNode[];
  characters: CharacterCard[];
  rules: WorldRule[];
  factions: FactionCard[];
}

function UpstreamSummary({ premise, chapterNodes, characters, rules, factions }: UpstreamSummaryProps) {
  return (
    <div className="packet-upstream">
      <div className="packet-upstream-title">上游数据摘要</div>

      {/* Premise */}
      <div className="packet-upstream-section">
        <div className="packet-upstream-section-title">前提</div>
        {premise ? (
          <div className="packet-upstream-card">
            <div className="packet-upstream-card-text">{premise.premiseText}</div>
            {premise.storyType && (
              <Badge variant="genre">{premise.storyType}</Badge>
            )}
          </div>
        ) : (
          <div className="packet-upstream-empty">尚未设定前提</div>
        )}
      </div>

      {/* Structure */}
      <div className="packet-upstream-section">
        <div className="packet-upstream-section-title">章节结构 ({chapterNodes.length})</div>
        {chapterNodes.length > 0 ? (
          <div className="packet-upstream-list">
            {chapterNodes.slice(0, 8).map(n => (
              <div key={n.id} className="packet-upstream-list-item">
                <span className="packet-upstream-list-title">{n.title}</span>
                {n.narrativeFunction && (
                  <span className="packet-upstream-list-desc">{n.narrativeFunction}</span>
                )}
              </div>
            ))}
            {chapterNodes.length > 8 && (
              <div className="packet-upstream-more">+{chapterNodes.length - 8} 更多</div>
            )}
          </div>
        ) : (
          <div className="packet-upstream-empty">尚未创建章节节点</div>
        )}
      </div>

      {/* Characters */}
      <div className="packet-upstream-section">
        <div className="packet-upstream-section-title">角色 ({characters.length})</div>
        {characters.length > 0 ? (
          <div className="packet-upstream-list">
            {characters.slice(0, 6).map(c => (
              <div key={c.id} className="packet-upstream-list-item">
                <span className="packet-upstream-list-title">{c.name}</span>
                <span className="packet-upstream-list-desc">{c.archetype}</span>
              </div>
            ))}
            {characters.length > 6 && (
              <div className="packet-upstream-more">+{characters.length - 6} 更多</div>
            )}
          </div>
        ) : (
          <div className="packet-upstream-empty">尚未创建角色</div>
        )}
      </div>

      {/* Rules + Factions summary */}
      <div className="packet-upstream-section">
        <div className="packet-upstream-section-title">设定</div>
        <div className="packet-upstream-stat-row">
          <Badge variant="canon">规则 {rules.length}</Badge>
          <Badge variant="canon">势力 {factions.length}</Badge>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
//  Main Component
// ══════════════════════════════════════════

// ══════════════════════════════════════════
//  Props
// ══════════════════════════════════════════

interface ChapterPacketCanvasProps {
  /**
   * 从画板② L4 (Zhang) 双击跳转时传入的 packet ID。
   * 组件加载后自动选中对应细纲包，并清除 store 中的 targetPacketId 防止多次跳转。
   */
  initialPacketId?: string | null;
}

export default function ChapterPacketCanvas({ initialPacketId }: ChapterPacketCanvasProps) {
  const projectId = useProjectStore(s => s.currentProjectId);
  const upstreamStatus = useProjectStore(s => s.upstreamStatus.packet);
  const markRefreshed = useProjectStore(s => s.markRefreshed);
  const { showToast } = useToast();

  // ── Data state ──
  const [packets, setPackets] = useState<ChapterPacket[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<ChapterPacket | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Upstream data ──
  const [premise, setPremise] = useState<PremiseCard | null>(null);
  const [chapterNodes, setChapterNodes] = useState<StructureNode[]>([]);
  const [characters, setCharacters] = useState<CharacterCard[]>([]);
  const [worldRules, setWorldRules] = useState<WorldRule[]>([]);
  const [factions, setFactions] = useState<FactionCard[]>([]);

  // ── Editor state ──
  const [title, setTitle] = useState('');
  const [position, setPosition] = useState('');
  const [chapterFunction, setChapterFunction] = useState('');
  const [editLayer1, setEditLayer1] = useState<WritingContract>(DEFAULT_WRITING_CONTRACT);
  const [editLayer2, setEditLayer2] = useState<ActiveContext>(DEFAULT_ACTIVE_CONTEXT);
  const [editLayer3, setEditLayer3] = useState<NarrativeCompression>(DEFAULT_NARRATIVE_COMPRESSION);
  const [editLayer4, setEditLayer4] = useState<ExecutionLayer>(DEFAULT_EXECUTION_LAYER);
  const [hasChanges, setHasChanges] = useState(false);

  // ── AI state ──
  const [aiModel, setAiModel] = useState<AiModel>(DEFAULT_MODELS[0]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  // ── UI state ──
  const [reviewMode, setReviewMode] = useState(true); // D2-UX: 审核模式默认
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({
    layer1: false,
    layer2: false,
    layer3: true,
    layer4: false,
  });

  // ── CN-MET-04: Detail mode state ──
  const [detailMode, setDetailMode] = useState<DetailMode>('standard');
  const [doNotAskAgain, setDoNotAskAgain] = useState(false);
  const [detailModeLoading, setDetailModeLoading] = useState(false);
  const [editingSince] = useState(() => Date.now()); // timestamp for refined mode

  // ── Data loading ──

  const loadData = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [packetsData, premiseCards, structureNodes, chars, wr, facs, detailResp] = await Promise.all([
        chapterPacketApi.listChapterPackets(projectId),
        premiseApi.listPremiseCards(projectId),
        structureApi.listStructureNodes(projectId),
        settingApi.listCharacterCards(projectId),
        settingApi.listWorldRules(projectId),
        settingApi.listFactionCards(projectId),
        chapterPacketApi.getPacketDetail(projectId).catch(() => null),
      ]);
      const parsed = packetsData.map(p => parsePacket(p as unknown as Record<string, unknown>));
      setPackets(parsed);
      if (parsed.length > 0) {
        selectPacket(parsed[0]);
      }
      setPremise(premiseCards[0] || null);
      setChapterNodes(structureNodes);
      setCharacters(chars);
      setWorldRules(wr);
      setFactions(facs);

      // Apply saved detail mode
      if (detailResp) {
        setDetailMode(detailResp.detailMode as DetailMode);
        setDoNotAskAgain(detailResp.doNotAskAgain);
      }
    } catch (err: any) {
      console.error('[ChapterPacketCanvas] load error', err);
      setError(err?.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // ── CN-INT-01: Refresh packet data when upstream changes ──

  const handleRefresh = useCallback(async () => {
    const packetIdBeforeRefresh = selectedPacket?.id;

    await loadData();

    // ── CN-INT-02: Auto-fill layer1 on refresh if still at default ──
    if (projectId && packetIdBeforeRefresh) {
      try {
        // Fetch fresh data independently (closure state may be stale after loadData)
        const freshPackets = await chapterPacketApi.listChapterPackets(projectId);
        const targetPacket = freshPackets.find(p => p.id === packetIdBeforeRefresh)
          || freshPackets[0];
        if (!targetPacket) return;

        const freshPremiseCards = await premiseApi.listPremiseCards(projectId);
        const pCard = freshPremiseCards[0] || null;
        if (!pCard || pCard.status !== 'confirmed') return;

        const stepResp = await premiseApi.getPremiseStepState({ projectId });
        if (!stepResp.exists || !stepResp.state) return;

        const currentL1 = parseLayer<WritingContract>(targetPacket.layer1, DEFAULT_WRITING_CONTRACT);
        const isDefault = JSON.stringify(currentL1) === JSON.stringify(DEFAULT_WRITING_CONTRACT);
        if (!isDefault) return; // user already edited — do not overwrite

        const fiveStep = stepResp.state as PremiseFiveStepState;
        if (!isPremiseReadyForContract(pCard, fiveStep)) return;

        const derived = premiseToWritingContract(pCard, fiveStep);
        const merged = { ...DEFAULT_WRITING_CONTRACT, ...derived };

        // Save to backend
        const updatedRaw = await chapterPacketApi.updateChapterPacketLayers({
          packetId: targetPacket.id,
          layer1: merged,
        } as any);
        const updatedPacket = parsePacket(updatedRaw as unknown as Record<string, unknown>);

        // Update local state
        setEditLayer1(merged);
        setSelectedPacket(updatedPacket);
        setPackets(prev => prev.map(p => (p.id === updatedPacket.id ? updatedPacket : p)));
      } catch (e) {
        console.warn('[ChapterPacketCanvas] auto-fill on refresh failed', e);
      }
    }

    markRefreshed('packet');
  }, [loadData, markRefreshed, projectId, selectedPacket?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── T-003 Sub-A: Auto-select packet from initialPacketId ──

  const initialPacketProcessed = useRef(false);

  useEffect(() => {
    if (initialPacketId && packets.length > 0 && !initialPacketProcessed.current) {
      const target = packets.find(p => p.id === initialPacketId);
      if (target) {
        selectPacket(target);
      }
      initialPacketProcessed.current = true;

      // Clear targetPacketId to prevent re-navigation on re-render
      useProjectStore.getState().setStageNavigation('packet', undefined);
    }
  }, [initialPacketId, packets]);

  // ── AI config check ──

  useEffect(() => {
    const hasTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
    if (hasTauri) {
      setAiConfigured(true);
      return;
    }
    testConnection('http://localhost:3001/v1', '')
      .then(r => setAiConfigured(r.success))
      .catch(() => setAiConfigured(false));
  }, []);

  // ── Packet selection ──

  const selectPacket = (packet: ChapterPacket) => {
    setSelectedPacket(packet);
    setTitle(packet.title);
    setPosition(packet.position);
    setChapterFunction(packet.chapterFunction);
    setEditLayer1(parseLayer<WritingContract>(packet.layer1, DEFAULT_WRITING_CONTRACT));
    setEditLayer2(parseLayer<ActiveContext>(packet.layer2, DEFAULT_ACTIVE_CONTEXT));
    setEditLayer3(parseLayer<NarrativeCompression>(packet.layer3, DEFAULT_NARRATIVE_COMPRESSION));
    setEditLayer4(parseLayer<ExecutionLayer>(packet.layer4, DEFAULT_EXECUTION_LAYER));
    setHasChanges(false);
  };

  // ── Accordion toggle ──

  const toggleLayer = useCallback((layer: string) => {
    setExpandedLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  // ── Change tracking ──

  const markChanged = useCallback(() => {
    if (!hasChanges) setHasChanges(true);
  }, [hasChanges]);

  // ══════════════════════════════════════════
  //  Layer editing helpers
  // ══════════════════════════════════════════

  const updateLayer1 = useCallback((updater: (prev: WritingContract) => WritingContract) => {
    setEditLayer1(updater);
    markChanged();
  }, [markChanged]);

  const updateLayer2 = useCallback((updater: (prev: ActiveContext) => ActiveContext) => {
    setEditLayer2(updater);
    markChanged();
  }, [markChanged]);

  const updateLayer3 = useCallback((updater: (prev: NarrativeCompression) => NarrativeCompression) => {
    setEditLayer3(updater);
    markChanged();
  }, [markChanged]);

  const updateLayer4 = useCallback((updater: (prev: ExecutionLayer) => ExecutionLayer) => {
    setEditLayer4(updater);
    markChanged();
  }, [markChanged]);

  // ══════════════════════════════════════════
  //  Actions
  // ══════════════════════════════════════════

  const handleCreateEmpty = async () => {
    if (!projectId) return;
    setSaving(true);
    setError(null);
    try {
      const nextNum = packets.length + 1;
      const raw = await chapterPacketApi.createChapterPacket({
        projectId,
        structureNodeId: chapterNodes.length > 0 ? chapterNodes[0].id : '',
        chapterNumber: nextNum,
        title: `第${nextNum}章`,
        position: '',
        chapterFunction: '',
      } as any);
      const created = parsePacket(raw as unknown as Record<string, unknown>);

      // ── CN-INT-02: Auto-fill layer1 from premise if ready ──
      let layer1ForNew: WritingContract = DEFAULT_WRITING_CONTRACT;
      if (premise?.status === 'confirmed') {
        try {
          const stepResp = await premiseApi.getPremiseStepState({ projectId });
          if (stepResp.exists && stepResp.state) {
            const fiveStep = stepResp.state as PremiseFiveStepState;
            if (isPremiseReadyForContract(premise, fiveStep)) {
              const derived = premiseToWritingContract(premise, fiveStep);
              layer1ForNew = { ...DEFAULT_WRITING_CONTRACT, ...derived };
            }
          }
        } catch (e) {
          console.warn('[ChapterPacketCanvas] auto-fill layer1 failed', e);
        }
      }

      const updatedRaw = await chapterPacketApi.updateChapterPacketLayers({
        packetId: created.id,
        layer1: layer1ForNew,
        layer2: DEFAULT_ACTIVE_CONTEXT,
        layer3: DEFAULT_NARRATIVE_COMPRESSION,
        layer4: DEFAULT_EXECUTION_LAYER,
        status: 'draft',
      } as any);
      const updated = parsePacket(updatedRaw as unknown as Record<string, unknown>);

      setPackets(prev => [...prev, updated]);
      selectPacket(updated);
      showToast('已创建空细纲包', 'success');
    } catch (err: any) {
      console.error('[ChapterPacketCanvas] create error', err);
      setError(err?.message || '创建细纲包失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPacket || !projectId) return;
    setSaving(true);
    setError(null);
    try {
      const updatedRaw = await chapterPacketApi.updateChapterPacketLayers({
        packetId: selectedPacket.id,
        layer1: editLayer1,
        layer2: editLayer2,
        layer3: editLayer3,
        layer4: editLayer4,
        status: 'draft',
      } as any);
      const updated = parsePacket(updatedRaw as unknown as Record<string, unknown>);
      // Preserve locally-edited title
      const finalPacket = { ...updated, title };
      setPackets(prev => prev.map(p => (p.id === finalPacket.id ? finalPacket : p)));
      setSelectedPacket(finalPacket);
      setHasChanges(false);
      showToast('保存成功', 'success');
    } catch (err: any) {
      console.error('[ChapterPacketCanvas] save error', err);
      setError(err?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedPacket || !projectId) return;
    setSaving(true);
    setError(null);
    try {
      // Save layers with confirmed status
      await chapterPacketApi.updateChapterPacketLayers({
        packetId: selectedPacket.id,
        layer1: editLayer1,
        layer2: editLayer2,
        layer3: editLayer3,
        layer4: editLayer4,
        status: 'confirmed',
      } as any);
      // Confirm via API
      await chapterPacketApi.confirmChapterPacket(selectedPacket.id);

      // Update local state
      const confirmed: ChapterPacket = {
        ...selectedPacket,
        title,
        layer1: JSON.stringify(editLayer1),
        layer2: JSON.stringify(editLayer2),
        layer3: JSON.stringify(editLayer3),
        layer4: JSON.stringify(editLayer4),
        status: 'confirmed' as PacketStatus,
      };
      setPackets(prev => prev.map(p => (p.id === confirmed.id ? confirmed : p)));
      setSelectedPacket(confirmed);
      setHasChanges(false);
      showToast('细纲包已确认', 'success');
    } catch (err: any) {
      console.error('[ChapterPacketCanvas] confirm error', err);
      setError(err?.message || '确认失败');
    } finally {
      setSaving(false);
    }
  };

  const handlePacketSwitch = (packet: ChapterPacket) => {
    if (hasChanges) {
      // Auto-save before switching
      handleSave();
    }
    selectPacket(packet);
  };

  // ── AI Generation ──

  const handleAiGenerate = async (model: AiModel) => {
    if (!projectId) return;
    setAiGenerating(true);
    setAiError(null);
    setShowModelPicker(false);
    try {
      const nextNum = packets.length + 1;
      const nodeId = chapterNodes.length > 0 ? chapterNodes[0].id : '';
      if (!nodeId) {
        throw new Error('请先在画板②创建章节结构节点');
      }
      // T-003 Sub-B: Pass current detailMode to AI generation for granularity control
      const result = await generateChapterPacketFromUpstream({
        projectId,
        structureNodeId: nodeId,
        chapterNumber: nextNum,
        model,
        detailMode,
      });
      const parsed = parsePacket(result as unknown as Record<string, unknown>);
      setPackets(prev => [...prev, parsed]);
      selectPacket(parsed);
      showToast('AI 生成细纲包成功', 'success');
    } catch (err: any) {
      console.error('[ChapterPacketCanvas] AI generate error', err);
      setAiError(err?.message || 'AI 生成失败');
      showToast('AI 生成失败: ' + (err?.message || '未知错误'), 'error');
    } finally {
      setAiGenerating(false);
    }
  };

  // ── CN-MET-04: Detail Mode Change ──

  const handleDetailModeChange = useCallback(async (newMode: DetailMode) => {
    if (!projectId || newMode === detailMode) return;
    setDetailModeLoading(true);
    setDetailMode(newMode);
    try {
      await chapterPacketApi.setDetailMode({
        projectId,
        detailMode: newMode,
        doNotAskAgain,
      });
      // When switching from sketch to standard, L4 auto-expands (data preserved)
      if (detailMode === 'sketch' && (newMode === 'standard' || newMode === 'refined')) {
        setExpandedLayers(prev => ({ ...prev, layer4: true }));
      }
      // When switching to refined, expand all layers
      if (newMode === 'refined') {
        setExpandedLayers(prev => ({ ...prev, layer1: true, layer2: true, layer3: true, layer4: true }));
      }
      showToast(`模式已切换: ${newMode === 'sketch' ? '快速草图' : newMode === 'standard' ? '标准大纲' : '精细润色'}`, 'success');
    } catch (err: any) {
      console.error('[ChapterPacketCanvas] mode change error', err);
      showToast('模式切换失败: ' + (err?.message || '未知错误'), 'error');
      setDetailMode(detailMode); // revert on error
    } finally {
      setDetailModeLoading(false);
    }
  }, [projectId, detailMode, doNotAskAgain, showToast]);

  const handleDoNotAskAgainChange = useCallback((checked: boolean) => {
    setDoNotAskAgain(checked);
  }, []);

  // ══════════════════════════════════════════
  //  Render: Layer content
  // ══════════════════════════════════════════

  const renderLayer1Content = () => {
    const l1 = editLayer1;
    return (
      <div className="packet-layer-fields">
        <FieldRow label="叙事距离">
          <Select
            value={l1.narrativeDistance}
            onChange={e => updateLayer1(p => ({ ...p, narrativeDistance: e.target.value as WritingContract['narrativeDistance'] }))}
            options={DISTANCE_OPTIONS}
          />
        </FieldRow>
        <FieldRow label="信息策略">
          <Select
            value={l1.expositionStrategy}
            onChange={e => updateLayer1(p => ({ ...p, expositionStrategy: e.target.value as WritingContract['expositionStrategy'] }))}
            options={STRATEGY_OPTIONS}
          />
        </FieldRow>
        <FieldRow label="人物声音">
          <Select
            value={l1.characterVoice}
            onChange={e => updateLayer1(p => ({ ...p, characterVoice: e.target.value as WritingContract['characterVoice'] }))}
            options={VOICE_OPTIONS}
          />
        </FieldRow>
        <FieldRow label="禁忌清单" hint="每行一条">
          <TextArea
            value={l1.taboos.join('\n')}
            onChange={e => updateLayer1(p => ({ ...p, taboos: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }))}
            placeholder="每行一条禁忌事项"
            className="packet-textarea"
            style={{ minHeight: 60 }}
          />
        </FieldRow>
        <FieldRow label="声音样本" hint="JSON 格式">
          <TextArea
            value={JSON.stringify(l1.voiceSamples, null, 2)}
            onChange={e => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (Array.isArray(parsed)) {
                  updateLayer1(p => ({ ...p, voiceSamples: parsed }));
                }
              } catch { /* invalid JSON — ignore while typing */ }
            }}
            placeholder='[{"characterId": "id", "sample": "示例对白"}]'
            className="packet-textarea packet-textarea-mono"
            style={{ minHeight: 70 }}
          />
        </FieldRow>
      </div>
    );
  };

  const renderLayer2Content = () => {
    const l2 = editLayer2;
    return (
      <div className="packet-layer-fields">
        <div className="packet-layer-badges">
          <Badge variant="status">角色 {l2.characters.length}</Badge>
          <Badge variant="status">场景 {l2.scenes.length}</Badge>
          <Badge variant="status">规则 {l2.rules.length}</Badge>
        </div>

        <FieldRow label="活跃角色">
          <TextArea
            value={l2.characters.map(c => `${c.name} — ${c.currentState || c.status}`).join('\n')}
            onChange={e => {
              const lines = e.target.value.split('\n').filter(Boolean);
              const updated = lines.map((line, i) => {
                const existing = l2.characters[i];
                const parts = line.split(' — ');
                return {
                  characterId: existing?.characterId || `char_${i}`,
                  name: parts[0] || existing?.name || '',
                  hook: existing?.hook || '',
                  currentState: parts[1] || existing?.currentState || '',
                  status: existing?.status || '',
                };
              });
              updateLayer2(p => ({ ...p, characters: updated }));
            }}
            placeholder="角色名 — 当前状态"
            className="packet-textarea"
            style={{ minHeight: 60 }}
          />
        </FieldRow>

        <FieldRow label="活跃场景">
          <TextArea
            value={l2.scenes.map(s => `${s.name} — ${s.atmosphere}`).join('\n')}
            onChange={e => {
              const lines = e.target.value.split('\n').filter(Boolean);
              const updated = lines.map((line, i) => {
                const existing = l2.scenes[i];
                const parts = line.split(' — ');
                return {
                  name: parts[0] || existing?.name || `场景 ${i + 1}`,
                  atmosphere: parts[1] || existing?.atmosphere || '',
                };
              });
              updateLayer2(p => ({ ...p, scenes: updated }));
            }}
            placeholder="场景名 — 氛围"
            className="packet-textarea"
            style={{ minHeight: 60 }}
          />
        </FieldRow>

        <FieldRow label="活跃规则">
          <TextArea
            value={l2.rules.map(r => `${r.title}: ${r.description}`).join('\n')}
            onChange={e => {
              const lines = e.target.value.split('\n').filter(Boolean);
              const updated = lines.map((line, i) => {
                const existing = l2.rules[i];
                const parts = line.split(': ');
                return {
                  ruleId: existing?.ruleId || `rule_${i}`,
                  title: parts[0] || existing?.title || '',
                  description: parts.slice(1).join(': ') || existing?.description || '',
                };
              });
              updateLayer2(p => ({ ...p, rules: updated }));
            }}
            placeholder="规则名: 规则描述"
            className="packet-textarea"
            style={{ minHeight: 60 }}
          />
        </FieldRow>

        <FieldRow label="前情提要">
          <TextArea
            value={l2.recap}
            onChange={e => updateLayer2(p => ({ ...p, recap: e.target.value }))}
            placeholder="一句话前情提要..."
            className="packet-textarea"
            style={{ minHeight: 50 }}
          />
        </FieldRow>

        <FieldRow label="角色状态快照" hint="JSON 格式">
          <TextArea
            value={JSON.stringify(l2.characterStates, null, 2)}
            onChange={e => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (Array.isArray(parsed)) {
                  updateLayer2(p => ({ ...p, characterStates: parsed }));
                }
              } catch { /* ignore */ }
            }}
            placeholder='[{"characterId": "id", "currentStatus": "...", "relationshipChanges": []}]'
            className="packet-textarea packet-textarea-mono"
            style={{ minHeight: 70 }}
          />
        </FieldRow>

        <FieldRow label="知识快照" hint="JSON 格式">
          <TextArea
            value={JSON.stringify(l2.knowledgeSnapshot, null, 2)}
            onChange={e => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (parsed && typeof parsed === 'object') {
                  updateLayer2(p => ({ ...p, knowledgeSnapshot: parsed }));
                }
              } catch { /* ignore */ }
            }}
            className="packet-textarea packet-textarea-mono"
            style={{ minHeight: 80 }}
          />
        </FieldRow>
      </div>
    );
  };

  const renderLayer3Content = () => {
    const l3 = editLayer3;
    return (
      <div className="packet-layer-fields">
        <FieldRow label="线路标记">
          <TextArea
            value={l3.lines.join('\n')}
            onChange={e => updateLayer3(p => ({ ...p, lines: e.target.value.split('\n').filter(Boolean) }))}
            placeholder="每行一条线路标记"
            className="packet-textarea"
            style={{ minHeight: 40 }}
          />
        </FieldRow>

        <FieldRow label="叙事位置 (从→到)">
          <div className="packet-field-inline">
            <Input
              value={l3.position.from}
              onChange={e => updateLayer3(p => ({ ...p, position: { ...p.position, from: e.target.value } }))}
              placeholder="起点位置"
              style={{ flex: 1 }}
            />
            <span className="packet-field-sep">→</span>
            <Input
              value={l3.position.to || ''}
              onChange={e => updateLayer3(p => ({ ...p, position: { ...p.position, to: e.target.value } }))}
              placeholder="终点位置"
              style={{ flex: 1 }}
            />
          </div>
        </FieldRow>

        <FieldRow label="本章功能">
          <Select
            value={l3.chapterFunction || chapterFunction}
            onChange={e => { updateLayer3(p => ({ ...p, chapterFunction: e.target.value })); setChapterFunction(e.target.value); }}
            options={CHAPTER_FUNCTION_OPTIONS}
          />
        </FieldRow>

        <FieldRow label="压缩叙事" hint="80-250 字">
          <TextArea
            value={l3.narrative}
            onChange={e => updateLayer3(p => ({ ...p, narrative: e.target.value }))}
            placeholder="用 80-250 字概括本章剧情..."
            className="packet-textarea"
            style={{ minHeight: 100, lineHeight: 1.7 }}
          />
          <div className="packet-char-count">{l3.narrative.length} 字</div>
        </FieldRow>

        <FieldRow label="释放信息" hint="每行一条">
          <TextArea
            value={l3.releases.join('\n')}
            onChange={e => updateLayer3(p => ({ ...p, releases: e.target.value.split('\n').filter(Boolean) }))}
            placeholder="本章释放给读者的信息"
            className="packet-textarea"
            style={{ minHeight: 60 }}
          />
        </FieldRow>

        <FieldRow label="建立 / 伏笔 / 压力" hint="JSON 格式">
          <TextArea
            value={JSON.stringify(l3.establishes, null, 2)}
            onChange={e => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (Array.isArray(parsed)) {
                  updateLayer3(p => ({ ...p, establishes: parsed }));
                }
              } catch { /* ignore */ }
            }}
            placeholder='[{"type": "establish", "subject": "...", "change": "..."}]'
            className="packet-textarea packet-textarea-mono"
            style={{ minHeight: 80 }}
          />
        </FieldRow>

        <FieldRow label="注释" hint="每行一条">
          <TextArea
            value={l3.annotations.join('\n')}
            onChange={e => updateLayer3(p => ({ ...p, annotations: e.target.value.split('\n').filter(Boolean) }))}
            placeholder="创作注释"
            className="packet-textarea"
            style={{ minHeight: 50 }}
          />
        </FieldRow>

        {/* Assumptions section with action buttons */}
        <div className="packet-assumptions-section">
          <div className="packet-field-label">临时假设 ({l3.assumptions.length})</div>
          {l3.assumptions.length === 0 ? (
            <div className="packet-assumptions-empty">暂无临时假设</div>
          ) : (
            <div className="packet-assumptions-list">
              {l3.assumptions.map((a, idx) => (
                <div key={a.id || idx} className="packet-assumption-item" style={{ borderLeftColor: RISK_COLORS[a.riskLevel] || '#666' }}>
                  <div className="packet-assumption-header">
                    <Badge style={{ background: RISK_COLORS[a.riskLevel] || '#666', color: '#000' }}>
                      {RISK_LABELS[a.riskLevel] || a.riskLevel}
                    </Badge>
                    <span className="packet-assumption-resolution">
                      {a.resolution === 'adopted' ? '已采纳' : a.resolution === 'rejected' ? '已驳回' : '待定'}
                    </span>
                    <button
                      className="packet-assumption-remove"
                      onClick={() => updateLayer3(p => ({ ...p, assumptions: p.assumptions.filter((_, i) => i !== idx) }))}
                      type="button"
                      title="移除"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="packet-assumption-content">{a.content}</div>
                  <div className="packet-assumption-reason">原因: {a.reason}</div>
                  <div className="packet-assumption-actions">
                    <Button size="sm" variant="ghost" onClick={() => updateLayer3(p => {
                      const updated = [...p.assumptions];
                      updated[idx] = { ...updated[idx], resolution: 'adopted' };
                      return { ...p, assumptions: updated };
                    })} disabled={a.resolution === 'adopted'}>
                      采纳
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => updateLayer3(p => {
                      const updated = [...p.assumptions];
                      updated[idx] = { ...updated[idx], resolution: 'rejected' };
                      return { ...p, assumptions: updated };
                    })} disabled={a.resolution === 'rejected'}>
                      驳回
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Raw JSON for assumptions as backup edit */}
        <FieldRow label="假设 JSON" hint="高级编辑">
          <TextArea
            value={JSON.stringify(l3.assumptions, null, 2)}
            onChange={e => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (Array.isArray(parsed)) {
                  updateLayer3(p => ({ ...p, assumptions: parsed }));
                }
              } catch { /* ignore */ }
            }}
            className="packet-textarea packet-textarea-mono"
            style={{ minHeight: 60 }}
          />
        </FieldRow>
      </div>
    );
  };

  const renderLayer4Content = () => {
    const l4 = editLayer4;
    return (
      <div className="packet-layer-fields">
        <FieldRow label="场景列表" hint="JSON 格式">
          <div className="packet-scene-summary">
            {l4.scenes.length === 0 ? (
              <div className="packet-upstream-empty">暂无场景</div>
            ) : (
              l4.scenes.map((s, i) => (
                <div key={i} className="packet-scene-item">
                  <div className="packet-scene-item-header">
                    <span className="packet-scene-item-label">{s.label || `场景 ${i + 1}`}</span>
                    <Badge>POV: {s.pov || '-'}</Badge>
                    <Badge variant="status">{s.rhythm}</Badge>
                  </div>
                  <div className="packet-scene-item-detail">
                    {s.location && <span>{s.location} · </span>}
                    {s.sceneGoal && <span>{s.sceneGoal}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </FieldRow>
        <FieldRow label="场景 JSON" hint="编辑全部场景">
          <TextArea
            value={JSON.stringify(l4.scenes, null, 2)}
            onChange={e => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (Array.isArray(parsed)) {
                  updateLayer4(p => ({ ...p, scenes: parsed }));
                }
              } catch { /* ignore */ }
            }}
            className="packet-textarea packet-textarea-mono"
            style={{ minHeight: 120 }}
          />
        </FieldRow>
        <FieldRow label="执行禁忌" hint="每行一条">
          <TextArea
            value={l4.taboos.join('\n')}
            onChange={e => updateLayer4(p => ({ ...p, taboos: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }))}
            placeholder="执行时避免的事项"
            className="packet-textarea"
            style={{ minHeight: 50 }}
          />
        </FieldRow>
      </div>
    );
  };

  // ══════════════════════════════════════════
  //  Render: Main
  // ══════════════════════════════════════════

  // Case: no project
  if (!projectId) {
    return (
      <EmptyState
        title="加载细纲"
        description="请先选择一个项目"
        icon={<span>📋</span>}
      />
    );
  }

  // Case: loading
  if (loading) {
    return (
      <div className="packet-loading">
        <div style={{ width: 20, height: 20, border: '2px solid #333', borderTopColor: '#B7FF00', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
        <span style={{ color: 'var(--text-muted, #888)', fontSize: 'var(--text-sm, 0.8125rem)' }}>加载细纲数据...</span>
      </div>
    );
  }

  // Case: error
  if (error && packets.length === 0) {
    return (
      <div className="packet-error">
        <EmptyState
          title="加载失败"
          description={error}
          icon={<span>⚠️</span>}
          action={
            <Button variant="secondary" onClick={loadData}>重试</Button>
          }
        />
      </div>
    );
  }

  // Case: empty — no packets exist yet
  if (packets.length === 0) {
    return (
      <div className="packet-container">
        {/* CN-INT-01: Upstream stale indicator */}
        <PipelineIndicator
          staleUpstreams={upstreamStatus.staleUpstreams}
          onRefresh={handleRefresh}
        />
        <div className="packet-welcome">
          <div className="packet-welcome-icon">📋</div>
          <div className="packet-welcome-title">排期细纲</div>
          <div className="packet-welcome-desc">
            将结构图中的剧情节点展开为完整的四层细纲包。
          </div>

          {/* Guidance for missing upstream data */}
          {chapterNodes.length === 0 && (
            <div className="packet-warning-box">
              <div className="packet-warning-title">尚未创建章节结构</div>
              <div className="packet-warning-desc">
                请先前往「大纲」画板，添加章节节点后再来创建细纲包。
              </div>
            </div>
          )}

          {characters.length === 0 && worldRules.length === 0 && factions.length === 0 && (
            <div className="packet-warning-box">
              <div className="packet-warning-title">尚未设定角色与世界观</div>
              <div className="packet-warning-desc">
                前往「设定」画板创建角色、规则和势力，细纲包将自动读取这些数据。
              </div>
            </div>
          )}

          <div className="packet-welcome-actions">
            <Button
              variant="primary"
              onClick={handleCreateEmpty}
              disabled={saving}
              loading={saving}
            >
              从空包开始
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowModelPicker(true)}
              disabled={aiGenerating || aiConfigured === false}
              loading={aiGenerating}
            >
              {aiConfigured === null ? '检测 AI...' : aiConfigured === false ? 'AI 未配置' : 'AI 生成整包'}
            </Button>
          </div>

          {aiError && (
            <div className="packet-warning-box" style={{ borderColor: 'rgba(244,67,54,0.3)', background: 'rgba(244,67,54,0.08)' }}>
              <div className="packet-warning-title">AI 生成失败</div>
              <div className="packet-warning-desc">{aiError}</div>
            </div>
          )}

          <div className="packet-welcome-hint">
            手动模式：创建空细纲包后逐层填写。或使用 AI 从上游数据自动生成完整细纲包。
          </div>
        </div>

        {/* Upstream summary even in empty state */}
        <UpstreamSummary
          premise={premise}
          chapterNodes={chapterNodes}
          characters={characters}
          rules={worldRules}
          factions={factions}
        />
      </div>
    );
  }

  // Case: editor with packets
  const isConfirmed = selectedPacket?.status === 'confirmed';
  const statusBadgeVariant = isConfirmed ? 'status' : 'default';
  const statusBadgeText = isConfirmed ? '✓ 已确认' : (selectedPacket?.status === 'draft' ? '草稿' : selectedPacket?.status || '空');

  return (
    <div className="packet-container">
      {/* CN-INT-01: Upstream stale indicator */}
      <PipelineIndicator
        staleUpstreams={upstreamStatus.staleUpstreams}
        onRefresh={handleRefresh}
      />
      {/* Left: Editor */}
      <div className="packet-editor">
        {/* Packet selector */}
        {packets.length > 1 && (
          <div className="packet-selector">
            {packets.map(p => (
              <button
                key={p.id}
                className={`packet-selector-item ${selectedPacket?.id === p.id ? 'packet-selector-active' : ''}`}
                onClick={() => handlePacketSwitch(p)}
                type="button"
              >
                <span>{p.title || `第${p.chapterNumber}章`}</span>
                {p.status === 'confirmed' && <span className="packet-selector-check">✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* Top bar */}
        <div className="packet-topbar">
          <div className="packet-topbar-left">
            <Input
              value={title}
              onChange={e => { setTitle(e.target.value); markChanged(); }}
              className="packet-title-input"
              placeholder="章节标题"
              style={{ fontSize: 'var(--fs-base, 0.9375rem)', fontWeight: 600, width: 260 }}
            />
            <Badge variant={statusBadgeVariant}>{statusBadgeText}</Badge>
            {selectedPacket?.structureNodeId && (
              <Badge variant="genre">
                节点: {chapterNodes.find(n => n.id === selectedPacket.structureNodeId)?.title || selectedPacket.structureNodeId.slice(0, 8)}
              </Badge>
            )}
          </div>
          <div className="packet-topbar-right">
            <Button
              variant="secondary"
              onClick={() => setShowModelPicker(true)}
              disabled={aiGenerating || aiConfigured === false}
              loading={aiGenerating}
              style={{ fontSize: '0.75rem' }}
            >
              {aiConfigured === null ? '检测 AI...' : aiConfigured === false ? 'AI 未配置' : 'AI 生成整包'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              loading={saving}
            >
              保存
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={saving || isConfirmed}
              loading={saving}
            >
              确认
            </Button>
          </div>
        </div>

        {/* CN-MET-04: Detail Mode Selector */}
        <div className="packet-detail-mode-bar">
          <PacketDetailModeSelector
            currentMode={detailMode}
            onModeChange={handleDetailModeChange}
            disabled={detailModeLoading}
            doNotAskAgain={doNotAskAgain}
            onDoNotAskAgainChange={handleDoNotAskAgainChange}
          />
        </div>

        {/* Metadata fields (visible in standard & refined mode) */}
        {detailMode !== 'sketch' && (
          <div className="packet-metabar">
            <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginRight: 12 }}>
              <button
                onClick={() => setReviewMode(true)}
                className={`packet-mode-btn ${reviewMode ? 'packet-mode-btn-active' : ''}`}
                type="button"
                style={{
                  padding: '3px 10px', fontSize: '0.6875rem', borderRadius: 4,
                  border: reviewMode ? '1px solid var(--accent, #B7FF00)' : '1px solid var(--border-default, #2a2a2a)',
                  background: reviewMode ? 'rgba(183,255,0,0.1)' : 'transparent',
                  color: reviewMode ? 'var(--accent, #B7FF00)' : 'var(--text-muted, #666)',
                  cursor: 'pointer', fontWeight: reviewMode ? 500 : 400,
                }}
              >
                审核模式
              </button>
              <button
                onClick={() => { setReviewMode(false); setExpandedLayers(prev => ({ ...prev, layer1: true, layer2: true, layer4: true })); }}
                className={`packet-mode-btn ${!reviewMode ? 'packet-mode-btn-active' : ''}`}
                type="button"
                style={{
                  padding: '3px 10px', fontSize: '0.6875rem', borderRadius: 4,
                  border: !reviewMode ? '1px solid var(--accent, #B7FF00)' : '1px solid var(--border-default, #2a2a2a)',
                  background: !reviewMode ? 'rgba(183,255,0,0.1)' : 'transparent',
                  color: !reviewMode ? 'var(--accent, #B7FF00)' : 'var(--text-muted, #666)',
                  cursor: 'pointer', fontWeight: !reviewMode ? 500 : 400,
                }}
              >
                完整模式
              </button>
            </div>
            <Select
              value={chapterFunction}
              onChange={e => setChapterFunction(e.target.value)}
              options={CHAPTER_FUNCTION_OPTIONS}
              style={{ width: reviewMode ? 140 : 140 }}
            />
            <Input
              value={position}
              onChange={e => setPosition(e.target.value)}
              placeholder="时位 (如: 动 / 藏→生)"
              style={{ width: 160 }}
            />
          </div>
        )}

        {/* Four-layer accordion editor (mode-aware) */}
        <div className="packet-layers">
          {detailMode === 'sketch' ? (
            /* ═══ 快速草图模式 — 紧凑摘要展示 ═══ */
            <PacketSketchView
              title={title}
              chapterFunction={chapterFunction}
              position={position}
              layer1={editLayer1}
              layer2={editLayer2}
              layer3={editLayer3}
            />
          ) : detailMode === 'refined' ? (
            /* ═══ 精细润色模式 — 全层可编辑 + 字数/时间/评论 ═══ */
            <PacketRefinedView
              layer1={editLayer1}
              layer2={editLayer2}
              layer3={editLayer3}
              layer4={editLayer4}
              onLayer1Change={(v) => { setEditLayer1(v); markChanged(); }}
              onLayer2Change={(v) => { setEditLayer2(v); markChanged(); }}
              onLayer3Change={(v) => { setEditLayer3(v); markChanged(); }}
              onLayer4Change={(v) => { setEditLayer4(v); markChanged(); }}
              editingSince={editingSince}
            />
          ) : (
            /* ═══ 标准大纲模式 — 现有 accordion 行为 ═══ */
            reviewMode ? (
              /* ═══ 审核模式 — 只展示核心字段 + Layer③ 展开 ═══ */
              <>
                {/* Layer ③ 剧情压缩层 — 核心叙事字段 */}
                <div className="packet-layer packet-layer-expanded">
                  <div className="packet-layer-header" style={{ cursor: 'default' }}>
                    <span className="packet-layer-arrow">▾</span>
                    <span className="packet-layer-title">剧情压缩 (核心叙事)</span>
                  </div>
                  <div className="packet-layer-body">
                    <div className="packet-layer-fields">
                      {/* 压缩叙事 */}
                      <FieldRow label="压缩叙事" hint="80-250 字">
                        <TextArea
                          value={editLayer3.narrative}
                          onChange={e => updateLayer3(p => ({ ...p, narrative: e.target.value }))}
                          placeholder="用 80-250 字概括本章剧情..."
                          className="packet-textarea"
                          style={{ minHeight: 100, lineHeight: 1.7 }}
                        />
                        <div className="packet-char-count">{editLayer3.narrative.length} 字</div>
                      </FieldRow>

                      {/* 释放信息 */}
                      <FieldRow label="读者释放" hint="每行一条 — 本章释放给读者的信息">
                        <TextArea
                          value={editLayer3.releases.join('\n')}
                          onChange={e => updateLayer3(p => ({ ...p, releases: e.target.value.split('\n').filter(Boolean) }))}
                          placeholder="本章释放给读者的信息"
                          className="packet-textarea"
                          style={{ minHeight: 60 }}
                        />
                      </FieldRow>

                      {/* 建立/伏笔/压力 */}
                      <FieldRow label="建立 · 伏笔 · 章尾压力" hint="JSON 格式">
                        <TextArea
                          value={JSON.stringify(editLayer3.establishes, null, 2)}
                          onChange={e => {
                            try {
                              const parsed = JSON.parse(e.target.value);
                              if (Array.isArray(parsed)) {
                                updateLayer3(p => ({ ...p, establishes: parsed }));
                              }
                            } catch { /* ignore */ }
                          }}
                          placeholder='[{"type": "establish|foreshadow|pressure", "subject": "...", "change": "..."}]'
                          className="packet-textarea packet-textarea-mono"
                          style={{ minHeight: 80 }}
                        />
                      </FieldRow>

                      {/* 关系变化 (from annotations) */}
                      <FieldRow label="关系变化 / 注释" hint="每行一条">
                        <TextArea
                          value={editLayer3.annotations.join('\n')}
                          onChange={e => updateLayer3(p => ({ ...p, annotations: e.target.value.split('\n').filter(Boolean) }))}
                          placeholder="关系变化说明或创作注释"
                          className="packet-textarea"
                          style={{ minHeight: 50 }}
                        />
                      </FieldRow>

                      {/* 线路标记 */}
                      <FieldRow label="线路标记" hint="每行一条">
                        <TextArea
                          value={editLayer3.lines.join('\n')}
                          onChange={e => updateLayer3(p => ({ ...p, lines: e.target.value.split('\n').filter(Boolean) }))}
                          placeholder="每行一条线路标记"
                          className="packet-textarea"
                          style={{ minHeight: 40 }}
                        />
                      </FieldRow>

                      {/* 临时假设 — 精简展示 */}
                      {editLayer3.assumptions.length > 0 && (
                        <div className="packet-assumptions-section">
                          <div className="packet-field-label">临时假设 ({editLayer3.assumptions.length})</div>
                          <div className="packet-assumptions-list">
                            {editLayer3.assumptions.map((a, idx) => (
                              <div key={a.id || idx} className="packet-assumption-item" style={{ borderLeftColor: RISK_COLORS[a.riskLevel] || '#666' }}>
                                <div className="packet-assumption-header">
                                  <Badge style={{ background: RISK_COLORS[a.riskLevel] || '#666', color: '#000' }}>
                                    {RISK_LABELS[a.riskLevel] || a.riskLevel}
                                  </Badge>
                                  <span className="packet-assumption-resolution">
                                    {a.resolution === 'adopted' ? '已采纳' : a.resolution === 'rejected' ? '已驳回' : '待定'}
                                  </span>
                                </div>
                                <div className="packet-assumption-content">{a.content}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Layers ①②④ — 折叠摘要卡片 */}
                <AccordionSection
                  id="layer1"
                  title="Layer ① 写作契约"
                  summary={`距离: ${DISTANCE_OPTIONS.find(o => o.value === editLayer1.narrativeDistance)?.label || editLayer1.narrativeDistance} · 禁忌: ${editLayer1.taboos.length}条`}
                  expanded={expandedLayers.layer1}
                  onToggle={() => toggleLayer('layer1')}
                >
                  {renderLayer1Content()}
                </AccordionSection>

                <AccordionSection
                  id="layer2"
                  title="Layer ② 活跃设定"
                  summary={`角色: ${editLayer2.characters.length} · 场景: ${editLayer2.scenes.length} · 规则: ${editLayer2.rules.length}`}
                  expanded={expandedLayers.layer2}
                  onToggle={() => toggleLayer('layer2')}
                >
                  {renderLayer2Content()}
                </AccordionSection>

                <AccordionSection
                  id="layer4"
                  title="Layer ④ 执行层"
                  summary={`场景: ${editLayer4.scenes.length}个`}
                  expanded={expandedLayers.layer4}
                  onToggle={() => toggleLayer('layer4')}
                >
                  {renderLayer4Content()}
                </AccordionSection>

                {/* 审核模式底部提示 */}
                <div style={{
                  textAlign: 'center', padding: '12px 0', fontSize: '0.6875rem',
                  color: 'var(--text-muted, #666)',
                  borderTop: '1px dashed var(--border-default, #2a2a2a)',
                  marginTop: 8,
                }}>
                  审核模式 — 仅展示核心字段。切换到「完整模式」编辑全部四层内容。
                </div>
              </>
            ) : (
              /* ═══ 完整模式 — 四层全部可编辑 ═══ */
              <>
                <AccordionSection
                  id="layer1"
                  title="Layer ① 写作契约"
                  summary={`距离: ${DISTANCE_OPTIONS.find(o => o.value === editLayer1.narrativeDistance)?.label || editLayer1.narrativeDistance} · 禁忌: ${editLayer1.taboos.length}条`}
                  expanded={expandedLayers.layer1}
                  onToggle={() => toggleLayer('layer1')}
                >
                  {renderLayer1Content()}
                </AccordionSection>

                <AccordionSection
                  id="layer2"
                  title="Layer ② 活跃设定"
                  summary={`角色: ${editLayer2.characters.length} · 场景: ${editLayer2.scenes.length} · 规则: ${editLayer2.rules.length}`}
                  expanded={expandedLayers.layer2}
                  onToggle={() => toggleLayer('layer2')}
                >
                  {renderLayer2Content()}
                </AccordionSection>

                <AccordionSection
                  id="layer3"
                  title="Layer ③ 剧情压缩层"
                  summary={editLayer3.narrative ? `${editLayer3.narrative.slice(0, 40)}...` : '空'}
                  expanded={expandedLayers.layer3}
                  onToggle={() => toggleLayer('layer3')}
                >
                  {renderLayer3Content()}
                </AccordionSection>

                <AccordionSection
                  id="layer4"
                  title="Layer ④ 执行层"
                  summary={`场景: ${editLayer4.scenes.length}个`}
                  expanded={expandedLayers.layer4}
                  onToggle={() => toggleLayer('layer4')}
                >
                  {renderLayer4Content()}
                </AccordionSection>
              </>
            )
          )}
        </div>
      </div>

      {/* Right: Upstream summary */}
      <UpstreamSummary
        premise={premise}
        chapterNodes={chapterNodes}
        characters={characters}
        rules={worldRules}
        factions={factions}
      />

      {/* ── AI Model Picker Modal ── */}
      {showModelPicker && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { if (!aiGenerating) setShowModelPicker(false); }}
        >
          <div
            style={{ background: 'var(--bg-surface, #141414)', border: '1px solid var(--border-default, #2a2a2a)', borderRadius: 'var(--radius-lg, 14px)', maxWidth: 420, width: '90%', padding: 24 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>选择 AI 模型</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted, #666)', marginBottom: 16 }}>
              选择一个模型来生成细纲包。上游数据将作为 prompt 上下文发送给 AI。
            </p>
            {DEFAULT_MODELS.map(m => (
              <div
                key={m.id}
                onClick={() => handleAiGenerate(m)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  borderRadius: 'var(--radius-sm, 6px)', cursor: aiGenerating ? 'not-allowed' : 'pointer',
                  marginBottom: 4, opacity: aiGenerating ? 0.6 : 1,
                  background: aiModel.id === m.id ? 'var(--accent-soft, rgba(183,255,0,0.1))' : 'transparent',
                  border: aiModel.id === m.id ? '1px solid rgba(183,255,0,0.2)' : '1px solid transparent',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent, #B7FF00)', opacity: aiModel.id === m.id ? 1 : 0.2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{m.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #666)' }}>{m.providerName} · {m.description}</div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #666)' }}>{m.costPer1KTokens === 0 ? '免费' : `$${m.costPer1KTokens}/1K`}</div>
              </div>
            ))}
            {aiGenerating && (
              <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-secondary, #a0a0a0)', fontSize: '0.8125rem' }}>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #444', borderTopColor: '#B7FF00', borderRadius: '50%', animation: 'spin 0.6s linear infinite', marginRight: 8, verticalAlign: 'middle' }} />
                AI 正在生成细纲包...
              </div>
            )}
            <button
              onClick={() => setShowModelPicker(false)}
              disabled={aiGenerating}
              style={{ marginTop: 16, width: '100%', padding: '8px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-default, #2a2a2a)', background: 'transparent', color: aiGenerating ? 'var(--text-muted, #666)' : 'var(--text-secondary, #a0a0a0)', cursor: aiGenerating ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}
            >
              {aiGenerating ? '生成中...' : '取消'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
