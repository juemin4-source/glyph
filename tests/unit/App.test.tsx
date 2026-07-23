/// <reference types="vitest/globals" />
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import { useFsStore } from '../../stores/fsStore';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  onCloseRequested: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mocks.invoke(...args) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: (...args: unknown[]) => mocks.listen(...args) }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onCloseRequested: (...args: unknown[]) => mocks.onCloseRequested(...args),
    destroy: (...args: unknown[]) => mocks.destroy(...args),
  }),
}));

const fsProject = {
  id: 'fs-1',
  name: '已有长篇',
  rootPath: 'C:/novels/existing',
  genre: '',
  createdAt: 1,
  lastOpenedAt: 2,
  updatedAt: 2,
};

const defaultSession = {
  lastOpenFilePath: null,
  lastCursorLine: 0,
  lastCursorColumn: 0,
  lastScrollPosition: 0,
  openFilePaths: [],
  sidebarWidth: null,
  focusMode: null,
  lastEditMode: 'markdown',
  lastSessionAt: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listen.mockResolvedValue(() => undefined);
  mocks.onCloseRequested.mockResolvedValue(() => undefined);
  mocks.destroy.mockResolvedValue(undefined);
  mocks.invoke.mockImplementation((command: string) => {
    switch (command) {
      case 'list_fs_projects': return Promise.resolve([fsProject]);
      case 'list_projects': return Promise.resolve([]);
      case 'get_session_state': return Promise.resolve(defaultSession);
      case 'list_directory': return Promise.resolve([]);
      case 'watch_project':
      case 'unwatch_project':
      case 'save_session_state': return Promise.resolve(undefined);
      default: return Promise.resolve(undefined);
    }
  });
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
});

describe('filesystem-first App', () => {
  it('presents the two genuinely different entry paths', async () => {
    render(<App />);

    expect(screen.getByText('在织梦机开始创作')).toBeInTheDocument();
    expect(screen.getByText('导入已有创作')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('已有长篇')).toBeInTheDocument());
  });

  it('opens any selected directory in the one shared workspace', async () => {
    mocks.invoke.mockImplementation((command: string) => {
      switch (command) {
        case 'list_fs_projects': return Promise.resolve([]);
        case 'list_projects': return Promise.resolve([]);
        case 'plugin:dialog|open': return Promise.resolve('C:/novels/existing');
        case 'open_fs_project': return Promise.resolve(fsProject);
        case 'get_session_state': return Promise.resolve(defaultSession);
        case 'list_directory': return Promise.resolve([]);
        case 'watch_project':
        case 'unwatch_project':
        case 'save_session_state': return Promise.resolve(undefined);
        default: return Promise.resolve(undefined);
      }
    });

    render(<App />);
    fireEvent.click(screen.getByText('导入已有创作'));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('open_fs_project', { rootPath: 'C:/novels/existing' }));
    expect(await screen.findByText('已有长篇')).toBeInTheDocument();
    expect(screen.getByText('从左侧打开一份 Markdown，继续你的作品。')).toBeInTheDocument();
  });

  it('creates a minimal local project inside the chosen parent directory', async () => {
    const createdProject = { ...fsProject, id: 'new-1', name: '新作品', rootPath: 'C:/novels/新作品' };
    mocks.invoke.mockImplementation((command: string) => {
      switch (command) {
        case 'list_fs_projects': return Promise.resolve([]);
        case 'list_projects': return Promise.resolve([]);
        case 'plugin:dialog|open': return Promise.resolve('C:/novels');
        case 'create_fs_project': return Promise.resolve({ project: createdProject, createdDirectories: [], createdFiles: ['正文.md'] });
        case 'open_fs_project': return Promise.resolve(createdProject);
        case 'get_session_state': return Promise.resolve({ ...defaultSession, lastOpenFilePath: '正文.md', openFilePaths: ['正文.md'] });
        case 'list_directory': return Promise.resolve([{ name: '正文.md', path: '正文.md', isDir: false, extension: 'md', size: 0, modifiedAt: 10 }]);
        case 'read_file_state': return Promise.resolve({ content: '# 新作品\n\n', modifiedAt: 10, version: 'v10' });
        case 'watch_project':
        case 'unwatch_project':
        case 'save_session_state': return Promise.resolve(undefined);
        default: return Promise.resolve(undefined);
      }
    });

    render(<App />);
    fireEvent.click(screen.getByText('在织梦机开始创作'));
    fireEvent.change(screen.getByPlaceholderText('例如：边界来客'), { target: { value: '新作品' } });
    fireEvent.click(screen.getByRole('button', { name: /选择/ }));
    await waitFor(() => expect(screen.getByText('将创建：C:/novels/新作品')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '创建并开始写作' }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('create_fs_project', {
      name: '新作品',
      rootPath: 'C:/novels/新作品',
      genre: undefined,
    }));
    expect(await screen.findByDisplayValue('# 新作品\n\n')).toBeInTheDocument();
  });
});
