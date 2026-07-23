import { test } from '@playwright/test';

test('probe drag-and-drop in outline', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', msg => {
    const t = msg.text();
    if (t.includes('📍') || t.includes('🔍') || t.includes('drag') || t.includes('DND') || t.includes('probe'))
      logs.push(t);
  });

  await page.goto('http://localhost:1420');
  await page.waitForSelector('.app-layout', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // 加载探针
  await page.addScriptTag({ url: 'http://localhost:1420/event-probe.js' });
  await page.waitForTimeout(500);

  // 直接用 API 创建项目 + 两个对象，然后刷新 GUI 加载
  const res = await page.request.post('http://127.0.0.1:21778/api/projects', {
    data: { name: '拖拽测试', genre: '科幻', status: 'drafting', wordCount: 0, gradient: '["#6366f1","#8b5cf6"]' }
  });
  if (!res.ok()) { console.log('API 建项目失败:', res.status()); return; }
  const proj = await res.json();
  console.log(`API 项目已创建: ${proj.id}`);

  // 创建对象
  await page.request.post('http://127.0.0.1:21778/api/objects', {
    data: { id: 'dnd-ch1', projectId: proj.id, name: '第一章', type: '章节', status: '草稿', canonLevel: '项目正典', tags: [], aliases: [], selectedBoards: [], content: '第一章内容', referencesCount: 0, judgmentHistory: [], sortOrder: 0 }
  });
  await page.request.post('http://127.0.0.1:21778/api/objects', {
    data: { id: 'dnd-ch2', projectId: proj.id, name: '第二章', type: '章节', status: '草稿', canonLevel: '项目正典', tags: [], aliases: [], selectedBoards: [], content: '第二章内容', referencesCount: 0, judgmentHistory: [], sortOrder: 1 }
  });
  await page.request.post('http://127.0.0.1:21778/api/objects', {
    data: { id: 'dnd-char1', projectId: proj.id, name: '林深', type: '人物', status: '草稿', canonLevel: '项目正典', tags: [], aliases: [], selectedBoards: [], content: '主角', referencesCount: 0, judgmentHistory: [], sortOrder: 0 }
  });
  console.log('3 个对象已创建');

  // 但是 GUI 和 API 用不同数据库！需要复制或重定向
  // 方案：用 page.evaluate 直接操作 IndexedDB/localStorage 或注入数据
  // 或者直接用 invoke 调 GUI 后端的 create_project
  // 最简单：先看看页面上有啥错误
  const errors = await page.evaluate(() => {
    // @ts-ignore
    return window.__TAURI__ ? '有 Tauri' : '无 Tauri (纯浏览器)';
  });
  console.log(`运行环境: ${errors}`);

  // 如果在纯浏览器中，invoke 不可用，我们注入一个 mock
  await page.evaluate(() => {
    // @ts-ignore
    if (!window.__TAURI__) {
      console.log('[probe] 纯浏览器模式，模拟 invoke');
      // 注入 mock 让 app 能创建项目
      const origFetch = window.fetch;
      // @ts-ignore
      window.__TAURI_INTERNALS__ = {
        invoke: (cmd: string, args?: any) => {
          console.log(`[mock invoke] ${cmd}`, JSON.stringify(args).slice(0, 100));
          return Promise.resolve(null);
        }
      };
    }
  });

  // 现在通过 GUI 创建一个项目（应该走 mock invoke）
  await page.locator('button:has-text("创建第一个作品")').click();
  await page.waitForTimeout(500);
  await page.locator('input').first().fill('GUI 项目');
  await page.waitForTimeout(200);
  await page.locator('button:has-text("下一步")').click();
  await page.waitForTimeout(500);
  await page.locator('text=从零开始').first().click();
  await page.waitForTimeout(200);
  await page.locator('button:has-text("开始创作")').click();
  await page.waitForTimeout(2000);

  // 检查是否进入了 workspace
  const outline = page.locator('.doc-outline');
  console.log(`\n进入 workspace: ${await outline.isVisible().catch(() => false)}`);
  const sidebar = page.locator('.glyph-sidebar');
  console.log(`sidebar: ${await sidebar.isVisible().catch(() => false)}`);
  const draggables = page.locator('[draggable]');
  console.log(`draggable: ${await draggables.count()}`);

  if (await outline.isVisible().catch(() => false)) {
    // 启动探针
    await page.evaluate(() => (window as any).probe?.('.doc-outline', 'dragstart dragenter dragover drop dragend'));
    const dc = await draggables.count();
    if (dc >= 2) {
      const src = draggables.first(), dst = draggables.nth(1);
      const sb = await src.boundingBox(), db = await dst.boundingBox();
      if (sb && db) {
        await page.mouse.move(sb.x + sb.width/2, sb.y + sb.height/2);
        await page.mouse.down();
        await page.mouse.move(db.x + db.width/2, db.y + db.height/2, { steps: 15 });
        await page.waitForTimeout(500);
        await page.mouse.up();
        await page.waitForTimeout(500);
      }
    }
  }

  console.log('\n=== Probe 日志 ===');
  const pl = logs.filter(l => l.includes('📍') || l.includes('🔍') || l.includes('[probe]') || l.includes('[mock'));
  for (const l of pl) console.log(l);

  const h = (s: string) => logs.some(l => l.includes('📍') && l.includes(s));
  console.log(`\ndragstart: ${h('dragstart') ? '✅' : '❌'}`);
  console.log(`dragenter: ${h('dragenter') ? '✅' : '❌'}`);
  console.log(`dragover:  ${h('dragover') ? '✅' : '❌'}`);
  console.log(`drop:      ${h('drop') ? '✅' : '❌'}`);
});
