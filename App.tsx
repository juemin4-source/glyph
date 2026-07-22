import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { User, MapPin, Building2, Settings, Calendar, Package, BookOpen, FileText, Search } from 'lucide-react';
import type { WorldObject, Connection, NavTab, CanvasTab, CanvasTabState, ObjectType, ObjectStatus, CanonLevel, JudgmentOperation, SaveStatus, ChangelogEntry } from './types/world';
import { CANVAS_TABS, CANON_LEVELS, CANON_COLORS, PROJECT_TEMPLATES } from './types/world';
import type { Project } from './types/world';
import { TEMPLATES } from './data/seed';

import * as api from './tauri-api';
import { countWords, isHtmlContent, htmlToMarkdown } from './utils/markdown';
import { SyncManager } from './lib/SyncManager';
import { Changelog } from './lib/Changelog';

import Bookshelf from './components/Bookshelf';
import DocumentView from './components/DocumentView';
import CanvasView from './components/CanvasView';
import SettingCollection from './components/SettingCollection';
import JudgmentRecords from './components/JudgmentRecords';
import Inspector from './components/Inspector';
import StatusBar from './components/StatusBar';
import CreationWizard from './components/CreationWizard';
import FirstLaunchGuide, { shouldShowGuide, markGuideDone } from './components/FirstLaunchGuide';
import CanonGuideCard, { shouldShowCanonGuide } from './components/CanonGuideCard';
import GlobalSearch from './components/GlobalSearch';
import { ToastProvider, useToast } from './components/Toast';
import AIChat from './components/ai/AIChat';
import AiSettings from './components/ai/AiSettings';
import { type ProviderConfig, type UsageStats, PRESET_PROVIDERS } from './types/ai';
import './styles/global.css';
import './styles/variables.css';
import './styles/ai.css';
import './components/ui/design-tokens.css';
import { useProjectStore } from './stores/projectStore';
import { getPipelineState, savePipelineState } from './api/projectApi';
import { useUpstreamDetection } from './hooks/useUpstreamDetection';
import PipelineNav from './features/pipeline-nav/PipelineNav';
import CanvasShell from './features/pipeline-canvas/CanvasShell';
import PremiseEntryGate from './features/canvas-01-premise/PremiseEntryGate';
import StructureFlowView from './features/canvas-02-structure/StructureFlowView';
import PacketComingSoon from './features/canvas-04-packet/PacketComingSoon';
import ChapterPacketCanvas from './features/canvas-04-packet/ChapterPacketCanvas';
import TextCanvas from './features/canvas-05-text/TextCanvas';
import SettingCanvasV2 from './features/canvas-03-setting/SettingCanvasV2';
import CanvasAiBar from './components/ai/CanvasAiBar';
import { FeedbackTrigger, FeedbackModal } from './components/feedback';

// ===== ID Generators =====
let _nextId = 1000;
function uid(): string { return `obj_${_nextId++}`; }
function cid(): string { return `conn_${_nextId++}`; }
function jid(): string { return `judg_${_nextId++}`; }

function createDefaultCanvasStates(): Record<CanvasTab, CanvasTabState> {
  const states: Record<string, CanvasTabState> = {};
  for (const tab of CANVAS_TABS) {
    states[tab] = {
      tabId: tab,
      positions: {},
      stickyNotes: [],
      connections: [],
      scale: 1,
      panX: 0,
      panY: 0,
    };
  }
  return states as Record<CanvasTab, CanvasTabState>;
}

function mapDTOtoProject(dto: api.ProjectDTO): Project {
  let gradient: [string, string] = ['#6366f1', '#8b5cf6'];
  try { const g = JSON.parse(dto.gradient); if (Array.isArray(g) && g.length >= 2) gradient = [g[0], g[1]]; } catch { console.warn('Failed to parse gradient', dto.gradient); }
  return {
    id: dto.id,
    title: dto.name,
    genre: dto.genre || '未分类',
    status: (dto.status as Project['status']) || 'conceiving',
    wordCount: dto.wordCount ?? 0,
    gradient,
  };
}

function mapProjectToCreate(name: string, genre?: string): Promise<api.ProjectDTO> {
  return api.createProject(name, genre || '未分类', 'conceiving', 0, '["#6366f1","#8b5cf6"]');
}

const syncManager = new SyncManager();
const changelog = new Changelog();

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

