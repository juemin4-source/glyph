# Craft Review Fix Report — 织梦机 v1.2

**Date:** 2026-07-08  
**Location:** G:/AI/Chancellor-OS-Lab/projects/zhimengji

## Summary

Resolved the craft-review BLOCKER: SyncManager + Changelog had zero tests. All items from the task have been completed.

## Changes Made

### 1. Changelog Tests (src/lib/Changelog.test.ts)
17 tests covering:
- Push and undo (LIFO order, returns entry, removes from stack)
- Empty stack behavior (undo returns null, canUndo false, count 0, peek null)
- Redo after undo (returns entry, cyclically moves between stacks, null on empty)
- Push clears redo stack
- Max stack size (drops oldest, custom size 1, default 100)
- Clear (empties both stacks)

### 2. SyncManager Tests (src/lib/SyncManager.test.ts)
21 tests covering:
- Queue persistence (enqueue, multiple enqueues, clearAll)
- Retry behavior (failed item stays, successful item removed, sequential retry via retryFailed)
- Online/offline detection (default online, ping failure detection, offline accumulation)
- Reconnect (queue drain via retryFailed after offline)
- Failed items persist (retry exhaustion, error state, queue retention)
- getFailedCount (after failures, initially zero, after success)
- Save status (initial, enqueue changes, offline status, listeners)
- Online status callbacks (listener notification)
- Queue inspection (empty length, empty failed ops, initial count)

### 3. Source Code Fixes

**SyncManager.getFailedCount()** (src/lib/SyncManager.ts)
- Added private _failedCount field
- getFailedCount() now returns real counter instead of hardcoded 0
- Counter increments when items are permanently marked as failed
- Counter resets in clearAll()
- Added retryTimers tracking with cleanup in clearAll() to prevent dangling timeouts

**Empty catch blocks** (src/App.tsx)
- Added console.warn to gradient parse catch
- Added console.warn to preset creation catch
- Added console.warn to localStorage catch

**Unused dependency** (package.json)
- Removed turndown from dependencies (custom htmlToMarkdown is self-contained)
- Removed @types/turndown from devDependencies
- Added test script: vitest run

### 4. Test Infrastructure
- Installed fake-indexeddb as devDependency for IndexedDB mocking in jsdom
- Updated src/__tests__/setup.ts to provide fake IndexedDB globally

## Test Results

All 68 tests pass across 4 test files:
- src/lib/Changelog.test.ts -- 17 tests, all pass
- src/lib/SyncManager.test.ts -- 21 tests, all pass
- src/__tests__/api.test.ts -- 22 tests, all pass (pre-existing)
- src/__tests__/Bookshelf.test.tsx -- 8 tests, all pass (pre-existing)

Note: src/__tests__/App.test.tsx has pre-existing failures (React hooks conditional render violation) -- not caused by this fix round.
