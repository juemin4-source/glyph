#!/usr/bin/env node
/**
 * accept-export.mjs — Export command acceptance test.
 *
 * Tests:
 *   1. Export command module exists (via cargo check)
 *   2. Rust compilation is clean
 *   3. tauri_plugin_dialog is configured
 *
 * The export command opens a native file dialog then writes content.
 * Full E2E test requires a Tauri app instance with a GUI environment.
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

console.log('\n=== accept:export — Export command smoke test ===\n');

// Test 1: export_commands.rs exists
console.log('[1/4] Export command module exists');
{
  const path = resolve(ROOT, 'src-tauri/src/export_commands.rs');
  if (existsSync(path)) {
    pass('export_commands.rs exists');
  } else {
    fail('export_commands.rs', 'file not found');
  }
}

// Test 2: tauri_plugin_dialog in Cargo.toml
console.log('[2/4] tauri_plugin_dialog dependency');
{
  const cargoPath = resolve(ROOT, 'src-tauri/Cargo.toml');
  const content = readFileSync(cargoPath, 'utf-8');
  if (content.includes('tauri-plugin-dialog')) {
    pass('tauri-plugin-dialog in Cargo.toml');
  } else {
    fail('tauri-plugin-dialog', 'missing from Cargo.toml');
  }
}

// Test 3: Rust compilation
console.log('[3/4] Rust compilation check');
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

// Test 4: ExportInput model exists in Rust
console.log('[4/4] ExportInput model exists');
{
  const modelPath = resolve(ROOT, 'src-tauri/src/models.rs');
  const content = readFileSync(modelPath, 'utf-8');
  if (content.includes('pub struct ExportInput')) {
    pass('ExportInput struct in models.rs');
  } else {
    fail('ExportInput', 'missing from models.rs');
  }
}

console.log(exitCode === 0 ? '\nAll Export acceptance tests PASSED.\n' : '\nSome Export acceptance tests FAILED.\n');
process.exit(exitCode);
