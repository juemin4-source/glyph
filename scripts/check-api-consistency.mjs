/**
 * API Consistency Check — Glyph v0.1
 *
 * Compares frontend invoke() calls against backend #[tauri::command] definitions.
 * Reports: commands found only on frontend, only on backend, and both.
 *
 * Usage: node scripts/check-api-consistency.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

// ── Patterns ──
const INVOKE_RE = /invoke\s*\(\s*['"]([a-z_]+)['"]/g;
const TAURI_COMMAND_RE = /#\[tauri::command\]\s*\n\s*(?:pub\s+)?(?:async\s+)?fn\s+([a-z_]+)/g;

// ── Collect frontend invoke calls ──
const frontendCalls = new Map(); // name -> locations[]
const EXTENSIONS = new Set(['.ts', '.tsx', '.mjs']);

function walkDir(dir, baseDir = dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'target' || entry.name === 'dist' || entry.name === '.git') continue;
      walkDir(fullPath, baseDir);
    } else if (EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
      scanFile(fullPath, baseDir);
    }
  }
}

function scanFile(filePath, baseDir) {
  const content = readFileSync(filePath, 'utf-8');
  let match;
  while ((match = INVOKE_RE.exec(content)) !== null) {
    const cmd = match[1];
    if (!frontendCalls.has(cmd)) frontendCalls.set(cmd, []);
    frontendCalls.get(cmd).push(relative(baseDir, filePath));
  }
}

// Scan frontend source
walkDir(join(ROOT, 'api'), ROOT);
walkDir(join(ROOT, 'components'), ROOT);
walkDir(join(ROOT, 'features'), ROOT);
walkDir(join(ROOT, 'lib'), ROOT);
walkDir(ROOT, ROOT); // App.tsx, tauri-api.ts

// ── Collect backend command definitions ──
const backendCommands = new Map(); // name -> file

function scanRustFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const multiLineTAURI_RE = /#\[tauri::command\](?:[\s\S]*?)fn\s+([a-z_]+)\s*\(/g;
  let match;

  // Reset lastIndex
  TAURI_COMMAND_RE.lastIndex = 0;

  while ((match = TAURI_COMMAND_RE.exec(content)) !== null) {
    const cmd = match[1];
    backendCommands.set(cmd, relative(ROOT, filePath));
  }

  // Also try multi-line pattern (fn on next line)
  while ((match = multiLineTAURI_RE.exec(content)) !== null) {
    const cmd = match[1];
    if (!backendCommands.has(cmd)) {
      backendCommands.set(cmd, relative(ROOT, filePath));
    }
  }
}

// Scan Rust files
function walkRust(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'target' || entry.name === '.git') continue;
      walkRust(fullPath);
    } else if (entry.name.endsWith('.rs')) {
      scanRustFile(fullPath);
    }
  }
}
walkRust(ROOT); // Rust files at root (lib.rs, commands.rs, etc.)

// ── Compare ──
const frontendOnly = [];
const backendOnly = [];
const matched = [];

const allCmds = new Set([...frontendCalls.keys(), ...backendCommands.keys()]);

for (const cmd of [...allCmds].sort()) {
  const fe = frontendCalls.has(cmd);
  const be = backendCommands.has(cmd);

  if (fe && !be) frontendOnly.push(cmd);
  else if (!fe && be) backendOnly.push(cmd);
  else matched.push(cmd);
}

// ── Report ──
console.log('═══════════════════════════════════════════');
console.log('  API Consistency Check — Glyph v0.1');
console.log('═══════════════════════════════════════════\n');

console.log(`Frontend calls:    ${frontendCalls.size}`);
console.log(`Backend commands:  ${backendCommands.size}`);
console.log(`Matched:           ${matched.length}`);
console.log(`Frontend-only:     ${frontendOnly.length}`);
console.log(`Backend-only:      ${backendOnly.length}\n`);

if (frontendOnly.length > 0) {
  console.log('❌ FRONTEND ONLY (invoke() calls without backend):');
  for (const cmd of frontendOnly) {
    const locs = frontendCalls.get(cmd).join(', ');
    console.log(`   ${cmd}`);
    console.log(`       → ${locs}`);
  }
  console.log();
}

if (backendOnly.length > 0) {
  console.log('⚠️  BACKEND ONLY (commands not called by frontend):');
  for (const cmd of backendOnly) {
    const file = backendCommands.get(cmd);
    console.log(`   ${cmd}`);
    console.log(`       → ${file}`);
  }
  console.log();
}

// ── Summary ──
const issues = [];
if (frontendOnly.length > 0) issues.push(`${frontendOnly.length} frontend-only calls (will crash at runtime!)`);
if (backendOnly.length > 0) issues.push(`${backendOnly.length} unused backend commands (dead code)`);

if (issues.length > 0) {
  console.log('⚠️  ISSUES:');
  issues.forEach(i => console.log(`   - ${i}`));
} else {
  console.log('✅ All API calls match between frontend and backend.');
}

console.log();
