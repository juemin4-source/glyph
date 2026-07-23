import { create } from 'zustand';
import type { DirEntry, FsProject, SessionState } from '../types/fs';
import {
  listFsProjects,
  createFsProject,
  openFsProject,
  removeFsProject,
  listDirectory,
  readFile,
  writeFile,
  getSessionState,
  saveSessionState,
} from '../tauri-api';

export type ProjectMode = 'sqlite' | 'filesystem';

interface FsStore {
  // Mode
  projectMode: ProjectMode;
  setProjectMode: (mode: ProjectMode) => void;

  // Project list
  fsProjects: FsProject[];
  loading: boolean;
  error: string | null;

  // Active project
  activeFsProject: FsProject | null;

  // File tree
  fileTree: DirEntry[];
  currentPath: string; // current directory path being shown
  expandedPaths: Set<string>;

  // Current file
  openFilePath: string | null;
  openFileName: string | null;
  fileContent: string | null;
  fileDirty: boolean;

  // Session
  sessionState: SessionState | null;

  // Actions
  loadFsProjects: () => Promise<void>;
  initNewProject: (name: string, rootPath: string, genre?: string) => Promise<FsProject>;
  openProject: (rootPath: string) => Promise<void>;
  closeProject: () => void;
  navigateToDir: (dirPath: string) => Promise<void>;
  refreshTree: () => Promise<void>;
  toggleExpanded: (path: string) => void;
  openFile: (filePath: string) => Promise<void>;
  saveCurrentFile: () => Promise<boolean>;
  setFileDirty: (dirty: boolean) => void;
  updateContent: (content: string) => void;
  removeProject: (projectId: string) => Promise<void>;
}

export const useFsStore = create<FsStore>((set, get) => ({
  // Defaults
  projectMode: 'filesystem',
  setProjectMode: (mode) => set({ projectMode: mode }),

  fsProjects: [],
  loading: false,
  error: null,

  activeFsProject: null,
  fileTree: [],
  currentPath: '',
  expandedPaths: new Set<string>(),

  openFilePath: null,
  openFileName: null,
  fileContent: null,
  fileDirty: false,

  sessionState: null,

  loadFsProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await listFsProjects();
      set({ fsProjects: projects || [], loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  initNewProject: async (name, rootPath, genre) => {
    set({ loading: true, error: null });
    try {
      const result = await createFsProject(name, rootPath, genre);
      const project = result.project;
      set((state) => ({
        fsProjects: [project, ...state.fsProjects],
        activeFsProject: project,
        loading: false,
      }));
      // Navigate to root
      await get().navigateToDir('');
      return project;
    } catch (err) {
      set({ error: String(err), loading: false });
      throw err;
    }
  },

  openProject: async (rootPath) => {
    set({ loading: true, error: null });
    try {
      const project = await openFsProject(rootPath);
      const state = await getSessionState(rootPath);
      set({
        activeFsProject: project,
        sessionState: state,
        loading: false,
        openFilePath: null,
        fileContent: null,
        fileDirty: false,
      });
      // Navigate to root
      await get().navigateToDir('');

      // Restore last open file if exists
      if (state?.lastOpenFilePath) {
        try {
          await get().openFile(state.lastOpenFilePath);
        } catch {
          // File might have been deleted; ignore
        }
      }

      // Update project list
      const projects = await listFsProjects();
      set({ fsProjects: projects });
    } catch (err) {
      set({ error: String(err), loading: false });
      throw err;
    }
  },

  closeProject: async () => {
    const { activeFsProject, openFilePath, openFileContent, fileDirty } = get();
    if (fileDirty && openFilePath && activeFsProject) {
      await get().saveCurrentFile();
    }
    // Save session state
    if (activeFsProject) {
      try {
        const state: SessionState = {
          lastOpenFilePath: get().openFilePath,
          lastCursorLine: null,
          lastCursorColumn: null,
          lastScrollPosition: null,
          openFilePaths: get().openFilePath ? [get().openFilePath!] : [],
          sidebarWidth: null,
          focusMode: null,
          lastEditMode: null,
          lastSessionAt: Date.now(),
        };
        await saveSessionState(activeFsProject.rootPath, state);
      } catch {
        // Silently fail session save
      }
    }
    set({
      activeFsProject: null,
      fileTree: [],
      currentPath: '',
      openFilePath: null,
      openFileName: null,
      fileContent: null,
      fileDirty: false,
      sessionState: null,
    });
  },

  navigateToDir: async (dirPath) => {
    const { activeFsProject } = get();
    if (!activeFsProject) return;

    set({ loading: true });
    try {
      const entries = await listDirectory(activeFsProject.rootPath, dirPath);
      set({
        fileTree: entries,
        currentPath: dirPath,
        loading: false,
      });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  refreshTree: async () => {
    const { currentPath, activeFsProject } = get();
    if (!activeFsProject) return;
    try {
      const entries = await listDirectory(activeFsProject.rootPath, currentPath);
      set({ fileTree: entries });
    } catch {
      // Silently fail refresh
    }
  },

  toggleExpanded: (path) => {
    set((state) => {
      const next = new Set(state.expandedPaths);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { expandedPaths: next };
    });
  },

  openFile: async (filePath) => {
    const { activeFsProject } = get();
    if (!activeFsProject) return;

    // If dirty, save first
    if (get().fileDirty) {
      await get().saveCurrentFile();
    }

    set({ loading: true, error: null });
    try {
      const content = await readFile(activeFsProject.rootPath, filePath);
      const name = filePath.split('/').pop() || filePath;
      set({
        openFilePath: filePath,
        openFileName: name,
        fileContent: content,
        fileDirty: false,
        loading: false,
      });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  saveCurrentFile: async () => {
    const { activeFsProject, openFilePath, fileContent } = get();
    if (!activeFsProject || !openFilePath || fileContent === null) return false;

    try {
      await writeFile(activeFsProject.rootPath, openFilePath, fileContent);
      set({ fileDirty: false });
      return true;
    } catch (err) {
      set({ error: String(err) });
      return false;
    }
  },

  setFileDirty: (dirty) => set({ fileDirty: dirty }),

  updateContent: (content) => {
    set({ fileContent: content, fileDirty: true });
  },

  removeProject: async (projectId) => {
    try {
      await removeFsProject(projectId);
      set((state) => ({
        fsProjects: state.fsProjects.filter((p) => p.projectId !== projectId),
      }));
    } catch (err) {
      set({ error: String(err) });
    }
  },
}));
