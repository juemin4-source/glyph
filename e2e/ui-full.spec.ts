/**
 * 织梦机完整 UI 测试
 * 来源: test-plan.md + product-brief.md + App.tsx
 * 
 * 覆盖: Bookshelf, NavBar (5 tabs), AI Chat, Canvas,
 *       Inspector, Search, Settings, StatusBar
 * 
 * 模式: 纯 UI 交互测试 (IPC 已 mock)
 */

import { test, expect } from '@playwright/test';
import { setupMocks, DEFAULT_PROJECTS, DEFAULT_OBJECTS } from './mock-helper';

// ─── Helpers ────────────────────────────────────────────────────────

async function withProjects(page, objects = []) {
  await setupMocks(page, { projects: DEFAULT_PROJECTS, objects });
  await page.goto('/');
  await expect(page.getByText('作品书架')).toBeVisible({ timeout: 10000 });
}

async function enterProject(page, name = '觉醒纪元') {
  await page.getByLabel('进入《' + name + '》').click();
  await expect(page.getByTitle('返回书架')).toBeVisible({ timeout: 5000 });

  // 等待弹窗出现并全部关闭
  await page.waitForTimeout(500);
  // 关 FirstLaunchGuide: 点"开始使用" → 点"跳过"
  await page.getByText('开始使用').click().catch(() => {});
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: '跳过' }).click().catch(() => {});
  await page.waitForTimeout(200);
  // 关 CanonGuideCard: 点"知道了"
  await page.getByText(/知道了|知道啦/).click().catch(() => {});
  await page.waitForTimeout(200);
}

// ─── 1. Bookshelf ───────────────────────────────────────────────────

test.describe('Bookshelf - 作品书架', () => {
  test('空书架状态', async ({ page }) => {
    await setupMocks(page, { projects: [] });
    await page.goto('/');
    await expect(page.getByText('作品书架')).toBeVisible();
    await expect(page.getByText('还没有作品')).toBeVisible();
    await expect(page.getByRole('button', { name: '新建作品' })).toBeVisible();
  });

  test('显示已有项目列表', async ({ page }) => {
    await withProjects(page);
    // 验证两个预设项目都显示
    await expect(page.getByText('觉醒纪元')).toBeVisible();
    await expect(page.getByText('星空彼岸')).toBeVisible();
  });

  test('新建作品向导弹窗', async ({ page }) => {
    await withProjects(page);
    await page.getByRole('button', { name: '新建作品' }).click();
    // 验证向导弹窗
    await expect(page.getByPlaceholder('输入作品名称...')).toBeVisible();
    await expect(page.getByText('从零开始')).toBeVisible();
    await expect(page.getByRole('button', { name: '下一步' })).toBeVisible();
    // 关闭弹窗
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.getByPlaceholder('输入作品名称...')).not.toBeVisible();
  });

  test('进入项目', async ({ page }) => {
    await withProjects(page);
    await page.getByLabel('进入《觉醒纪元》').click();
    await expect(page.getByTitle('返回书架')).toBeVisible();
    await expect(page.getByText('觉醒纪元')).toBeVisible();
  });
});

// ─── 2. NavTab 导航 ────────────────────────────────────────────────

test.describe('NavBar - 5 个标签导航', () => {
  test.beforeEach(async ({ page }) => {
    await withProjects(page, DEFAULT_OBJECTS);
    await enterProject(page);
  });

  const NAV_TABS = ['文档', '画板', '设定集', '判断记录', 'AI'];

  for (const tab of NAV_TABS) {
    test(`导航到「${tab}」`, async ({ page }) => {
      await page.getByRole('button', { name: tab, exact: true }).click();
      const btn = page.getByRole('button', { name: tab, exact: true });
      await expect(btn).toHaveClass(/active/);
    });
  }

  test('顶部工具栏按钮', async ({ page }) => {
    await expect(page.getByTitle('返回书架')).toBeVisible();
    await expect(page.getByTitle('全局搜索 (Ctrl+K)')).toBeVisible();
    await expect(page.getByTitle('AI 设置')).toBeVisible();
  });
});

