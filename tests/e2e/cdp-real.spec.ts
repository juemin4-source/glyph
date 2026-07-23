/**
 * 织梦机真实 E2E 测试
 * 通过 CDP 直接连接桌面窗口，不 mock，全真实后端
 */
import { test, expect, chromium } from '@playwright/test';

test.describe('织梦机真实应用', () => {
  let browser: any;
  let page: any;

  test.beforeAll(async () => {
    browser = await chromium.connectOverCDP('http://localhost:9222');
    const context = browser.contexts()[0];
    page = context.pages()[0];
  });

  test.afterAll(async () => {
    // 不断开连接，让桌面窗口继续运行
  });

  test('应用已加载并显示内容', async () => {
    const title = await page.title();
    console.log('窗口标题:', title);
    
    const bodyText = await page.locator('body').textContent();
    expect(bodyText.length).toBeGreaterThan(0);
    console.log('页面内容长度:', bodyText.length);
    
    await page.screenshot({ path: 'test-results/cdp-real-app.png' });
  });

  test('Bookshelf 显示且有新建按钮', async () => {
    // 如果是空书架
    const emptyVisible = await page.getByText('还没有作品').isVisible().catch(() => false);
    console.log('空书架:', emptyVisible);
    
    const newBtn = page.getByRole('button', { name: '新建作品' });
    await expect(newBtn).toBeVisible({ timeout: 5000 });
    console.log('新建作品按钮可见 ✅');
  });

  test('创建真实项目', async () => {
    const newBtn = page.getByRole('button', { name: '新建作品' });
    if (await newBtn.isVisible()) {
      await newBtn.click();
      
      // 填写名称
      const nameInput = page.getByPlaceholder('输入作品名称...');
      await expect(nameInput).toBeVisible({ timeout: 3000 });
      await nameInput.fill('CDP 测试项目');
      
      // 选择从零开始
      await page.getByText('从零开始').first().click();
      
      // 下一步 + 开始创作
      await page.getByRole('button', { name: '下一步' }).click();
      await page.getByRole('button', { name: '开始创作' }).click();
      
      // 验证进入编辑器
      await expect(page.getByTitle('返回书架')).toBeVisible({ timeout: 5000 });
      console.log('项目已创建 ✅');
    }
  });
});
