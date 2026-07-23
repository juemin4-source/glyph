#!/usr/bin/env node
/**
 * accept-quickdraft.ts — QuickDraft persistence acceptance test.
 *
 * Tests:
 *   1. Contracts file exists
 *   2. Rust unit tests for QuickDraft CRUD (via cargo test)
 *   3. API client file exists
 *
 * Exit: 0 if all pass, 1 if any FAIL
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let exitCode = 0;

function pass(name: string) {
  console.log(`  PASS  ${name}`);
}

function fail(name: string, detail: string) {
  console.log(`  FAIL  ${name}: ${detail}`);
  exitCode = 1;
}

console.log('\n=== accept:quickdraft — QuickDraft CRUD smoke test ===\n');

// ── Test 1: Contract file exists ──
console.log('[1/4] Contract file exists');
{
  const path = resolve(ROOT, 'src/contracts/quick-draft.contract.ts');
  if (existsSync(path)) {
    pass('quick-draft.contract.ts exists');
  } else {
    fail('quick-draft.contract.ts', 'file not found');
  }
}

// ── Test 2: API client file exists ──
console.log('[2/4] API client file exists');
{
  const path = resolve(ROOT, 'src/api/quickDraftApi.ts');
  if (existsSync(path)) {
    pass('quickDraftApi.ts exists');
  } else {
    fail('quickDraftApi.ts', 'file not found');
  }
}

// ── Test 3: Rust unit tests pass ──
console.log('[3/4] Rust QuickDraft CRUD (via cargo test)');
{
  const result = spawnSync('cargo', [
    'test', '--', 'quick_draft', '--nocapture',
  ], {
    cwd: resolve(ROOT, 'src-tauri'),
    stdio: 'inherit',
    shell: true,
    timeout: 120000,
  });

  if (result.status === 0) {
    pass('cargo test -- quick_draft');
  } else {
    fail('cargo test -- quick_draft', `exit code ${result.status}`);
  }
}

// ── Test 4: Rust compilation ──
console.log('[4/4] Rust compilation check');
{
  const result = spawnSync('cargo', ['check'], {
    cwd: resolve(ROOT, 'src-tauri'),
    stdio: 'inherit',
    shell: true,
    timeout: 120000,
  });

  if (result.status === 0) {
    pass('cargo check');
  } else {
    fail('cargo check', `exit code ${result.status}`);
  }
}

console.log(exitCode === 0 ? '\nAll QuickDraft acceptance tests PASSED.\n' : '\nSome QuickDraft acceptance tests FAILED.\n');
process.exit(exitCode);
