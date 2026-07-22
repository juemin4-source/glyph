import { test, expect } from "@playwright/test";
import { setupMocks, DEFAULT_PROJECTS } from "./mock-helper";

/**
 * Helper: switch to source mode to access the raw textarea.
 * TipTap WYSIWYG is the default editor mode (Batch 1).
 */
async function switchToSourceMode(page: import("@playwright/test").Page) {
  const sourceBtn = page.getByTitle("源码");
  if (await sourceBtn.isVisible()) {
    await sourceBtn.click();
    // Wait for textarea to appear
    await page.waitForSelector("textarea", { timeout: 3000 });
  }
}

test.describe("Path 1: Story Creation", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page, {
      projects: DEFAULT_PROJECTS,
      objects: [],
      connections: [],
      canvasStates: [],
    });
  });

  test("loads bookshelf with projects", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("觉醒纪元")).toBeVisible();
    await expect(page.getByText("星空彼岸")).toBeVisible();
    await expect(page.getByText("共 2 部作品")).toBeVisible();
  });

  test("handles empty projects gracefully", async ({ page }) => {
    await page.addInitScript(`
      window.__TAURI_INTERNALS__.invoke = async (cmd) => {
        if (cmd === 'list_projects') return [];
        return undefined;
      };
    `);
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("还没有作品")).toBeVisible();
  });

  test("create project navigates into project view", async ({ page }) => {
    await page.addInitScript(`
      const origInvoke = window.__TAURI_INTERNALS__.invoke;
      const allProjects = [
        { id: "book-1", name: "觉醒纪元", genre: "科幻", status: "drafting", wordCount: 12500, gradient: '["#667eea","#764ba2"]', createdAt: 1000, updatedAt: 2000 },
        { id: "book-2", name: "星空彼岸", genre: "奇幻", status: "conceiving", wordCount: 3800, gradient: '["#0f2027","#203a43"]', createdAt: 1000, updatedAt: 1500 },
        { id: "book-3", name: "新作品", genre: "未分类", status: "conceiving", wordCount: 0, gradient: '["#6366f1","#8b5cf6"]', createdAt: Date.now(), updatedAt: Date.now() },
      ];
      window.__TAURI_INTERNALS__.invoke = async (cmd, args) => {
        if (cmd === 'create_project') return allProjects[2];
        if (cmd === 'list_projects') return allProjects;
        return origInvoke(cmd, args);
      };
    `);
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("新建作品").click();

    await expect(page.getByText("新作品")).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: "文档" })).toBeVisible();
    await expect(page.getByRole("button", { name: "画板" })).toBeVisible();
    await expect(page.getByRole("button", { name: "设定集" })).toBeVisible();
    await expect(page.getByRole("button", { name: "判断记录" })).toBeVisible();
  });

  test("enter an existing project", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("进入《觉醒纪元》").click();
    await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("← 书架")).toBeVisible();
  });

  test("create object and write wiki link in content", async ({ page }) => {
    await setupMocks(page, {
      projects: DEFAULT_PROJECTS,
      objects: [],
      connections: [],
      canvasStates: [],
    });
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("进入《觉醒纪元》").click();
    await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });

    // Empty state shows template buttons
    await expect(page.getByText("选择或创建一个对象")).toBeVisible();
    await expect(page.getByText("+ 人物")).toBeVisible();

    // Click "+ 人物" to create a character
    await page.getByText("+ 人物").click();

    // After creation the TipTap editor appears — switch to source mode for text entry
    await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 5000 });
    await switchToSourceMode(page);

    // Default name shows as "新人物" in the outline
    await expect(page.locator(".outline-item-name").filter({ hasText: "新人物" })).toBeVisible({ timeout: 3000 });

    // Word count should show 0 links
    await expect(page.getByText(/\[\[链接\]\]: 0/)).toBeVisible();

    // Type content containing a [[wiki link]]
    const textarea = page.locator("textarea");
    await textarea.fill("这个故事的主角是[[李四]]，他是核心人物。");
    await expect(textarea).toHaveValue("这个故事的主角是[[李四]]，他是核心人物。");

    // Word count should now show 1 wiki link
    await expect(page.getByText(/\[\[链接\]\]: 1/)).toBeVisible({ timeout: 3000 });
  });

  test("create object and add to canvas board via inspector", async ({ page }) => {
    await setupMocks(page, {
      projects: DEFAULT_PROJECTS,
      objects: [
        {
          id: "obj-new-1",
          projectId: "book-1",
          name: "新人物",
          type: "人物",
          status: "草稿",
          canonLevel: "未收录",
          tags: ["人物"],
          aliases: [],
          selectedBoards: [],
          content: "新人物设定内容",
          referencesCount: 0,
          judgmentHistory: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      connections: [],
      canvasStates: [],
    });
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    // Enter project
    await page.getByLabel("进入《觉醒纪元》").click();
    await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });

    // Select the object in the outline
    await page.getByText("新人物").first().click();
    await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 5000 });
    await switchToSourceMode(page);
    await expect(page.locator("textarea")).toHaveValue("新人物设定内容", { timeout: 5000 });

    // Navigate to canvas tab first — should show no nodes for a board-less object
    await page.locator("button.nav-tab", { hasText: "画板" }).click();
    // Info bar shows "节点: 0" for an empty canvas
    await expect(page.getByText(/节点: 0/)).toBeVisible({ timeout: 3000 });

    // Switch back to document tab to use inspector
    await page.locator("button.nav-tab", { hasText: "文档" }).click();
    await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 3000 });

    // Click "放入画板" in the inspector panel
    const addToBoardBtn = page.getByTitle("放入画板");
    await expect(addToBoardBtn).toBeVisible();
    await expect(addToBoardBtn).toBeEnabled();
    await addToBoardBtn.click();

    // Board menu should appear
    const boardMenu = page.locator(".ia-board-menu");
    await expect(boardMenu).toBeVisible();

    // Click "角色关系图" board item
    await page.getByText("角色关系图").first().click();

    // Navigate to canvas tab
    await page.locator("button.nav-tab", { hasText: "画板" }).click();

    // The "角色关系图" tab should be the default — verify the node appears
    await expect(page.locator(".canvas-node .node-name").filter({ hasText: "新人物" })).toBeVisible({ timeout: 5000 });
    // Info bar should now show at least 1 node
    const nodeInfo = page.getByText(/节点: \d+/);
    await expect(nodeInfo).toBeVisible();
    const nodeCountText = await nodeInfo.textContent();
    expect(parseInt(nodeCountText!.match(/\d+/)?.[0] || "0")).toBeGreaterThanOrEqual(1);
  });
});
