/**
 * 用 tauri-driver 在真实 Tauri WebView 中运行 Event Probe
 *
 * 使用：
 *   1. 确保 tauri-driver 已安装 (cargo install tauri-driver)
 *   2. 先建好 dist/event-probe.js
 *   3. node e2e/tauri-driver-probe.mjs
 */
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GLYPH_EXE = resolve(__dirname, '..', 'target', 'debug', 'glyph.exe');
const WEBDRIVER_PORT = 4444;
const BASE = `http://127.0.0.1:${WEBDRIVER_PORT}`;

// ── 工具函数 ──
async function wd(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1', port: WEBDRIVER_PORT,
      path: `/session${path}`, method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
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
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── 启动 tauri-driver ──
async function startDriver() {
  const driver = spawn('tauri-driver', ['--port', '4444'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, RUST_LOG: 'info' },
  });
  driver.stderr.on('data', d => {
    const s = d.toString().trim();
    if (s && !s.includes('INFO') && !s.includes('WARN')) console.log('[driver]', s.slice(0, 120));
  });
  // 等待 driver 启动（最长 30 秒）
  for (let i = 0; i < 30; i++) {
    try {
      const r = await wd('GET', '/sessions');
      if (r && !r.error) break;
    } catch { /* 还没启动 */ }
    await sleep(1000);
  }
  console.log('[driver] 就绪');
  return driver;
}

