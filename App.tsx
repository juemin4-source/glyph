import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Maximize, Minimize, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { Project } from './types/world';
import type { FileSyncStatus, FsProject } from './types/fs';
import type { AiWriteProposal, EditorSelectionContext, ProjectAiPlan } from './types/fs-ai';
import * as api from './tauri-api';
import { countWords } from './utils/markdown';
import { ToastProvider, useToast } from './components/Toast';
import FsWelcome from './components/FsWelcome';
import FsProjectCreateDialog from './components/FsProjectCreateDialog';
import FileTree from './components/FileTree';
import FsDocumentView from './components/FsDocumentView';
import FsAiPanel from './components/FsAiPanel';
import AiHistoryPanel from './components/AiHistoryPanel';
import EntityPanel from './components/EntityPanel';
import SchemaSection from './components/SchemaSection';
import { useFsStore } from './stores/fsStore';
import { useCanonStore } from './stores/canonStore';
import { useExternalChangeDetector } from './hooks/useExternalChangeDetector';

import './styles/global.css';
import './styles/variables.css';
import './styles/editor.css';
import './styles/fs.css';
import './components/ui/design-tokens.css';

function mapLegacyProject(dto: api.ProjectDTO): Project {
  let gradient: [string, string] = ['#6366f1', '#8b5cf6'];
  try {
    const parsed = JSON.parse(dto.gradient);
    if (Array.isArray(parsed) && parsed.length >= 2) gradient = [parsed[0], parsed[1]];
  } catch {
    // Keep the fallback cover colors. Migration does not depend on cover metadata.
  }
  return {
    id: dto.id,
    title: dto.name,
    genre: dto.genre || '未分类',
    status: (dto.status as Project['status']) || 'conceiving',
    wordCount: dto.wordCount || 0,
    gradient,
  };
}

function safeFolderName(name: string): string {
  return name.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/[. ]+$/g, '') || '未命名作品';
}

function joinPath(parent: string, child: string): string {
  return `${parent.replace(/[\\/]+$/, '')}/${child}`;
}

function normalizeRoot(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  return /^[A-Za-z]:\//.test(normalized) ? normalized.toLowerCase() : normalized;
}

