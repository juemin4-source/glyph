/// <reference types="vitest/globals" />
import { describe, it, expect } from 'vitest';
import { Changelog } from './Changelog';
import type { ChangelogEntry } from '../types/world';

function makeEntry(overrides: Partial<ChangelogEntry> = {}): ChangelogEntry {
  return {
    timestamp: Date.now(),
    action: 'create_object',
    objectId: 'obj-1',
    snapshot: { name: 'Test Object' },
    ...overrides,
  };
}

describe('Changelog', () => {
  describe('push and undo', () => {
    it('undo returns the last pushed entry', () => {
      const cl = new Changelog();
      const entry = makeEntry();
      cl.push(entry);
      const result = cl.undo();
      expect(result).not.toBeNull();
      expect(result!.objectId).toBe('obj-1');
      expect(result!.action).toBe('create_object');
    });

    it('undo removes the entry from the undo stack', () => {
      const cl = new Changelog();
      cl.push(makeEntry({ objectId: 'first' }));
      cl.push(makeEntry({ objectId: 'second' }));
      cl.undo();
      expect(cl.getUndoCount()).toBe(1);
      expect(cl.peekUndo()!.objectId).toBe('first');
    });

    it('can undo multiple entries in LIFO order', () => {
      const cl = new Changelog();
      cl.push(makeEntry({ objectId: 'a' }));
      cl.push(makeEntry({ objectId: 'b' }));
      cl.push(makeEntry({ objectId: 'c' }));

      expect(cl.undo()!.objectId).toBe('c');
      expect(cl.undo()!.objectId).toBe('b');
      expect(cl.undo()!.objectId).toBe('a');
      expect(cl.undo()).toBeNull();
    });
  });

  describe('empty stack behavior', () => {
    it('undo on empty returns null', () => {
      const cl = new Changelog();
      expect(cl.undo()).toBeNull();
    });

    it('canUndo returns false on empty stack', () => {
      const cl = new Changelog();
      expect(cl.canUndo()).toBe(false);
    });

    it('getUndoCount returns 0 on empty stack', () => {
      const cl = new Changelog();
      expect(cl.getUndoCount()).toBe(0);
    });

    it('peekUndo returns null on empty stack', () => {
      const cl = new Changelog();
      expect(cl.peekUndo()).toBeNull();
    });
  });

  describe('redo after undo', () => {
    it('redo returns the last undone entry', () => {
      const cl = new Changelog();
      const entry = makeEntry();
      cl.push(entry);
      cl.undo();
      const result = cl.redo();
      expect(result).not.toBeNull();
      expect(result!.objectId).toBe('obj-1');
    });

    it('redo after undo moves entry back to undo stack', () => {
      const cl = new Changelog();
      cl.push(makeEntry());
      cl.undo();
      cl.redo();
      expect(cl.getUndoCount()).toBe(1);
      expect(cl.getRedoCount()).toBe(0);
    });

    it('undo after redo works cyclically', () => {
      const cl = new Changelog();
      cl.push(makeEntry());
      cl.undo();
      expect(cl.getRedoCount()).toBe(1);
      cl.redo();
      expect(cl.getRedoCount()).toBe(0);
      expect(cl.getUndoCount()).toBe(1);
    });

    it('redo on empty returns null', () => {
      const cl = new Changelog();
      expect(cl.redo()).toBeNull();
    });

    it('canRedo returns false on empty redo stack', () => {
      const cl = new Changelog();
      expect(cl.canRedo()).toBe(false);
    });
  });

  describe('push clears redo stack', () => {
    it('new push after undo clears redo stack', () => {
      const cl = new Changelog();
      cl.push(makeEntry({ objectId: 'a' }));
      cl.undo();
      expect(cl.canRedo()).toBe(true);
      cl.push(makeEntry({ objectId: 'b' }));
      expect(cl.canRedo()).toBe(false);
      expect(cl.getRedoCount()).toBe(0);
    });
  });

  describe('max stack size', () => {
    it('drops oldest entry when pushing beyond max size', () => {
      const cl = new Changelog(3);
      cl.push(makeEntry({ objectId: 'a' }));
      cl.push(makeEntry({ objectId: 'b' }));
      cl.push(makeEntry({ objectId: 'c' }));
      cl.push(makeEntry({ objectId: 'd' }));

      expect(cl.getUndoCount()).toBe(3);
      const firstUndone = cl.undo()!;
      expect(firstUndone.objectId).toBe('d');
      expect(cl.undo()!.objectId).toBe('c');
      expect(cl.undo()!.objectId).toBe('b');
      expect(cl.undo()).toBeNull();
    });

    it('max size 1 keeps only the latest entry', () => {
      const cl = new Changelog(1);
      cl.push(makeEntry({ objectId: 'a' }));
      cl.push(makeEntry({ objectId: 'b' }));
      expect(cl.getUndoCount()).toBe(1);
      expect(cl.undo()!.objectId).toBe('b');
    });

    it('default max size is 100', () => {
      const cl = new Changelog();
      for (let i = 0; i < 101; i++) {
        cl.push(makeEntry({ objectId: `obj-${i}` }));
      }
      expect(cl.getUndoCount()).toBe(100);
      expect(cl.undo()!.objectId).toBe('obj-100');
    });
  });

  describe('clear', () => {
    it('clears both undo and redo stacks', () => {
      const cl = new Changelog();
      cl.push(makeEntry());
      cl.push(makeEntry());
      cl.undo();
      cl.clear();
      expect(cl.getUndoCount()).toBe(0);
      expect(cl.getRedoCount()).toBe(0);
      expect(cl.canUndo()).toBe(false);
      expect(cl.canRedo()).toBe(false);
    });
  });
});
