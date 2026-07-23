#!/usr/bin/env node
/**
 * accept-feedback.mjs — Feedback submission acceptance test.
 *
 * Tests:
 *   1. Feedback command module exists
 *   2. Rust compilation is clean
 *   3. Feedback model exists in models.rs
 *   4. API client exists
 *
 * The feedback command writes to decision_logs with operation='feedback'.
 * Full E2E test requires a Tauri app instance.
 *
 * Exit: 0 if all pass, 1 if any FAIL
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let exitCode = 0;

function pass(name) {
  console.log(`  PASS  ${name}`);
}

function fail(name, detail) {
  console.log(`  FAIL  ${name}: ${detail}`);
  exitCode = 1;
}

console.log('\n=== accept:feedback — Feedback submission smoke test ===\n');

// Test 1: feedback_commands.rs exists
console.log('[1/5] Feedback command module exists');
{
  const path = resolve(ROOT, 'src-tauri/src/feedback_commands.rs');
  if (existsSync(path)) {
    pass('feedback_commands.rs exists');
  } else {
    fail('feedback_commands.rs', 'file not found');
  }
}

// Test 2: Rust compilation
console.log('[2/5] Rust compilation check');
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

// Test 3: FeedbackInput model exists
console.log('[3/5] FeedbackInput model exists');
{
  const modelPath = resolve(ROOT, 'src-tauri/src/models.rs');
  const content = readFileSync(modelPath, 'utf-8');
  if (content.includes('pub struct FeedbackInput')) {
    pass('FeedbackInput struct in models.rs');
  } else {
    fail('FeedbackInput', 'missing from models.rs');
  }
}

// Test 4: submit_feedback DB method exists
console.log('[4/5] submit_feedback DB method');
{
  const dbPath = resolve(ROOT, 'src-tauri/src/db.rs');
  const content = readFileSync(dbPath, 'utf-8');
  if (content.includes('pub fn submit_feedback')) {
    pass('submit_feedback in db.rs');
  } else {
    fail('submit_feedback', 'missing from db.rs');
  }
}

// Test 5: API client exists
console.log('[5/5] Feedback API client exists');
{
  const path = resolve(ROOT, 'src/api/feedbackApi.ts');
  if (existsSync(path)) {
    pass('feedbackApi.ts exists');
  } else {
    fail('feedbackApi.ts', 'file not found');
  }
}

console.log(exitCode === 0 ? '\nAll Feedback acceptance tests PASSED.\n' : '\nSome Feedback acceptance tests FAILED.\n');
process.exit(exitCode);
