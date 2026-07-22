/**
 * Changelog — In-memory undo/redo stack for 织梦机 v1.2 (P0-03).
 * Records operations for object create/delete, canvas position changes,
 * connection create/delete. Not persisted across restarts.
 */

import type { ChangelogEntry } from '../types/world';

export class Changelog {
  private undoStack: ChangelogEntry[] = [];
  private redoStack: ChangelogEntry[] = [];
  private maxSize: number = 100;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  push(entry: ChangelogEntry): void {
    this.undoStack.push(entry);
    this.redoStack = [];
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }

  undo(): ChangelogEntry | null {
    const entry = this.undoStack.pop();
    if (entry) {
      this.redoStack.push(entry);
    }
    return entry || null;
  }

  redo(): ChangelogEntry | null {
    const entry = this.redoStack.pop();
    if (entry) {
      this.undoStack.push(entry);
    }
    return entry || null;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  getUndoCount(): number {
    return this.undoStack.length;
  }

  getRedoCount(): number {
    return this.redoStack.length;
  }

  peekUndo(): ChangelogEntry | null {
    return this.undoStack[this.undoStack.length - 1] || null;
  }

  getAllEntries(): ChangelogEntry[] {
    return [...this.undoStack];
  }
}
