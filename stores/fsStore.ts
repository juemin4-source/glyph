import { create } from 'zustand';
import type {
  AiFileActionInput,
  DirEntry,
  ExternalConflict,
  FileSyncStatus,
  FsProject,
  SessionState,
} from '../types/fs';
import type {
  AiCommitOutcome,
  AiWriteProposal,
  EditorSelectionContext,
  PreparedWriteTarget,
  ProjectAiPlan,
} from '../types/fs-ai';
import {
  commitAiFileAction,
  createDirectory,
  createFsProject,
  createTextFile,
  deleteDirectory,
  deleteFile,
  getSessionState,
  listDirectory,
  listFsProjects,
  openFsProject,
  readFileState,
  removeFsProject,
  renameFile,
  saveSessionState,
  writeFileChecked,
} from '../tauri-api';

interface ViewportState {
  cursorLine: number;
  cursorColumn: number;
  scrollPosition: number;
}

interface FsStore {
  fsProjects: FsProject[];
  loading: boolean;
  error: string | null;

  activeProject: FsProject | null;
  rootEntries: DirEntry[];
  childrenByPath: Record<string, DirEntry[]>;
  expandedPaths: Set<string>;

  openFilePath: string | null;
  openFileName: string | null;
  fileContent: string | null;
  diskModifiedAt: number | null;
  diskVersion: string | null;
  fileStatus: FileSyncStatus;
  externalConflict: ExternalConflict | null;
  contentRevision: number;
  editRevision: number;

  viewport: ViewportState;
  restoredSession: SessionState | null;

  loadProjects: () => Promise<void>;
  createProject: (name: string, rootPath: string, genre?: string) => Promise<FsProject>;
  openProject: (rootPath: string) => Promise<FsProject>;
  closeProject: () => Promise<boolean>;
  removeProject: (projectId: string) => Promise<void>;

  loadDirectory: (path: string) => Promise<void>;
  toggleDirectory: (path: string) => Promise<void>;
  refreshVisibleTree: () => Promise<void>;

  openFile: (path: string) => Promise<boolean>;
  updateContent: (content: string) => void;
  saveCurrentFile: (options?: { force?: boolean }) => Promise<boolean>;
  handleExternalChanges: (paths: string[]) => Promise<'none' | 'reloaded' | 'conflict' | 'missing'>;
  useExternalVersion: () => void;
  overwriteExternalVersion: () => Promise<boolean>;
  saveConflictCopy: () => Promise<string | null>;
  saveMissingCopy: () => Promise<string | null>;

  prepareAiWrite: (
    plan: ProjectAiPlan,
    expectedFilePath: string | null,
    expectedFileContent: string | null,
    selection: EditorSelectionContext | null,
  ) => Promise<PreparedWriteTarget>;
  commitAiWrite: (proposal: AiWriteProposal) => Promise<AiCommitOutcome>;

  createMarkdownFile: (path: string) => Promise<boolean>;
  createFolder: (path: string) => Promise<boolean>;
  renameEntry: (oldPath: string, newPath: string) => Promise<boolean>;
  deleteEntry: (entry: DirEntry) => Promise<boolean>;

  // ══ Gate D: History & Provenance ══
  actionHistory: AiActionSummary[];
  actionHistoryLoading: boolean;
  actionHistoryError: string | null;
  provenance: ProvenanceRecord[];
  provenanceLoading: boolean;
  sourceMode: boolean;
  recoveryResult: StartupRecoveryResult | null;

  loadActionHistory: () => Promise<void>;
  openActionDetail: (operationId: string) => Promise<import('../types/fs-ai').AiActionDetail | null>;
  revertAction: (input: RevertAiActionInput) => Promise<import('../types/fs-ai').RevertAiActionResult | null>;
  loadProvenance: (filePath: string) => Promise<void>;
  setSourceMode: (on: boolean) => void;
  runStartupRecovery: () => Promise<void>;

  updateViewport: (partial: Partial<ViewportState>) => void;
  persistSession: () => Promise<void>;
  clearError: () => void;
}

const initialViewport: ViewportState = {
  cursorLine: 0,
  cursorColumn: 0,
  scrollPosition: 0,
};

let activeSavePromise: Promise<boolean> | null = null;
let openRequestSequence = 0;

function fileName(path: string): string {
  return path.split('/').pop() || path;
}

