#!/usr/bin/env node
/**
 * scan-css-compliance.mjs
 *
 * Scans v2 component CSS files for compliance:
 *  - className uses kebab-case
 *  - Uses CSS variables rather than excessive hardcoded colors
 *  - References var(-- CSS variables
 *
 * The project uses a dark theme design system. Hardcoded colors are
 * expected in small amounts but should be replaced by CSS variables
 * where possible. A file is rejected if:
 *   1. It has no CSS variable references at all but uses hardcoded colors
 *   2. It has more than HARDCODED_LIMIT hardcoded color values
 *   3. Class names are not kebab-case
 *
 * Usage: node scripts/acceptance/scan-css-compliance.mjs
 * Exit:  0 if all pass, 1 if any FAIL
 */

import { readFileSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');

// Maximum allowed hardcoded color values per file (dark theme needs some)
const HARDCODED_LIMIT = 40;

// CSS files to check: all v2 feature CSS + canvas-ai-bar
const CSS_FILES = [
  'src/features/canvas-01-premise/premise-entry.css',
  'src/features/canvas-02-structure/structure-flow.css',
  'src/features/canvas-03-setting/character-panel.css',
  'src/features/canvas-03-setting/faction-panel.css',
  'src/features/canvas-03-setting/setting-canvas.css',
  'src/features/canvas-03-setting/world-rule-panel.css',
  'src/features/pipeline-canvas/canvas-shell.css',
  'src/features/pipeline-nav/pipeline-nav.css',
  'src/components/ai/canvas-ai-bar.css',
];

// ---- Helpers ----

let violations = 0;

function fail(check, file, line, msg) {
  console.log(`[FAIL] ${check} — ${file}:${line}  ${msg}`);
  violations++;
}

function warn(check, file, line, msg) {
  console.log(`[WARN] ${check} — ${file}:${line}  ${msg}`);
}

function readFile(path) {
  try { return readFileSync(path, 'utf8'); }
  catch { return null; }
}

// ---- Checks ----

// 1. className uses kebab-case
function checkClassNameKebab(files) {
  for (const [rel, content] of files) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const classMatch = line.match(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g);
      if (!classMatch) continue;

      for (const cls of classMatch) {
        const name = cls.slice(1);
        if (name.startsWith('-') || name.startsWith('_')) continue;
        if (!/^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$/.test(name)) {
          fail('classname-kebab', rel, i + 1, `"${cls}" is not kebab-case`);
        }
      }
    }
  }
}

// 2. Check hardcoded colors — warn each but FAIL only if excessive or missing CSS vars
function checkHardcodedColors(files) {
  const colorRe = /#[0-9a-fA-F]{3,8}\b/g;
  const allowlist = [
    '#ffffff', '#fff', '#ffff',
    '#000000', '#000', '#0000',
    '#ff0000', '#f00',
  ];

  for (const [rel, content] of files) {
    const hasCssVars = /var\(--/.test(content);
    const lines = content.split('\n');
    let fileColorCount = 0;
    const details = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matches = line.matchAll(colorRe);
      for (const m of matches) {
        const color = m[0].toLowerCase();
        if (allowlist.includes(color)) continue;
        const before = line.slice(0, m.index);
        if (before.includes('/*') && !before.includes('*/')) continue;
        fileColorCount++;
        details.push({ line: i + 1, color });
      }
    }

    // Check 1: no CSS vars but has hardcoded colors
    if (!hasCssVars && fileColorCount > 0) {
      fail('hardcoded-color-no-vars', rel, 1,
        `No CSS variables used but ${fileColorCount} hardcoded colors found — use design tokens`);
      continue;
    }

    // Check 2: excessive hardcoded colors
    if (fileColorCount > HARDCODED_LIMIT) {
      fail('hardcoded-color-excessive', rel, 1,
        `${fileColorCount} hardcoded colors found (limit ${HARDCODED_LIMIT}) — replace with CSS variables`);
    }

    // Warn individually for visibility
    for (const d of details) {
      warn('hardcoded-color', rel, d.line, `"${d.color}" — prefer var(--xxx)`);
    }
  }
}

// 3. Check CSS variable references exist
function checkCssVarUsage(files) {
  for (const [rel, content] of files) {
    if (!/var\(--/.test(content)) {
      fail('css-vars-missing', rel, 1, 'No CSS variable (var(--)) references found; use design tokens');
    }
  }
}

// ---- Main ----

console.log('=== scan-css-compliance ===\n');

const files = [];
for (const cssPath of CSS_FILES) {
  const fullPath = join(ROOT, cssPath);
  const content = readFile(fullPath);
  if (content === null) {
    console.log(`[SKIP] ${cssPath} — file not found`);
    continue;
  }
  files.push([cssPath, content]);
}

console.log(`Checking ${files.length} CSS files...\n`);

checkClassNameKebab(files);
checkHardcodedColors(files);
checkCssVarUsage(files);

console.log('');
if (violations > 0) {
  console.log(`[FAIL] ${violations} violation(s) found.`);
  process.exit(1);
} else {
  console.log('[PASS] All CSS compliance checks passed.');
  process.exit(0);
}
