/**
 * Core User Paths E2E Tests — 织梦机 v1.3
 *
 * Tests the six main user flows:
 *   1. Bookshelf -> Create Project
 *   2. Editor view
 *   3. AI Chat page
 *   4. AI Settings overlay
 *   5. Canvas view
 *   6. Judgment Records page
 *
 * All tests mock the Tauri IPC layer (@tauri-apps/api/core invoke)
 * so the React SPA can render in a plain browser without the native backend.
 */

import { test, expect } from "@playwright/test";

// ─── Test Data ───────────────────────────────────────────────────

const BOOK_1 = {
  id: "book-1",
  name: "觉醒纪元",
  genre: "科幻",
  status: "drafting",
  wordCount: 12500,
  gradient: '["#667eea","#764ba2"]',
  createdAt: 1000,
  updatedAt: 2000,
};

const BOOK_2 = {
  id: "book-2",
  name: "误入禁忌森林",
  genre: "奇幻",
  status: "conceiving",
  wordCount: 3800,
  gradient: '["#0f2027","#203a43"]',
  createdAt: 1000,
  updatedAt: 1500,
};

// ─── Helpers ────────────────────────────────────────────────────

async function mockMutableProjects(page) {
  await page.addInitScript(`
    window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = window.__TAURI_EVENT_PLUGIN_INTERNALS__ || {};
    const callbacks = new Map();
    window.__TAURI_INTERNALS__.transformCallback = (callback, once) => {
      const id = crypto.getRandomValues(new Uint32Array(1))[0];
      callbacks.set(id, (d) => { if (once) callbacks.delete(id); return typeof callback === "function" ? callback(d) : undefined; });
      return id;
    };
    window.__TAURI_INTERNALS__.unregisterCallback = (id) => callbacks.delete(id);
    const projects = [];
    window.__TAURI_INTERNALS__.invoke = async (cmd, args) => {
      switch (cmd) {
        case "list_projects": return projects;
        case "create_project": {
          const p = { id: "test-book-" + Date.now(), name: args.name, genre: args.genre || "未分类", status: "conceiving", wordCount: 0, gradient: '["#6366f1","#8b5cf6"]', createdAt: Date.now(), updatedAt: Date.now() };
          projects.push(p); return p;
        }
        case "list_world_objects": return [];
        case "list_connections": return [];
        case "list_canvas_tab_states": return [];
        case "create_world_object": return args.object || {};
        case "update_world_object": return undefined;
        case "delete_world_object": return undefined;
        case "append_judgment_record": return { ...(args.record || {}), id: "mock-judg" };
        case "save_canvas_tab_state": return { ...(args.state || {}) };
        case "create_connection": return { ...(args.connection || {}) };
        default: return undefined;
      }
    };
  `);
}

async function mockExistingProjects(page, objectsJSON) {
  const projectsJSON = JSON.stringify([BOOK_1, BOOK_2]);
  await page.addInitScript(`
    try { localStorage.setItem("glyph-guide-done-book-1","true"); localStorage.setItem("glyph-guide-done-book-2","true"); } catch(e) {}
    window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = window.__TAURI_EVENT_PLUGIN_INTERNALS__ || {};
    const callbacks = new Map();
    window.__TAURI_INTERNALS__.transformCallback = (callback, once) => {
      const id = crypto.getRandomValues(new Uint32Array(1))[0];
      callbacks.set(id, (d) => { if (once) callbacks.delete(id); return typeof callback === "function" ? callback(d) : undefined; });
      return id;
    };
    window.__TAURI_INTERNALS__.unregisterCallback = (id) => callbacks.delete(id);
    const projects = ${projectsJSON};
    const objects = ${objectsJSON || "[]"};
    window.__TAURI_INTERNALS__.invoke = async (cmd, args) => {
      switch (cmd) {
        case "list_projects": return projects;
        case "list_world_objects": return objects;
        case "get_world_object": return objects.find((o) => o.id === (args.id || args)) || null;
        case "list_connections": return [];
        case "list_canvas_tab_states": return [];
        case "create_world_object": return args.object || {};
        case "update_world_object": return undefined;
        case "delete_world_object": return undefined;
        case "append_judgment_record": return { ...(args.record || {}), id: "mock-judg" };
        case "save_canvas_tab_state": return { ...(args.state || {}) };
        case "create_connection": return { ...(args.connection || {}) };
        default: return undefined;
      }
    };
  `);
}

async function enterProject(page, projectName) {
  await page.getByLabel("进入《" + projectName + "》").click();
  await expect(page.getByTitle("返回书架")).toBeVisible({ timeout: 5000 });
}

// ─── Path 1 + 2: Bookshelf -> Create Project -> Editor ────────────

