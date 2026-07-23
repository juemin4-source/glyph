#!/usr/bin/env node
/**
 * accept-demo.mjs — Demo project seed data acceptance test.
 *
 * Tests:
 *   1. Demo seed data constants exist in seed.ts
 *   2. Demo API client file exists
 *   3. QuickDraft feature components exist
 *   4. Bookshelf.tsx imports QuickDraft components
 *   5. Project type supports 'demo' status
 *   6. Demo-specific UI elements in Bookshelf
 *
 * Exit: 0 if all pass, 1 if any FAIL
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
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

console.log('\n=== accept:demo — Demo Project seed data verification ===\n');

// ── Test 1: Demo seed data exists in seed.ts ──
console.log('[1/7] Demo seed data in seed.ts');
{
  const path = resolve(ROOT, 'src/data/seed.ts');
  if (!existsSync(path)) {
    fail('seed.ts', 'file not found');
  } else {
    const content = readFileSync(path, 'utf-8');
    const checks = [
      { name: 'DEMO_PROJECT', found: content.includes('DEMO_PROJECT') },
      { name: 'DEMO_PREMISE', found: content.includes('DEMO_PREMISE') },
      { name: 'DEMO_STRUCTURE_NODES', found: content.includes('DEMO_STRUCTURE_NODES') },
      { name: 'DEMO_WORLD_RULE', found: content.includes('DEMO_WORLD_RULE') },
      { name: 'DEMO_CHARACTER_CARD', found: content.includes('DEMO_CHARACTER_CARD') },
      { name: 'DEMO_FACTION_CARD', found: content.includes('DEMO_FACTION_CARD') },
      { name: 'DEMO_CHAPTER_PACKETS', found: content.includes('DEMO_CHAPTER_PACKETS') },
      { name: 'demo-project-id', found: content.includes('demo-project-id') },
    ];
    let allFound = true;
    for (const c of checks) {
      if (c.found) {
        pass(`seed.ts contains ${c.name}`);
      } else {
        fail(`seed.ts`, `${c.name} not found`);
        allFound = false;
      }
    }
    if (allFound) pass('All Demo seed data constants present');
  }
}

// ── Test 2: Demo API client exists ──
console.log('[2/7] Demo API client');
{
  const path = resolve(ROOT, 'src/api/demoApi.ts');
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf-8');
    if (content.includes('seedDemoProject')) {
      pass('demoApi.ts with seedDemoProject()');
    } else {
      fail('demoApi.ts', 'seedDemoProject() function not found');
    }
  } else {
    fail('demoApi.ts', 'file not found');
  }
}

// ── Test 3: QuickDraft feature components exist ──
console.log('[3/7] QuickDraft feature components');
{
  const featureDir = resolve(ROOT, 'src/features/quick-draft');
  const files = [
    { name: 'QuickDraftButton.tsx', path: resolve(featureDir, 'QuickDraftButton.tsx') },
    { name: 'QuickDraftPanel.tsx', path: resolve(featureDir, 'QuickDraftPanel.tsx') },
    { name: 'DraftPreview.tsx', path: resolve(featureDir, 'DraftPreview.tsx') },
    { name: 'index.ts', path: resolve(featureDir, 'index.ts') },
  ];
  let allExist = true;
  for (const f of files) {
    if (existsSync(f.path)) {
      pass(`quick-draft/${f.name} exists`);
    } else {
      fail(`quick-draft/${f.name}`, 'file not found');
      allExist = false;
    }
  }
  if (allExist) pass('All QuickDraft feature components present');
}

// ── Test 4: Bookshelf.tsx imports QuickDraft components ──
console.log('[4/7] Bookshelf.tsx QuickDraft integration');
{
  const path = resolve(ROOT, 'src/components/Bookshelf.tsx');
  if (!existsSync(path)) {
    fail('Bookshelf.tsx', 'file not found');
  } else {
    const content = readFileSync(path, 'utf-8');
    const checks = [
      { name: 'imports QuickDraftButton', found: content.includes("from '../features/quick-draft/QuickDraftButton'") || content.includes('from \'../features/quick-draft/QuickDraftButton\'') },
      { name: 'imports QuickDraftPanel', found: content.includes('QuickDraftPanel') },
      { name: 'imports demoApi', found: content.includes('demoApi') },
      { name: 'showQuickDraft state', found: content.includes('showQuickDraft') },
      { name: 'demoSeeding state', found: content.includes('demoSeeding') },
    ];
    let allFound = true;
    for (const c of checks) {
      if (c.found) {
        pass(`Bookshelf.tsx ${c.name}`);
      } else {
        fail(`Bookshelf.tsx`, `${c.name} not found`);
        allFound = false;
      }
    }
    if (allFound) pass('Bookshelf.tsx properly integrates QuickDraft');
  }
}

// ── Test 5: Project type supports 'demo' status ──
console.log('[5/7] Project type supports demo status');
{
  const path = resolve(ROOT, 'src/types/world.ts');
  if (!existsSync(path)) {
    fail('types/world.ts', 'file not found');
  } else {
    const content = readFileSync(path, 'utf-8');
    if (content.includes("'demo'") && content.includes("Project")) {
      pass("Project type supports 'demo' status");
    } else {
      fail('types/world.ts', "'demo' status not found in Project type");
    }
  }
}

// ── Test 6: Demo UI elements in Bookshelf ──
console.log('[6/7] Demo UI elements in Bookshelf');
{
  const path = resolve(ROOT, 'src/components/Bookshelf.tsx');
  if (!existsSync(path)) {
    fail('Bookshelf.tsx', 'file not found');
  } else {
    const content = readFileSync(path, 'utf-8');
    const checks = [
      { name: 'STATUS_LABEL.demo', found: content.includes('demo:') && content.includes('STATUS_LABEL') },
      { name: 'STATUS_COLOR.demo', found: content.includes("demo: '#B7FF00'") },
      { name: 'Demo badge in BookCard', found: content.includes("project.status === 'demo'") && content.includes('示例') },
      { name: 'QuickDraftButton placement', found: content.includes('QuickDraftButton') },
      { name: 'QuickDraftPanel overlay', found: content.includes('<QuickDraftPanel') },
    ];
    let allFound = true;
    for (const c of checks) {
      if (c.found) {
        pass(`Bookshelf.tsx ${c.name}`);
      } else {
        fail(`Bookshelf.tsx`, `${c.name} not found`);
        allFound = false;
      }
    }
    if (allFound) pass('All Demo UI elements present in Bookshelf');
  }
}

// ── Test 7: QuickDraft contract types exist ──
console.log('[7/7] QuickDraft contract types');
{
  const path = resolve(ROOT, 'src/contracts/quick-draft.contract.ts');
  if (!existsSync(path)) {
    fail('quick-draft.contract.ts', 'file not found');
  } else {
    const content = readFileSync(path, 'utf-8');
    const checks = [
      { name: 'QuickDraftGenerateInput', found: content.includes('QuickDraftGenerateInput') },
      { name: 'QuickDraftGenerateResult', found: content.includes('QuickDraftGenerateResult') },
      { name: 'QuickDraftTransferInput', found: content.includes('QuickDraftTransferInput') },
      { name: 'QuickDraft', found: content.includes('interface QuickDraft') },
    ];
    let allFound = true;
    for (const c of checks) {
      if (c.found) {
        pass(`contract ${c.name}`);
      } else {
        fail(`contract`, `${c.name} not found`);
        allFound = false;
      }
    }
    if (allFound) pass('All QuickDraft contract types present');
  }
}

console.log(exitCode === 0 ? '\nAll Demo acceptance tests PASSED.\n' : '\nSome Demo acceptance tests FAILED.\n');
process.exit(exitCode);
