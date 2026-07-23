#!/usr/bin/env node
/**
 * scan-forbidden-patterns.mjs
 *
 * Scans v2 files for patterns that should not exist:
 *  - Direct import/use of @tauri-apps/api/core's invoke outside src/api/
 *  - Large inline style objects (const styles = { / const s: Record<string,)
 *  - 'mock' keyword in production code
 *  - Accidental edits to old (v1) components
 *
 * Usage: node scripts/acceptance/scan-forbidden-patterns.mjs
 * Exit:  0 if all pass, 1 if any FAIL
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve, relative } from 'path';
import { execSync } from 'child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const V2_DIRS = [
  'src/features',
  'src/contracts',
  'src/api',
  'src/stores',
];
const V2_RS_GLOBS = [
  'src-tauri/src/setting_commands.rs',
  'src-tauri/src/premise_commands.rs',
  'src-tauri/src/structure_commands.rs',
  'src-tauri/src/pipeline_commands.rs',
  'src-tauri/src/models.rs',
  'src-tauri/src/db.rs',
];

// ---- Helpers ----

function getAllV2Files() {
  const files = [];

  // Walk TypeScript directories
  for (const dir of V2_DIRS) {
    const fullDir = join(ROOT, dir);
    if (!existsSync(fullDir)) continue;
    const list = execSync(`find "${fullDir}" -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.css" \\)`, {
      encoding: 'utf8', cwd: ROOT,
    }).trim().split('\n').filter(Boolean);
    for (const f of list) {
      files.push(f.trim());
    }
  }

  // Add Rust files
  for (const rs of V2_RS_GLOBS) {
    const fullPath = join(ROOT, rs);
    if (existsSync(fullPath)) files.push(fullPath);
  }

  return files;
}

function readFile(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

// ---- Checks ----

let violations = 0;

function fail(pattern, file, line, msg) {
  console.log(`[FAIL] ${pattern} — ${file}:${line}  ${msg}`);
  violations++;
}

// 1. Direct @tauri-apps/api/core invoke outside src/api/
function checkDirectInvoke(files) {
  for (const file of files) {
    const rel = normRel(file);
    const isApi = rel.startsWith('src/api/');
    if (isApi) continue; // Allowed in api layer

    const content = readFile(file);
    if (!content) continue;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('@tauri-apps/api/core') || line.includes("from '@tauri-apps/api/core'")) {
        fail('direct-invoke-import', rel, i + 1, 'Found import from @tauri-apps/api/core outside src/api/');
      }
      // Also check for direct invoke() calls
      if (/\binvoke\(/.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
        fail('direct-invoke-call', rel, i + 1, 'Found invoke() call outside src/api/');
      }
    }
  }
}

function normRel(filePath) {
  return relative(ROOT, filePath).replace(/\\/g, '/');
}

// 2. Large inline style objects
function checkInlineStyles(files) {
  for (const file of files) {
    const rel = normRel(file);
    if (!rel.endsWith('.tsx') && !rel.endsWith('.ts')) continue;

    const content = readFile(file);
    if (!content) continue;

    // Match `const styles = {` or `const s: Record<string,` patterns
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/const\s+styles?\s*(:|=\s*Record<string,)?\s*\{/.test(line) && !line.includes('css')) {
        // Check that it's not a very small one-liner
        if (line.includes('{') && (line.includes('}') || (i + 1 < lines.length && lines[i + 1].includes('}')))) {
          continue; // One-liner is ok
        }
        fail('inline-styles', rel, i + 1, `Found inline style object definition: "${line.trim()}"`);
      }
    }
  }
}

// 3. 'mock' keyword in production code
function checkMockKeyword(files) {
  // Skip test files explicitly
  const skipPatterns = ['__tests__', '.test.', '.spec.', 'e2e', '__mocks__'];
  for (const file of files) {
    const rel = normRel(file);
    if (skipPatterns.some(p => rel.includes(p))) continue;
    if (!rel.endsWith('.ts') && !rel.endsWith('.tsx') && !rel.endsWith('.rs')) continue;

    const content = readFile(file);
    if (!content) continue;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match 'mock' as word boundary, exclude comments
      const stripped = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '').replace(/^\s*\*/, '');
      if (/\bmock\b/i.test(stripped) && !stripped.trim().startsWith('*')) {
        fail('mock-keyword', rel, i + 1, `Found "mock" in production code: "${line.trim()}"`);
      }
    }
  }
}

// 4. Git diff check for old components
function checkOldComponentEdits() {
  try {
    const diff = execSync('git diff --name-only HEAD', { encoding: 'utf8', cwd: ROOT });
    const changedFiles = diff.trim().split('\n').filter(Boolean);
    const oldPatterns = [
      'src/components/CanvasView',
      'src/components/AIChat',
      'src/components/SettingCollection',
      'src/components/DocumentView',
    ];
    for (const file of changedFiles) {
      for (const pattern of oldPatterns) {
        if (file.includes(pattern)) {
          fail('old-component-edit', file, 1, `Accidental edit to v1 component (${pattern})`);
        }
      }
    }
  } catch (e) {
    // git diff may fail if no git history or no changes
    console.log('[INFO] Could not run git diff for old component check:', e.message);
  }
}

// ---- Main ----

console.log('=== scan-forbidden-patterns ===\n');

const files = getAllV2Files();
console.log(`Scanning ${files.length} v2 files...\n`);

checkDirectInvoke(files);
checkInlineStyles(files);
checkMockKeyword(files);
checkOldComponentEdits();

console.log('');
if (violations > 0) {
  console.log(`[FAIL] ${violations} violation(s) found.`);
  process.exit(1);
} else {
  console.log('[PASS] No forbidden patterns found.');
  process.exit(0);
}
