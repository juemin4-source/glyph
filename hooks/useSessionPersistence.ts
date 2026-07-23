import { useEffect, useCallback } from 'react';
import type { SessionState } from '../types/fs';
import { getSessionState, saveSessionState } from '../tauri-api';

interface SessionData {
  lastOpenFilePath: string | null;
  lastCursorLine?: number;
  lastCursorColumn?: number;
  lastScrollPosition?: number;
  openFilePaths: string[];
}

/**
 * Manages session persistence for the filesystem project.
 * Saves on beforeunload, restores on mount.
 */
export function useSessionPersistence(
  projectRoot: string | null,
  currentSession: SessionData | null,
  onRestore: (state: SessionState) => void,
) {
  // Restore session on mount
  useEffect(() => {
    if (!projectRoot) return;

    getSessionState(projectRoot)
      .then((state) => {
        if (state.lastOpenFilePath || state.openFilePaths.length > 0) {
          onRestore(state);
        }
      })
      .catch(() => {
        // No saved session, ignore
      });
  }, [projectRoot]);

  // Save on beforeunload
  useEffect(() => {
    if (!projectRoot || !currentSession) return;

    const handleBeforeUnload = () => {
      const state: SessionState = {
        lastOpenFilePath: currentSession.lastOpenFilePath,
        lastCursorLine: currentSession.lastCursorLine ?? null,
        lastCursorColumn: currentSession.lastCursorColumn ?? null,
        lastScrollPosition: currentSession.lastScrollPosition ?? null,
        openFilePaths: currentSession.openFilePaths,
        sidebarWidth: null,
        focusMode: null,
        lastEditMode: null,
        lastSessionAt: Date.now(),
      };
      // Use sendBeacon-like approach: synchronous XHR
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/save-session', false); // Will be intercepted
      } catch {
        // Fallback: just use the Tauri invoke (may not complete)
        saveSessionState(projectRoot, state).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [projectRoot, currentSession]);

  // Manual save
  const save = useCallback(async () => {
    if (!projectRoot || !currentSession) return;
    const state: SessionState = {
      lastOpenFilePath: currentSession.lastOpenFilePath,
      lastCursorLine: currentSession.lastCursorLine ?? null,
      lastCursorColumn: currentSession.lastCursorColumn ?? null,
      lastScrollPosition: currentSession.lastScrollPosition ?? null,
      openFilePaths: currentSession.openFilePaths,
      sidebarWidth: null,
      focusMode: null,
      lastEditMode: null,
      lastSessionAt: Date.now(),
    };
    await saveSessionState(projectRoot, state);
  }, [projectRoot, currentSession]);

  return { save };
}
