/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function tick(ms = 30): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// 鈹€鈹€ Mock tauri-api before importing SyncManager 鈹€鈹€
const mockPing = vi.fn();
const mockCreateWorldObject = vi.fn();
const mockUpdateWorldObject = vi.fn();
const mockDeleteWorldObject = vi.fn();
const mockSaveCanvasTabState = vi.fn();
const mockCreateConnection = vi.fn();
const mockDeleteConnection = vi.fn();
const mockAppendJudgmentRecord = vi.fn();

vi.mock('../tauri-api', () => ({
  ping: (...args: unknown[]) => mockPing(...args),
  createWorldObject: (...args: unknown[]) => mockCreateWorldObject(...args),
  updateWorldObject: (...args: unknown[]) => mockUpdateWorldObject(...args),
  deleteWorldObject: (...args: unknown[]) => mockDeleteWorldObject(...args),
  saveCanvasTabState: (...args: unknown[]) => mockSaveCanvasTabState(...args),
  createConnection: (...args: unknown[]) => mockCreateConnection(...args),
  deleteConnection: (...args: unknown[]) => mockDeleteConnection(...args),
  appendJudgmentRecord: (...args: unknown[]) => mockAppendJudgmentRecord(...args),
}));

import { SyncManager } from './SyncManager';

