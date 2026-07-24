/// <reference types="vitest/globals" />
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listFsProjects: vi.fn(),
  createFsProject: vi.fn(),
  openFsProject: vi.fn(),
  removeFsProject: vi.fn(),
  listDirectory: vi.fn(),
  readFileState: vi.fn(),
  writeFileChecked: vi.fn(),
  createTextFile: vi.fn(),
  createFile: vi.fn(),
  createDirectory: vi.fn(),
  renameFile: vi.fn(),
  deleteFile: vi.fn(),
  deleteDirectory: vi.fn(),
  getSessionState: vi.fn(),
  saveSessionState: vi.fn(),
}));

vi.mock('../../tauri-api', () => mocks);

const project = {
  id: 'project-1',
  name: '边界来客',
  rootPath: 'C:/novels/边界来客',
  genre: '',
  createdAt: 1,
  lastOpenedAt: 2,
  updatedAt: 2,
};

const session = {
  lastOpenFilePath: '正文/ch01.md',
  lastCursorLine: 12,
  lastCursorColumn: 4,
  lastScrollPosition: 320,
  openFilePaths: ['正文/ch01.md'],
  sidebarWidth: null,
  focusMode: null,
  lastEditMode: 'markdown',
  lastSessionAt: 2,
};

const entries = [
  { name: '正文', path: '正文', isDir: true, extension: '', size: 0, modifiedAt: 10 },
  { name: '大纲.md', path: '大纲.md', isDir: false, extension: 'md', size: 20, modifiedAt: 11 },
];

let useFsStore: typeof import('../../stores/fsStore').useFsStore;

beforeEach(async () => {
  vi.clearAllMocks();
  ({ useFsStore } = await import('../../stores/fsStore'));
  useFsStore.setState({
    fsProjects: [],
    loading: false,
    error: null,
    activeProject: null,
    rootEntries: [],
    childrenByPath: {},
    expandedPaths: new Set(),
    openFilePath: null,
    openFileName: null,
    fileContent: null,
    diskModifiedAt: null,
    diskVersion: null,
    fileStatus: 'clean',
    externalConflict: null,
    contentRevision: 0,
    editRevision: 0,
    viewport: { cursorLine: 0, cursorColumn: 0, scrollPosition: 0 },
    restoredSession: null,
  });
  mocks.listDirectory.mockResolvedValue(entries);
  mocks.getSessionState.mockResolvedValue({ ...session, lastOpenFilePath: null, openFilePaths: [] });
});