// ── 主流程 ──
async function main() {
  console.log('=== Tauri DnD Probe ===\n');

  // 1. 启动 driver
  console.log('[1] 启动 tauri-driver...');
  const driver = await startDriver();

  // 2. 创建 session
  console.log('[2] 创建 Tauri WebView session...');
  let session, sessionId;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      session = await wd('POST', '', {
        capabilities: {
          alwaysMatch: {
            browserName: 'tauri',
            'tauri:options': { application: GLYPH_EXE },
          },
        },
      });
      sessionId = session?.value?.sessionId || session?.sessionId;
      if (sessionId) break;
    } catch (e) {
      console.log(`  尝试 ${attempt + 1} 失败: ${e.message.slice(0, 60)}`);
      await sleep(3000);
    }
  }
  if (!sessionId) { console.log('❌ 无法创建 session'); driver.kill(); return; }
  console.log(`  Session: ${sessionId}`);
  console.log(`  Session: ${sessionId}`);

  // 需要重设 BASE 路径包含 sessionId
  const wd2 = async (method, path, body) => {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: '127.0.0.1', port: WEBDRIVER_PORT,
        path: `/session/${sessionId}${path}`, method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
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
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  };

  // 3. 导航到 Tauri app
  console.log('[3] 等待应用启动...');
  await wd2('POST', '/url', { url: 'tauri://localhost' });
  await sleep(3000);

  // 4. 获取页面源码检查
  const source = await wd2('GET', '/source');
  console.log(`  App loaded: ${source.value?.length > 100}`);

  // 5. 注入 Event Probe
  console.log('[4] 注入 Event Probe...');
  await wd2('POST', '/execute/async', {
    script: `
      const done = arguments[arguments.length - 1];
      const s = document.createElement('script');
      s.src = '/event-probe.js';
      s.onload = () => done('loaded');
      document.head.appendChild(s);
    `,
    args: [],
  });
  await sleep(1000);

  // 6. 通过创建项目进入 workspace
  console.log('[5] 创建测试项目...');
  try {
    // 点击 "创建第一个作品"
    const createBtn = await wd2('POST', '/element', {
      using: 'xpath', value: '//button[contains(text(), "创建第一个作品")]',
    });
    const createBtnId = createBtn.value?.['element-6066-11e4-a52e-4f735466cecf'] || createBtn.value?.ELEMENT;
    if (createBtnId) {
      await wd2('POST', `/element/${createBtnId}/click`);
      console.log('  点击了创建按钮');
    }
    await sleep(1000);

    // 输入项目名
    const input = await wd2('POST', '/element', {
      using: 'css selector', value: 'input',
    });
    const inputId = input.value?.['element-6066-11e4-a52e-4f735466cecf'] || input.value?.ELEMENT;
    if (inputId) {
      await wd2('POST', `/element/${inputId}/clear`);
      await wd2('POST', `/element/${inputId}/value`, { text: 'DnD测试' });
      console.log('  已输入项目名');
    }
    await sleep(500);

    // 点击下一步
    const nextBtn = await wd2('POST', '/element', {
      using: 'xpath', value: '//button[contains(text(), "下一步")]',
    });
    const nextId = nextBtn.value?.['element-6066-11e4-a52e-4f735466cecf'] || nextBtn.value?.ELEMENT;
    if (nextId) {
      await wd2('POST', `/element/${nextId}/click`);
      console.log('  点击了下一步');
    }
    await sleep(500);

    // 选择"从零开始"模板
    const template = await wd2('POST', '/element', {
      using: 'xpath', value: '//*[contains(text(), "从零开始")]',
    });
    const tplId = template.value?.['element-6066-11e4-a52e-4f735466cecf'] || template.value?.ELEMENT;
    if (tplId) {
      await wd2('POST', `/element/${tplId}/click`);
      console.log('  选择了从零开始模板');
    }
    await sleep(300);

    // 点击开始创作
    const startBtn = await wd2('POST', '/element', {
      using: 'xpath', value: '//button[contains(text(), "开始创作")]',
    });
    const startId = startBtn.value?.['element-6066-11e4-a52e-4f735466cecf'] || startBtn.value?.ELEMENT;
    if (startId) {
      await wd2('POST', `/element/${startId}/click`);
      console.log('  点击了开始创作');
    }
    await sleep(2000);

  } catch (e) {
    console.log('  创建项目失败（也许已在 workspace 中）:', e.message?.slice(0, 80));
  }

  // 7. 检查大纲是否可见
  const outlineEl = await wd2('POST', '/element', {
    using: 'css selector', value: '.doc-outline',
  });
  const hasOutline = !outlineEl.value?.error;
  console.log(`[6] 大纲可见: ${hasOutline}`);

  if (!hasOutline) {
    const body = await wd2('GET', '/source');
    console.log('  页面内容:', (body.value || '').slice(0, 300));
    driver.kill();
    return;
  }

  // 8. 启动探针
  console.log('[7] 启动 Event Probe...');
  await wd2('POST', '/execute/async', {
    script: `
      const done = arguments[arguments.length - 1];
      window.probe?.('.doc-outline', 'dragstart dragenter dragover drop dragend');
      window.probe?.('.outline-item-wrapper', 'dragstart dragenter dragover drop');
      setTimeout(done, 500);
    `,
    args: [],
  });
  await sleep(500);

  // 9. 获取浏览器日志
  const getLogs = async () => {
    try {
      const logs = await wd2('POST', '/log', { type: 'browser' });
      return logs.value || [];
    } catch { return []; }
  };

  // 输出到目前为止的日志
  let allLogs = await getLogs();
  console.log(`  已有 ${allLogs.length} 条日志`);

  // 10. 尝试拖拽
  console.log('[8] 模拟拖拽...');
  const dragItems = await wd2('POST', '/elements', {
    using: 'css selector', value: '[draggable]',
  });
  const items = dragItems.value || [];
  console.log(`  找到 ${items.length} 个 draggable`);

  if (items.length >= 2) {
    const srcId = items[0]['element-6066-11e4-a52e-4f735466cecf'] || items[0].ELEMENT;
    const dstId = items[1]['element-6066-11e4-a52e-4f735466cecf'] || items[1].ELEMENT;

    // 获取位置
    const srcLoc = await wd2('GET', `/element/${srcId}/rect`);
    const dstLoc = await wd2('GET', `/element/${dstId}/rect`);

    if (srcLoc.value && dstLoc.value) {
      const sx = srcLoc.value.x + srcLoc.value.width / 2;
      const sy = srcLoc.value.y + srcLoc.value.height / 2;
      const dx = dstLoc.value.x + dstLoc.value.width / 2;
      const dy = dstLoc.value.y + dstLoc.value.height / 2;

      console.log(`  源: (${sx}, ${sy}) → 目标: (${dx}, ${dy})`);

      // 执行拖拽: mousedown at src, mousemove to dst, mouseup
      await wd2('POST', '/actions', {
        actions: [{
          type: 'pointer', id: 'mouse',
          parameters: { pointerType: 'mouse' },
          actions: [
            { type: 'pointerMove', duration: 0, x: Math.round(sx), y: Math.round(sy) },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerMove', duration: 500, x: Math.round(dx), y: Math.round(dy) },
            { type: 'pause', duration: 300 },
            { type: 'pointerUp', button: 0 },
          ],
        }],
      });
      console.log('  拖拽操作完成');
    }
    await sleep(500);
  }

  // 11. 收集探针日志
  await sleep(500);
  allLogs = await getLogs();
  console.log(`\n=== Event Probe 日志 (${allLogs.length} 条) ===`);
  const probeLogs = allLogs.filter(l =>
    l.message?.includes('📍') || l.message?.includes('🔍') ||
    l.message?.includes('[probe]') || l.message?.includes('drag')
  );
  for (const l of probeLogs) {
    console.log(l.message?.trim().slice(0, 200));
  }

  console.log('\n=== 分析 ===');
  const msgs = probeLogs.map(l => l.message || '');
  console.log(`  dragstart: ${msgs.some(m => m.includes('📍') && m.includes('dragstart')) ? '✅' : '❌'}`);
  console.log(`  dragenter: ${msgs.some(m => m.includes('📍') && m.includes('dragenter')) ? '✅' : '❌'}`);
  console.log(`  dragover:  ${msgs.some(m => m.includes('📍') && m.includes('dragover')) ? '✅' : '❌'}`);
  console.log(`  drop:      ${msgs.some(m => m.includes('📍') && m.includes('drop')) ? '✅' : '❌'}`);

  // 清理
  driver.kill();
  console.log('\n✅ 探测完成');
}

main().catch(e => {
  console.error('❌ 错误:', e.message);
  process.exit(1);
});