function statusLabel(status: FileSyncStatus): string {
  switch (status) {
    case 'clean': return '已保存';
    case 'dirty': return '未保存';
    case 'saving': return '正在保存';
    case 'save-error': return '保存失败';
    case 'conflict': return '外部冲突';
    case 'missing': return '文件已丢失';
  }
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

function AppInner() {
  const { showToast } = useToast();
  const {
    fsProjects,
    loading,
    error,
    activeProject,
    openFilePath,
    openFileName,
    fileContent,
    fileStatus,
    externalConflict,
    contentRevision,
    viewport,
    loadProjects,
    createProject,
    openProject,
    openFile,
    closeProject,
    removeProject,
    saveCurrentFile,
    handleExternalChanges,
    useExternalVersion,
    overwriteExternalVersion,
    saveConflictCopy,
    saveMissingCopy,
    prepareAiWrite,
    commitAiWrite,
    updateContent,
    updateViewport,
    persistSession,
    clearError,
    sourceMode,
    provenance,
    setSourceMode,
  } = useFsStore();

  const [legacyProjects, setLegacyProjects] = useState<Project[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [aiPanelTab, setAiPanelTab] = useState<'task' | 'history' | 'canon'>('task');
  const [editorSelection, setEditorSelection] = useState<EditorSelectionContext | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeInProgress = useRef(false);

  useEffect(() => {
    void loadProjects();
    void api.listProjects()
      .then((projects) => setLegacyProjects(projects.map(mapLegacyProject)))
      .catch(() => setLegacyProjects([]));
  }, [loadProjects]);

  useEffect(() => {
    if (!error) return;
    showToast(error, fileStatus === 'conflict' || fileStatus === 'missing' ? 'warning' : 'error');
    clearError();
  }, [error, fileStatus, showToast, clearError]);

  useEffect(() => {
    const root = activeProject?.rootPath;
    if (!root) return;
    void api.watchProject(root).catch((watchError) => {
      console.warn('[watcher] failed to start', watchError);
      showToast('无法监控外部文件变化', 'warning');
    });
    return () => {
      void api.unwatchProject(root).catch(() => undefined);
    };
  }, [activeProject?.rootPath, showToast]);

  const onExternalChange = useCallback(async (event: { projectRoot: string; paths: string[] }) => {
    if (!activeProject || normalizeRoot(event.projectRoot) !== normalizeRoot(activeProject.rootPath)) return;
    const result = await handleExternalChanges(event.paths);
    if (result === 'reloaded') showToast('文件已被外部修改，已重新加载', 'info');
    if (result === 'conflict') showToast('检测到外部修改，自动保存已暂停', 'warning');
    if (result === 'missing') showToast('当前文件已被移动或删除', 'warning');
  }, [activeProject, handleExternalChanges, showToast]);

  useExternalChangeDetector(activeProject?.rootPath ?? null, onExternalChange);

  // One owner for automatic saves. Conflict and missing states never auto-write.
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (fileStatus !== 'dirty') return;
    autoSaveTimer.current = setTimeout(() => {
      void saveCurrentFile();
    }, 1_500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [fileStatus, fileContent, saveCurrentFile]);

  // Session state is auxiliary and persisted independently from document content.
  useEffect(() => {
    if (!activeProject) return;
    if (sessionTimer.current) clearTimeout(sessionTimer.current);
    sessionTimer.current = setTimeout(() => void persistSession(), 700);
    return () => {
      if (sessionTimer.current) clearTimeout(sessionTimer.current);
    };
  }, [activeProject, openFilePath, viewport, persistSession]);

  useEffect(() => {
    if (!activeProject) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') void persistSession();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [activeProject, persistSession]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    void import('@tauri-apps/api/window')
      .then(async ({ getCurrentWindow }) => {
        const appWindow = getCurrentWindow();
        const stop = await appWindow.onCloseRequested(async (event) => {
          event.preventDefault();
          if (closeInProgress.current) return;
          closeInProgress.current = true;

          try {
            const state = useFsStore.getState();
            if (!state.activeProject) {
              await appWindow.destroy();
              return;
            }

            if (state.fileStatus === 'conflict') {
              const confirmed = window.confirm('当前正文与外部版本存在冲突。关闭前将自动保存一份“本地冲突”副本，是否继续？');
              if (!confirmed) return;
              const copy = await state.saveConflictCopy();
              if (!copy) {
                showToast('无法保存冲突副本，窗口保持打开。', 'error');
                return;
              }
            } else if (state.fileStatus === 'missing') {
              const confirmed = window.confirm('原文件已经不存在。关闭前将自动保存恢复副本，是否继续？');
              if (!confirmed) return;
              const copy = await state.saveMissingCopy();
              if (!copy) {
                showToast('无法保存恢复副本，窗口保持打开。', 'error');
                return;
              }
            } else {
              const closed = await state.closeProject();
              if (!closed) {
                const confirmed = window.confirm('当前正文无法正常保存。是否另存一份恢复副本后退出？');
                if (!confirmed) return;
                const copy = await useFsStore.getState().saveMissingCopy();
                if (!copy) {
                  showToast('恢复副本保存失败，窗口保持打开。', 'error');
                  return;
                }
              }
            }

            await useFsStore.getState().persistSession();
            await appWindow.destroy();
          } catch (closeError) {
            console.error('[window] close failed', closeError);
            showToast(`关闭失败：${String(closeError)}`, 'error');
          } finally {
            closeInProgress.current = false;
          }
        });
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch((closeSetupError) => {
        console.warn('[window] failed to register close handler', closeSetupError);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [showToast]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setFocusMode((value) => !value);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleOpenDirectory = useCallback(async () => {
    const selected = await api.pickDirectory('选择已有作品目录');
    if (!selected) return;
    try {
      await openProject(selected);
      showToast('作品已接入，原有目录结构保持不变', 'success');
    } catch (openError) {
      showToast(`打开失败：${String(openError)}`, 'error');
    }
  }, [openProject, showToast]);

  const handleOpenRecent = useCallback(async (project: FsProject) => {
    try {
      await openProject(project.rootPath);
    } catch (openError) {
      showToast(`无法打开最近项目：${String(openError)}`, 'error');
    }
  }, [openProject, showToast]);

  const handleCreate = useCallback(async (name: string, rootPath: string) => {
    try {
      await createProject(name, rootPath);
      setShowCreateDialog(false);
      showToast(`作品“${name}”已创建`, 'success');
    } catch (createError) {
      showToast(`创建失败：${String(createError)}`, 'error');
    }
  }, [createProject, showToast]);

  const handleMigrateLegacy = useCallback(async (project: Project) => {
    const parent = await api.pickDirectory(`选择“${project.title}”的迁移位置`);
    if (!parent) return;
    const outputPath = joinPath(parent, safeFolderName(project.title));
    try {
      const result = await api.exportToFsProject(project.id, outputPath);
      await loadProjects();
      await openProject(result.project.rootPath);
      showToast(`已迁移 ${result.fileCount} 个文件`, 'success');
    } catch (migrationError) {
      showToast(`迁移失败：${String(migrationError)}`, 'error');
    }
  }, [loadProjects, openProject, showToast]);

  const handleBack = useCallback(async () => {
    const closed = await closeProject();
    if (!closed) {
      showToast('请先处理当前文件的保存失败或外部冲突', 'warning');
    }
  }, [closeProject, showToast]);

  const handleConflictCopy = useCallback(async () => {
    const path = await saveConflictCopy();
    if (path) showToast(`本地草稿已另存为 ${path}`, 'success');
  }, [saveConflictCopy, showToast]);

  const handleMissingCopy = useCallback(async () => {
    const path = await saveMissingCopy();
    if (path) showToast(`编辑缓存已保存为 ${path}`, 'success');
  }, [saveMissingCopy, showToast]);

  const handleUseExternal = useCallback(() => {
    const confirmed = window.confirm('使用外部版本后，织梦机中尚未保存的本地内容会被放弃。确认继续？');
    if (confirmed) useExternalVersion();
  }, [useExternalVersion]);

  const handleOverwriteExternal = useCallback(async () => {
    const confirmed = window.confirm('确认用织梦机中的当前内容覆盖外部版本？系统不会再自动判断。');
    if (!confirmed) return;
    const ok = await overwriteExternalVersion();
    if (ok) showToast('已用当前内容覆盖外部版本', 'success');
  }, [overwriteExternalVersion, showToast]);

  const handleSelectionChange = useCallback((selection: EditorSelectionContext | null) => {
    setEditorSelection(selection);
  }, []);

  const wordCount = useMemo(() => countWords(fileContent || ''), [fileContent]);

  const handlePrepareAiWrite = useCallback(
    (plan: ProjectAiPlan, context: { currentFilePath: string | null; currentFileContent: string | null; selection: EditorSelectionContext | null }) =>
      prepareAiWrite(plan, context.currentFilePath, context.currentFileContent, context.selection),
    [prepareAiWrite],
  );

  const handleCommitAiWrite = useCallback(
    (proposal: AiWriteProposal) => commitAiWrite(proposal),
    [commitAiWrite],
  );

  if (!activeProject) {
    return (
      <div className="app-layout fs-first-app fs-welcome-shell">
        <div className="fs-welcome-scroll">
          <FsWelcome
            projects={fsProjects}
            legacyProjects={legacyProjects}
            loading={loading}
            onCreate={() => setShowCreateDialog(true)}
            onOpenDirectory={() => void handleOpenDirectory()}
            onOpenRecent={(project) => void handleOpenRecent(project)}
            onRemoveRecent={(project) => void removeProject(project.id)}
            onMigrateLegacy={(project) => void handleMigrateLegacy(project)}
          />
        </div>
        {showCreateDialog && (
          <FsProjectCreateDialog
            onChooseParent={() => api.pickDirectory('选择作品保存位置')}
            onConfirm={handleCreate}
            onCancel={() => setShowCreateDialog(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`app-layout fs-first-app ${focusMode ? 'focus-mode' : ''}`}>
      <header className="glyph-topbar">
        <button className="glyph-topbar-btn" onClick={() => void handleBack()} title="返回作品入口">
          <BookOpen size={18} />
        </button>
        <div className="glyph-topbar-project">
          <strong>{activeProject.name}</strong>
          <span>{activeProject.rootPath}</span>
        </div>
        <div className="glyph-topbar-spacer" />
        <button
          className="glyph-topbar-btn"
          onClick={() => setAiPanelOpen((value) => !value)}
          title={aiPanelOpen ? '收起 AI 副手' : '打开 AI 副手'}
          aria-label={aiPanelOpen ? '收起 AI 副手' : '打开 AI 副手'}
        >
          {aiPanelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
        <button
          className="glyph-topbar-btn"
          onClick={() => setFocusMode((value) => !value)}
          title="专注模式（Ctrl+Shift+F）"
        >
          {focusMode ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
      </header>

      <div className="glyph-workspace fs-workspace">
        {!focusMode && (
          <aside className="glyph-sidebar fs-sidebar">
            <FileTree />
          </aside>
        )}

        <main className="glyph-main fs-main">
          {fileStatus === 'conflict' && externalConflict && (
            <section className="fs-conflict-banner" role="alert">
              <div>
                <strong>文件在其他软件中发生了变化</strong>
                <span>自动保存已暂停。当前编辑内容和外部版本都还在。</span>
              </div>
              <div className="fs-conflict-actions">
                <button onClick={handleUseExternal}>使用外部版本</button>
                <button onClick={() => void handleConflictCopy()}>本地草稿另存后重载</button>
                <button className="danger" onClick={() => void handleOverwriteExternal()}>覆盖外部版本</button>
              </div>
            </section>
          )}
          {fileStatus === 'missing' && (
            <section className="fs-conflict-banner" role="alert">
              <div>
                <strong>原文件已经不存在</strong>
                <span>编辑缓存仍保留在当前窗口，可以立即保存为恢复副本。</span>
              </div>
              <div className="fs-conflict-actions">
                <button onClick={() => void handleMissingCopy()}>保存恢复副本</button>
              </div>
            </section>
          )}

          <FsDocumentView
            content={fileContent}
            filePath={openFilePath}
            fileName={openFileName}
            status={fileStatus}
            contentRevision={contentRevision}
            cursorLine={viewport.cursorLine}
            cursorColumn={viewport.cursorColumn}
            scrollPosition={viewport.scrollPosition}
            onContentChange={updateContent}
            onSave={saveCurrentFile}
            onViewportChange={updateViewport}
            onSelectionChange={handleSelectionChange}
            sourceMode={sourceMode}
            provenance={provenance}
            onSourceModeToggle={() => setSourceMode(!sourceMode)}
          />
        </main>

        {!focusMode && aiPanelOpen && (
          <aside className="glyph-ai-sidebar">
            <div className="fs-ai-tabs">
              <button
                className={`fs-ai-tab ${aiPanelTab === 'task' ? 'fs-ai-tab-active' : ''}`}
                onClick={() => setAiPanelTab('task')}
              >
                当前任务
              </button>
              <button
                className={`fs-ai-tab ${aiPanelTab === 'history' ? 'fs-ai-tab-active' : ''}`}
                onClick={() => setAiPanelTab('history')}
              >
                历史
              </button>
              <button
                className={`fs-ai-tab ${aiPanelTab === 'canon' ? 'fs-ai-tab-active' : ''}`}
                onClick={() => {
                  setAiPanelTab('canon');
                  if (activeProject) useCanonStore.getState().loadAll(activeProject.rootPath);
                }}
              >
                设定
              </button>
            </div>
            {aiPanelTab === 'task' ? (
              <FsAiPanel
                project={activeProject}
                currentFilePath={openFilePath}
                currentFileContent={fileContent}
                selection={editorSelection}
                onOpenFile={openFile}
                onPrepareWrite={handlePrepareAiWrite}
                onCommitWrite={handleCommitAiWrite}
              />
            ) : aiPanelTab === 'canon' ? (
              <div className="canon-sidebar">
                <SchemaSection projectRoot={activeProject.rootPath} />
                <div className="canon-divider" />
                <EntityPanel projectRoot={activeProject.rootPath} onOpenFile={openFile} />
              </div>
            ) : (
              <AiHistoryPanel onOpenFile={openFile} />
            )}
          </aside>
        )}
      </div>

      <footer className="fs-status-bar">
        <span className={`fs-status-${fileStatus}`}>{statusLabel(fileStatus)}</span>
        <span>{openFilePath || '未打开文件'}</span>
        <span className="fs-status-spacer" />
        <span>{wordCount.toLocaleString()} 字</span>
        <span>Markdown</span>
      </footer>
    </div>
  );
}
