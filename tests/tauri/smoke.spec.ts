import { test, expect, chromium } from "@playwright/test";

/**
 * tauri-driver E2E smoke test — 真实 Tauri 窗口路径
 *
 * 前置条件:
 *   1. npm run tauri build       — 构建 Tauri 桌面应用
 *   2. tauri-driver               — 启动 WebDriver 桥接 (port 4444)
 *   3. npx playwright test --project=tauri  — 跑本测试
 *
 * 本测试验证 Tauri 桌面窗口能正常启动并展示织梦机 UI。
 * 与 e2e/*.spec.ts (纯浏览器、mock Tauri IPC) 不同，
 * 这是真正走 tauri-driver WebDriver/CDP 路径的桌面端 E2E。
 *
 * 注意: 完整的 10 步 Golden Path E2E 在 real-app.spec.ts 中。
 * 本文件只保留快速烟雾测试（窗口加载 + 基础 UI），不与 real-app 重复。
 */

test.describe("tauri-driver: 织梦机桌面窗口", () => {
  test("窗口加载并展示作品书架", async ({}) => {
    // 通过 tauri-driver 的 CDP 端点连接 Tauri 窗口
    const browser = await chromium.connectOverCDP("http://127.0.0.1:4444");
    const context = browser.contexts()[0];
    const page = context.pages()[0];

    await test.step("窗口标题包含织梦机", async () => {
      await expect(page).toHaveTitle(/织梦机/, { timeout: 15000 });
    });

    await test.step("作品书架渲染", async () => {
      await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });
    });

    await test.step("确认在真实 Tauri 上下文中", async () => {
      const hasTauriInternals = await page.evaluate(() => {
        return typeof (window as any).__TAURI_INTERNALS__ !== "undefined";
      });
      expect(hasTauriInternals).toBe(true);
    });

    await browser.close();
  });

  test("UI 组件正常渲染", async ({}) => {
    const browser = await chromium.connectOverCDP("http://127.0.0.1:4444");
    const context = browser.contexts()[0];
    const page = context.pages()[0];

    // 新建作品按钮存在
    await expect(page.getByLabel("新建作品")).toBeVisible({ timeout: 10000 });

    // 头部导航或功能按钮存在
    const hasNav = await page.evaluate(() => {
      return document.querySelectorAll("nav, header, [role='navigation']").length > 0;
    });
    expect(hasNav).toBe(true);

    await browser.close();
  });
});
