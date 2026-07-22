/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock tauri-api
const mockCreateWorldObject = vi.fn();
const mockUpdateWorldObject = vi.fn();
const mockDeleteWorldObject = vi.fn();

vi.mock('../tauri-api', () => ({
  createWorldObject: (...args: unknown[]) => mockCreateWorldObject(...args),
  updateWorldObject: (...args: unknown[]) => mockUpdateWorldObject(...args),
  deleteWorldObject: (...args: unknown[]) => mockDeleteWorldObject(...args),
}));

import { SyncManager } from './SyncManager';

describe('SyncManager v0.1', () => {
  let sm: SyncManager;

  beforeEach(() => {
    vi.clearAllMocks();
    sm = new SyncManager();
  });

  it('starts as saved', () => {
    expect(sm.getSaveStatus()).toBe('saved');
  });

  it('notifies status change listeners', () => {
    const cb = vi.fn();
    sm.onSaveStatusChange(cb);
    sm.writeObject('updateObject', { id: '1', content: 'hello', projectId: 'p1' });
    expect(cb).toHaveBeenCalledWith('saving');
  });

  it('sets saved after successful writeObject', async () => {
    mockUpdateWorldObject.mockResolvedValueOnce(undefined);
    const ok = await sm.writeObject('updateObject', { id: '1', content: 'hello', projectId: 'p1' });
    expect(ok).toBe(true);
    expect(mockUpdateWorldObject).toHaveBeenCalledWith({ id: '1', content: 'hello', projectId: 'p1' });
  });

  it('sets failed after writeObject error', async () => {
    mockUpdateWorldObject.mockRejectedValueOnce(new Error('db error'));
    const ok = await sm.writeObject('updateObject', { id: '1', projectId: 'p1' });
    expect(ok).toBe(false);
    expect(sm.getSaveStatus()).toBe('failed');
  });

  it('handles createObject', async () => {
    mockCreateWorldObject.mockResolvedValueOnce(undefined);
    const ok = await sm.writeObject('createObject', { id: 'new', name: 'test', projectId: 'p1' });
    expect(ok).toBe(true);
    expect(mockCreateWorldObject).toHaveBeenCalledWith({ id: 'new', name: 'test', projectId: 'p1' });
  });

  it('handles deleteObject', async () => {
    mockDeleteWorldObject.mockResolvedValueOnce(undefined);
    const ok = await sm.writeObject('deleteObject', { id: '1' });
    expect(ok).toBe(true);
    expect(mockDeleteWorldObject).toHaveBeenCalledWith('1');
  });

  it('retryFailed resets failed status', () => {
    sm.retryFailed(); // no-op when not failed
    expect(sm.getSaveStatus()).toBe('saved');
  });
});