// ─── 3. AI Chat ────────────────────────────────────────────────────

test.describe('AI 对话', () => {
  test.beforeEach(async ({ page }) => {
    await withProjects(page, DEFAULT_OBJECTS);
    await enterProject(page);
    await page.getByRole('button', { name: 'AI', exact: true }).click();
  });

  test('AI 界面渲染完整', async ({ page }) => {
    await expect(page.getByText('AI 助手')).toBeVisible();
    await expect(page.getByPlaceholder('输入你的想法，让 AI 帮你创作...')).toBeVisible();
    await expect(page.getByText('AI 已连接')).toBeVisible();
    // 侧边大纲
    await expect(page.getByText('大纲')).toBeVisible();
    // 对象在大纲中
    await expect(page.getByText('陈锋')).toBeVisible();
    await expect(page.getByText('灰塔实验室')).toBeVisible();
    // 底栏模型信息
    await expect(page.getByText(/GPT|Claude|Gemini|模型/)).toBeVisible();
  });

  test('发送消息', async ({ page }) => {
    const input = page.getByPlaceholder('输入你的想法，让 AI 帮你创作...');
    await input.fill('帮我创建一个世界观');
    await input.press('Enter');
    // 消息出现在对话中
    await expect(page.getByText('帮我创建一个世界观')).toBeVisible({ timeout: 5000 });
    // AI 回复（模拟）
    await expect(page.getByText('天眼纪元')).toBeVisible({ timeout: 5000 });
  });

  test('模型选择弹窗', async ({ page }) => {
    // 点击模型选择器
    await page.locator('text=GPT-4o, text=FreeLLMAPI, text=Claude, text=Gemini').first().click();
    // 或者点击"切换模型"按钮
    await page.getByRole('button', { name: '切换模型' }).click();
    // 验证弹窗
    await expect(page.getByText('选择模型')).toBeVisible();
    await expect(page.getByText('GPT-4o')).toBeVisible();
    await expect(page.getByText('Claude 3.5 Sonnet')).toBeVisible();
  });

  test('侧边大纲折叠/展开', async ({ page }) => {
    // 收起按钮
    const collapseBtn = page.locator('button', { hasText: '◀' });
    await expect(collapseBtn).toBeVisible();
    await collapseBtn.click();
    // 展开按钮出现
    await expect(page.locator('button', { hasText: '▶' })).toBeVisible();
  });

  test('新对话按钮', async ({ page }) => {
    await page.getByRole('button', { name: '+ 新对话' }).click();
    // 确认弹窗
    await expect(page.getByText('开始新对话？')).toBeVisible();
    await page.getByRole('button', { name: '确认新对话' }).click();
    // 对话重置为欢迎消息
    await expect(page.getByText('你好！我是织梦机的 AI 助手')).toBeVisible();
  });
});

// ─── 4. Canvas 画板 ───────────────────────────────────────────────

test.describe('画板视图', () => {
  test.beforeEach(async ({ page }) => {
    await withProjects(page, DEFAULT_OBJECTS);
    await enterProject(page);
    await page.getByRole('button', { name: '画板', exact: true }).click();
  });

  test('画板子标签', async ({ page }) => {
    await expect(page.getByRole('button', { name: '角色关系图', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '时间线', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '设定推演图', exact: true })).toBeVisible();
  });

  test('子标签切换', async ({ page }) => {
    await page.getByRole('button', { name: '时间线', exact: true }).click();
    await expect(page.getByRole('button', { name: '时间线', exact: true })).toHaveClass(/active/);
    await page.getByRole('button', { name: '设定推演图', exact: true }).click();
    await expect(page.getByRole('button', { name: '设定推演图', exact: true })).toHaveClass(/active/);
  });

  test('缩放控件', async ({ page }) => {
    await expect(page.getByTitle('缩小 (Ctrl+-)')).toBeVisible();
    await expect(page.getByTitle('放大 (Ctrl++)')).toBeVisible();
    await expect(page.getByTitle('适应画布 (Ctrl+0)')).toBeVisible();
    await expect(page.getByText('100%')).toBeVisible();
  });

  test('工具按钮', async ({ page }) => {
    await expect(page.getByTitle('选择')).toBeVisible();
    await expect(page.getByTitle('拖动画布')).toBeVisible();
    await expect(page.getByTitle('对象卡')).toBeVisible();
  });
});