function AppInner() {
  const { showToast } = useToast();
  const { setProjectId, setPipelineState } = useProjectStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);

  const [objects, setObjects] = useState<WorldObject[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [activeNavTab, setActiveNavTab] = useState<NavTab>('文档');
  const [canvasStates, setCanvasStates] = useState<Record<CanvasTab, CanvasTabState>>(createDefaultCanvasStates);
  const canvasStatesRef = useRef(canvasStates);
  useEffect(() => { canvasStatesRef.current = canvasStates; }, [canvasStates]);

  // v1.2: Save status
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [contentDirty, setContentDirty] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // v1.2: Editor mode (nav-bar controlled)
  const [editorMode, setEditorMode] = useState<'source' | 'preview' | 'wysiwyg'>('source');

  // v1.2: Offline detection
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // v1.2: Modal states
  const [showCreationWizard, setShowCreationWizard] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showCanonGuide, setShowCanonGuide] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [lastGenre, setLastGenre] = useState('科幻');

  // v2.0.1: Feedback state
  const [showFeedback, setShowFeedback] = useState(false);

  // v1.3: AI Chat state
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [aiProviders, setAiProviders] = useState<ProviderConfig[]>([]);
  const [aiActiveModelId, setAiActiveModelId] = useState('gpt-4o');
  const [changelogEntries, setChangelogEntries] = useState<ChangelogEntry[]>([]);

  // v2: Pipeline state
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [canvasStages, setCanvasStages] = useState<{stage: string; status: string}[]>([]);

  // D3: Legacy view override
  const [legacyView, setLegacyView] = useState<string | null>(null);

  // Sync local state when pipeline-helper updates the store (e.g. confirmPremise)
  const storeStage = useProjectStore(s => s.currentStage);
  const storeStages = useProjectStore(s => s.canvasStages);
  const storeProjectId = useProjectStore(s => s.currentProjectId);
  const targetPacketId = useProjectStore(s => s.targetPacketId);
  useUpstreamDetection(storeProjectId);
  useEffect(() => {
    if (storeStage && storeStage !== currentStage) {
      setCurrentStage(storeStage);
      if (storeStages.length > 0) setCanvasStages(storeStages);
    }
  }, [storeStage]);

  const [aiUsageStats, setAiUsageStats] = useState<UsageStats>({
    todayTokens: 0, maxTokens: 0,
    dailyHistory: [],
    totalCostToday: 0, totalCostMonth: 0, budgetLimit: 10,
  });
  // v1.2: Object count for canon guide trigger
  const prevObjectCountRef = useRef(0);

  // ── SyncManager setup ──
  useEffect(() => {
    syncManager.startPing();
    syncManager.onSaveStatusChange((status) => {
      setSaveStatus(status);
    });
    return () => { syncManager.stopPing(); };
  }, []);

  // ── Online/Offline detection ──
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── AI usage stats from backend ──
  useEffect(() => {
    const loadUsage = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const stats = await invoke('get_usage_stats');
        if (stats) setAiUsageStats(stats as UsageStats);
      } catch {
        // Backend not available, keep empty defaults
      }
    };
    loadUsage();
  }, []);

  // ── Load saved AI providers from backend on mount ──
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const infos = await invoke('list_providers') as any[];
        if (infos && infos.length > 0) {
          const merged = infos.map(info => {
            const preset = PRESET_PROVIDERS.find(p => p.id === info.provider);
            if (!preset) return null;
            return {
              id: info.provider,
              name: preset.name,
              icon: preset.icon,
              apiKey: '', // Don't expose keys to frontend
              endpoint: preset.defaultEndpoint,
              timeout: 30,
              models: preset.defaultModels,
              status: 'connected' as const,
            } as ProviderConfig;
          }).filter(Boolean) as ProviderConfig[];
          setAiProviders(merged);
        }
      } catch {
        // Backend not available, keep empty defaults
      }
    };
    loadProviders();
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(prev => !prev);
        return;
      }
      if (isCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (isCtrl && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (isCtrl && e.key === 'Z') {
        e.preventDefault();
        handleRedo();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [objects, connections, canvasStates, selectedObjectId]);

  // ── Undo/Redo handlers ──
  const handleUndo = useCallback(() => {
    const entry = changelog.undo();
    if (!entry) {
      showToast('没有可撤销的操作', 'info');
      return;
    }
    switch (entry.action) {
      case 'delete_object':
        setObjects(prev => [...prev, entry.snapshot as WorldObject]);
        setSelectedObjectId(entry.objectId);
        break;
      case 'create_object':
        setObjects(prev => prev.filter(o => o.id !== entry.objectId));
        if (selectedObjectId === entry.objectId) setSelectedObjectId(null);
        break;
      case 'move_canvas_node':
      case 'update_canvas_state':
        setCanvasStates(prev => {
          const next = { ...prev };
          for (const tab of CANVAS_TABS) {
            if (entry.snapshot[tab]) {
              next[tab] = entry.snapshot[tab] as CanvasTabState;
            }
          }
          return next;
        });
        break;
      case 'create_connection':
        setConnections(prev => prev.filter(c => c.id !== entry.objectId));
        break;
      case 'delete_connection':
        setConnections(prev => [...prev, entry.snapshot as Connection]);
        break;
    }
  }, [objects, selectedObjectId, showToast]);

  const handleRedo = useCallback(() => {
    const entry = changelog.redo();
    if (!entry) {
      showToast('没有可重做的操作', 'info');
      return;
    }
    switch (entry.action) {
      case 'delete_object':
        setObjects(prev => prev.filter(o => o.id !== entry.objectId));
        if (selectedObjectId === entry.objectId) setSelectedObjectId(null);
        break;
      case 'create_object':
        setObjects(prev => [...prev, entry.snapshot as WorldObject]);
        setSelectedObjectId(entry.objectId);
        break;
      case 'move_canvas_node':
      case 'update_canvas_state':
        setCanvasStates(prev => {
          const next = { ...prev };
          for (const tab of CANVAS_TABS) {
            if (entry.snapshot[tab]) {
              next[tab] = entry.snapshot[tab] as CanvasTabState;
            }
          }
          return next;
        });
        break;
      case 'create_connection':
        setConnections(prev => [...prev, entry.snapshot as Connection]);
        break;
      case 'delete_connection':
        setConnections(prev => prev.filter(c => c.id !== entry.objectId));
        break;
    }
  }, [objects, selectedObjectId, showToast]);

  const pushChangelog = useCallback((entry: ChangelogEntry) => {
    changelog.push(entry);
    setChangelogEntries(prev => [...prev, entry]);
  }, []);

  // Load projects on mount
  useEffect(() => {
    Promise.resolve(api.listProjects?.() ?? [])
      .then(dtos => setProjects(dtos.map(mapDTOtoProject)))
      .catch(e => console.error('Failed to load projects', e))
      .finally(() => setProjectsLoading(false));
  }, []);

  const activeBook = useMemo(
    () => projects.find(b => b.id === activeBookId) || null,
    [projects, activeBookId]
  );
  const currentObject = useMemo(
    () => objects.find(o => o.id === selectedObjectId) || null,
    [objects, selectedObjectId]
  );
  const allBoardTabs = CANVAS_TABS;
  const bookshelfProjects = projects;
  const settingDefaultSelected = useMemo(
    () => { const first = objects.find(o => o.canonLevel !== '未收录'); return first?.id; },
    [objects]
  );

  // ── Canon guide trigger ──
  useEffect(() => {
    const prev = prevObjectCountRef.current;
    const current = objects.length;
    if (prev < 3 && current >= 3 && activeBookId && shouldShowCanonGuide(activeBookId)) {
      setShowCanonGuide(true);
    }
    prevObjectCountRef.current = current;
  }, [objects.length, activeBookId]);

  // ── Auto-save ──
  const triggerAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('unsaved');
    setContentDirty(true);
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving');
      // The actual save is triggered via SyncManager on each write operation
      setTimeout(() => {
        setSaveStatus('saved');
        setContentDirty(false);
      }, 800);
    }, 500);
  }, []);

  const loadProjectData = useCallback(async (projectId: string) => {
    try {
      const [objs, conns, canvases] = await Promise.all([
        api.listWorldObjects(projectId),
        api.listConnections(projectId),
        api.listCanvasTabStates(projectId),
      ]);
      // v1.2: Auto-migrate HTML content to Markdown
      const migratedObjs = objs.map(obj => {
        if (isHtmlContent(obj.content)) {
          return { ...obj, content: htmlToMarkdown(obj.content) };
        }
        return obj;
      });
      setObjects(migratedObjs);
      setConnections(conns);
      const cs: Record<string, CanvasTabState> = {};
      for (const tab of CANVAS_TABS) {
        const found = canvases.find(c => c.tabId === tab);
        cs[tab] = found || { tabId: tab, positions: {}, stickyNotes: [], connections: [], scale: 1, panX: 0, panY: 0 };
      }
      setCanvasStates(cs as Record<CanvasTab, CanvasTabState>);
      setSelectedObjectId(migratedObjs.length > 0 ? migratedObjs[0].id : null);
      changelog.clear();
      setChangelogEntries([]);
    } catch (e) {
      console.error('Failed to load project data', e);
      showToast('加载项目数据失败', 'error');
      setObjects([]);
      setConnections([]);
      setCanvasStates(createDefaultCanvasStates());
      setSelectedObjectId(null);
    }
  }, [showToast]);

  const refreshProjects = useCallback(async () => {
    try {
      const dtos = await api.listProjects();
      setProjects(dtos.map(mapDTOtoProject));
    } catch (e) {
      console.error('Failed to refresh projects', e);
      showToast('刷新项目列表失败', 'error');
    }
  }, [showToast]);

  const handleEnterProject = useCallback(async (project: Project) => {
    setActiveBookId(project.id);
    setActiveNavTab('文档');
    await loadProjectData(project.id);
    // Load pipeline state
    setProjectId(project.id);
    try {
      const ps = await getPipelineState(project.id);
      setPipelineState(ps);
      setCurrentStage(ps.currentStage);
      setCanvasStages(ps.canvasStages);
    } catch (e) {
      console.error('Failed to load pipeline state', e);
    }
    // Show first launch guide if needed
    if (shouldShowGuide(project.id)) {
      setShowGuide(true);
    }
  }, [loadProjectData]);

  const handleStageChange = useCallback(async (stage: string) => {
    type CanvasStage = 'premise' | 'structure' | 'setting' | 'packet' | 'text';
    const target = canvasStages.find(s => s.stage === stage);
    if (!target || !(target.status === 'active' || target.status === 'ready' || target.status === 'done')) return;
    if (!activeBookId) return;

    // Clear legacy view when navigating via pipeline
    setLegacyView(null);

    // Update local stage
    setCurrentStage(stage);
    setActiveNavTab('文档');

    // Build updated stages: clicked stage becomes active, others stay as-is
    const updatedStages = canvasStages.map(s => ({
      ...s,
      status: s.stage === stage ? 'active' as const : (s.status === 'active' ? 'done' as const : s.status as 'locked' | 'ready' | 'active' | 'done'),
    }));
    setCanvasStages(updatedStages);

    // Persist to SQLite via full pipeline
    try {
      const ps = await savePipelineState({
        projectId: activeBookId,
        currentStage: stage as CanvasStage,
        canvasStages: updatedStages.map(s => ({ stage: s.stage as CanvasStage, status: s.status })),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setPipelineState(ps);
    } catch (e) {
      console.error('Failed to save pipeline state', e);
    }
  }, [canvasStages, activeBookId]);

  const handleBackToBookshelf = useCallback(() => {
    setActiveBookId(null);
    setLegacyView(null);
    setSelectedObjectId(null);
    setObjects([]);
    setConnections([]);
    changelog.clear();
    setChangelogEntries([]);
    // Reset pipeline state
    setCurrentStage(null);
    setCanvasStages([]);
    useProjectStore.getState().reset();
  }, []);

  // D3: Legacy view handler
  const handleLegacySelect = useCallback((type: 'canvas' | 'ai-chat' | 'setting-collection') => {
    setLegacyView(type);
  }, []);

  // ── Creation Wizard ──
  const handleCreateProjectClick = useCallback(() => {
    setShowCreationWizard(true);
  }, []);

  const handleCreateProjectFromWizard = useCallback(async (title: string, genre: string, templateId: string | null) => {
    try {
      setLastGenre(genre);
      const dto = await mapProjectToCreate(title, genre);
      const project = mapDTOtoProject(dto);

      // Create preset objects if template selected
      if (templateId) {
        
        
      const tmpl = PROJECT_TEMPLATES.find(t => t.id === templateId);
        if (tmpl && tmpl.presetObjectTypes.length > 0) {
          for (const preset of tmpl.presetObjectTypes) {
            const now = Date.now();
            const newObj: WorldObject = {
              id: uid(), projectId: dto.id, name: preset.name,
              type: preset.type, status: '草稿' as ObjectStatus,
              canonLevel: '未收录' as CanonLevel,
              tags: [preset.type], aliases: [], selectedBoards: [],
              content: `# ${preset.name}\n\n`,
              referencesCount: 0, judgmentHistory: [],
              createdAt: now, updatedAt: now,
            };
            try {
              await api.createWorldObject(newObj);
            } catch { console.warn('Failed to create preset object'); }
          }
        }
      }

      await refreshProjects();
      setShowCreationWizard(false);
      setActiveBookId(project.id);
      setActiveNavTab('文档');
      setObjects([]);
      setConnections([]);
      setCanvasStates(createDefaultCanvasStates());
      setSelectedObjectId(null);
      setShowGuide(true);
      // Load pipeline state for the new project (prevents leaking previous project's state)
      setProjectId(project.id);
      try {
        const ps = await getPipelineState(project.id);
        setPipelineState(ps);
        setCurrentStage(ps.currentStage);
        setCanvasStages(ps.canvasStages);
      } catch (e) {
        console.error('Failed to load pipeline state', e);
      }
      showToast(`作品「${title}」已创建`, 'success');
    } catch (e) {
      console.error('Failed to create project', e);
      showToast('创建作品失败', 'error');
    }
  }, [refreshProjects, showToast]);

  // ══════════════════════════════════════════
  //  Judgment Operations
  // ══════════════════════════════════════════

  const addJudgment = useCallback(async (objectId: string, operationType: JudgmentOperation, reason: string, prevValue: string, newValue: string) => {
    const obj = objects.find(o => o.id === objectId);
    if (!obj) return;
    const now = Date.now();
    const statusOps: JudgmentOperation[] = ['锁定', '废弃', '待验证'];
    const record = {
      id: jid(), objectId, objectName: obj.name, operationType,
      reason, timestamp: now, previousStatus: prevValue, newStatus: newValue,
    };
    setObjects(prev => prev.map(o =>
      o.id === objectId
        ? {
            ...o,
            ...(statusOps.includes(operationType) ? { status: newValue as ObjectStatus } : {}),
            judgmentHistory: [...o.judgmentHistory, record],
            updatedAt: now,
          }
        : o
    ));
    syncManager.enqueue('appendJudgment', record).catch(e => { console.error('Sync failed', e); showToast('自动同步失败', 'error'); });
    api.appendJudgmentRecord(record).catch(e => {
      console.error('Failed to append judgment', e);
      showToast(`${operationType}失败`, 'error');
    });
  }, [objects, showToast]);

  const onLockObject = useCallback((objectId: string, reason: string) => {
    const obj = objects.find(o => o.id === objectId);
    if (obj) addJudgment(objectId, '锁定', reason || '手动锁定', obj.status, '锁定');
  }, [objects, addJudgment]);

  const onDiscardObject = useCallback((objectId: string, reason: string) => {
    const obj = objects.find(o => o.id === objectId);
    if (obj) addJudgment(objectId, '废弃', reason || '手动废弃', obj.status, '废弃');
  }, [objects, addJudgment]);

  const onUnlockObject = useCallback((objectId: string, reason: string) => {
    const obj = objects.find(o => o.id === objectId);
    if (obj) addJudgment(objectId, '待验证', reason || '解锁回退', obj.status, '待验证');
  }, [objects, addJudgment]);

  // ══════════════════════════════════════════
  //  WorldObject CRUD (via SyncManager)
  // ══════════════════════════════════════════

  const onUpdateObject = useCallback(async (id: string, updates: Partial<WorldObject>) => {
    const before = objects.find(o => o.id === id);
    if (before) {
      if (updates.status && updates.status !== before.status) {
        addJudgment(id, '待验证', `状态变更: ${before.status} → ${updates.status}`, before.status, updates.status);
      }
      if (updates.canonLevel && updates.canonLevel !== before.canonLevel) {
        const idxBefore = CANON_LEVELS.indexOf(before.canonLevel);
        const idxAfter = CANON_LEVELS.indexOf(updates.canonLevel);
        const op: JudgmentOperation = idxAfter > idxBefore ? '提升正典' : '收录';
        addJudgment(id, op, `正典等级变更: ${before.canonLevel} → ${updates.canonLevel}`, before.canonLevel, updates.canonLevel);
      }
    }
    setObjects(prev => {
      const updated = prev.map(o => o.id === id ? { ...o, ...updates, updatedAt: Date.now() } as WorldObject : o);
      const target = updated.find(o => o.id === id);
      if (target && activeBookId) {
        const objWithProject = { ...target, projectId: activeBookId };
        syncManager.enqueue('updateObject', objWithProject).catch(e => { console.error('Sync failed', e); showToast('自动同步失败', 'error'); });
        api.updateWorldObject(objWithProject).catch(e => {
          console.error('Failed to update object', e);
          showToast('保存失败', 'error');
        });
      }
      return updated;
    });
    triggerAutoSave();
  }, [activeBookId, objects, addJudgment, showToast, triggerAutoSave]);

  const onCreateObject = useCallback(async (templateType: ObjectType) => {
    const template = TEMPLATES.find(t => t.type === templateType);
    const now = Date.now();
    const newObj: WorldObject = {
      id: uid(), projectId: activeBookId || '', name: `新${templateType}`,
      type: templateType, status: (template?.defaultStatus ?? '草稿') as ObjectStatus,
      canonLevel: '未收录' as CanonLevel,
      tags: template?.defaultTags ?? [], aliases: [], selectedBoards: [],
      content: template?.defaultContent ?? '', referencesCount: 0, judgmentHistory: [],
      createdAt: now, updatedAt: now,
    };
    // Record for undo
    pushChangelog({ timestamp: now, action: 'create_object', objectId: newObj.id, snapshot: newObj });
    setObjects(prev => [...prev, newObj]);
    setSelectedObjectId(newObj.id);
    setActiveNavTab('文档');
    if (activeBookId) {
      syncManager.enqueue('createObject', newObj).catch(e => { console.error('Sync failed', e); showToast('自动同步失败', 'error'); });
      api.createWorldObject(newObj)
        .then(() => showToast(`已创建${templateType}`, 'success'))
        .catch(e => { console.error('Failed to create object', e); showToast('创建对象失败', 'error'); });
    }
  }, [activeBookId, showToast]);

  const onCreateCanvasObject = useCallback((templateType: ObjectType, board: CanvasTab, x: number, y: number) => {
    const template = TEMPLATES.find(t => t.type === templateType);
    const now = Date.now();
    const newObj: WorldObject = {
      id: uid(), projectId: activeBookId || "", name: `新${templateType}`,
      type: templateType, status: (template?.defaultStatus ?? '草稿') as ObjectStatus,
      canonLevel: '未收录' as CanonLevel,
      tags: template?.defaultTags ?? [], aliases: [], selectedBoards: [board],
      content: template?.defaultContent ?? '', referencesCount: 0, judgmentHistory: [],
      createdAt: now, updatedAt: now,
    };
    pushChangelog({ timestamp: now, action: 'create_object', objectId: newObj.id, snapshot: newObj });
    setObjects(prev => [...prev, newObj]);
    setSelectedObjectId(newObj.id);
    // Place the new object on the canvas at the double-clicked position
    setCanvasStates(prev => {
      const tabState = prev[board];
      if (!tabState) return prev;
      return {
        ...prev,
        [board]: {
          ...tabState,
          positions: {
            ...tabState.positions,
            [newObj.id]: { objectId: newObj.id, x, y }
          }
        }
      };
    });
    if (activeBookId) {
      syncManager.enqueue('createObject', newObj).catch(e => { console.error('Sync failed', e); showToast('自动同步失败', 'error'); });
      api.createWorldObject(newObj)
        .then(() => showToast(`已创建${templateType}`, "success"))
        .catch(e => { console.error('Failed to create object', e); showToast('创建对象失败', 'error'); });
    }
  }, [activeBookId, showToast]);

  const onCreateNamedObject = useCallback(async (name: string, objectType: ObjectType) => {
    const template = TEMPLATES.find(t => t.type === objectType);
    const now = Date.now();
    const newObj: WorldObject = {
      id: uid(), projectId: activeBookId || '', name,
      type: objectType, status: (template?.defaultStatus ?? '草稿') as ObjectStatus,
      canonLevel: '未收录' as CanonLevel,
      tags: template?.defaultTags ?? [], aliases: [], selectedBoards: [],
      content: template?.defaultContent ?? '', referencesCount: 0, judgmentHistory: [],
      createdAt: now, updatedAt: now,
    };
    pushChangelog({ timestamp: now, action: 'create_object', objectId: newObj.id, snapshot: newObj });
    setObjects(prev => [...prev, newObj]);
    setSelectedObjectId(newObj.id);
    setActiveNavTab('文档');
    if (activeBookId) {
      syncManager.enqueue('createObject', newObj).catch(e => { console.error('Sync failed', e); showToast('自动同步失败', 'error'); });
      api.createWorldObject(newObj)
        .then(() => showToast(`已创建「${name}」`, 'success'))
        .catch(e => { console.error('Failed to create named object', e); showToast('创建对象失败', 'error'); });
    }
  }, [activeBookId, showToast]);

  const onDeleteObject = useCallback(async (id: string) => {
    const obj = objects.find(o => o.id === id);
    if (obj) {
      pushChangelog({ timestamp: Date.now(), action: 'delete_object', objectId: id, snapshot: { ...obj } });
    }
    setObjects(prev => prev.filter(o => o.id !== id));
    if (selectedObjectId === id) setSelectedObjectId(null);
    syncManager.enqueue('deleteObject', { id }).catch(e => { console.error('Sync failed', e); showToast('自动同步失败', 'error'); });
    api.deleteWorldObject(id)
      .then(() => showToast('对象已删除', 'success'))
      .catch(e => { console.error('Failed to delete object', e); showToast('删除对象失败', 'error'); });
  }, [selectedObjectId, showToast]);

  const onNavigate = useCallback((name: string, id?: string) => {
    const target = id ? objects.find(o => o.id === id) : objects.find(o => o.name === name);
    if (target) { setSelectedObjectId(target.id); setActiveNavTab('文档'); }
  }, [objects]);

  const onSelectObject = useCallback((objectId: string | null) => {
    setSelectedObjectId(objectId);
  }, []);

  const onAddToBoard = useCallback((objectId: string, board: string) => {
    setObjects(prev => prev.map(o => {
      if (o.id !== objectId || o.selectedBoards.includes(board)) return o;
      const updated = { ...o, selectedBoards: [...o.selectedBoards, board], updatedAt: Date.now() };
      if (activeBookId) {
        syncManager.enqueue('updateObject', { ...updated, projectId: activeBookId }).catch(e => { console.error('Sync failed', e); showToast('自动同步失败', 'error'); });
        api.updateWorldObject({ ...updated, projectId: activeBookId })
          .then(() => showToast(`已放入「${board}」`, 'success'))
          .catch(e => { console.error('Failed to update board', e); showToast('加入画板失败', 'error'); });
      }
      return updated;
    }));
  }, [activeBookId, showToast]);

  const onInspectorAction = useCallback((action: string, objectId: string, extra?: string) => {
    switch (action) {
      case '收录为设定': {
        const obj = objects.find(o => o.id === objectId);
        if (!obj || obj.canonLevel !== '未收录') return;
        addJudgment(objectId, '提升正典', '收录为设定', obj.canonLevel, '草案正典');
        setObjects(prev => prev.map(o =>
          o.id === objectId ? { ...o, canonLevel: '草案正典' as CanonLevel, updatedAt: Date.now() } : o
        ));
        break;
      }
      case '放入画板': if (extra) onAddToBoard(objectId, extra); break;
      case '锁定': onLockObject(objectId, extra || ''); break;
      case '废弃': onDiscardObject(objectId, extra || ''); break;
      case '解锁': onUnlockObject(objectId, extra || ''); break;
      case '查看引用': {
        const obj = objects.find(o => o.id === objectId);
        if (obj) { const ref = objects.find(o => o.id !== obj.id && o.content.includes(obj.name)); if (ref) onNavigate(ref.name); }
        break;
      }
      case '判断记录': setSelectedObjectId(objectId); setActiveNavTab('判断记录'); break;
    }
  }, [objects, onAddToBoard, onLockObject, onDiscardObject, onUnlockObject, addJudgment, onNavigate]);

  // ══════════════════════════════════════════
  //  Canvas Operations
  // ══════════════════════════════════════════

  const saveCanvasState = useCallback(async (tabId: CanvasTab, state: Partial<CanvasTabState>) => {
    if (!activeBookId) return;
    const current = canvasStates[tabId];
    const merged: CanvasTabState = { ...current, ...state };
    setCanvasStates(prev => ({ ...prev, [tabId]: merged }));
    const canvasRecord: CanvasTabState = { ...merged, tabId };
    const canvasId = `${activeBookId}:${tabId}`;
    const version = Date.now();
    syncManager.enqueue('saveCanvasState', { ...canvasRecord, id: canvasId, projectId: activeBookId, version }).catch(e => { console.error('Sync failed', e); showToast('自动同步失败', 'error'); });
    api.saveCanvasTabState({ ...canvasRecord, id: canvasId, projectId: activeBookId, version })
      .then((resp: any) => {
        if (resp && resp.error === 'VERSION_CONFLICT') {
          showToast('版本冲突，已重新加载画板状态', 'error');
          loadProjectData(activeBookId);
        }
      })
      .catch(e => { console.error('Failed to save canvas state', e); showToast('画板保存失败', 'error'); });
  }, [activeBookId, canvasStates, showToast, loadProjectData]);

  const onUpdateCanvasState = useCallback((tabId: CanvasTab, state: Partial<CanvasTabState>) => {
    // Record for undo if positions changed
    if (state.positions) {
      const current = canvasStatesRef.current[tabId];
      pushChangelog({
        timestamp: Date.now(),
        action: 'update_canvas_state',
        objectId: tabId,
        snapshot: { [tabId]: { ...current } },
      });
    }
    saveCanvasState(tabId, state);
  }, [saveCanvasState]);

  const onAddConnection = useCallback(async (sourceId: string, targetId: string, type: string, label: string) => {
    if (!activeBookId) return;
    const newConn: Connection = {
      id: cid(), sourceId, targetId, type: type as any, label,
      projectId: activeBookId,
    };
    setConnections(prev => [...prev, newConn]);
    setCanvasStates(prev => {
      const next = { ...prev } as Record<CanvasTab, CanvasTabState>;
      for (const tab of CANVAS_TABS) {
        const s = next[tab];
        if (s.positions[sourceId] && s.positions[targetId]) {
          next[tab] = { ...s, connections: [...s.connections, newConn] };
        }
      }
      return next;
    });
    syncManager.enqueue('createConnection', newConn).catch(e => { console.error('Sync failed', e); showToast('自动同步失败', 'error'); });
    api.createConnection(newConn).catch(e => { console.error('Failed to create connection', e); showToast('创建连线失败', 'error'); });
  }, [activeBookId, showToast]);

  const onAddSticky = useCallback((tabId: CanvasTab, text: string) => {
    setCanvasStates(prev => ({
      ...prev,
      [tabId]: { ...prev[tabId], stickyNotes: [...prev[tabId].stickyNotes, { id: `sticky_${_nextId++}`, text, x: 100, y: 100, width: 160, height: 100, color: '#3E2723' }] }
    }));
  }, []);

  const onCanvasCreateObject = useCallback((templateType: ObjectType, x: number, y: number, tabId: CanvasTab) => {
    const template = TEMPLATES.find(t => t.type === templateType);
    const now = Date.now();
    const newObj: WorldObject = {
      id: uid(), projectId: activeBookId || '', name: `新${templateType}`,
      type: templateType, status: (template?.defaultStatus ?? '草稿') as ObjectStatus,
      canonLevel: '未收录' as CanonLevel,
      tags: template?.defaultTags ?? [], aliases: [], selectedBoards: [tabId],
      content: template?.defaultContent ?? '', referencesCount: 0, judgmentHistory: [],
      createdAt: now, updatedAt: now,
    };
    pushChangelog({ timestamp: now, action: 'create_object', objectId: newObj.id, snapshot: newObj });
    setObjects(prev => [...prev, newObj]);
    setSelectedObjectId(newObj.id);
    if (activeBookId) {
      syncManager.enqueue('createObject', newObj).catch(e => { console.error('Sync failed', e); showToast('自动同步失败', 'error'); });
      api.createWorldObject(newObj)
        .then(() => showToast(`已创建${templateType}`, 'success'))
        .catch(e => { console.error('Failed to create object', e); showToast('创建对象失败', 'error'); });
    }
    setCanvasStates(prev => {
      const tab = prev[tabId];
      if (!tab) return prev;
      return {
        ...prev,
        [tabId]: { ...tab, positions: { ...tab.positions, [newObj.id]: { objectId: newObj.id, x, y } } },
      } as Record<CanvasTab, CanvasTabState>;
    });
  }, [activeBookId, showToast]);

  function renderTypeIcon(type: string, size: number = 14) {
    switch (type) {
      case '人物': return <User size={size} />;
      case '地点': return <MapPin size={size} />;
      case '组织': return <Building2 size={size} />;
      case '规则/机制': return <Settings size={size} />;
      case '事件': return <Calendar size={size} />;
      case '物品': return <Package size={size} />;
      case '术语': return <BookOpen size={size} />;
      case '章节': return <FileText size={size} />;
      default: return <FileText size={size} />;
    }
  }

  // const NAV_TABS: NavTab[] = ['文档', '画板', '设定集', '判断记录', 'AI'];
  // Compute total word count for status bar
  const totalWordCount = useMemo(() => {
    return objects.reduce((sum, o) => sum + countWords(o.content || ''), 0);
  }, [objects]);

  // Compute total wiki link count for status bar
  const totalLinkCount = useMemo(() => {
    return objects.reduce((sum, o) => {
      const matches = (o.content || '').match(/\[\[([^\]]+)\]\]/g);
      return sum + (matches ? matches.length : 0);
    }, 0);
  }, [objects]);

  // Compute total canvas node count for status bar
  const totalCanvasNodeCount = useMemo(() => {
    let count = 0;
    for (const tab of CANVAS_TABS) {
      count += Object.keys(canvasStates[tab]?.positions || {}).length;
    }
    return count;
  }, [canvasStates]);

  const renderMainContent = () => {
    // D3: Legacy view overrides pipeline stages
    if (legacyView) {
      switch (legacyView) {
        case 'canvas': return <CanvasView
          allObjects={objects} connections={connections} canvasStates={canvasStates}
          selectedObjectId={selectedObjectId} onSelectObject={onSelectObject}
          onNavigate={onNavigate} onUpdateCanvasState={onUpdateCanvasState}
          onAddConnection={onAddConnection} onAddSticky={onAddSticky}
          onAddToBoard={onAddToBoard} onCreateObject={onCreateObject}
          onCreateCanvasObject={onCreateCanvasObject}
        />;
        case 'ai-chat': return <AIChat
          allObjects={objects}
          activeBookId={activeBookId}
          onNavigate={onNavigate}
          onUpdateObject={onUpdateObject}
          onShowToast={showToast}
          onCreateObject={(templateType: string) => onCreateObject(templateType as ObjectType)}
        />;
        case 'setting-collection': return <SettingCollection
          allObjects={objects} onSelectObject={onSelectObject}
          onNavigate={onNavigate} onUpdateObject={onUpdateObject}
          onCreateObject={onCreateObject} defaultSelected={settingDefaultSelected}
        />;
        default: break;
      }
    }

    if (currentStage) {
      const stageInfo = canvasStages.find(s => s.stage === currentStage);
      const status = (stageInfo?.status || 'active') as 'locked' | 'ready' | 'active' | 'done';
      switch (currentStage) {
        case 'premise': return (
          <CanvasShell stage="premise" status={status}>
            <PremiseEntryGate />
          </CanvasShell>
        );
        case 'structure': return (
          <CanvasShell stage="structure" status={status}>
            <StructureFlowView />
          </CanvasShell>
        );
        case 'setting': return (
          <CanvasShell stage="setting" status={status}>
            <SettingCanvasV2 />
          </CanvasShell>
        );
        case 'packet': return (
          <CanvasShell stage="packet" status={status}>
            <ChapterPacketCanvas initialPacketId={targetPacketId} />
          </CanvasShell>
        );
        case 'text': return (
          <CanvasShell stage="text" status={status}>
            <TextCanvas
              currentObject={currentObject} allObjects={objects} allBoardTabs={allBoardTabs}
              onUpdateObject={onUpdateObject} onNavigate={onNavigate} onAddToBoard={onAddToBoard}
              onLockObject={onLockObject} onDiscardObject={onDiscardObject}
              onCreateObject={onCreateObject} onCreateNamedObject={onCreateNamedObject}
              saveStatus={saveStatus} onTriggerSave={triggerAutoSave}
              projectName={activeBook?.title || ''}
            />
          </CanvasShell>
        );
        default: return null;
      }
    }
    switch (activeNavTab) {
      case '文档': return <DocumentView
        currentObject={currentObject} allObjects={objects} allBoardTabs={allBoardTabs}
        onUpdateObject={onUpdateObject} onNavigate={onNavigate} onAddToBoard={onAddToBoard}
        onLockObject={onLockObject} onDiscardObject={onDiscardObject}
        onCreateObject={onCreateObject} onCreateNamedObject={onCreateNamedObject}
        saveStatus={saveStatus} onTriggerSave={triggerAutoSave}

      />;
      case '画板': return <CanvasView
        allObjects={objects} connections={connections} canvasStates={canvasStates}
        selectedObjectId={selectedObjectId} onSelectObject={onSelectObject}
        onNavigate={onNavigate} onUpdateCanvasState={onUpdateCanvasState}
        onAddConnection={onAddConnection} onAddSticky={onAddSticky}
        onAddToBoard={onAddToBoard} onCreateObject={onCreateObject}
        onCreateCanvasObject={onCreateCanvasObject}

      />;
      case '设定集': return <SettingCollection
        allObjects={objects} onSelectObject={onSelectObject}
        onNavigate={onNavigate} onUpdateObject={onUpdateObject}
        onCreateObject={onCreateObject} defaultSelected={settingDefaultSelected}
      />;
      case '判断记录': return <JudgmentRecords allObjects={objects} onNavigate={onNavigate} />;
      case 'AI': return <AIChat
        allObjects={objects}
        activeBookId={activeBookId}
        onNavigate={onNavigate}
        onUpdateObject={onUpdateObject}
        onShowToast={showToast}
        onCreateObject={(templateType: string) => onCreateObject(templateType as ObjectType)}
      />;
      default: return null;
    }
  };

  if (projectsLoading) {
    return (
      <div className="app-layout app-loading">
        <div className="spinner" />
        <p style={{ color: '#888' }}>加载中...</p>
      </div>
    );
  }



  return (
    <div className="app-layout">
      {activeBookId === null ? (
        <Bookshelf projects={bookshelfProjects} onEnterProject={handleEnterProject} onCreateProject={handleCreateProjectClick} />
      ) : (
        <>
          {isOffline && (
            <div className="offline-banner">离线 ● 当前处于离线状态，编辑内容将在恢复连接后自动同步。</div>
          )}
          <PipelineNav
            stages={canvasStages.map(s => ({ stage: s.stage, status: s.status })) as any}
            currentStage={currentStage || 'premise'}
            onStageClick={handleStageChange}
            onBack={handleBackToBookshelf}
            projectTitle={activeBook?.title ?? '设定管理器'}
            onSettingsClick={() => setShowAiSettings(true)}
            onLegacySelect={handleLegacySelect}
          />
          <div className="main-area">
            <div className="main-content">{renderMainContent()}</div>
            {!currentStage && <Inspector object={currentObject} allObjects={objects} allBoardTabs={allBoardTabs} onNavigate={onNavigate} onAction={onInspectorAction} />}
          </div>
          <CanvasAiBar stage={currentStage || 'premise'} />
          {/* Bottom StatusBar */}
          <StatusBar
            saveStatus={saveStatus}
            wordCount={totalWordCount}
            linkCount={totalLinkCount}
            onRetrySave={() => { syncManager.retryFailed(); }}
          />

          {/* Feedback trigger & modal (v2.0.1) */}
          <FeedbackTrigger
            projectId={activeBookId}
            onOpen={() => setShowFeedback(true)}
          />
          {showFeedback && (
            <FeedbackModal
              projectId={activeBookId}
              onClose={() => setShowFeedback(false)}
            />
          )}
        </>
      )}

      {/* Creation Wizard (P1-01) */}
      {showCreationWizard && (
        <CreationWizard
          lastGenre={lastGenre}
          onConfirm={(title, genre, templateId) => handleCreateProjectFromWizard(title, genre, templateId)}
          onCancel={() => setShowCreationWizard(false)}
        />
      )}

      {/* First Launch Guide (P1-02) */}
      {showGuide && activeBookId && (
        <FirstLaunchGuide
          projectId={activeBookId}
          onDismiss={() => {
            setShowGuide(false);
            if (activeBookId) markGuideDone(activeBookId);
          }}
        />
      )}

      {/* Canon Guide Card (P1-07) */}
      {showCanonGuide && activeBookId && (
        <CanonGuideCard
          onDismiss={(dontShowAgain) => {
            setShowCanonGuide(false);
            if (dontShowAgain && activeBookId) {
              try { localStorage.setItem(`glyph-canon-guide-done-${activeBookId}`, 'true'); } catch {}
            }
          }}
        />
      )}

      {/* Global Search (P1-08) */}
      <GlobalSearch
        objects={objects}
        isOpen={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
        onNavigate={onNavigate}
      />
      
      {/* AI Settings (v1.3) */}
      {showAiSettings && <AiSettings
        providers={aiProviders}
        activeModelId={aiActiveModelId}
        usageStats={aiUsageStats}
        onClose={() => setShowAiSettings(false)}
        onSaveProviders={async (providers) => {
          setAiProviders(providers);
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            for (const p of providers) {
              if (p.apiKey) {
                await invoke('store_api_key', { provider: p.id, key: p.apiKey });
              }
            }
          } catch {}
        }}
        onChangeModel={(modelId) => setAiActiveModelId(modelId)}
        onSaveBudget={async (budget) => {
          setAiUsageStats(prev => ({ ...prev, budgetLimit: budget }));
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('set_budget_limit', { limit: budget * 1000 });
          } catch {}
        }}
      />}
    </div>
  );
}










