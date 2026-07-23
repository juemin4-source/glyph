/**
 * 在真实 Tauri WebView 中用 Event Probe 排查 DnD 问题
 *
 * 跑：npx wdio run ./wdio.tauri.conf.ts --spec ./e2e/tauri/probe-dnd.spec.ts
 */
describe('DnD Probe in Tauri WebView', () => {
  let logs: string[] = [];

  before(async () => {
    logs = [];
    // 收集控制台日志
    browser.on('console', (msg: any) => {
      const text = msg.getText();
      if (text.includes('📍') || text.includes('🔍') || text.includes('[probe]') ||
          text.includes('drag') || text.includes('DND') || text.includes('ERROR'))
        logs.push(`[${msg.getType()}] ${text}`);
    });
  });

  it('should load probe and test DnD', async () => {
    // 等待 app 启动
    await browser.url('tauri://localhost');
    await browser.pause(3000);

    // 注入 Event Probe
    await browser.execute(`
      const s = document.createElement('script');
      s.src = '/event-probe.js';
      document.head.appendChild(s);
    `);
    await browser.pause(1000);

    // 创建一个项目走完整流程
    // 点击"创建第一个作品"
    const createBtn = await $('button=创建第一个作品');
    await createBtn.waitForDisplayed({ timeout: 5000 });
    await createBtn.click();
    await browser.pause(500);

    // 输入项目名
    const input = await $('input');
    await input.setValue('DnD 探针测试');
    await browser.pause(200);

    // 点击"下一步"
    await $('button=下一步').click();
    await browser.pause(500);

    // 选择"从零开始"模板
    await $('text=从零开始').click();
    await browser.pause(200);

    // 点击"开始创作"
    await $('button=开始创作').click();
    await browser.pause(2000);

    // 确认已进入 workspace
    const outline = await $('.doc-outline');
    const outlineVisible = await outline.isDisplayed();
    console.log(`[DnD-Probe] 大纲可见: ${outlineVisible}`);

    if (!outlineVisible) {
      console.log('[DnD-Probe] 未进入 workspace，打印页面内容:');
      const body = await $('body').getText();
      console.log(body.slice(0, 300));
      return;
    }

    // 启动探针
    await browser.execute(`
      window.probe?.('.doc-outline', 'dragstart dragenter dragover drop dragend');
      window.probe?.('.outline-item-wrapper', 'dragstart dragenter dragover drop');
    `);
    await browser.pause(500);

    // 查找 draggable 元素
    const draggables = await $$('[draggable]');
    console.log(`[DnD-Probe] 找到 ${draggables.length} 个 draggable`);

    if (draggables.length >= 2) {
      const src = draggables[0];
      const dst = draggables[1];
      const srcLoc = await src.getLocation();
      const srcSize = await src.getSize();
      const dstLoc = await dst.getLocation();
      const dstSize = await dst.getSize();

      const sx = srcLoc.x + srcSize.width / 2;
      const sy = srcLoc.y + srcSize.height / 2;
      const dx = dstLoc.x + dstSize.width / 2;
      const dy = dstLoc.y + dstSize.height / 2;

      // 模拟拖拽：mousedown → mousemove → mouseup
      await browser.performActions([{
        type: 'pointer',
        id: 'mouse',
        parameters: { pointerType: 'mouse' },
        actions: [
          { type: 'pointerMove', duration: 0, x: sx, y: sy },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerMove', duration: 500, x: dx, y: dy },
          { type: 'pause', duration: 300 },
          { type: 'pointerUp', button: 0 },
        ],
      }]);
      await browser.pause(500);
    }

    // 输出日志
    console.log('\n========== Event Probe 日志 ==========');
    for (const l of logs) console.log(l);

    const h = (s: string) => logs.some(l => l.includes('📍') && l.includes(s));
    console.log('\n========== 分析 ==========');
    console.log(`dragstart: ${h('dragstart') ? '✅' : '❌'}`);
    console.log(`dragenter: ${h('dragenter') ? '✅' : '❌'}`);
    console.log(`dragover:  ${h('dragover') ? '✅' : '❌'}`);
    console.log(`drop:      ${h('drop') ? '✅' : '❌'}`);
  });
});
