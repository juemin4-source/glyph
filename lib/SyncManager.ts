/**
 * SyncManager — v0.1 simplified auto-save.
 *
 * Removed (per PRD 3.6):
 * - IndexedDB backup queue (no server, don't need it)
 * - Online/offline detection (no server, don't need it)
 * - Exponential backoff retry (direct write, failure is immediate)
 * - Reconnect replay (no server, don't need it)
 *
 * Kept:
 * - Direct invoke to Tauri commands
 * - Save status callbacks for UI status bar
 * - Failed save exposes retry()
 */

import type { SaveStatus } from '../types/world';
import * as api from '../tauri-api';

type StatusCallback = (status: SaveStatus) => void;

export class SyncManager {
  private _saveStatus: SaveStatus = 'saved';
  private statusListeners: StatusCallback[] = [];
  private pendingWrites = 0;

  getSaveStatus(): SaveStatus {
    return this._saveStatus;
  }

  onSaveStatusChange(cb: StatusCallback): void {
    this.statusListeners.push(cb);
  }

  private setSaveStatus(status: SaveStatus): void {
    this._saveStatus = status;
    for (const cb of this.statusListeners) {
      try { cb(status); } catch { /* ignore */ }
    }
  }

  startPing(): void {
    // v0.1: no-op. No server to ping.
  }

  stopPing(): void {
    // v0.1: no-op
  }

  /**
   * Write a world object to the backend directly.
   * Returns true on success, false on failure.
   */
  async writeObject(type: 'createObject' | 'updateObject' | 'deleteObject', payload: any): Promise<boolean> {
    this.pendingWrites++;
    this.setSaveStatus('saving');

    try {
      switch (type) {
        case 'createObject':
          await api.createWorldObject(payload);
          break;
        case 'updateObject':
          await api.updateWorldObject(payload);
          break;
        case 'deleteObject':
          await api.deleteWorldObject(payload.id || payload);
          break;
      }
      this.pendingWrites--;
      if (this.pendingWrites === 0) {
        this.setSaveStatus('saved');
      }
      return true;
    } catch {
      this.pendingWrites--;
      if (this.pendingWrites === 0) {
        this.setSaveStatus('failed');
      }
      return false;
    }
  }

  /**
   * Retry all failed operations. For v0.1, since there's no queue,
   * the caller should re-trigger the failed write.
   */
  retryFailed(): void {
    // v0.1: caller re-triggers the write. This resets the status for next write.
    if (this._saveStatus === 'failed') {
      this.setSaveStatus('saved');
    }
  }
}
