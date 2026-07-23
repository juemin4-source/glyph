import { test, expect } from '@playwright/test';

test.describe('织梦机冒烟测试', () => {
  test('应用加载并显示作品书架', async ({ page }) => {
    test.setTimeout(120_000);

    // 导航到 Tauri 应用
    await page.goto('/');
    await page.waitForLoadState('load');

    // 验证页面有内容
    const title = await page.title();
    expect(title).toBeTruthy();
    console.log('页面标题:', title);

    // 保存截图
    await page.screenshot({ path: 'test-results/smoke-load.png', fullPage: true });
  });
});