// ─── 5. Inspector 检查器 ──────────────────────────────────────────

test.describe('Inspector - 对象检查器', () => {
  test.beforeEach(async ({ page }) => {
    await withProjects(page, DEFAULT_OBJECTS);
    await enterProject(page);
  });

  test('选中对象后显示详情', async ({ page }) => {
    // 选中文档视图下的对象
    const docOutline = page.locator('.doc-outline');
    if (await docOutline.isVisible({ timeout: 2000 }).catch(() => false)) {
      await docOutline.locator('text=陈锋').click();
    }
    // Inspector 应该显示类型和等级
    const inspector = page.locator('.inspector, [class*="inspector"]');
    await expect(inspector).toBeVisible();
  });
});

// ─── 6. 全局搜索 ─────────────────────────────────────────────────

test.describe('全局搜索', () => {
  test.beforeEach(async ({ page }) => {
    await withProjects(page, DEFAULT_OBJECTS);
    await enterProject(page);
  });

  test('Ctrl+K 打开搜索弹窗', async ({ page }) => {
    await page.getByTitle('全局搜索 (Ctrl+K)').click();
    // 搜索弹窗应该包含输入框
    await expect(page.getByPlaceholder(/搜索|查找/)).toBeVisible({ timeout: 3000 });
    // 关闭
    await page.keyboard.press('Escape');
    // 应该有一个搜索结果或关闭按钮
  });
});

// ─── 7. AI 设置 ──────────────────────────────────────────────────

test.describe('AI 设置', () => {
  test.beforeEach(async ({ page }) => {
    await withProjects(page, DEFAULT_OBJECTS);
    await enterProject(page);
  });

  test('设置弹窗打开和关闭', async ({ page }) => {
    await page.getByTitle('AI 设置').click();
    await expect(page.getByText('设置')).toBeVisible({ timeout: 3000 });
    // 验证标签页
    await expect(page.getByText('API Keys')).toBeVisible();
    await expect(page.getByText('模型选择')).toBeVisible();
    await expect(page.getByText('用量监控')).toBeVisible();
    await expect(page.getByText('费用')).toBeVisible();
    // 关闭
    await page.getByRole('button', { name: '返回' }).first().click();
  });
});

// ─── 8. StatusBar 底栏 ───────────────────────────────────────────

test.describe('StatusBar - 底栏', () => {
  test.beforeEach(async ({ page }) => {
    await withProjects(page, DEFAULT_OBJECTS);
    await enterProject(page);
  });

  test('底栏显示状态信息', async ({ page }) => {
    // 底栏应该显示保存状态
    await expect(page.getByText(/保存|saved|unsaved/)).toBeVisible();
    // 字数信息
    await expect(page.locator('text=字数, text=words, text=链接')).toBeVisible();
  });
});

// ─── 9. 键盘快捷键 ───────────────────────────────────────────────

test.describe('键盘快捷键', () => {
  test.beforeEach(async ({ page }) => {
    await withProjects(page, DEFAULT_OBJECTS);
    await enterProject(page);
  });

  test('Ctrl+K 触发全局搜索', async ({ page }) => {
    await page.keyboard.press('Control+k');
    // 搜索弹窗应出现
    await expect(page.getByPlaceholder(/搜索|查找/)).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
  });
});