test.describe("Path 1+2: Bookshelf -> Create Project -> Editor", () => {
  test("create project via wizard and verify editor view", async ({ page }) => {
    await mockMutableProjects(page);
    await page.goto("/");

    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("还没有作品")).toBeVisible();

    await page.getByRole("button", { name: "新建作品" }).click();
    await expect(page.getByRole("heading", { name: "新建作品" })).toBeVisible({ timeout: 5000 });

    await page.getByPlaceholder("输入作品名称...").fill("测试作品");
    await page.getByText("从零开始").first().click();
    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByRole("button", { name: "开始创作" }).click();

    // Dismiss first-launch guide
    await page.getByText("开始使用").click({ timeout: 10000 });
    await page.getByRole("button", { name: "跳过" }).click({ timeout: 5000 });

    await expect(page.getByRole("button", { name: "文档", exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "画板", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "设定集", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "判断记录", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI", exact: true })).toBeVisible();

    await expect(page.getByTitle("返回书架")).toBeVisible();
    await expect(page.locator(".doc-outline")).toBeVisible();
    await expect(page.getByText("选择或创建一个对象")).toBeVisible();
    await expect(page.getByTitle("AI 设置")).toBeVisible();
    await expect(page.getByTitle("全局搜索 (Ctrl+K)")).toBeVisible();
  });
});

// ─── Path 3: AI Chat ─────────────────────────────────────────────

test.describe("Path 3: AI Chat page", () => {
  test("AI chat loads, shows input, sidebar outline, and accepts messages", async ({ page }) => {
    const objects = [
      {
        id: "obj-1", projectId: "book-1", name: "陈锋", type: "人物",
        status: "锁定", canonLevel: "核心正典", tags: ["主角"], aliases: [],
        selectedBoards: ["角色关系图"],
        content: "# 陈锋\n\n觉醒者联盟的核心人物。",
        referencesCount: 1, judgmentHistory: [],
        createdAt: Date.now() - 86400000, updatedAt: Date.now() - 86400000,
      },
    ];
    await mockExistingProjects(page, JSON.stringify(objects));
    await page.goto("/");

    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });
    await enterProject(page, "觉醒纪元");

    await page.getByRole("button", { name: "AI", exact: true }).click();

    await expect(page.getByText("AI 助手", { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("你好！我是织梦机的 AI 助手")).toBeVisible();

    const chatInput = page.getByPlaceholder("输入你的想法，让 AI 帮你创作...");
    await expect(chatInput).toBeVisible();

    await expect(page.getByText("人物").first()).toBeVisible();
    await expect(page.getByText("陈锋").first()).toBeVisible();

    await chatInput.fill("你好");
    await expect(chatInput).toHaveValue("你好");
  });
});

// ─── Path 4: AI Settings ──────────────────────────────────────────

test.describe("Path 4: AI Settings overlay", () => {
  test("AI Settings opens, shows tabs, and can be closed", async ({ page }) => {
    await mockExistingProjects(page);
    await page.goto("/");

    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });
    await enterProject(page, "觉醒纪元");

    await page.getByTitle("AI 设置").click();

    await expect(page.getByText("API Keys")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("模型选择")).toBeVisible();
    await expect(page.getByText("用量监控")).toBeVisible();
    await expect(page.getByText("费用")).toBeVisible();
    await expect(page.getByText("保存设置")).toBeVisible();

    await page.getByRole("button", { name: "返回" }).first().click();
    await expect(page.getByTitle("AI 设置")).toBeVisible({ timeout: 3000 });
  });
});

// ─── Path 5: Canvas ──────────────────────────────────────────────

test.describe("Path 5: Canvas view", () => {
  test("canvas tab shows canvas sub-tabs and zoom controls", async ({ page }) => {
    await mockExistingProjects(page);
    await page.goto("/");

    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });
    await enterProject(page, "觉醒纪元");

    await page.getByRole("button", { name: "画板", exact: true }).click();

    await expect(page.getByRole("button", { name: "角色关系图" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "时间线" })).toBeVisible();
    await expect(page.getByRole("button", { name: "设定推演图" })).toBeVisible();

    await expect(page.getByTitle("缩小 (Ctrl+-)")).toBeVisible();
    await expect(page.getByTitle("放大 (Ctrl++)")).toBeVisible();
    await expect(page.getByTitle("适应画布 (Ctrl+0)")).toBeVisible();
    await expect(page.getByText("100%")).toBeVisible();

    await expect(page.getByTitle("选择")).toBeVisible();
    await expect(page.getByTitle("拖动画布")).toBeVisible();
    await expect(page.getByTitle("对象卡")).toBeVisible();
  });
});

// ─── Path 6: Judgment Records ────────────────────────────────────

test.describe("Path 6: Judgment Records page", () => {
  test("judgment records tab loads with tab navigation", async ({ page }) => {
    const objects = [
      {
        id: "obj-1", projectId: "book-1", name: "陈锋", type: "人物",
        status: "锁定", canonLevel: "核心正典", tags: ["主角"], aliases: [],
        selectedBoards: [],
        content: "# 陈锋\n\n觉醒者联盟的核心人物。",
        referencesCount: 0,
        judgmentHistory: [
          { id: "judg-1", objectId: "obj-1", objectName: "陈锋", operationType: "锁定", reason: "核心角色锁定", timestamp: Date.now() - 86400000, previousStatus: "草稿", newStatus: "锁定" },
        ],
        createdAt: Date.now() - 86400000 * 2, updatedAt: Date.now() - 86400000,
      },
    ];
    await mockExistingProjects(page, JSON.stringify(objects));
    await page.goto("/");

    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });
    await enterProject(page, "觉醒纪元");

    await page.getByRole("button", { name: "判断记录", exact: true }).click();

    await expect(page.getByText("动作日志")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("字段变更")).toBeVisible();
    await expect(page.locator(".judgment-filters")).toBeVisible();

    await page.getByText("字段变更").click();
    await expect(page.locator(".judgment-tab.active")).toContainText("字段变更");
  });
});
