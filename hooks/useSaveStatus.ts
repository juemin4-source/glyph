/**
 * useSaveStatus — Save status hook for 织梦机 v1.2 (P1-05).
 *
 * Provides:
 * - saveStatus state (saved/saving/unsaved/failed/offline)
 * - contentDirty flag
 * - Auto-save 500ms debounce timer
 * - SyncManager integration
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SaveStatus } from '../types/world';

interface UseSaveStatusReturn {
  saveStatus: SaveStatus;
  contentDirty: boolean;
  setContentDirty: (dirty: boolean) => void;
  setSaveStatus: (status: SaveStatus) => void;
  triggerSave: () => void;
}

export function useSaveStatus(
  autoSaveFn?: () => Promise<void>
): UseSaveStatusReturn {
  const [saveStatus, setSaveStatusState] = useState<SaveStatus>('saved');
  const [contentDirty, setContentDirtyState] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<SaveStatus>('saved');

  const setSaveStatus = useCallback((status: SaveStatus) => {
    statusRef.current = status;
    setSaveStatusState(status);
  }, []);

  const setContentDirty = useCallback((dirty: boolean) => {
    setContentDirtyState(dirty);
    if (dirty && statusRef.current === 'saved') {
      setSaveStatus('unsaved');
    }
  }, [setSaveStatus]);

  const triggerSave = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(async () => {
      if (!autoSaveFn) return;
      setSaveStatus('saving');
      try {
        await autoSaveFn();
        setSaveStatus('saved');
        setContentDirtyState(false);
      } catch {
        setSaveStatus('failed');
      }
    }, 500);
  }, [autoSaveFn, setSaveStatus]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    saveStatus,
    contentDirty,
    setContentDirty,
    setSaveStatus,
    triggerSave,
  };
}

