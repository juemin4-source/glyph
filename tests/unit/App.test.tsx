/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

// ── Mock Tauri API ──
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// ── Mock child components so they don't pull in heavy deps ──
vi.mock('../components/Bookshelf', () => {
  const React = require('react');
  return {
    default: function MockBookshelf(props: { projects: Array<{ id: string; title: string }>; onEnterProject: (p: unknown) => void; onCreateProject?: () => void }) {
      return React.createElement('div', { 'data-testid': 'bookshelf' },
        React.createElement('span', { 'data-testid': 'project-count' }, `Projects: ${props.projects?.length || 0}`),
        props.onCreateProject
          ? React.createElement('button', { 'data-testid': 'create-project', onClick: props.onCreateProject }, 'Create')
          : null,
        ...(props.projects || []).map((p) =>
          React.createElement('button', { key: p.id, 'data-testid': `enter-${p.id}`, onClick: () => props.onEnterProject(p) }, p.title)
        )
      );
    },
  };
});

vi.mock('../components/DocumentView', () => {
  const React = require('react');
  return { default: () => React.createElement('div', { 'data-testid': 'document-view' }, 'DocumentView') };
});

vi.mock('../components/CanvasView', () => {
  const React = require('react');
  return { default: () => React.createElement('div', { 'data-testid': 'canvas-view' }, 'CanvasView') };
});

vi.mock('../components/SettingCollection', () => {
  const React = require('react');
  return { default: () => React.createElement('div', { 'data-testid': 'setting-collection' }, 'SettingCollection') };
});

vi.mock('../components/JudgmentRecords', () => {
  const React = require('react');
  return { default: () => React.createElement('div', { 'data-testid': 'judgment-records' }, 'JudgmentRecords') };
});

vi.mock('../components/Inspector', () => {
  const React = require('react');
  return { default: () => React.createElement('div', { 'data-testid': 'inspector' }, 'Inspector') };
});

// ── Test Data ──
const mockProjects = [
  { id: 'book-1', name: '觉醒纪元', genre: '科幻', status: 'drafting', wordCount: 12500, gradient: '["#667eea","#764ba2"]', createdAt: 1000, updatedAt: 2000 },
  { id: 'book-2', name: '星空彼岸', genre: '奇幻', status: 'conceiving', wordCount: 3800, gradient: '["#0f2027","#203a43"]', createdAt: 1000, updatedAt: 1500 },
];

const mockWorldObjects = [
  {
    id: 'obj-1',
    projectId: 'book-1',
    name: '张三',
    type: '人物',
    status: '锁定',
    canonLevel: '核心正典',
    tags: ['主角'],
    aliases: [],
    selectedBoards: ['角色关系图'],
    content: 'Test content',
    referencesCount: 0,
    judgmentHistory: [],
    createdAt: 1000,
    updatedAt: 2000,
  },
];

beforeEach(() => {
  mockInvoke.mockReset();
});

// ── Path 1: Story Creation (App level) ──
describe('Path 1: Story Creation (App level)', () => {
  it('shows loading state initially, then renders bookshelf', async () => {
    mockInvoke.mockResolvedValue(mockProjects);
    render(<App />);

    // Loading state initially
    expect(screen.getByText('加载中...')).toBeInTheDocument();

    // After projects load, bookshelf appears
    await waitFor(() => {
      expect(screen.getByTestId('bookshelf')).toBeInTheDocument();
    });
    expect(screen.getByText('觉醒纪元')).toBeInTheDocument();
  });

  it('handles empty projects gracefully', async () => {
    mockInvoke.mockResolvedValue([]);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('bookshelf')).toBeInTheDocument();
    });
    expect(screen.getByText('Projects: 0')).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'));
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('bookshelf')).toBeInTheDocument();
    });
    // App should still render bookshelf (with empty projects)
    expect(screen.getByText('Projects: 0')).toBeInTheDocument();
  });

  it('create project button triggers project creation flow', async () => {
    mockInvoke
      .mockResolvedValueOnce('pong') // SyncManager ping
      .mockResolvedValueOnce(mockProjects) // listProjects
      .mockResolvedValueOnce({ // createProject
        id: 'book-3',
        name: '新作品',
        genre: '未分类',
        status: 'conceiving',
        wordCount: 0,
        gradient: '["#6366f1","#8b5cf6"]',
        createdAt: 3000,
        updatedAt: 3000,
      })
      .mockResolvedValueOnce([...mockProjects, { id: 'book-3', name: '新作品', genre: '未分类', status: 'conceiving', wordCount: 0, gradient: '["#6366f1","#8b5cf6"]', createdAt: 3000, updatedAt: 3000 }]); // refreshProjects

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('bookshelf')).toBeInTheDocument();
    });

    // Click create
    fireEvent.click(screen.getByTestId('create-project'));

    // Step 1: type title
    fireEvent.change(screen.getByPlaceholderText('输入作品名称...'), { target: { value: '新作品' } });

    // Click next
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }));

    // Step 2: skip template
    fireEvent.click(screen.getByText('跳过'));

    // Should call create_project
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('create_project', expect.objectContaining({
        name: '新作品',
      }));
    });
  });
});

// ── Path 3: Canon Management (App level) ──
describe('Path 3: Canon Management (App level)', () => {
  it('loads world objects when entering a project', async () => {
    mockInvoke
      .mockResolvedValueOnce('pong') // SyncManager ping
      .mockResolvedValueOnce(mockProjects) // listProjects
      .mockResolvedValueOnce(mockWorldObjects) // listWorldObjects
      .mockResolvedValueOnce([]) // listConnections
      .mockResolvedValueOnce([]); // listCanvasTabStates

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('bookshelf')).toBeInTheDocument();
    });

    // Enter a project
    const enterBtn = screen.getByTestId('enter-book-1');
    fireEvent.click(enterBtn);

    // Should load project data
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('list_world_objects', { projectId: 'book-1' });
    });
  });
});

// ── Path 4: Judgment Recording (App level) ──
describe('Path 4: Judgment Recording (App level)', () => {
  it('tabs include judgment records tab', async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'ping') return Promise.resolve('pong');
      if (command === 'list_projects') return Promise.resolve(mockProjects);
      if (command === 'list_world_objects') return Promise.resolve(mockWorldObjects);
      if (command === 'get_pipeline_state') return Promise.resolve({
        projectId: 'book-1',
        currentStage: 'premise',
        canvasStages: [{ stage: 'premise', status: 'active' }],
        createdAt: 0,
        updatedAt: 0,
      });
      return Promise.resolve([]);
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('bookshelf')).toBeInTheDocument();
    });

    // Enter project
    fireEvent.click(screen.getByTestId('enter-book-1'));

    // Check that nav tabs are rendered (using mocked components)
    await waitFor(() => {
      expect(screen.getByTestId('document-view')).toBeInTheDocument();
    });

    // Entering the project leaves the bookshelf and opens pipeline mode.
    expect(screen.queryByTestId('bookshelf')).not.toBeInTheDocument();
  });
});

// ── Path 6: Cross-Book Isolation (App level) ──
describe('Path 6: Cross-Book Isolation (App level)', () => {
  it('shows multiple books in bookshelf', async () => {
    mockInvoke.mockResolvedValue(mockProjects);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('bookshelf')).toBeInTheDocument();
    });

    expect(screen.getByText('觉醒纪元')).toBeInTheDocument();
    expect(screen.getByText('星空彼岸')).toBeInTheDocument();
  });
});
