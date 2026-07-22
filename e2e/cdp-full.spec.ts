/**
 * 织梦机完整实测 — 连真实桌面窗口，不 mock
 * 跑之前确保: npm run tauri dev 运行中 + CDP 端口 9222
 */
import { test, expect, chromium } from '@playwright/test';

let browser: any;
let page: any;

test.beforeAll(async () => {
  browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  page = context.pages()[0];
});

// ─── 辅助 ────────────────────────────────────────────────────────────

async function closeGuideModals() {
  // 关 FirstLaunchGuide
  const startBtn = page.getByRole('button', { name: '开始使用' });
  if (await startBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await startBtn.click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: '跳过' }).click().catch(() => {});
    await page.waitForTimeout(200);
  }
  // 关 CanonGuideCard
  const knowBtn = page.getByRole('button', { name: /知道了|知道啦/ });
  if (await knowBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await knowBtn.click();
    await page.waitForTimeout(200);
  }
}

async function enterProject(name = '实测项目') {
  await page.getByLabel('进入《' + name + '》').click();
  await expect(page.getByTitle('返回书架')).toBeVisible({ timeout: 8000 });
  await closeGuideModals();
}

async function backToBookshelf() {
  await page.getByTitle('返回书架').click();
  await expect(page.getByText('作品书架')).toBeVisible({ timeout: 5000 });
}

async function takeScreenshot(name: string) {
  await page.screenshot({ path: 'test-results/' + name + '.png' });
}

// ═══════════════════════════════════════════════════════════════════
//  1. Bookshelf
// ═══════════════════════════════════════════════════════════════════

test.describe('Bookshelf - 作品书架', () => {
  test('首次打开显示空书架', async () => {
    const hasEmpty = await page.getByText('还没有作品').isVisible().catch(() => false);
    if (!hasEmpty) {
      // 已经有项目的话，先回到书架
      const backBtn = page.getByTitle('返回书架');
      if (await backBtn.isVisible().catch(() => false)) {
        await backBtn.click();
      }
    }
    await takeScreenshot('01-bookshelf');
  });

  test('创建项目', async () => {
    await page.getByRole('button', { name: '新建作品' }).click();
    await page.getByPlaceholder('输入作品名称...').fill('实测项目');
    await page.getByText('从零开始').first().click();
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByRole('button', { name: '开始创作' }).click();
    await expect(page.getByTitle('返回书架')).toBeVisible({ timeout: 8000 });
    await closeGuideModals();
    await takeScreenshot('02-project-created');
  });

  test('可以回到书架', async () => {
    await backToBookshelf();
    await expect(page.getByText('实测项目')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════
//  2. NavTab 切换
// ═══════════════════════════════════════════════════════════════════

test.describe('NavTab 导航', () => {
  test.beforeEach(async () => {
    await enterProject('实测项目');
  });

  test.afterEach(async () => {
    // 切回文档 tab，方便后续测试
    await page.getByRole('button', { name: '文档', exact: true }).click().catch(() => {});
  });

  const TABS = ['文档', '画板', '设定集', '判断记录', 'AI'];
  for (const tab of TABS) {
    test(`切换到「${tab}」`, async () => {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await expect(page.getByRole('button', { name: tab, exact: true })).toHaveClass(/active/);
    });
  }

  test('顶部工具栏按钮', async () => {
    await expect(page.getByTitle('返回书架')).toBeVisible();
    await expect(page.getByTitle('全局搜索 (Ctrl+K)')).toBeVisible();
    await expect(page.getByTitle('AI 设置')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════
//  3. AI 对话
// ═══════════════════════════════════════════════════════════════════

test.describe('AI 对话', () => {
  test.beforeEach(async () => {
    await enterProject('实测项目');
    await page.getByRole('button', { name: 'AI', exact: true }).click();
  });

  test('AI 界面完整', async () => {
    await expect(page.getByText('AI 助手')).toBeVisible();
    await expect(page.getByPlaceholder('输入你的想法，让 AI 帮你创作...')).toBeVisible();
    await expect(page.getByText('AI 已连接')).toBeVisible();
    await expect(page.getByText('大纲')).toBeVisible();
    await takeScreenshot('03-ai-chat');
  });

  test('发送消息', async () => {
    const input = page.getByPlaceholder('输入你的想法，让 AI 帮你创作...');
    await input.fill('帮我创建一个世界观');
    await input.press('Enter');
    await expect(page.getByText('帮我创建一个世界观')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(2000);
    await takeScreenshot('04-ai-response');
  });

  test('切换模型弹窗', async () => {
    await page.getByRole('button', { name: '切换模型' }).click();
    await expect(page.getByText('选择模型')).toBeVisible();
    await expect(page.getByText('GPT-4o')).toBeVisible();
    await page.keyboard.press('Escape');
  });
});

// ═══════════════════════════════════════════════════════════════════
//  4. 画板
// ═══════════════════════════════════════════════════════════════════

test.describe('画板视图', () => {
  test.beforeEach(async () => {
    await enterProject('实测项目');
    await page.getByRole('button', { name: '画板', exact: true }).click();
  });

  test('子标签和缩放控件', async () => {
    await expect(page.getByRole('button', { name: '角色关系图', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '时间线', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '设定推演图', exact: true })).toBeVisible();
    await expect(page.getByTitle('缩小 (Ctrl+-)')).toBeVisible();
    await expect(page.getByTitle('放大 (Ctrl++)')).toBeVisible();
    await expect(page.getByText('100%')).toBeVisible();
    await takeScreenshot('05-canvas');
  });

  test('切换子标签', async () => {
    await page.getByRole('button', { name: '时间线', exact: true }).click();
    await expect(page.getByRole('button', { name: '时间线', exact: true })).toHaveClass(/active/);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  5. 全局搜索
// ═══════════════════════════════════════════════════════════════════

test.describe('全局搜索', () => {
  test.beforeEach(async () => {
    await enterProject('实测项目');
  });

  test('Ctrl+K 打开搜索', async () => {
    await page.getByTitle('全局搜索 (Ctrl+K)').click();
    await expect(page.getByPlaceholder(/搜索|查找/)).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await takeScreenshot('06-search');
  });
});

// ═══════════════════════════════════════════════════════════════════
//  6. AI 设置
// ═══════════════════════════════════════════════════════════════════

test.describe('AI 设置', () => {
  test.beforeEach(async () => {
    await enterProject('实测项目');
  });

  test('设置弹窗', async () => {
    await page.getByTitle('AI 设置').click();
    await expect(page.getByText('设置')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('API Keys')).toBeVisible();
    await expect(page.getByText('模型选择')).toBeVisible();
    await expect(page.getByText('用量监控')).toBeVisible();
    await expect(page.getByText('费用')).toBeVisible();
    await takeScreenshot('07-ai-settings');
    await page.getByRole('button', { name: '返回' }).first().click();
  });
});
