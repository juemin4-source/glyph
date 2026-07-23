/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock tauri-api module ──
const mockListFsProjects = vi.fn();
const mockCreateFsProject = vi.fn();
const mockOpenFsProject = vi.fn();
const mockRemoveFsProject = vi.fn();
const mockListDirectory = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockGetSessionState = vi.fn();
const mockSaveSessionState = vi.fn();

vi.mock('../../tauri-api', () => ({
  listFsProjects: (...args: unknown[]) => mockListFsProjects(...args),
  createFsProject: (...args: unknown[]) => mockCreateFsProject(...args),
  openFsProject: (...args: unknown[]) => mockOpenFsProject(...args),
  removeFsProject: (...args: unknown[]) => mockRemoveFsProject(...args),
  listDirectory: (...args: unknown[]) => mockListDirectory(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  getSessionState: (...args: unknown[]) => mockGetSessionState(...args),
  saveSessionState: (...args: unknown[]) => mockSaveSessionState(...args),
}));

// ── Test Fixtures ──
const mockFsProject = {
  projectId: 'proj-1',
  name: '测试小说',
  rootPath: 'C:/novels/test-novel',
  genre: '科幻',
  createdAt: 1000,
  lastOpenedAt: 2000,
  updatedAt: 2000,
};

const mockDirEntries = [
  { name: 'chapters', path: 'chapters', isDir: true, extension: '', size: 0, modifiedAt: 2000 },
  { name: 'characters', path: 'characters', isDir: true, extension: '', size: 0, modifiedAt: 2000 },
  { name: 'ch01.md', path: 'chapters/ch01.md', isDir: false, extension: 'md', size: 1200, modifiedAt: 2500 },
  { name: '大纲.md', path: '大纲.md', isDir: false, extension: 'md', size: 800, modifiedAt: 2400 },
];

const mockSessionState = {
  lastOpenFilePath: 'chapters/ch01.md',
  lastCursorLine: 42,
  lastCursorColumn: 10,
  lastScrollPosition: null,
  openFilePaths: ['chapters/ch01.md'],
  sidebarWidth: null,
  focusMode: null,
  lastEditMode: 'wysiwyg',
  lastSessionAt: 2000,
};

const mockFileContent = '# 第一章\n\n正文内容……';

describe('fsStore', () => {
  let store: typeof import('../../stores/fsStore').useFsStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset store state by re-importing (zustand create() resets on each import)
    const mod = await import('../../stores/fsStore');
    store = mod.useFsStore;
    store.getState().closeProject();
    // Clear any lingering state
    store.setState({
      fsProjects: [],
      activeFsProject: null,
      fileTree: [],
      openFilePath: null,
      fileContent: null,
      fileDirty: false,
      loading: false,
      error: null,
    });
  });

  // ── loadFsProjects ──
  describe('loadFsProjects', () => {
    it('loads and sets project list from API', async () => {
      mockListFsProjects.mockResolvedValue([mockFsProject]);
      await store.getState().loadFsProjects();

      const state = store.getState();
      expect(state.fsProjects).toHaveLength(1);
      expect(state.fsProjects[0].name).toBe('测试小说');
      expect(state.loading).toBe(false);
    });

    it('handles empty list gracefully', async () => {
      mockListFsProjects.mockResolvedValue([]);
      await store.getState().loadFsProjects();

      expect(store.getState().fsProjects).toEqual([]);
    });

    it('handles API errors gracefully', async () => {
      mockListFsProjects.mockRejectedValue(new Error('Network error'));
      await store.getState().loadFsProjects();

      const state = store.getState();
      expect(state.fsProjects).toEqual([]);
      expect(state.error).toContain('Network error');
      expect(state.loading).toBe(false);
    });

    it('handles null/undefined response gracefully', async () => {
      mockListFsProjects.mockResolvedValue(null);
      await store.getState().loadFsProjects();

      expect(store.getState().fsProjects).toEqual([]);
    });
  });

  // ── initNewProject ──
  describe('initNewProject', () => {
    it('creates project and sets as active', async () => {
      mockCreateFsProject.mockResolvedValue({ project: mockFsProject, createdDirectories: [], createdFiles: [] });
      mockListDirectory.mockResolvedValue([]);

      const project = await store.getState().initNewProject('测试小说', 'C:/novels/test-novel', '科幻');

      expect(project.name).toBe('测试小说');
      expect(store.getState().activeFsProject?.name).toBe('测试小说');
      expect(mockCreateFsProject).toHaveBeenCalledWith('测试小说', 'C:/novels/test-novel', '科幻');
    });

    it('navigates to root directory after creation', async () => {
      mockCreateFsProject.mockResolvedValue({ project: mockFsProject, createdDirectories: [], createdFiles: [] });
      mockListDirectory.mockResolvedValue([]);

      await store.getState().initNewProject('测试小说', 'C:/novels/test-novel');

      expect(mockListDirectory).toHaveBeenCalled();
    });

    it('rejects on API failure', async () => {
      mockCreateFsProject.mockRejectedValue(new Error('Create failed'));

      await expect(
        store.getState().initNewProject('测试小说', 'C:/novels/test-novel'),
      ).rejects.toThrow('Create failed');

      expect(store.getState().activeFsProject).toBeNull();
    });
  });

  // ── openProject ──
  describe('openProject', () => {
    it('opens project, loads session, and restores last file', async () => {
      mockOpenFsProject.mockResolvedValue(mockFsProject);
      mockGetSessionState.mockResolvedValue(mockSessionState);
      mockListDirectory.mockResolvedValue(mockDirEntries);
      mockReadFile.mockResolvedValue(mockFileContent);
      mockListFsProjects.mockResolvedValue([mockFsProject]);

      await store.getState().openProject('C:/novels/test-novel');

      const state = store.getState();
      expect(state.activeFsProject?.name).toBe('测试小说');
      expect(state.sessionState?.lastOpenFilePath).toBe('chapters/ch01.md');
      // Should have restored last file
      expect(state.openFilePath).toBe('chapters/ch01.md');
      expect(state.fileContent).toBe(mockFileContent);
      expect(mockReadFile).toHaveBeenCalled();
    });

    it('handles missing session file gracefully', async () => {
      mockOpenFsProject.mockResolvedValue(mockFsProject);
      mockGetSessionState.mockResolvedValue({
        lastOpenFilePath: null,
        lastCursorLine: null, lastCursorColumn: null,
        lastScrollPosition: null, openFilePaths: [],
        sidebarWidth: null, focusMode: null, lastEditMode: null, lastSessionAt: 0,
      });
      mockListDirectory.mockResolvedValue(mockDirEntries);
      mockListFsProjects.mockResolvedValue([mockFsProject]);

      await store.getState().openProject('C:/novels/test-novel');

      expect(store.getState().openFilePath).toBeNull();
    });

    it('handles deleted last file gracefully', async () => {
      mockOpenFsProject.mockResolvedValue(mockFsProject);
      mockGetSessionState.mockResolvedValue(mockSessionState);
      mockListDirectory.mockResolvedValue(mockDirEntries);
      mockReadFile.mockRejectedValue(new Error('File not found'));
      mockListFsProjects.mockResolvedValue([mockFsProject]);

      await store.getState().openProject('C:/novels/test-novel');

      // Should degrade gracefully - file missing doesn't block project open
      expect(store.getState().activeFsProject).toBeTruthy();
    });
  });

  // ── File tree navigation ──
  describe('navigateToDir', () => {
    it('loads directory contents', async () => {
      store.setState({ activeFsProject: mockFsProject });
      mockListDirectory.mockResolvedValue(mockDirEntries);

      await store.getState().navigateToDir('chapters');

      expect(mockListDirectory).toHaveBeenCalledWith('C:/novels/test-novel', 'chapters');
    });

    it('does nothing when no project is active', async () => {
      store.setState({ activeFsProject: null });
      await store.getState().navigateToDir('chapters');

      expect(mockListDirectory).not.toHaveBeenCalled();
    });
  });

  // ── File operations ──
  describe('openFile / saveCurrentFile', () => {
    beforeEach(() => {
      store.setState({ activeFsProject: mockFsProject });
    });

    it('opens a file and reads its content', async () => {
      mockReadFile.mockResolvedValue(mockFileContent);

      await store.getState().openFile('chapters/ch01.md');

      const state = store.getState();
      expect(state.openFilePath).toBe('chapters/ch01.md');
      expect(state.openFileName).toBe('ch01.md');
      expect(state.fileContent).toBe(mockFileContent);
      expect(state.fileDirty).toBe(false);
    });

    it('saves dirty file before opening another', async () => {
      store.setState({ fileDirty: true, fileContent: '修改内容', openFilePath: 'old.md' });
      mockWriteFile.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(mockFileContent);

      await store.getState().openFile('chapters/ch01.md');

      // Should have saved the old file first
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('saves current file content to disk', async () => {
      store.setState({ openFilePath: 'chapters/ch01.md', fileContent: mockFileContent, fileDirty: true });
      mockWriteFile.mockResolvedValue(undefined);

      const result = await store.getState().saveCurrentFile();

      expect(result).toBe(true);
      expect(mockWriteFile).toHaveBeenCalledWith('C:/novels/test-novel', 'chapters/ch01.md', mockFileContent);
      expect(store.getState().fileDirty).toBe(false);
    });

    it('returns false on save failure', async () => {
      store.setState({ openFilePath: 'chapters/ch01.md', fileContent: 'test', fileDirty: true });
      mockWriteFile.mockRejectedValue(new Error('Write failed'));

      const result = await store.getState().saveCurrentFile();

      expect(result).toBe(false);
    });

    it('does not save when no file is open', async () => {
      store.setState({ activeFsProject: null, openFilePath: null, fileContent: null, fileDirty: false });
      mockWriteFile.mockResolvedValue(undefined);
      vi.clearAllMocks();

      const result = await store.getState().saveCurrentFile();

      expect(result).toBe(false);
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  // ── closeProject ──
  describe('closeProject', () => {
    it('saves dirty file and session before closing', async () => {
      store.setState({
        activeFsProject: mockFsProject,
        openFilePath: 'ch01.md',
        fileContent: '# draft',
        fileDirty: true,
      });
      mockWriteFile.mockResolvedValue(undefined);
      mockSaveSessionState.mockResolvedValue(undefined);

      await store.getState().closeProject();

      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockSaveSessionState).toHaveBeenCalled();
      expect(store.getState().activeFsProject).toBeNull();
      expect(store.getState().openFilePath).toBeNull();
    });

    it('clears state even without active project', async () => {
      store.setState({ activeFsProject: null, openFilePath: null });

      await store.getState().closeProject();

      expect(store.getState().activeFsProject).toBeNull();
    });
  });

  // ── removeProject ──
  describe('removeProject', () => {
    it('removes project from list via API', async () => {
      store.setState({ fsProjects: [mockFsProject] });
      mockRemoveFsProject.mockResolvedValue(undefined);

      await store.getState().removeProject('proj-1');

      expect(store.getState().fsProjects).toHaveLength(0);
      expect(mockRemoveFsProject).toHaveBeenCalledWith('proj-1');
    });

    it('handles API error', async () => {
      store.setState({ fsProjects: [mockFsProject] });
      mockRemoveFsProject.mockRejectedValue(new Error('Remove failed'));

      await store.getState().removeProject('proj-1');

      // Project should remain in list on failure
      expect(store.getState().fsProjects).toHaveLength(1);
    });
  });
});
