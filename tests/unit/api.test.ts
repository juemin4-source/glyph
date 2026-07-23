/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @tauri-apps/api/core before any imports that use it
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  listWorldObjects,
  getWorldObject,
  createWorldObject,
  updateWorldObject,
  deleteWorldObject,
  listJudgmentRecords,
  appendJudgmentRecord,
  listConnections,
  createConnection,
  deleteConnection,
  listCanvasTabStates,
  saveCanvasTabState,
  deleteCanvasTabState,
} from '../tauri-api';

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockInvoke.mockReset();
});

// ── Project API ──

describe('Project API', () => {
  const mockProject = {
    id: 'proj-1',
    name: '觉醒纪元',
    genre: '科幻',
    status: 'drafting',
    wordCount: 12500,
    gradient: '["#667eea","#764ba2"]',
    createdAt: 1000,
    updatedAt: 2000,
  };

  it('listProjects calls invoke with list_projects', async () => {
    mockInvoke.mockResolvedValue([mockProject]);
    const result = await listProjects();
    expect(mockInvoke).toHaveBeenCalledWith('list_projects');
    expect(result).toEqual([mockProject]);
    expect(result.length).toBe(1);
  });

  it('listProjects returns empty array when no projects', async () => {
    mockInvoke.mockResolvedValue([]);
    const result = await listProjects();
    expect(result).toEqual([]);
  });

  it('getProject calls invoke with get_project and id', async () => {
    mockInvoke.mockResolvedValue(mockProject);
    const result = await getProject('proj-1');
    expect(mockInvoke).toHaveBeenCalledWith('get_project', { id: 'proj-1' });
    expect(result).toEqual(mockProject);
  });

  it('getProject returns null for non-existent', async () => {
    mockInvoke.mockResolvedValue(null);
    const result = await getProject('nonexistent');
    expect(result).toBeNull();
  });

  it('createProject calls invoke with create_project and defaults', async () => {
    mockInvoke.mockResolvedValue(mockProject);
    const result = await createProject('觉醒纪元');
    expect(mockInvoke).toHaveBeenCalledWith('create_project', {
      name: '觉醒纪元',
      genre: '未分类',
      status: 'conceiving',
      wordCount: 0,
      gradient: '["#6366f1","#8b5cf6"]',
    });
    expect(result).toEqual(mockProject);
  });

  it('createProject passes custom parameters', async () => {
    mockInvoke.mockResolvedValue({ ...mockProject, genre: '科幻' });
    const result = await createProject('觉醒纪元', '科幻', 'drafting', 5000, '["#a","#b"]');
    expect(mockInvoke).toHaveBeenCalledWith('create_project', {
      name: '觉醒纪元',
      genre: '科幻',
      status: 'drafting',
      wordCount: 5000,
      gradient: '["#a","#b"]',
    });
  });

  it('updateProject calls invoke with update_project', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await updateProject(mockProject);
    expect(mockInvoke).toHaveBeenCalledWith('update_project', { project: mockProject });
  });

  it('deleteProject calls invoke with delete_project', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await deleteProject('proj-1');
    expect(mockInvoke).toHaveBeenCalledWith('delete_project', { id: 'proj-1' });
  });

  it('handles invoke errors', async () => {
    mockInvoke.mockRejectedValue(new Error('DB error'));
    await expect(listProjects()).rejects.toThrow('DB error');
  });
});

// ── WorldObject API ──

describe('WorldObject API', () => {
  const mockObject = {
    id: 'obj-1',
    projectId: 'proj-1',
    name: '张三',
    type: '人物' as const,
    status: '锁定' as const,
    canonLevel: '核心正典' as const,
    tags: ['主角'],
    aliases: [],
    selectedBoards: ['角色关系图'],
    content: 'Test content',
    referencesCount: 0,
    judgmentHistory: [],
    createdAt: 1000,
    updatedAt: 2000,
  };

  it('listWorldObjects calls invoke', async () => {
    mockInvoke.mockResolvedValue([mockObject]);
    const result = await listWorldObjects('proj-1');
    expect(mockInvoke).toHaveBeenCalledWith('list_world_objects', { projectId: 'proj-1' });
    expect(result).toEqual([mockObject]);
  });

  it('getWorldObject calls invoke', async () => {
    mockInvoke.mockResolvedValue(mockObject);
    const result = await getWorldObject('obj-1');
    expect(mockInvoke).toHaveBeenCalledWith('get_world_object', { id: 'obj-1' });
    expect(result).toEqual(mockObject);
  });

  it('createWorldObject calls invoke', async () => {
    mockInvoke.mockResolvedValue(mockObject);
    const result = await createWorldObject(mockObject);
    expect(mockInvoke).toHaveBeenCalledWith('create_world_object', { object: mockObject });
    expect(result).toEqual(mockObject);
  });

  it('updateWorldObject calls invoke', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await updateWorldObject(mockObject);
    expect(mockInvoke).toHaveBeenCalledWith('update_world_object', { object: mockObject });
  });

  it('deleteWorldObject calls invoke', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await deleteWorldObject('obj-1');
    expect(mockInvoke).toHaveBeenCalledWith('delete_world_object', { id: 'obj-1' });
  });
});

