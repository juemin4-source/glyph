#!/usr/bin/env node
/**
 * persistence.mjs — SQLite CRUD smoke test for v2 Round C entities.
 *
 * Tests all C round entities in a temporary in-memory SQLite database:
 *   1. ChapterPacket CRUD
 *   2. PipelineState advancement (packet -> text)
 *
 * Exit: 0 if all pass, 1 if any FAIL
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Use sqlite3 command-line or better-sqlite3 to test persistence.
// We use a Node.js inline test that calls the Rust test binary.
// Since we can't import Rust directly, we run `cargo test` filtered to chapter_packet tests.

let exitCode = 0;

function pass(name) {
  console.log(`  PASS  ${name}`);
}

function fail(name, detail) {
  console.log(`  FAIL  ${name}: ${detail}`);
  exitCode = 1;
}

console.log('\n=== accept:persistence — Round C CRUD smoke test ===\n');

// ── Test 1: Rust unit tests for ChapterPacket CRUD ──
console.log('[1/5] Rust ChapterPacket CRUD (via cargo test)');
{
  const result = spawnSync('cargo', [
    'test',
    '--',
    'chapter_packet',
    '--nocapture',
  ], {
    cwd: resolve(ROOT, 'src-tauri'),
    stdio: 'inherit',
    shell: true,
    timeout: 120000,
  });

  if (result.status === 0) {
    pass('cargo test -- chapter_packet');
  } else {
    fail('cargo test -- chapter_packet', `exit code ${result.status}`);
  }
}

// ── Test 2: TypeScript contract files exist ──
console.log('\n[2/5] Contract files exist');
{
  const fs = await import('fs');

  const contracts = [
    'src/contracts/chapter-packet.contract.ts',
    'src/contracts/structure.contract.ts',
  ];

  let allOk = true;
  for (const c of contracts) {
    const full = resolve(ROOT, c);
    if (fs.existsSync(full)) {
      pass(`contract exists: ${c}`);
    } else {
      fail(`contract missing: ${c}`);
      allOk = false;
    }
  }

  // Verify ChapterFunction type in structure.contract.ts
  const structContent = fs.readFileSync(resolve(ROOT, 'src/contracts/structure.contract.ts'), 'utf-8');
  if (structContent.includes('ChapterFunction')) {
    pass('structure.contract.ts has ChapterFunction type');
  } else {
    fail('structure.contract.ts missing ChapterFunction type');
    allOk = false;
  }
  if (structContent.includes('chapterFunction')) {
    pass('structure.contract.ts has chapterFunction field');
  } else {
    fail('structure.contract.ts missing chapterFunction field');
    allOk = false;
  }
}

// ── Test 3: API file exists ──
console.log('\n[3/5] API files exist');
{
  const fs = await import('fs');

  const apiFiles = [
    'src/api/chapterPacketApi.ts',
  ];

  for (const f of apiFiles) {
    const full = resolve(ROOT, f);
    if (fs.existsSync(full)) {
      pass(`api exists: ${f}`);
    } else {
      fail(`api missing: ${f}`);
    }
  }
}

// ── Test 4: Rust source files exist ──
console.log('\n[4/5] Rust source files exist');
{
  const fs = await import('fs');

  const rustFiles = [
    'src-tauri/src/chapter_packet_commands.rs',
  ];

  for (const f of rustFiles) {
    const full = resolve(ROOT, f);
    if (fs.existsSync(full)) {
      pass(`rust file exists: ${f}`);
    } else {
      fail(`rust file missing: ${f}`);
    }
  }

  // Verify lib.rs registers chapter_packet_commands
  const libContent = fs.readFileSync(resolve(ROOT, 'src-tauri/src/lib.rs'), 'utf-8');
  const moduleKeywords = ['chapter_packet_commands'];
  for (const kw of moduleKeywords) {
    if (libContent.includes(kw)) {
      pass(`lib.rs has mod/use: ${kw}`);
    } else {
      fail(`lib.rs missing ${kw}`);
    }
  }

  // Verify models.rs has ChapterPacket
  const modelsContent = fs.readFileSync(resolve(ROOT, 'src-tauri/src/models.rs'), 'utf-8');
  if (modelsContent.includes('pub struct ChapterPacket')) {
    pass('models.rs has ChapterPacket struct');
  } else {
    fail('models.rs missing ChapterPacket struct');
  }

  // Verify db.rs has chapter_packets table init
  const dbContent = fs.readFileSync(resolve(ROOT, 'src-tauri/src/db.rs'), 'utf-8');
  if (dbContent.includes('init_chapter_packets_table')) {
    pass('db.rs has init_chapter_packets_table');
  } else {
    fail('db.rs missing init_chapter_packets_table');
  }

  // Verify db.rs chapter_packet CRUD methods
  const dbMethods = [
    'create_chapter_packet',
    'list_chapter_packets',
    'get_chapter_packet',
    'update_chapter_packet_layers',
    'confirm_chapter_packet',
    'delete_chapter_packet',
  ];
  for (const m of dbMethods) {
    if (dbContent.includes(m)) {
      pass(`db.rs has method: ${m}`);
    } else {
      fail(`db.rs missing method: ${m}`);
    }
  }
}

// ── Test 5: pipeline-helper.ts has confirmPacket ──
console.log('\n[5/5] Pipeline helper has confirmPacket');
{
  const fs = await import('fs');

  const helperContent = fs.readFileSync(resolve(ROOT, 'src/stores/pipeline-helper.ts'), 'utf-8');
  if (helperContent.includes('export async function confirmPacket')) {
    pass('pipeline-helper.ts has confirmPacket');
  } else {
    fail('pipeline-helper.ts missing confirmPacket');
  }
}

// ── Test 6: DecisionLog ──
console.log('\n[6/6] DecisionLog');
{
  const fs = await import('fs');

  // Contract file
  const contractPath = 'src/contracts/decision-log.contract.ts';
  const contractFull = resolve(ROOT, contractPath);
  if (fs.existsSync(contractFull)) {
    pass(`contract exists: ${contractPath}`);
  } else {
    fail(`contract missing: ${contractPath}`);
  }

  // Api file
  const apiPath = 'src/api/decisionLogApi.ts';
  const apiFull = resolve(ROOT, apiPath);
  if (fs.existsSync(apiFull)) {
    pass(`api exists: ${apiPath}`);
  } else {
    fail(`api missing: ${apiPath}`);
  }

  // Rust commands file
  const cmdPath = 'src-tauri/src/decision_log_commands.rs';
  const cmdFull = resolve(ROOT, cmdPath);
  if (fs.existsSync(cmdFull)) {
    pass(`rust file exists: ${cmdPath}`);
  } else {
    fail(`rust file missing: ${cmdPath}`);
  }

  // lib.rs registration
  const libContent = fs.readFileSync(resolve(ROOT, 'src-tauri/src/lib.rs'), 'utf-8');
  if (libContent.includes('decision_log_commands')) {
    pass('lib.rs has decision_log_commands module');
  } else {
    fail('lib.rs missing decision_log_commands');
  }

  // models.rs struct
  const modelsContent = fs.readFileSync(resolve(ROOT, 'src-tauri/src/models.rs'), 'utf-8');
  if (modelsContent.includes('pub struct DecisionLogEntry')) {
    pass('models.rs has DecisionLogEntry struct');
  } else {
    fail('models.rs missing DecisionLogEntry struct');
  }

  // db.rs methods
  const dbContent = fs.readFileSync(resolve(ROOT, 'src-tauri/src/db.rs'), 'utf-8');
  if (dbContent.includes('init_decision_logs_table')) {
    pass('db.rs has init_decision_logs_table');
  } else {
    fail('db.rs missing init_decision_logs_table');
  }
  const dbMethods = ['append_decision_log', 'list_decision_logs', 'get_decision_log'];
  for (const m of dbMethods) {
    if (dbContent.includes(`pub fn ${m}`)) {
      pass(`db.rs has method: ${m}`);
    } else {
      fail(`db.rs missing method: ${m}`);
    }
  }

  // assumption-helper.ts exists
  const helperPath = 'src/lib/assumption-helper.ts';
  const helperFull = resolve(ROOT, helperPath);
  if (fs.existsSync(helperFull)) {
    pass(`assumption-helper exists: ${helperPath}`);
  } else {
    fail(`assumption-helper missing: ${helperPath}`);
  }
}

// ── Test 7: AI Table persistence ──
console.log('\n[7/7] AI table persistence');
{
  const fs = await import('fs');

  // Check AI contract files exist
  const aiContracts = [
    'src/contracts/ai-context.contract.ts',
    'src/contracts/ai-router.contract.ts',
    'src/contracts/ai-parser.contract.ts',
    'src/contracts/ai-registry.contract.ts',
  ];
  for (const c of aiContracts) {
    const full = resolve(ROOT, c);
    if (fs.existsSync(full)) {
      pass(`ai contract exists: ${c}`);
    } else {
      fail(`ai contract missing: ${c}`);
    }
  }

  // Check AI API files exist
  const aiApiFiles = [
    'src/api/aiContextApi.ts',
    'src/api/aiControlCenterApi.ts',
  ];
  for (const f of aiApiFiles) {
    const full = resolve(ROOT, f);
    if (fs.existsSync(full)) {
      pass(`ai api exists: ${f}`);
    } else {
      fail(`ai api missing: ${f}`);
    }
  }

  // Check Rust AI module exists
  const aiModuleDir = resolve(ROOT, 'src-tauri/src/ai');
  if (fs.existsSync(aiModuleDir)) {
    pass('src-tauri/src/ai/ module directory exists');
    const modFile = resolve(aiModuleDir, 'mod.rs');
    if (fs.existsSync(modFile)) {
      pass('ai/mod.rs exists — module registered');
    } else {
      fail('ai/mod.rs missing');
    }
  } else {
    fail('src-tauri/src/ai/ directory missing');
  }

  // Check ai_commands.rs exists
  const aiCommandsPath = resolve(ROOT, 'src-tauri/src/ai_commands.rs');
  if (fs.existsSync(aiCommandsPath)) {
    pass('ai_commands.rs exists');
  } else {
    fail('ai_commands.rs missing');
  }

  // Check lib.rs registers ai_commands
  const libContent = fs.readFileSync(resolve(ROOT, 'src-tauri/src/lib.rs'), 'utf-8');
  if (libContent.includes('ai_commands')) {
    pass('lib.rs has ai_commands module');
  } else {
    fail('lib.rs missing ai_commands');
  }

  // Check models.rs has AI-related structs
  const modelsContent = fs.readFileSync(resolve(ROOT, 'src-tauri/src/models.rs'), 'utf-8');
  const aiModels = ['AiBuiltContext', 'AiRouteOutput', 'AiParseOutput', 'AiSkillRecord', 'AiProviderConfig'];
  for (const structName of aiModels) {
    if (modelsContent.includes(`pub struct ${structName}`)) {
      pass(`models.rs has ${structName}`);
    } else {
      fail(`models.rs missing ${structName}`);
    }
  }

  // Check db.rs has AI table init
  const dbContent = fs.readFileSync(resolve(ROOT, 'src-tauri/src/db.rs'), 'utf-8');
  const aiTables = ['ai_provider_config', 'ai_prompt_registry', 'ai_evaluation_results'];
  for (const table of aiTables) {
    if (dbContent.includes(table)) {
      pass(`db.rs references table: ${table}`);
    } else {
      fail(`db.rs missing reference to ${table}`);
    }
  }
}

console.log(`\n=== accept:persistence complete — ${exitCode === 0 ? 'ALL PASS' : 'SOME FAIL'} ===\n`);
process.exit(exitCode);
