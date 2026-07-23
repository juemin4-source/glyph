#!/usr/bin/env node
/**
 * probe-api.mjs — Glyph API-only 模式探测
 *
 * 快速验证：
 *   1. `--api-only` 模式启动
 *   2. HTTP API 端口可达
 *   3. 基础端点响应
 *
 * 使用：
 *   node tests/e2e/probe-api.mjs
 *
 * 退出码: 0 = PASS, 1 = FAIL
 */

import { spawn } from 'child_process';
import http from 'http';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');
const API_PORT = 21778;
const BASE = `http://127.0.0.1:${API_PORT}`;
const EXE = resolve(ROOT, 'target', 'debug', 'glyph.exe');

async function httpGet(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}${path}`, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  let pass = 0, fail = 0;
  function check(name, ok) {
    if (ok) { console.log(`  [PASS] ${name}`); pass++; }
    else { console.log(`  [FAIL] ${name}`); fail++; }
  }

  // ── 1. Start API server ──
  console.log('Starting glyph --api-only...');
  const proc = spawn(EXE, ['--api-only'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stderr.on('data', d => {}); // swallow

  // Wait for server
  for (let i = 0; i < 15; i++) {
    try {
      await httpGet('/api/projects');
      console.log('  Server ready\n');
      break;
    } catch { await sleep(1000); }
  }

  // ── 2. Probe endpoints ──
  try {
    const projects = await httpGet('/api/projects');
    check('GET /api/projects responds', projects !== undefined);
    check('Response has expected structure',
      projects !== null && typeof projects === 'object');
  } catch (e) {
    check('API server reachable', false);
    console.error('  Error:', e.message);
  }

  // ── 3. Summary ──
  console.log(`\nResults: ${pass} PASS, ${fail} FAIL (${pass + fail} total)`);
  proc.kill();

  if (fail > 0) process.exit(1);
  console.log('[PASS] API probe complete');
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