function normalizeRelative(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function isExternalModification(error: unknown): boolean {
  const message = String(error);
  return message.includes('EXTERNAL_MODIFICATION') || message.includes('FILE_MISSING');
}

function conflictCopyPath(path: string): string {
  const slash = path.lastIndexOf('/');
  const dir = slash >= 0 ? path.slice(0, slash + 1) : '';
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '.md';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${dir}${stem}.本地冲突-${stamp}${ext}`;
}

function pathIsWithin(path: string, parent: string): boolean {
  return path === parent || path.startsWith(`${parent}/`);
}

function replacePathPrefix(path: string, oldPrefix: string, newPrefix: string): string {
  if (path === oldPrefix) return newPrefix;
  if (path.startsWith(`${oldPrefix}/`)) return `${newPrefix}${path.slice(oldPrefix.length)}`;
  return path;
}

function emptyWorkspace() {
  return {
    rootEntries: [] as DirEntry[],
    childrenByPath: {} as Record<string, DirEntry[]>,
    expandedPaths: new Set<string>(),
    openFilePath: null as string | null,
    openFileName: null as string | null,
    fileContent: null as string | null,
    diskModifiedAt: null as number | null,
    diskVersion: null as string | null,
    fileStatus: 'clean' as FileSyncStatus,
    externalConflict: null as ExternalConflict | null,
    restoredSession: null as SessionState | null,
    viewport: initialViewport,
    contentRevision: 0,
    editRevision: 0,
    // Gate D
    actionHistory: [] as import('../types/fs-ai').AiActionSummary[],
    actionHistoryLoading: false,
    actionHistoryError: null as string | null,
    provenance: [] as import('../types/fs-ai').ProvenanceRecord[],
    provenanceLoading: false,
    sourceMode: false,
    recoveryResult: null as import('../types/fs-ai').StartupRecoveryResult | null,
  };
}

export const useFsStore = create<FsStore>((set, get) => {
  const activateProject = async (project: FsProject, session: SessionState | null) => {
    openRequestSequence += 1;
    set({
      ...emptyWorkspace(),
      activeProject: project,
      restoredSession: session,
      viewport: {
        cursorLine: session?.lastCursorLine ?? 0,
        cursorColumn: session?.lastCursorColumn ?? 0,
        scrollPosition: session?.lastScrollPosition ?? 0,
      },
      loading: false,
      error: null,
    });

    await get().loadDirectory('');
    if (session?.lastOpenFilePath) {
      const restored = await get().openFile(session.lastOpenFilePath);
      if (!restored) set({ error: null, loading: false, restoredSession: null });
    }
  };

  const waitForActiveSave = async () => {
    const pending = activeSavePromise;
    if (pending) await pending;
  };

  const settleCurrentFile = async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (get().fileStatus === 'saving') await waitForActiveSave();
      const status = get().fileStatus;
      if (status === 'clean' || !get().openFilePath) return true;
      if (status === 'dirty' || status === 'save-error') {
        const saved = await get().saveCurrentFile();
        if (!saved) return false;
        continue;
      }
      // Conflict and missing states preserve local text and require an explicit user choice.
      return false;
    }
    return get().fileStatus === 'clean';
  };

  return {
    fsProjects: [],
    loading: false,
    error: null,

    activeProject: null,
    ...emptyWorkspace(),

    loadProjects: async () => {
      set({ loading: true, error: null });
      try {
        const projects = await listFsProjects();
        set({ fsProjects: projects ?? [], loading: false });
      } catch (error) {
        set({ fsProjects: [], loading: false, error: String(error) });
      }
    },

    createProject: async (name, rootPath, genre) => {
      set({ loading: true, error: null });
      try {
        const result = await createFsProject(name, rootPath, genre);
        const session = await getSessionState(result.project.rootPath).catch(() => null);
        set((state) => ({
          fsProjects: [result.project, ...state.fsProjects.filter((project) => project.id !== result.project.id)],
        }));
        await activateProject(result.project, session);
        return result.project;
      } catch (error) {
        set({ loading: false, error: String(error) });
        throw error;
      }
    },

    openProject: async (rootPath) => {
      set({ loading: true, error: null });
      try {
        const project = await openFsProject(rootPath);
        const session = await getSessionState(project.rootPath).catch(() => null);
        await activateProject(project, session);
        set((state) => ({
          fsProjects: [project, ...state.fsProjects.filter((item) => item.id !== project.id)],
        }));
        return project;
      } catch (error) {
        set({ loading: false, error: String(error) });
        throw error;
      }
    },

    closeProject: async () => {
      if (!await settleCurrentFile()) return false;
      await get().persistSession();
      openRequestSequence += 1;
      set({ activeProject: null, ...emptyWorkspace() });
      return true;
    },

    removeProject: async (projectId) => {
      try {
        await removeFsProject(projectId);
        set((state) => ({ fsProjects: state.fsProjects.filter((project) => project.id !== projectId) }));
      } catch (error) {
        set({ error: String(error) });
      }
    },

    loadDirectory: async (path) => {
      const project = get().activeProject;
      if (!project) return;
      const normalized = normalizeRelative(path);
      try {
        const entries = await listDirectory(project.rootPath, normalized);
        if (get().activeProject?.id !== project.id) return;
        if (normalized === '') {
          set({ rootEntries: entries });
        } else {
          set((state) => ({
            childrenByPath: { ...state.childrenByPath, [normalized]: entries },
          }));
        }
      } catch (error) {
        if (get().activeProject?.id === project.id) set({ error: String(error) });
      }
    },

    toggleDirectory: async (path) => {
      const normalized = normalizeRelative(path);
      if (get().expandedPaths.has(normalized)) {
        set((state) => {
          const next = new Set(state.expandedPaths);
          next.delete(normalized);
          return { expandedPaths: next };
        });
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(get().childrenByPath, normalized)) {
        await get().loadDirectory(normalized);
      }
      set((state) => {
        const next = new Set(state.expandedPaths);
        next.add(normalized);
        return { expandedPaths: next };
      });
    },

    refreshVisibleTree: async () => {
      await get().loadDirectory('');
      const paths = [...get().expandedPaths];
      await Promise.all(paths.map((path) => get().loadDirectory(path)));
    },

    openFile: async (path) => {
      const project = get().activeProject;
      if (!project) return false;
      const normalized = normalizeRelative(path);
      if (normalized === get().openFilePath) return true;
      if (!await settleCurrentFile()) return false;

      const requestId = ++openRequestSequence;
      set({ loading: true, error: null });
      try {
        const result = await readFileState(project.rootPath, normalized);
        if (requestId !== openRequestSequence || get().activeProject?.id !== project.id) return false;
        const restoredSession = get().restoredSession;
        set((state) => ({
          openFilePath: normalized,
          openFileName: fileName(normalized),
          fileContent: result.content,
          diskModifiedAt: result.modifiedAt,
          diskVersion: result.version,
          fileStatus: 'clean',
          externalConflict: null,
          contentRevision: state.contentRevision + 1,
          editRevision: 0,
          viewport:
            restoredSession?.lastOpenFilePath === normalized
              ? state.viewport
              : initialViewport,
          restoredSession: null,
          loading: false,
        }));
        return true;
      } catch (error) {
        if (requestId === openRequestSequence) set({ loading: false, error: String(error) });
        return false;
      }
    },

    updateContent: (content) => {
      const state = get();
      if (state.fileStatus === 'conflict' || state.fileStatus === 'missing') return;
      if (state.fileContent === content) return;
      set({
        fileContent: content,
        fileStatus: 'dirty',
        editRevision: state.editRevision + 1,
      });
    },

    saveCurrentFile: async ({ force = false } = {}) => {
      if (activeSavePromise) return activeSavePromise;

      const snapshot = get();
      if (!snapshot.activeProject || !snapshot.openFilePath || snapshot.fileContent === null) return false;
      if (snapshot.fileStatus === 'clean') return true;
      if ((snapshot.fileStatus === 'conflict' || snapshot.fileStatus === 'missing') && !force) return false;

      const projectId = snapshot.activeProject.id;
      const projectRoot = snapshot.activeProject.rootPath;
      const path = snapshot.openFilePath;
      const content = snapshot.fileContent;
      const version = force ? null : snapshot.diskVersion;
      const editRevision = snapshot.editRevision;

      set({ fileStatus: 'saving', error: null });
      const task = (async (): Promise<boolean> => {
        try {
          const result = await writeFileChecked(projectRoot, path, content, version);
          set((state) => {
            if (state.activeProject?.id !== projectId || state.openFilePath !== path) return {};
            if (state.fileStatus === 'conflict' || state.fileStatus === 'missing') return {};
            const unchanged = state.editRevision === editRevision && state.fileContent === content;
            return {
              diskModifiedAt: result.modifiedAt,
              diskVersion: result.version,
              fileStatus: unchanged ? 'clean' : 'dirty',
              externalConflict: null,
            };
          });
          return true;
        } catch (error) {
          if (get().activeProject?.id !== projectId || get().openFilePath !== path) return false;
          if (isExternalModification(error)) {
            try {
              const external = await readFileState(projectRoot, path);
              set({
                fileStatus: 'conflict',
                externalConflict: external,
                error: '文件已被其他程序修改，自动保存已暂停。',
              });
            } catch {
              set({ fileStatus: 'missing', error: '文件已被移动或删除。' });
            }
          } else {
            set({ fileStatus: 'save-error', error: String(error) });
          }
          return false;
        }
      })();

      activeSavePromise = task;
      try {
        return await task;
      } finally {
        if (activeSavePromise === task) activeSavePromise = null;
      }
    },

    handleExternalChanges: async (paths) => {
      const normalized = paths.map(normalizeRelative);
      await get().refreshVisibleTree();

      let project = get().activeProject;
      let openPath = get().openFilePath;
      if (!project || !openPath || !normalized.includes(openPath)) return 'none';

      // A watcher event may arrive before the checked-write promise resolves.
      // Wait for that single save owner, then compare the actual disk version.
      if (activeSavePromise) {
        await waitForActiveSave();
        project = get().activeProject;
        openPath = get().openFilePath;
        if (!project || !openPath || !normalized.includes(openPath)) return 'none';
      }

      try {
        const external = await readFileState(project.rootPath, openPath);
        if (get().activeProject?.id !== project.id || get().openFilePath !== openPath) return 'none';
        const state = get();

        // This is Glyph's own completed save (or a duplicate watcher event).
        // It is harmless even when the user has already typed newer dirty text.
        if (external.version === state.diskVersion) return 'none';

        if (state.fileStatus === 'clean') {
          set((current) => ({
            fileContent: external.content,
            diskModifiedAt: external.modifiedAt,
            diskVersion: external.version,
            externalConflict: null,
            fileStatus: 'clean',
            contentRevision: current.contentRevision + 1,
            editRevision: 0,
          }));
          return 'reloaded';
        }

        set({
          fileStatus: 'conflict',
          externalConflict: external,
          error: '文件已被其他程序修改，自动保存已暂停。',
        });
        return 'conflict';
      } catch {
        set({ fileStatus: 'missing', error: '当前文件已被移动或删除。' });
        return 'missing';
      }
    },

    useExternalVersion: () => {
      const conflict = get().externalConflict;
      if (!conflict) return;
      set((state) => ({
        fileContent: conflict.content,
        diskModifiedAt: conflict.modifiedAt,
        diskVersion: conflict.version,
        externalConflict: null,
        fileStatus: 'clean',
        error: null,
        contentRevision: state.contentRevision + 1,
        editRevision: 0,
      }));
    },

    overwriteExternalVersion: async () => get().saveCurrentFile({ force: true }),

    saveConflictCopy: async () => {
      const { activeProject, openFilePath, fileContent, externalConflict } = get();
      if (!activeProject || !openFilePath || fileContent === null || !externalConflict) return null;
      const copyPath = conflictCopyPath(openFilePath);
      try {
        await createTextFile(activeProject.rootPath, copyPath, fileContent);
        set((state) => ({
          fileContent: externalConflict.content,
          diskModifiedAt: externalConflict.modifiedAt,
          diskVersion: externalConflict.version,
          externalConflict: null,
          fileStatus: 'clean',
          error: null,
          contentRevision: state.contentRevision + 1,
          editRevision: 0,
        }));
        await get().refreshVisibleTree();
        return copyPath;
      } catch (error) {
        set({ error: String(error) });
        return null;
      }
    },

    saveMissingCopy: async () => {
      const { activeProject, openFilePath, fileContent } = get();
      if (!activeProject || !openFilePath || fileContent === null) return null;
      const copyPath = conflictCopyPath(openFilePath).replace('.本地冲突-', '.恢复副本-');
      try {
        const result = await createTextFile(activeProject.rootPath, copyPath, fileContent);
        set((state) => ({
          openFilePath: copyPath,
          openFileName: fileName(copyPath),
          diskModifiedAt: result.modifiedAt,
          diskVersion: result.version,
          externalConflict: null,
          fileStatus: 'clean',
          error: null,
          contentRevision: state.contentRevision + 1,
          editRevision: 0,
        }));
        await get().refreshVisibleTree();
        return copyPath;
      } catch (error) {
        set({ error: String(error) });
        return null;
      }
    },

    prepareAiWrite: async (plan, expectedFilePath, expectedFileContent, selection) => {
      const action = plan.action;
      if (action === 'answer') throw new Error('AI_WRITE_BLOCKED: 当前任务没有写入动作');
      const project = get().activeProject;
      if (!project) throw new Error('AI_WRITE_BLOCKED: 当前没有打开作品');

      if (action === 'create_file') {
        const targetPath = normalizeRelative(plan.targetPath || '');
        if (!targetPath) throw new Error('AI_WRITE_BLOCKED: 没有有效的新文件路径');
        return {
          action,
          targetPath,
          baseContent: null,
          baseVersion: null,
          baseEditorRevision: null,
          selection: null,
          cursorOffset: null,
        };
      }

      if (!get().openFilePath || get().fileContent === null) {
        throw new Error('AI_WRITE_BLOCKED: 请先打开要修改的 Markdown 文件');
      }
      if (get().openFilePath !== expectedFilePath || get().fileContent !== expectedFileContent) {
        throw new Error('AI_WRITE_BLOCKED: AI 规划期间当前文件已经发生变化');
      }
      if (action === 'replace_selection' && selection
          && (get().fileContent ?? "").slice(selection.start, selection.end) !== selection.text) {
        throw new Error('AI_WRITE_BLOCKED: 选区已经变化');
      }
      if (get().fileStatus === 'dirty' || get().fileStatus === 'save-error') {
        const saved = await get().saveCurrentFile();
        if (!saved) throw new Error('AI_WRITE_BLOCKED: 当前正文尚未安全保存');
      }
      const state = get();
      if (state.fileStatus !== 'clean' || !state.openFilePath || state.fileContent === null || !state.diskVersion) {
        throw new Error('AI_WRITE_BLOCKED: 当前文件存在冲突、缺失或保存问题');
      }
      if (action === 'replace_selection' && (!selection || selection.start === selection.end)) {
        throw new Error('AI_WRITE_BLOCKED: 请先选择要改写的文字');
      }
      const targetPath = state.openFilePath;
      return {
        action,
        targetPath,
        baseContent: state.fileContent,
        baseVersion: state.diskVersion,
        baseEditorRevision: state.editRevision,
        selection: action === 'replace_selection' ? selection : null,
        cursorOffset: selection?.cursorOffset ?? state.fileContent.length,
      };
    },

    commitAiWrite: async (proposal) => {
      const project = get().activeProject;
      if (!project) return { status: 'blocked', commit: null, reason: '当前作品已经关闭' };

      if (proposal.action !== 'create_file') {
        const state = get();
        const unchanged = state.openFilePath === proposal.targetPath
          && state.fileStatus === 'clean'
          && state.editRevision === proposal.baseEditorRevision
          && state.diskVersion === proposal.expectedVersion
          && state.fileContent === proposal.baseContent;
        if (!unchanged) {
          return { status: 'blocked', commit: null, reason: 'AI 生成期间当前文件已经发生变化' };
        }
      }

      const input: AiFileActionInput = {
        operationId: proposal.operationId,
        actionType: proposal.action === 'create_file' ? 'create' : 'modify',
        targetPath: proposal.targetPath,
        content: proposal.finalContent,
        expectedVersion: proposal.expectedVersion,
        instruction: proposal.instruction,
        changeSummary: proposal.changeSummary,
        evidencePaths: proposal.evidencePaths,
      };

      try {
        const result = await commitAiFileAction(project.rootPath, input);
        if (get().activeProject?.id !== project.id) {
          return { status: 'blocked', commit: null, reason: '作品已经切换；文件已提交但当前工作区没有接管结果' };
        }
        await get().refreshVisibleTree();
        if (proposal.action === 'create_file') {
          await get().openFile(proposal.targetPath);
        } else if (get().openFilePath === proposal.targetPath) {
          set((state) => ({
            fileContent: proposal.finalContent,
            diskModifiedAt: result.modifiedAt,
            diskVersion: result.version,
            fileStatus: 'clean',
            externalConflict: null,
            contentRevision: state.contentRevision + 1,
            editRevision: 0,
            error: null,
          }));
        }
        return { status: 'committed', commit: result, reason: null };
      } catch (error) {
        const message = String(error);
        if (message.includes('EXTERNAL_MODIFICATION') || message.includes('FILE_MISSING')) {
          if (proposal.action !== 'create_file' && get().openFilePath === proposal.targetPath) {
            try {
              const external = await readFileState(project.rootPath, proposal.targetPath);
              set({ fileStatus: 'conflict', externalConflict: external, error: 'AI 提交前文件已被其他程序修改，本次没有覆盖。' });
            } catch {
              set({ fileStatus: 'missing', error: 'AI 提交前目标文件已经不存在。' });
            }
          }
          return { status: 'blocked', commit: null, reason: '目标文件在提交前发生了外部变化' };
        }
        if (message.includes('FILE_EXISTS')) {
          return { status: 'blocked', commit: null, reason: '目标文件已经存在，系统没有覆盖' };
        }
        throw error;
      }
    },

    createMarkdownFile: async (path) => {
      const project = get().activeProject;
      if (!project) return false;
      if (!await settleCurrentFile()) return false;
      const normalized = normalizeRelative(path.endsWith('.md') ? path : `${path}.md`);
      try {
        await createTextFile(project.rootPath, normalized, '');
        await get().refreshVisibleTree();
        return get().openFile(normalized);
      } catch (error) {
        set({ error: String(error) });
        return false;
      }
    },

    createFolder: async (path) => {
      const project = get().activeProject;
      if (!project) return false;
      try {
        await createDirectory(project.rootPath, normalizeRelative(path));
        await get().refreshVisibleTree();
        return true;
      } catch (error) {
        set({ error: String(error) });
        return false;
      }
    },

    renameEntry: async (oldPath, newPath) => {
      const project = get().activeProject;
      if (!project) return false;
      const normalizedOld = normalizeRelative(oldPath);
      const normalizedNew = normalizeRelative(newPath);
      const currentOpenPath = get().openFilePath;
      const affectsOpenFile = currentOpenPath ? pathIsWithin(currentOpenPath, normalizedOld) : false;
      if (affectsOpenFile && !await settleCurrentFile()) return false;

      try {
        await renameFile(project.rootPath, normalizedOld, normalizedNew);
        const nextOpenPath = currentOpenPath && affectsOpenFile
          ? replacePathPrefix(currentOpenPath, normalizedOld, normalizedNew)
          : null;
        openRequestSequence += 1;
        set({
          rootEntries: [],
          childrenByPath: {},
          expandedPaths: new Set<string>(),
          ...(affectsOpenFile ? {
            openFilePath: null,
            openFileName: null,
            fileContent: null,
            diskModifiedAt: null,
            diskVersion: null,
            fileStatus: 'clean' as FileSyncStatus,
            externalConflict: null,
          } : {}),
        });
        await get().loadDirectory('');
        if (nextOpenPath) await get().openFile(nextOpenPath);
        return true;
      } catch (error) {
        set({ error: String(error) });
        return false;
      }
    },

    deleteEntry: async (entry) => {
      const project = get().activeProject;
      if (!project) return false;
      const currentOpenPath = get().openFilePath;
      const affectsOpenFile = currentOpenPath ? pathIsWithin(currentOpenPath, entry.path) : false;
      if (affectsOpenFile && !await settleCurrentFile()) return false;

      try {
        if (entry.isDir) await deleteDirectory(project.rootPath, entry.path);
        else await deleteFile(project.rootPath, entry.path);
        if (affectsOpenFile) {
          openRequestSequence += 1;
          set({
            openFilePath: null,
            openFileName: null,
            fileContent: null,
            diskModifiedAt: null,
            diskVersion: null,
            fileStatus: 'clean',
            externalConflict: null,
          });
        }
        await get().refreshVisibleTree();
        return true;
      } catch (error) {
        set({ error: String(error) });
        return false;
      }
    },

    updateViewport: (partial) => {
      set((state) => ({ viewport: { ...state.viewport, ...partial } }));
    },

    persistSession: async () => {
      const { activeProject, openFilePath, viewport } = get();
      if (!activeProject) return;
      const projectRoot = activeProject.rootPath;
      const state: SessionState = {
        lastOpenFilePath: openFilePath,
        lastCursorLine: viewport.cursorLine,
        lastCursorColumn: viewport.cursorColumn,
        lastScrollPosition: viewport.scrollPosition,
        openFilePaths: openFilePath ? [openFilePath] : [],
        sidebarWidth: null,
        focusMode: null,
        lastEditMode: 'markdown',
        lastSessionAt: Date.now(),
      };
      try {
        await saveSessionState(projectRoot, state);
      } catch (error) {
        console.warn('[session] failed to persist session', error);
      }
    },

    clearError: () => set({ error: null }),
  };
});
