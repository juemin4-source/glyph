/**
 * Glyph App v0.1 — Writing-first experience.
 *
 * Screens:
 *   1. Bookshelf (project list)
 *   2. Workspace: TopBar + [DocOutline | DocumentView] + StatusBar
 *
 * Explicitly NOT in this version:
 *   - AI (Chat, CanvasAiBar, Settings)
 *   - Writing pipeline (5-stage canvas, PipelineNav)
 *   - Setting Collection
 *   - Judgment Records
 *   - Canvas board view
 *   - Quick Draft, Feedback
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { BookOpen, PanelLeftClose, PanelLeft } from 'lucide-react';
import type { WorldObject, ObjectType, ObjectStatus, CanonLevel, SaveStatus, ChangelogEntry } from './types/world';
import { CANON_LEVELS } from './types/world';
import type { Project } from './types/world';

import * as api from './tauri-api';
import { countWords, isHtmlContent, htmlToMarkdown } from './utils/markdown';
import { SyncManager } from './lib/SyncManager';
import { Changelog } from './lib/Changelog';

import Bookshelf from './components/Bookshelf';
import DocumentView from './components/DocumentView';
import DocOutline from './components/DocOutline';
import StatusBar from './components/StatusBar';
import CreationWizard from './components/CreationWizard';
import GlobalSearch from './components/GlobalSearch';
import { ToastProvider, useToast } from './components/Toast';

import './styles/global.css';
import './styles/variables.css';
import './styles/editor.css';
import './styles/ai.css';
import './components/ui/design-tokens.css';

// ── IDs ──
function uid(): string { return `obj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

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

  // ── Project state ──
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeBookTitle, setActiveBookTitle] = useState('');

  // ── Object state ──
  const [objects, setObjects] = useState<WorldObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  // ── UI state ──
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [showOutline, setShowOutline] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showCreationWizard, setShowCreationWizard] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [lastGenre, setLastGenre] = useState('科幻');
  const [changelogEntries, setChangelogEntries] = useState<ChangelogEntry[]>([]);

  // ── SyncManager ──
  useEffect(() => {
    syncManager.startPing();
    syncManager.onSaveStatusChange((status) => setSaveStatus(status));
    return () => { syncManager.stopPing(); };
  }, []);

  // ── Online/offline ──
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

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(prev => !prev);
      }
      if (isCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((isCtrl && e.key === 'z' && e.shiftKey) || (isCtrl && e.key === 'Z')) {
        e.preventDefault();
        handleRedo();
      }
      // Glyph v0.1: Ctrl+Shift+F toggles focus mode
      if (isCtrl && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setFocusMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [objects, selectedObjectId]);

  // ── Undo/Redo ──
  const handleUndo = () => {
    const entry = changelog.undo();
    if (!entry) { showToast('没有可撤销的操作', 'info'); return; }
    switch (entry.action) {
      case 'delete_object':
        setObjects(prev => [...prev, entry.snapshot as WorldObject]);
        setSelectedObjectId(entry.objectId);
        break;
      case 'create_object':
        setObjects(prev => prev.filter(o => o.id !== entry.objectId));
        if (selectedObjectId === entry.objectId) setSelectedObjectId(null);
        break;
    }
  };

  const handleRedo = () => {
    const entry = changelog.redo();
    if (!entry) { showToast('没有可重做的操作', 'info'); return; }
    switch (entry.action) {
      case 'delete_object':
        setObjects(prev => prev.filter(o => o.id !== entry.objectId));
        if (selectedObjectId === entry.objectId) setSelectedObjectId(null);
        break;
      case 'create_object':
        setObjects(prev => [...prev, entry.snapshot as WorldObject]);
        setSelectedObjectId(entry.objectId);
        break;
    }
  };

  const pushChangelog = useCallback((entry: ChangelogEntry) => {
    changelog.push(entry);
    setChangelogEntries(prev => [...prev, entry]);
  }, []);

  // ── Load projects on mount ──
  useEffect(() => {
    Promise.resolve(api.listProjects?.() ?? [])
      .then(dtos => setProjects(dtos.map(mapDTOtoProject)))
      .catch(e => console.error('Failed to load projects', e))
      .finally(() => setProjectsLoading(false));
  }, []);

  // ── Derived state ──
  const currentObject = useMemo(
    () => objects.find(o => o.id === selectedObjectId) || null,
    [objects, selectedObjectId]
  );

  const wikiLinksCount = useMemo(() => {
    if (!currentObject?.content) return 0;
    const matches = currentObject.content.match(/\[\[([^\]]+)\]\]/g);
    return matches ? matches.length : 0;
  }, [currentObject?.content]);

  // Glyph v0.1: Total word count across all objects in the project
  const totalWordCount = useMemo(() => {
    return objects.reduce((sum, obj) => sum + countWords(obj.content || ''), 0);
  }, [objects]);

  // ── Load project data ──
  const loadProjectData = useCallback(async (projectId: string) => {
    try {
      const objs = await api.listWorldObjects(projectId);
      const migratedObjs = objs.map(obj =>
        isHtmlContent(obj.content) ? { ...obj, content: htmlToMarkdown(obj.content) } : obj
      );
      setObjects(migratedObjs);
      setSelectedObjectId(migratedObjs.length > 0 ? migratedObjs[0].id : null);
      changelog.clear();
      setChangelogEntries([]);
    } catch (e) {
      console.error('Failed to load project data', e);
      showToast('加载项目数据失败', 'error');
      setObjects([]);
      setSelectedObjectId(null);
    }
  }, [showToast]);

  // ── Refresh projects ──
  const refreshProjects = useCallback(async () => {
    try {
      const dtos = await api.listProjects();
      setProjects(dtos.map(mapDTOtoProject));
    } catch (e) {
      console.error('Failed to refresh projects', e);
      showToast('刷新项目列表失败', 'error');
    }
  }, [showToast]);

  // ── Enter/leave project ──
  const handleEnterProject = useCallback(async (project: Project) => {
    setActiveBookId(project.id);
    setActiveBookTitle(project.title);
    await loadProjectData(project.id);
  }, [loadProjectData]);

  const handleBackToBookshelf = useCallback(() => {
    setActiveBookId(null);
    setSelectedObjectId(null);
    setObjects([]);
    setActiveBookTitle('');
    changelog.clear();
    setChangelogEntries([]);
  }, []);

  // ── Create project ──
  const handleCreateProjectFromWizard = useCallback(async (title: string, genre: string, _templateId: string | null) => {
    try {
      setLastGenre(genre);
      const dto = await mapProjectToCreate(title, genre);
      const project = mapDTOtoProject(dto);
      await refreshProjects();
      setShowCreationWizard(false);
      setActiveBookId(project.id);
      setActiveBookTitle(project.title);
      setObjects([]);
      setSelectedObjectId(null);
      showToast(`作品「${title}」已创建`, 'success');
    } catch (e) {
      console.error('Failed to create project', e);
      showToast('创建作品失败', 'error');
    }
  }, [refreshProjects, showToast]);

  // ── Object CRUD ──
  const onUpdateObject = useCallback(async (id: string, updates: Partial<WorldObject>) => {
    setObjects(prev => {
      const updated = prev.map(o => o.id === id ? { ...o, ...updates, updatedAt: Date.now() } as WorldObject : o);
      return updated;
    });
    // Persist to backend
    const target = objects.find(o => o.id === id);
    if (target && activeBookId) {
      const obj = { ...target, ...updates, projectId: activeBookId };
      const ok = await syncManager.writeObject('updateObject', obj);
      if (!ok) showToast('保存失败，请重试', 'error');
    }
    triggerAutoSave();
  }, [activeBookId, objects, showToast]);

  const onCreateObject = useCallback(async (templateType: ObjectType) => {
    const now = Date.now();
    const newObj: WorldObject = {
      id: uid(), projectId: activeBookId || '', name: `新${templateType}`,
      type: templateType, status: '草稿' as ObjectStatus,
      canonLevel: '未收录' as CanonLevel,
      tags: [], aliases: [], selectedBoards: [],
      content: '', referencesCount: 0, judgmentHistory: [],
      createdAt: now, updatedAt: now,
      parentId: null, sortOrder: 0,
    };
    pushChangelog({ timestamp: now, action: 'create_object', objectId: newObj.id, snapshot: newObj });
    setObjects(prev => [...prev, newObj]);
    setSelectedObjectId(newObj.id);
    if (activeBookId) {
      const ok = await syncManager.writeObject('createObject', { ...newObj, projectId: activeBookId });
      if (ok) showToast(`已创建${templateType}`, 'success');
      else showToast('创建失败', 'error');
    }
  }, [activeBookId, showToast]);

  const onDeleteObject = useCallback(async (id: string) => {
    const obj = objects.find(o => o.id === id);
    if (obj) pushChangelog({ timestamp: Date.now(), action: 'delete_object', objectId: id, snapshot: { ...obj } });
    setObjects(prev => prev.filter(o => o.id !== id));
    if (selectedObjectId === id) setSelectedObjectId(objects.find(o => o.id !== id)?.id || null);
    const ok = await syncManager.writeObject('deleteObject', { id });
    if (ok) showToast('已删除', 'success');
    else showToast('删除失败', 'error');
  }, [objects, selectedObjectId, showToast]);

  const onNavigate = useCallback((name: string, id?: string) => {
    const target = id ? objects.find(o => o.id === id) : objects.find(o => o.name === name);
    if (target) setSelectedObjectId(target.id);
  }, [objects]);

  const onSelectObject = useCallback((id: string | null) => {
    setSelectedObjectId(id);
  }, []);

  // ── Glyph v0.1: Outline reorder handler ──
  const onReorderOutline = useCallback(async (objectId: string, newParentId: string | null, newSortOrder: number) => {
    // Optimistic local update
    setObjects(prev => prev.map(o =>
      o.id === objectId ? { ...o, parentId: newParentId, sortOrder: newSortOrder, updatedAt: Date.now() } as WorldObject : o
    ));
    // Persist to backend
    try {
      await api.reorderOutline(objectId, newParentId, newSortOrder);
    } catch (e) {
      console.error('Failed to reorder outline', e);
      showToast('排序保存失败', 'error');
    }
  }, [showToast]);

  // ── Auto-save ──
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('unsaved');
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving');
      setTimeout(() => { setSaveStatus('saved'); }, 800);
    }, 500);
  }, []);

  // ── Helpers ──
  function mapDTOtoProject(dto: api.ProjectDTO): Project {
    let gradient: [string, string] = ['#6366f1', '#8b5cf6'];
    try {
      const g = JSON.parse(dto.gradient);
      if (Array.isArray(g) && g.length >= 2) gradient = [g[0], g[1]];
    } catch {}
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

  // ════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════

  // ── Loading ──
  if (projectsLoading) {
    return (
      <div className="app-layout app-loading">
        <div className="spinner" />
        <p style={{ color: '#888' }}>加载中...</p>
      </div>
    );
  }

  // ── Bookshelf ──
  if (activeBookId === null) {
    return (
      <div className="app-layout">
        <Bookshelf
          projects={projects}
          onEnterProject={handleEnterProject}
          onCreateProject={() => setShowCreationWizard(true)}
          onRefreshProjects={refreshProjects}
        />

        {showCreationWizard && (
          <CreationWizard
            lastGenre={lastGenre}
            onConfirm={(title, genre, templateId) =>
              handleCreateProjectFromWizard(title, genre, templateId)
            }
            onCancel={() => setShowCreationWizard(false)}
          />
        )}

        <GlobalSearch
          objects={objects}
          isOpen={showGlobalSearch}
          onClose={() => setShowGlobalSearch(false)}
          onNavigate={onNavigate}
        />
      </div>
    );
  }

  // ── Workspace ──
  return (
    <div className={`app-layout ${focusMode ? 'focus-mode' : ''}`}>
      {isOffline && (
        <div className="offline-banner">离线 ● 当前处于离线状态</div>
      )}

      {/* Top Bar */}
      <header className="glyph-topbar">
        <button
          className="glyph-topbar-btn"
          onClick={handleBackToBookshelf}
          title="返回书架"
        >
          <BookOpen size={18} />
        </button>

        <span className="glyph-topbar-title">{activeBookTitle}</span>

        <div className="glyph-topbar-spacer" />

        <button
          className="glyph-topbar-btn"
          onClick={() => setFocusMode(v => !v)}
          title={`专注模式 (Ctrl+Shift+F) ${focusMode ? '(已开启)' : ''}`}
          style={{ color: focusMode ? 'var(--accent, #B7FF00)' : undefined }}
        >
          {focusMode ? '✎' : '📝'}
        </button>

        <button
          className="glyph-topbar-btn"
          onClick={() => setShowOutline(v => !v)}
          title={showOutline ? '隐藏大纲' : '显示大纲'}
        >
          {showOutline ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
        </button>

      </header>

      {/* Main area */}
      <div className="glyph-workspace">
        {showOutline && !focusMode && (
          <aside className="glyph-sidebar">
            <DocOutline
              allObjects={objects}
              currentObjectId={selectedObjectId}
              currentObjectContent={currentObject?.content}
              onNavigate={onNavigate}
              onCreateObject={onCreateObject}
              onReorderOutline={onReorderOutline}
            />
          </aside>
        )}

        <main className={`glyph-main ${focusMode ? 'glyph-main-focus' : ''}`}>
          <DocumentView
            currentObject={currentObject}
            allObjects={objects}
            allBoardTabs={[]}
            onUpdateObject={onUpdateObject}
            onNavigate={onNavigate}
            onAddToBoard={() => {}}
            onLockObject={() => {}}
            onDiscardObject={() => {}}
            onCreateObject={onCreateObject}
            saveStatus={saveStatus}
            onTriggerSave={triggerAutoSave}
          />
        </main>
      </div>

      {/* Status Bar */}
      <StatusBar
        saveStatus={saveStatus}
        wordCount={currentObject ? countWords(currentObject.content || '') : 0}
        totalProjectWordCount={totalWordCount}
        linkCount={wikiLinksCount}
        onRetrySave={() => { syncManager.retryFailed(); }}
        className={focusMode ? 'status-bar-focus' : ''}
      />

      {/* Modals */}
      {showCreationWizard && (
        <CreationWizard
          lastGenre={lastGenre}
          onConfirm={(title, genre, templateId) =>
            handleCreateProjectFromWizard(title, genre, templateId)
          }
          onCancel={() => setShowCreationWizard(false)}
        />
      )}

      <GlobalSearch
        objects={objects}
        isOpen={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
        onNavigate={onNavigate}
      />
    </div>
  );
}
