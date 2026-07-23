/**
 * tauri-driver DnD 探针 — 完整版
 * 跑：node e2e/td-probe-full.mjs
 */
import { spawn } from 'child_process';
import { resolve } from 'path';

const PORT = 4444;
const EXE = resolve('G:/AI/Claude-Workspace/Projects/glyph/target/debug/glyph.exe');
const __dirname = resolve('.');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function wd(method, path, body) {
  const http = await import('http');
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1', port: PORT, path, method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      timeout: 15000,
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ value: data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // 1. Kill leftovers and start driver
  const { execSync } = await import('child_process');
  try { execSync('powershell -NoProfile "Get-Process tauri-driver,msedgedriver|Stop-Process -Force"', { timeout: 3000 }); } catch {}
  await sleep(2000);

  console.log('Starting tauri-driver...');
  const driver = spawn('tauri-driver', ['--port', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, RUST_LOG: 'error' },
  });
  for (let i = 0; i < 20; i++) {
    try { await wd('GET', '/sessions'); break; }
    catch { await sleep(1000); }
  }

  // 2. Create session
  console.log('Creating session...');
  const caps = {
    capabilities: {
      alwaysMatch: {
        browserName: 'tauri',
        'tauri:options': { application: EXE },
      },
    },
  };
  let sid;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await wd('POST', '/session', caps);
      sid = res?.value?.sessionId || res?.sessionId;
      if (sid) { console.log(`Session: ${sid}`); break; }
    } catch (e) { console.log(`Attempt ${attempt}: ${e.message}`); }
    await sleep(3000);
  }
  if (!sid) { console.log('FAILED'); driver.kill(); return; }

  const base = `/session/${sid}`;

  // 3. Navigate and wait
  console.log('Loading app...');
  try { await wd('POST', `${base}/url`, { url: 'tauri://localhost' }); } catch {}
  await sleep(4000);

  // 4. Get console logs
  async function getLogs() {
    try { return (await wd('POST', `${base}/log`, { type: 'browser' }))?.value || []; }
    catch { return []; }
  }

  // Clear initial logs
  await getLogs();

  // 5. Inject probe
  console.log('Injecting Event Probe...');
  const injectResult = await wd('POST', `${base}/execute/sync`, {
    script: `
      var s = document.createElement('script');
      s.src = '/event-probe.js';
      document.head.appendChild(s);
    `,
    args: [],
  });
  await sleep(1000);

  // Verify probe loaded
  const logs1 = await getLogs();
  const probeLoaded = logs1.some(l => (l.message || '').includes('Event Probe'));
  console.log(`Probe loaded: ${probeLoaded}`);

  // 6. Start probe on outline
  const probeResult = await wd('POST', `${base}/execute/sync`, {
    script: `
      window.probe('.doc-outline', 'dragstart dragenter dragover drop dragend');
      window.probe('.outline-item-wrapper', 'dragstart dragover drop');
      return 'probes started';
    `,
    args: [],
  });
  console.log('Probes:', JSON.stringify(probeResult).slice(0, 100));

  // 7. Create a project to get into workspace
  console.log('Creating project...');
  try {
    // Click "创建第一个作品"
    const btns = await wd('POST', `${base}/elements`, {
      using: 'xpath', value: '//button',
    });
    const allBtns = btns?.value || [];
    console.log(`Found ${allBtns.length} buttons`);

    // Find and click the create button
    for (const btn of allBtns.slice(0, 3)) {
      const id = btn['element-6066-11e4-a52e-4f735466cecf'] || btn.ELEMENT;
      if (id) {
        const text = await wd('GET', `${base}/element/${id}/text`);
        const label = (text?.value || '').trim();
        console.log(`  Button: "${label.slice(0, 30)}"`);
        if (label.includes('创建') || label.includes('新建')) {
          await wd('POST', `${base}/element/${id}/click`);
          console.log(`  Clicked: ${label.slice(0, 20)}`);
          await sleep(1000);
          break;
        }
      }
    }

    // Fill in project name
    const inputs = await wd('POST', `${base}/elements`, {
      using: 'css selector', value: 'input',
    });
    const inp = inputs?.value?.[0];
    if (inp) {
      const id = inp['element-6066-11e4-a52e-4f735466cecf'] || inp.ELEMENT;
      await wd('POST', `${base}/element/${id}/clear`);
      await wd('POST', `${base}/element/${id}/value`, { text: 'DnD测试' });
      console.log('Typed project name');
    }
    await sleep(500);

    // Click "下一步"
    const allBtns2 = (await wd('POST', `${base}/elements`, {
      using: 'xpath', value: '//button',
    }))?.value || [];
    for (const btn of allBtns2) {
      const id = btn['element-6066-11e4-a52e-4f735466cecf'] || btn.ELEMENT;
      const text = await wd('GET', `${base}/element/${id}/text`);
      if ((text?.value || '').includes('下一步')) {
        await wd('POST', `${base}/element/${id}/click`);
        console.log('Clicked 下一步');
        break;
      }
    }
    await sleep(1000);

    // Click "从零开始" template
    const templates = await wd('POST', `${base}/elements`, {
      using: 'xpath', value: '//*[contains(text(), "从零开始")]',
    });
    if (templates?.value?.[0]) {
      const id = templates.value[0]['element-6066-11e4-a52e-4f735466cecf'] || templates.value[0].ELEMENT;
      await wd('POST', `${base}/element/${id}/click`);
      console.log('Selected template');
    }
    await sleep(500);

    // Click "开始创作"
    const allBtns3 = (await wd('POST', `${base}/elements`, {
      using: 'xpath', value: '//button',
    }))?.value || [];
    for (const btn of allBtns3) {
      const id = btn['element-6066-11e4-a52e-4f735466cecf'] || btn.ELEMENT;
      const text = await wd('GET', `${base}/element/${id}/text`);
      if ((text?.value || '').includes('开始创作')) {
        await wd('POST', `${base}/element/${id}/click`);
        console.log('Clicked 开始创作');
        break;
      }
    }
    await sleep(2000);

  } catch (e) {
    console.log(`Project creation: ${e.message}`);
  }

  // 8. Try DnD
  const drags = await wd('POST', `${base}/elements`, {
    using: 'css selector', value: '[draggable]',
  });
  const items = drags?.value || [];
  console.log(`\n[dnd] Found ${items.length} draggable elements`);

  if (items.length >= 2) {
    const srcId = items[0]['element-6066-11e4-a52e-4f735466cecf'] || items[0].ELEMENT;
    const dstId = items[1]['element-6066-11e4-a52e-4f735466cecf'] || items[1].ELEMENT;

    const srcRect = await wd('GET', `${base}/element/${srcId}/rect`);
    const dstRect = await wd('GET', `${base}/element/${dstId}/rect`);

    if (srcRect?.value && dstRect?.value) {
      const sx = Math.round(srcRect.value.x + srcRect.value.width / 2);
      const sy = Math.round(srcRect.value.y + srcRect.value.height / 2);
      const dx = Math.round(dstRect.value.x + dstRect.value.width / 2);
      const dy = Math.round(dstRect.value.y + dstRect.value.height / 2);

      console.log(`[dnd] Drag from (${sx},${sy}) to (${dx},${dy})`);

      // Perform drag via Actions API
      await wd('POST', `${base}/actions`, {
        actions: [{
          type: 'pointer', id: 'mouse',
          parameters: { pointerType: 'mouse' },
          actions: [
            { type: 'pointerMove', duration: 0, x: sx, y: sy },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerMove', duration: 800, x: dx, y: dy },
            { type: 'pause', duration: 500 },
            { type: 'pointerUp', button: 0 },
          ],
        }],
      });
      console.log('[dnd] Actions completed');
    }
    await sleep(500);

    // Clear actions
    try { await wd('DELETE', `${base}/actions`); } catch {}
  }

  // 9. Collect all logs
  await sleep(500);
  const allLogs = await getLogs();
  console.log(`\n=== Total ${allLogs.length} console messages ===`);

  const probeMessages = allLogs.filter(l => {
    const m = l.message || '';
    return m.includes('📍') || m.includes('dragstart') || m.includes('dragover') || m.includes('drop');
  });

  console.log(`\n=== DnD Events (${probeMessages.length}) ===`);
  for (const l of probeMessages) {
    const msg = l.message || '';
    console.log(msg.slice(0, 250));
  }

  const msgs = probeMessages.map(l => l.message || '');
  console.log('\n=== Summary ===');
  console.log(`  dragstart: ${msgs.some(m => m.includes('📍') && m.includes('dragstart')) ? '✅' : '❌'}`);
  console.log(`  dragenter: ${msgs.some(m => m.includes('📍') && m.includes('dragenter')) ? '✅' : '❌'}`);
  console.log(`  dragover:  ${msgs.some(m => m.includes('📍') && m.includes('dragover')) ? '✅' : '❌'}`);
  console.log(`  drop:      ${msgs.some(m => m.includes('📍') && m.includes('drop')) ? '✅' : '❌'}`);

  // Cleanup
  driver.kill();
  console.log('\nDone');
}

main().catch(e => console.error('Error:', e.message));