describe('filesystem-first store', () => {
  it('loads recent projects using the backend id contract', async () => {
    mocks.listFsProjects.mockResolvedValue([project]);
    await useFsStore.getState().loadProjects();
    expect(useFsStore.getState().fsProjects[0].id).toBe('project-1');
  });

  it('opens an arbitrary project and restores the last file and viewport', async () => {
    mocks.openFsProject.mockResolvedValue(project);
    mocks.getSessionState.mockResolvedValue(session);
    mocks.readFileState.mockResolvedValue({ content: '# 第一章', modifiedAt: 100, version: 'v100' });

    await useFsStore.getState().openProject(project.rootPath);

    const state = useFsStore.getState();
    expect(state.activeProject).toEqual(project);
    expect(state.rootEntries).toEqual(entries);
    expect(state.openFilePath).toBe('正文/ch01.md');
    expect(state.diskModifiedAt).toBe(100);
    expect(state.viewport).toEqual({ cursorLine: 12, cursorColumn: 4, scrollPosition: 320 });
  });

  it('uses a single checked write and advances the disk version', async () => {
    useFsStore.setState({
      activeProject: project,
      openFilePath: '正文/ch01.md',
      openFileName: 'ch01.md',
      fileContent: '修改后的正文',
      diskModifiedAt: 100,
      diskVersion: 'v100',
      fileStatus: 'dirty',
    });
    mocks.writeFileChecked.mockResolvedValue({ modifiedAt: 101, version: 'v101' });

    const saved = await useFsStore.getState().saveCurrentFile();

    expect(saved).toBe(true);
    expect(mocks.writeFileChecked).toHaveBeenCalledWith(
      project.rootPath,
      '正文/ch01.md',
      '修改后的正文',
      'v100',
    );
    expect(useFsStore.getState().fileStatus).toBe('clean');
    expect(useFsStore.getState().diskModifiedAt).toBe(101);
    expect(useFsStore.getState().diskVersion).toBe('v101');
  });

  it('does not mark newer typing as saved when an earlier save finishes', async () => {
    let resolveWrite: ((value: { modifiedAt: number; version: string }) => void) | undefined;
    mocks.writeFileChecked.mockImplementation(() => new Promise((resolve) => { resolveWrite = resolve; }));
    useFsStore.setState({
      activeProject: project,
      openFilePath: '正文/ch01.md',
      openFileName: 'ch01.md',
      fileContent: '第一版修改',
      diskModifiedAt: 100,
      diskVersion: 'v100',
      fileStatus: 'dirty',
      editRevision: 1,
    });

    const pending = useFsStore.getState().saveCurrentFile();
    useFsStore.getState().updateContent('保存期间继续写出的第二版');
    resolveWrite?.({ modifiedAt: 101, version: 'v101' });
    await pending;

    expect(useFsStore.getState().fileContent).toBe('保存期间继续写出的第二版');
    expect(useFsStore.getState().fileStatus).toBe('dirty');
    expect(useFsStore.getState().diskVersion).toBe('v101');
  });

  it('treats the watcher event from its own in-flight save as a no-op', async () => {
    let resolveWrite: ((value: { modifiedAt: number; version: string }) => void) | undefined;
    mocks.writeFileChecked.mockImplementation(() => new Promise((resolve) => { resolveWrite = resolve; }));
    mocks.readFileState.mockResolvedValue({ content: '已保存内容', modifiedAt: 101, version: 'v101' });
    useFsStore.setState({
      activeProject: project,
      openFilePath: '正文/ch01.md',
      openFileName: 'ch01.md',
      fileContent: '已保存内容',
      diskModifiedAt: 100,
      diskVersion: 'v100',
      fileStatus: 'dirty',
      editRevision: 1,
    });

    const saving = useFsStore.getState().saveCurrentFile();
    const watcher = useFsStore.getState().handleExternalChanges(['正文/ch01.md']);
    resolveWrite?.({ modifiedAt: 101, version: 'v101' });

    expect(await saving).toBe(true);
    expect(await watcher).toBe('none');
    expect(useFsStore.getState().fileStatus).toBe('clean');
    expect(useFsStore.getState().externalConflict).toBeNull();
  });

  it('keeps newer typing dirty when its own watcher event arrives before save completion', async () => {
    let resolveWrite: ((value: { modifiedAt: number; version: string }) => void) | undefined;
    mocks.writeFileChecked.mockImplementation(() => new Promise((resolve) => { resolveWrite = resolve; }));
    mocks.readFileState.mockResolvedValue({ content: '第一版修改', modifiedAt: 101, version: 'v101' });
    useFsStore.setState({
      activeProject: project,
      openFilePath: '正文/ch01.md',
      openFileName: 'ch01.md',
      fileContent: '第一版修改',
      diskModifiedAt: 100,
      diskVersion: 'v100',
      fileStatus: 'dirty',
      editRevision: 1,
    });

    const saving = useFsStore.getState().saveCurrentFile();
    useFsStore.getState().updateContent('保存期间继续写出的第二版');
    const watcher = useFsStore.getState().handleExternalChanges(['正文/ch01.md']);
    resolveWrite?.({ modifiedAt: 101, version: 'v101' });

    expect(await saving).toBe(true);
    expect(await watcher).toBe('none');
    expect(useFsStore.getState().fileContent).toBe('保存期间继续写出的第二版');
    expect(useFsStore.getState().fileStatus).toBe('dirty');
    expect(useFsStore.getState().diskVersion).toBe('v101');
  });

  it('turns a version mismatch into a conflict instead of overwriting', async () => {
    useFsStore.setState({
      activeProject: project,
      openFilePath: '正文/ch01.md',
      fileContent: '本地草稿',
      diskModifiedAt: 100,
      diskVersion: 'v100',
      fileStatus: 'dirty',
    });
    mocks.writeFileChecked.mockRejectedValue(new Error('EXTERNAL_MODIFICATION'));
    mocks.readFileState.mockResolvedValue({ content: '外部版本', modifiedAt: 110, version: 'v110' });

    const saved = await useFsStore.getState().saveCurrentFile();

    expect(saved).toBe(false);
    expect(useFsStore.getState().fileStatus).toBe('conflict');
    expect(useFsStore.getState().fileContent).toBe('本地草稿');
    expect(useFsStore.getState().externalConflict?.content).toBe('外部版本');
  });

  it('reloads a clean file after an external change', async () => {
    useFsStore.setState({
      activeProject: project,
      openFilePath: '正文/ch01.md',
      fileContent: '旧内容',
      diskModifiedAt: 100,
      fileStatus: 'clean',
    });
    mocks.readFileState.mockResolvedValue({ content: '外部新内容', modifiedAt: 120, version: 'v120' });

    const result = await useFsStore.getState().handleExternalChanges(['正文/ch01.md']);

    expect(result).toBe('reloaded');
    expect(useFsStore.getState().fileContent).toBe('外部新内容');
    expect(useFsStore.getState().diskModifiedAt).toBe(120);
  });

  it('preserves dirty local content when an external change arrives', async () => {
    useFsStore.setState({
      activeProject: project,
      openFilePath: '正文/ch01.md',
      fileContent: '本地未保存内容',
      diskModifiedAt: 100,
      diskVersion: 'v100',
      fileStatus: 'dirty',
    });
    mocks.readFileState.mockResolvedValue({ content: '外部内容', modifiedAt: 130, version: 'v130' });

    const result = await useFsStore.getState().handleExternalChanges(['正文/ch01.md']);

    expect(result).toBe('conflict');
    expect(useFsStore.getState().fileContent).toBe('本地未保存内容');
    expect(useFsStore.getState().externalConflict?.content).toBe('外部内容');
  });

  it('can save the local draft as a conflict copy without touching the external version', async () => {
    useFsStore.setState({
      activeProject: project,
      openFilePath: '正文/ch01.md',
      fileContent: '本地草稿',
      diskModifiedAt: 100,
      fileStatus: 'conflict',
      externalConflict: { content: '外部版本', modifiedAt: 140, version: 'v140' },
    });
    mocks.createTextFile.mockResolvedValue({ modifiedAt: 141, version: 'v141' });

    const path = await useFsStore.getState().saveConflictCopy();

    expect(path).toContain('ch01.本地冲突-');
    expect(mocks.createTextFile).toHaveBeenCalledWith(project.rootPath, expect.stringContaining('本地冲突'), '本地草稿');
    expect(useFsStore.getState().fileContent).toBe('外部版本');
    expect(useFsStore.getState().fileStatus).toBe('clean');
  });

  it('can rescue the edit cache after the original file disappears', async () => {
    useFsStore.setState({
      activeProject: project,
      openFilePath: '正文/ch01.md',
      openFileName: 'ch01.md',
      fileContent: '仍在窗口中的正文',
      fileStatus: 'missing',
    });
    mocks.createTextFile.mockResolvedValue({ modifiedAt: 150, version: 'v150' });

    const path = await useFsStore.getState().saveMissingCopy();

    expect(path).toContain('恢复副本');
    expect(useFsStore.getState().openFilePath).toBe(path);
    expect(useFsStore.getState().fileStatus).toBe('clean');
    expect(useFsStore.getState().diskVersion).toBe('v150');
  });

  it('does not close a project while a conflict is unresolved', async () => {
    useFsStore.setState({ activeProject: project, openFilePath: '正文/ch01.md', fileStatus: 'conflict' });
    expect(await useFsStore.getState().closeProject()).toBe(false);
    expect(useFsStore.getState().activeProject).toEqual(project);
  });

  it('persists the real cursor and scroll position', async () => {
    useFsStore.setState({
      activeProject: project,
      openFilePath: '正文/ch01.md',
      viewport: { cursorLine: 20, cursorColumn: 3, scrollPosition: 888 },
    });
    mocks.saveSessionState.mockResolvedValue(undefined);

    await useFsStore.getState().persistSession();

    expect(mocks.saveSessionState).toHaveBeenCalledWith(
      project.rootPath,
      expect.objectContaining({
        lastOpenFilePath: '正文/ch01.md',
        lastCursorLine: 20,
        lastCursorColumn: 3,
        lastScrollPosition: 888,
      }),
    );
  });
});
