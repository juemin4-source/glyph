/**
 * SyncManager — IndexedDB-backed retry queue for 织梦机 v1.2 (P0-01, P0-02).
 *
 * All write operations route through enqueue() before reaching Tauri invoke.
 * Queue persisted to IndexedDB for survival across app restarts.
 * 3-retry exponential backoff (1s, 2s, 4s).
 * Health ping every 3 seconds for online/offline detection.
 */

import type { SyncOperation, SyncOperationType, SaveStatus } from '../types/world';
import * as api from '../tauri-api';

type StatusCallback = (status: SaveStatus) => void;
type OnlineCallback = (online: boolean) => void;

const DB_NAME = 'glyph-sync-queue';
const DB_VERSION = 1;
const STORE_NAME = 'operations';
const PING_INTERVAL_MS = 3000;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class SyncManager {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private _isOnline: boolean = true;
  private _saveStatus: SaveStatus = 'saved';
  private statusListeners: StatusCallback[] = [];
  private onlineListeners: OnlineCallback[] = [];
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private processing: boolean = false;
  private _failedCount = 0;

  constructor() {
    this.dbPromise = openDB();
  }

  // ── Online Status ──

  isOnline(): boolean {
    return this._isOnline;
  }

  getSaveStatus(): SaveStatus {
    return this._saveStatus;
  }

  onSaveStatusChange(cb: StatusCallback): void {
    this.statusListeners.push(cb);
  }

  onOnlineStatusChange(cb: OnlineCallback): void {
    this.onlineListeners.push(cb);
  }

  private setSaveStatus(status: SaveStatus): void {
    this._saveStatus = status;
    for (const cb of this.statusListeners) {
      try { cb(status); } catch { /* ignore */ }
    }
  }

  private setOnline(online: boolean): void {
    if (this._isOnline === online) return;
    this._isOnline = online;
    if (!online) {
      this.setSaveStatus('offline');
    }
    for (const cb of this.onlineListeners) {
      try { cb(online); } catch { /* ignore */ }
    }
  }

  // ── Lifecycle ──

  startPing(): void {
    if (this.pingTimer) return;
    this.pingTimer = setInterval(() => this.ping(), PING_INTERVAL_MS);
    this.ping(); // immediate first check
  }

  stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private async ping(): Promise<void> {
    try {
      await api.ping();
      const wasOffline = !this._isOnline;
      this.setOnline(true);
      if (this._saveStatus === 'offline' || wasOffline) {
        this.setSaveStatus('saving');
        await this.processQueue();
      }
    } catch {
      this.setOnline(false);
    }
  }

  // ── Queue Operations ──

  async enqueue(type: SyncOperationType, payload: any): Promise<void> {
    const op: SyncOperation = {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      payload,
      retryCount: 0,
      maxRetries: MAX_RETRIES,
      createdAt: Date.now(),
    };

    await this.saveToDB(op);
    if (this._isOnline) {
      this.setSaveStatus('saving');
      this.processQueue();
    } else {
      this.setSaveStatus('offline');
    }
  }

  async getQueueLength(): Promise<number> {
    try {
      const all = await this.getAllFromDB();
      return all.length;
    } catch {
      return 0;
    }
  }

  getFailedCount(): number {
    return this._failedCount;
  }

  async retryFailed(): Promise<void> {
    this.setSaveStatus('saving');
    await this.processQueue();
  }

  // ── Queue Processing ──

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      const ops = await this.getAllFromDB();
      if (ops.length === 0) {
        this.setSaveStatus('saved');
        return;
      }

      for (const op of ops) {
        if (op.retryCount > op.maxRetries) continue;

        const success = await this.executeOp(op);
        if (success) {
          await this.removeFromDB(op.id);
        } else {
          op.retryCount++;
          op.lastAttempt = Date.now();
          if (op.retryCount > op.maxRetries) {
            op.error = 'Max retries exceeded';
            await this.updateInDB(op);
            this._failedCount++;
            this.setSaveStatus('failed');
          } else {
            await this.updateInDB(op);
            // Schedule retry with exponential backoff
            const delay = BACKOFF_BASE_MS * Math.pow(2, op.retryCount - 1);
            setTimeout(() => this.processQueue(), delay);
            this.processing = false;
            return;
          }
        }
      }

      // Check if any failed remain
      const remaining = await this.getAllFromDB();
      const hasFailed = remaining.some(o => o.retryCount > o.maxRetries);
      if (remaining.length === 0) {
        this.setSaveStatus('saved');
      } else if (!hasFailed) {
        this.setSaveStatus('saved');
      }
    } catch {
      // Queue processing error — keep status
    } finally {
      this.processing = false;
    }
  }

  private async executeOp(op: SyncOperation): Promise<boolean> {
    try {
      switch (op.type) {
        case 'createObject':
          await api.createWorldObject(op.payload);
          break;
        case 'updateObject':
          await api.updateWorldObject(op.payload);
          break;
        case 'deleteObject':
          await api.deleteWorldObject(op.payload.id || op.payload);
          break;
        case 'saveCanvasState':
          await api.saveCanvasTabState(op.payload);
          break;
        case 'createConnection':
          await api.createConnection(op.payload);
          break;
        case 'deleteConnection':
          await api.deleteConnection(op.payload.id || op.payload);
          break;
        case 'appendJudgment':
          await api.appendJudgmentRecord(op.payload);
          break;
      }
      return true;
    } catch {
      return false;
    }
  }

  // ── IndexedDB Helpers ──

  private async withDB<T>(fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.dbPromise!;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private saveToDB(op: SyncOperation): Promise<void> {
    return this.withDB(store => store.put(op)).then(() => {});
  }

  private removeFromDB(id: string): Promise<void> {
    return this.withDB(store => store.delete(id)).then(() => {});
  }

  private updateInDB(op: SyncOperation): Promise<void> {
    return this.withDB(store => store.put(op)).then(() => {});
  }

  private async getAllFromDB(): Promise<SyncOperation[]> {
    const db = await this.dbPromise!;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const results: SyncOperation[] = req.result || [];
        results.sort((a, b) => a.createdAt - b.createdAt);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getFailedOperations(): Promise<SyncOperation[]> {
    const all = await this.getAllFromDB();
    return all.filter(o => o.retryCount > o.maxRetries);
  }

  async clearAll(): Promise<void> {
    await this.withDB(store => store.clear());
  }
}