describe('SyncManager', () => {
  let sm: SyncManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    sm = new SyncManager();
    mockPing.mockResolvedValue('pong');
    // Ensure clean DB state by clearing any leftovers
    await sm.clearAll();
  });

  afterEach(async () => {
    sm.stopPing();
    await sm.clearAll();
  });

  // 鈹€鈹€ Queue Persistence 鈹€鈹€

  describe('queue persistence', () => {
    it('enqueue adds an operation, getQueueLength returns 1', async () => {
      mockCreateWorldObject.mockRejectedValue(new Error('block'));
      await sm.enqueue('createObject', { name: 'test' });
      await tick();
      const len = await sm.getQueueLength();
      expect(len).toBe(1);
    });

    it('multiple enqueues increase queue length', async () => {
      mockCreateWorldObject.mockRejectedValue(new Error('block'));
      mockUpdateWorldObject.mockRejectedValue(new Error('block'));
      mockDeleteWorldObject.mockRejectedValue(new Error('block'));
      await sm.enqueue('createObject', { name: 'a' });
      await sm.enqueue('updateObject', { id: '1' });
      await sm.enqueue('deleteObject', { id: '2' });
      await tick();
      const len = await sm.getQueueLength();
      expect(len).toBe(3);
    });

    it('clearAll empties the queue', async () => {
      mockCreateWorldObject.mockRejectedValue(new Error('block'));
      await sm.enqueue('createObject', { name: 'test' });
      await tick();
      await sm.clearAll();
      const len = await sm.getQueueLength();
      expect(len).toBe(0);
    });
  });

  // 鈹€鈹€ Retry / Failure Behavior 鈹€鈹€

  describe('retry behavior', () => {
    it('failed operation stays in queue', async () => {
      mockCreateWorldObject.mockRejectedValue(new Error('Network error'));
      await sm.enqueue('createObject', { name: 'retry-test' });
      await tick();

      expect(await sm.getQueueLength()).toBe(1);
      expect(mockCreateWorldObject).toHaveBeenCalledTimes(1);
    });

    it('successful operation is removed from queue', async () => {
      mockCreateWorldObject.mockResolvedValue({ id: 'new-obj' });
      await sm.enqueue('createObject', { name: 'success-test' });
      await tick();

      expect(await sm.getQueueLength()).toBe(0);
      expect(mockCreateWorldObject).toHaveBeenCalledTimes(1);
    });

    it('enqueue + retryFailed processes items sequentially', async () => {
      // Enqueue one item that fails
      mockCreateWorldObject.mockRejectedValue(new Error('fail'));
      await sm.enqueue('createObject', { name: 'retry-me' });
      await tick();
      expect(await sm.getQueueLength()).toBe(1);

      // Now make it succeed and retry
      mockCreateWorldObject.mockResolvedValue({ id: 'success' });
      await sm.retryFailed();
      await tick();
      expect(await sm.getQueueLength()).toBe(0);
      expect(mockCreateWorldObject).toHaveBeenCalledTimes(2);
    });
  });

  // 鈹€鈹€ Online/Offline Detection 鈹€鈹€

  describe('online/offline detection', () => {
    it('starts online by default', () => {
      expect(sm.isOnline()).toBe(true);
    });

    it('reports offline when ping fails', async () => {
      mockPing.mockRejectedValue(new Error('Offline'));
      sm.startPing();
      await tick();
      expect(sm.isOnline()).toBe(false);
      sm.stopPing();
    });

    it('accumulates items in queue while offline', async () => {
      mockPing.mockRejectedValue(new Error('Offline'));
      sm.startPing();
      await tick();
      expect(sm.isOnline()).toBe(false);

      await sm.enqueue('createObject', { name: 'offline-item-1' });
      await sm.enqueue('createObject', { name: 'offline-item-2' });

      expect(await sm.getQueueLength()).toBe(2);
      // No API calls while offline
      expect(mockCreateWorldObject).not.toHaveBeenCalled();
      sm.stopPing();
    });
  });

  // 鈹€鈹€ On Reconnect 鈹€鈹€

  describe('on reconnect', () => {
    it('drains the queue via retryFailed after being offline', async () => {
      mockPing.mockRejectedValue(new Error('Offline'));
      sm.startPing();
      await tick();

      mockCreateWorldObject.mockResolvedValue({ id: 'synced' });
      await sm.enqueue('createObject', { name: 'item1' });
      await sm.enqueue('createObject', { name: 'item2' });
      expect(await sm.getQueueLength()).toBe(2);

      // Simulate reconnect
      await sm.retryFailed();
      await tick();

      expect(await sm.getQueueLength()).toBe(0);
      expect(mockCreateWorldObject).toHaveBeenCalledTimes(2);
      sm.stopPing();
    });
  });

  // 鈹€鈹€ Failed Items Persist (using retryFailed to exhaust) 鈹€鈹€

  describe('failed items persist', () => {
    it('items stay in queue after exhausting retries', async () => {
      mockCreateWorldObject.mockRejectedValue(new Error('Persistent error'));

      await sm.enqueue('createObject', { name: 'persist-test' });
      await tick();

      // Use retryFailed to increment retryCount
      // retryFailed calls processQueue which tries executeOp and increments
      for (let i = 0; i < 4; i++) {
        await sm.retryFailed();
        await tick();
      }

      expect(await sm.getQueueLength()).toBe(1);
      const failed = await sm.getFailedOperations();
      expect(failed).toHaveLength(1);
    });

    it('getFailedCount returns correct count after failures', async () => {
      mockCreateWorldObject.mockRejectedValue(new Error('Error'));

      await sm.enqueue('createObject', { name: 'fail-count' });
      await tick();

      for (let i = 0; i < 4; i++) {
        await sm.retryFailed();
        await tick();
      }

      expect(sm.getFailedCount()).toBe(1);
    });
  });

  // 鈹€鈹€ Save Status 鈹€鈹€

  describe('save status', () => {
    it('initial status is saved', () => {
      expect(sm.getSaveStatus()).toBe('saved');
    });

    it('status changes when enqueuing while online', async () => {
      await sm.enqueue('createObject', { name: 'status-test' });
      expect(sm.getSaveStatus()).toBe('saving');
    });

    it('status changes to offline when enqueuing while offline', async () => {
      mockPing.mockRejectedValue(new Error('Offline'));
      sm.startPing();
      await tick();

      await sm.enqueue('createObject', { name: 'offline-status' });
      expect(sm.getSaveStatus()).toBe('offline');
      sm.stopPing();
    });

    it('notifies status listeners', async () => {
      const changes: string[] = [];
      sm.onSaveStatusChange((status) => { changes.push(status); });
      await sm.enqueue('createObject', { name: 'notify-test' });
      expect(changes.length).toBeGreaterThan(0);
    });
  });

  // 鈹€鈹€ Online Status Callbacks 鈹€鈹€

  describe('online status callbacks', () => {
    it('notifies online listeners when offline', async () => {
      const onlineChanges: boolean[] = [];
      sm.onOnlineStatusChange((online) => { onlineChanges.push(online); });

      mockPing.mockRejectedValue(new Error('Offline'));
      sm.startPing();
      await tick();

      expect(onlineChanges).toContain(false);
      sm.stopPing();
    });
  });

  // 鈹€鈹€ getQueueLength / Failed Operations 鈹€鈹€

  describe('queue inspection', () => {
    it('getQueueLength returns 0 for empty queue', async () => {
      const len = await sm.getQueueLength();
      expect(len).toBe(0);
    });

    it('getFailedOperations returns empty for no failures', async () => {
      const failed = await sm.getFailedOperations();
      expect(failed).toEqual([]);
    });

    it('getFailedCount returns 0 initially', () => {
      expect(sm.getFailedCount()).toBe(0);
    });
  });

  // 鈹€鈹€ getFailedCount after failures 鈹€鈹€

  describe('getFailedCount (integration)', () => {
    it('getFailedCount is 0 after successful enqueue', async () => {
      mockCreateWorldObject.mockResolvedValue({ id: 'obj' });
      await sm.enqueue('createObject', { name: 'success' });
      await tick();
      expect(sm.getFailedCount()).toBe(0);
    });
  });
});