// ── JudgmentRecord API ──

describe('JudgmentRecord API', () => {
  const mockRecord = {
    id: 'judg-1',
    objectId: 'obj-1',
    objectName: '张三',
    operationType: '锁定' as const,
    reason: '核心角色',
    timestamp: 1000,
    previousStatus: '草稿',
    newStatus: '锁定',
  };

  it('listJudgmentRecords calls invoke', async () => {
    mockInvoke.mockResolvedValue([mockRecord]);
    const result = await listJudgmentRecords('proj-1');
    expect(mockInvoke).toHaveBeenCalledWith('list_judgment_records', { projectId: 'proj-1' });
    expect(result).toEqual([mockRecord]);
  });

  it('appendJudgmentRecord calls invoke', async () => {
    mockInvoke.mockResolvedValue(mockRecord);
    const result = await appendJudgmentRecord(mockRecord);
    expect(mockInvoke).toHaveBeenCalledWith('append_judgment_record', { record: mockRecord });
    expect(result).toEqual(mockRecord);
  });
});

// ── Connection API ──

describe('Connection API', () => {
  const mockConnection = {
    id: 'conn-1',
    projectId: 'proj-1',
    sourceId: 'obj-1',
    targetId: 'obj-2',
    type: '影响' as const,
    label: 'influences',
  };

  it('listConnections calls invoke', async () => {
    mockInvoke.mockResolvedValue([mockConnection]);
    const result = await listConnections('proj-1');
    expect(mockInvoke).toHaveBeenCalledWith('list_connections', { projectId: 'proj-1' });
    expect(result).toEqual([mockConnection]);
  });

  it('createConnection calls invoke', async () => {
    mockInvoke.mockResolvedValue(mockConnection);
    const result = await createConnection(mockConnection);
    expect(mockInvoke).toHaveBeenCalledWith('create_connection', { connection: mockConnection });
    expect(result).toEqual(mockConnection);
  });

  it('deleteConnection calls invoke', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await deleteConnection('conn-1');
    expect(mockInvoke).toHaveBeenCalledWith('delete_connection', { id: 'conn-1' });
  });
});

// ── CanvasTabState API ──

describe('CanvasTabState API', () => {
  const mockState = {
    id: 'proj-1:角色关系图',
    projectId: 'proj-1',
    tabId: '角色关系图' as const,
    positions: {},
    stickyNotes: [],
    connections: [],
    scale: 1.0,
    panX: 0,
    panY: 0,
    createdAt: 1000,
    updatedAt: 2000,
  };

  it('listCanvasTabStates calls invoke', async () => {
    mockInvoke.mockResolvedValue([mockState]);
    const result = await listCanvasTabStates('proj-1');
    expect(mockInvoke).toHaveBeenCalledWith('list_canvas_tab_states', { projectId: 'proj-1' });
    expect(result).toEqual([mockState]);
  });

  it('saveCanvasTabState calls invoke', async () => {
    mockInvoke.mockResolvedValue(mockState);
    const result = await saveCanvasTabState(mockState);
    expect(mockInvoke).toHaveBeenCalledWith('save_canvas_tab_state', { state: mockState });
    expect(result).toEqual(mockState);
  });

  it('deleteCanvasTabState calls invoke', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await deleteCanvasTabState('state-1');
    expect(mockInvoke).toHaveBeenCalledWith('delete_canvas_tab_state', { id: 'state-1' });
  });
});
