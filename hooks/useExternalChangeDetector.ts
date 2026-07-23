import { useEffect, useCallback, useRef } from 'react';
import type { FileChangeEvent } from '../types/fs';

type ExternalChangeCallback = (event: FileChangeEvent) => void;

/**
 * Listens for `fs:file-changed` events from the Tauri backend
 * and notifies when external file changes are detected.
 */
export function useExternalChangeDetector(
  projectRoot: string | null,
  onFileChanged: ExternalChangeCallback,
) {
  const callbackRef = useRef<ExternalChangeCallback>(onFileChanged);
  callbackRef.current = onFileChanged;

  useEffect(() => {
    if (!projectRoot) return;

    let unlisten: (() => void) | undefined;

    const setup = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<FileChangeEvent>('fs:file-changed', (event) => {
          if (callbackRef.current) {
            callbackRef.current(event.payload);
          }
        });
      } catch (e) {
        console.warn('[fs-watcher] Failed to listen for file changes:', e);
      }
    };

    setup();

    return () => {
      if (unlisten) unlisten();
    };
  }, [projectRoot]);
}
