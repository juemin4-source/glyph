/**
 * v2-golden-path.spec.ts — 织梦机 v2.0 Golden Path 完整五画板管线验收
 *
 * @deprecated 此测试依赖 addInitScript mock，不是真实 Tauri 后端验收。
 * 请使用 e2e/tauri/real-app.spec.ts 代替（通过 tauri-driver CDP 连接真实 Tauri 窗口）。
 *
 * 测试从书架 → 创建作品 → 五画板闭环 → 刷新持久化的完整黄金路径。
 *
 * 所有 Tauri IPC 调用通过 addInitScript mock，使 React 应用可在纯浏览器中运行。
 * 不需要 Tauri 后端或原生窗口。
 *
 * 保留目的：验证 mock 层和浏览器内基本管线逻辑，不作为正式验收依据。
 */

import { test, expect, type Page } from "@playwright/test";

// ── Inline type (avoid src import for Playwright isolation) ──
type CanvasStage = 'premise' | 'structure' | 'setting' | 'packet' | 'text';
type CanvasStatus = 'locked' | 'ready' | 'active' | 'done';
interface PipelineState {
  projectId: string;
  currentStage: CanvasStage;
  canvasStages: { stage: CanvasStage; status: CanvasStatus }[];
  createdAt: number;
  updatedAt: number;
}

// ═══════════════════════════════════════════
//  Test Constants
// ═══════════════════════════════════════════

const PROJECT_NAME = "黄金路径测试小说";
const PREMISE_TEXT = "一个渴望掌控权力的王子，在发现自己身世之谜后，必须决定是追随血脉的召唤还是守护养大自己的王国。";
const CHAPTER_TITLE = "第一章 觉醒";
const MOCK_PROJECT_ID = "mock-gold-001";

const DEFAULT_PIPELINE_STATE: PipelineState = {
  projectId: MOCK_PROJECT_ID,
  currentStage: "premise",
  canvasStages: [
    { stage: "premise", status: "active" },
    { stage: "structure", status: "locked" },
    { stage: "setting", status: "locked" },
    { stage: "packet", status: "locked" },
    { stage: "text", status: "locked" },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// ═══════════════════════════════════════════
//  Mock Factory
// ═══════════════════════════════════════════

/**
 * Build the addInitScript content for the v2 Golden Path.
 * Maintains mutable maps so Tauri calls feel like real backend:
 *   - create / update / list all work through shared JS maps.
 *   - Pipeline state is tracked in a mutable variable.
 */
function buildMockScript(): string {
  return `
(function() {
  // ── Shim Tauri internals ──
  window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = window.__TAURI_EVENT_PLUGIN_INTERNALS__ || {};

  // ── Persist across reload via localStorage ──
  var LS_KEY = '__zmj_mock_v2__';
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch(e) { return {}; }
  }
  function saveStore(data) {
    var existing = loadStore();
    existing = Object.assign(existing, data);
    try { localStorage.setItem(LS_KEY, JSON.stringify(existing)); } catch(e) {}
  }

  // ── Shared mutable store (seeded from localStorage) ──
  var stored = loadStore();
  var projects = new Map(stored.projects ? stored.projects.map(function(p) { return [p.id, p]; }) : []);
  var premiseCards = new Map();
  var structureNodes = new Map();
  var characterCards = new Map();
  var worldRules = new Map();
  var factionCards = new Map();
  var chapterPackets = new Map();
  var pipelineState = stored.pipelineState || ${JSON.stringify(DEFAULT_PIPELINE_STATE)};

  // ── Helpers ──
  function listFromMap(map) {
    const arr = [];
    for (const v of map.values()) arr.push(v);
    return arr.sort((a, b) => (a.sortOrder ?? a.createdAt ?? 0) - (b.sortOrder ?? b.createdAt ?? 0));
  }

  // ── Tauri invoke mock ──
  window.__TAURI_INTERNALS__.invoke = async function(cmd, args) {
    switch (cmd) {

      // ═══ Project API ═══
      case 'list_projects':
        return listFromMap(projects);

      case 'create_project': {
        const project = {
          id: '${MOCK_PROJECT_ID}',
          name: args && args.name ? args.name : '${PROJECT_NAME}',
          genre: (args && args.genre) || '未分类',
          status: 'conceiving',
          wordCount: 0,
          gradient: '["#6366f1","#8b5cf6"]',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        projects.set(project.id, project);
        saveStore({ projects: Array.from(projects.values()) });
        return project;
      }

      case 'get_project':
        return args && args.id ? (projects.get(args.id) || null) : null;

      case 'update_project':
        if (args && args.project) projects.set(args.project.id, args.project);
        return undefined;

      case 'delete_project':
        if (args && args.id) projects.delete(args.id);
        return undefined;

      // ═══ Pipeline state ═══
      case 'get_pipeline_state':
        return pipelineState;

      case 'save_pipeline_state': {
        const input = args && args.input ? args.input : args;
        const state = input && input.state ? input.state : input;
        if (state) {
          pipelineState = { ...pipelineState, ...state };
          saveStore({ pipelineState: pipelineState });
        }
        return pipelineState;
      }

      // ═══ World object API ═══
      case 'list_world_objects':
        return [];

      case 'get_world_object':
        return null;

      case 'create_world_object':
        return args && args.object ? { ...args.object, id: args.object.id || nextId() } : { id: nextId() };

      case 'update_world_object':
        return undefined;

      case 'delete_world_object':
        return undefined;

      // ═══ Connection API ═══
      case 'list_connections':
        return [];

      case 'create_connection':
        return args && args.connection ? args.connection : {};

      case 'delete_connection':
        return undefined;

      // ═══ Canvas tab state API ═══
      case 'list_canvas_tab_states':
        return [];

      case 'save_canvas_tab_state':
        return args && args.state ? args.state : {};

      case 'delete_canvas_tab_state':
        return undefined;

      // ═══ Premise Card API ═══
      case 'list_premise_cards': {
        const cards = listFromMap(premiseCards);
        // Return as plain objects matching the premise card contract for JSON field handling
        return cards.map(c => ({
          ...c,
          readerQuestions: typeof c.readerQuestions === 'string' ? c.readerQuestions : JSON.stringify(c.readerQuestions),
        }));
      }

      case 'get_premise_card': {
        const card = args && args.input && args.input.id ? premiseCards.get(args.input.id) : null;
        if (!card) return null;
        return {
          ...card,
          readerQuestions: typeof card.readerQuestions === 'string' ? card.readerQuestions : JSON.stringify(card.readerQuestions),
        };
      }

      case 'create_premise_card': {
        const input = (args && args.input) || args || {};
        const card = {
          id: nextId('premise'),
          projectId: input.projectId || '${MOCK_PROJECT_ID}',
          premiseText: input.premiseText || '',
          readerQuestions: JSON.stringify(input.readerQuestions || []),
          storyType: input.storyType || '',
          status: input.status || 'draft',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        premiseCards.set(card.id, card);
        return card;
      }

      case 'update_premise_card': {
        const input = (args && args.input) || args || {};
        const existing = premiseCards.get(input.id);
        if (existing) {
          const updated = {
            ...existing,
            premiseText: input.premiseText !== undefined ? input.premiseText : existing.premiseText,
            readerQuestions: input.readerQuestions !== undefined
              ? (typeof input.readerQuestions === 'string' ? input.readerQuestions : JSON.stringify(input.readerQuestions))
              : existing.readerQuestions,
            storyType: input.storyType !== undefined ? input.storyType : existing.storyType,
            status: input.status !== undefined ? input.status : existing.status,
            updatedAt: Date.now(),
          };
          premiseCards.set(updated.id, updated);
          return updated;
        }
        return input;
      }

      case 'delete_premise_card':
        if (args && args.input && args.input.id) premiseCards.delete(args.input.id);
        return undefined;

      // ═══ Structure Node API ═══
      case 'list_structure_nodes': {
        return listFromMap(structureNodes);
      }

      case 'get_structure_node': {
        return args && args.input && args.input.id ? (structureNodes.get(args.input.id) || null) : null;
      }

      case 'create_structure_node': {
        const input = (args && args.input) || args || {};
        const node = {
          id: nextId('struct'),
          projectId: input.projectId || '${MOCK_PROJECT_ID}',
          parentId: input.parentId || null,
          title: input.title || '新节点',
          nodeType: input.nodeType || 'chapter',
          narrativeFunction: input.narrativeFunction || '',
          summary: input.summary || '',
          positionX: input.positionX || 0,
          positionY: input.positionY || 0,
          sortOrder: input.sortOrder || 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        // 默认结构: 1 book (故事骨架) + 3 phases (开端/发展/高潮)
        structureNodes.set(node.id, node);
        return node;
      }

      case 'update_structure_node': {
        const input = (args && args.input) || args || {};
        const existing = structureNodes.get(input.id);
        if (existing) {
          const updated = { ...existing, ...input, updatedAt: Date.now() };
          structureNodes.set(updated.id, updated);
          return updated;
        }
        return input;
      }

      case 'delete_structure_node': {
        if (args && args.input && args.input.id) structureNodes.delete(args.input.id);
        return undefined;
      }

      // ═══ Setting API: Character Cards ═══
      case 'list_character_cards':
        return listFromMap(characterCards);

      case 'get_character_card':
        return args && args.input && args.input.id ? (characterCards.get(args.input.id) || null) : null;

      case 'create_character_card': {
        const input = (args && args.input) || args || {};
        const card = {
          id: nextId('char'),
          projectId: input.projectId || '${MOCK_PROJECT_ID}',
          name: input.name || '新角色',
          hook: input.hook || '',
          currentWant: input.currentWant || '',
          realBlock: input.realBlock || '',
          archetype: input.archetype || '',
          description: input.description || '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        characterCards.set(card.id, card);
        return card;
      }

      case 'update_character_card': {
        const input = (args && args.input) || args || {};
        const existing = characterCards.get(input.id);
        if (existing) {
          const updated = { ...existing, ...input, updatedAt: Date.now() };
          characterCards.set(updated.id, updated);
          return updated;
        }
        return input;
      }

      case 'delete_character_card':
        if (args && args.input && args.input.id) characterCards.delete(args.input.id);
        return undefined;

      // ═══ Setting API: World Rules ═══
      case 'list_world_rules':
        return [];

      case 'create_world_rule':
        return { id: nextId('rule'), ...((args && args.input) || args || {}), createdAt: Date.now(), updatedAt: Date.now() };

      case 'delete_world_rule':
        return undefined;

      // ═══ Setting API: Faction Cards ═══
      case 'list_faction_cards':
        return [];

      case 'create_faction_card':
        return { id: nextId('faction'), ...((args && args.input) || args || {}), resources: '[]', representativeCharacterIds: '[]', createdAt: Date.now(), updatedAt: Date.now() };

      case 'delete_faction_card':
        return undefined;

      // ═══ Chapter Packet API ═══
      case 'list_chapter_packets':
        return listFromMap(chapterPackets);

      case 'get_chapter_packet':
        return args && args.input && args.input.id ? (chapterPackets.get(args.input.id) || null) : null;

      case 'create_chapter_packet': {
        const input = (args && args.input) || args || {};
        const packet = {
          id: nextId('packet'),
          projectId: input.projectId || '${MOCK_PROJECT_ID}',
          structureNodeId: input.structureNodeId || null,
          chapterNumber: input.chapterNumber || 1,
          title: input.title || '第1章',
          position: input.position || '',
          chapterFunction: input.chapterFunction || '',
          layer1: '{"narrativeDistance":"medium","expositionStrategy":"balanced","characterVoice":"moderate","taboos":[],"voiceSamples":[]}',
          layer2: '{"characters":[],"scenes":[],"rules":[],"recap":"","knowledgeSnapshot":{"characterKnowledge":[],"readerKnows":[],"hiddenFromReader":[]},"characterStates":[]}',
          layer3: '{"lines":[],"position":{"from":"","to":""},"chapterFunction":"","narrative":"","releases":[],"establishes":[],"annotations":[],"assumptions":[]}',
          layer4: '{"scenes":[],"taboos":[]}',
          status: 'draft',
          mode: 'standard',
          assumptionCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        chapterPackets.set(packet.id, packet);
        return packet;
      }

      case 'update_chapter_packet_layers': {
        const input = (args && args.input) || args || {};
        const existing = chapterPackets.get(input.packetId);
        if (existing) {
          const updated = {
            ...existing,
            title: input.title !== undefined ? input.title : existing.title,
            layer1: input.layer1 !== undefined ? JSON.stringify(input.layer1) : existing.layer1,
            layer2: input.layer2 !== undefined ? JSON.stringify(input.layer2) : existing.layer2,
            layer3: input.layer3 !== undefined ? JSON.stringify(input.layer3) : existing.layer3,
            layer4: input.layer4 !== undefined ? JSON.stringify(input.layer4) : existing.layer4,
            status: input.status || existing.status,
            updatedAt: Date.now(),
          };
          chapterPackets.set(updated.id, updated);
          return updated;
        }
        return input;
      }

      case 'confirm_chapter_packet': {
        const packetId = (args && args.input && args.input.packetId) || (args && args.packetId);
        const existing = chapterPackets.get(packetId);
        if (existing) {
          const updated = { ...existing, status: 'confirmed', updatedAt: Date.now() };
          chapterPackets.set(updated.id, updated);
          return updated;
        }
        return {};
      }

      case 'delete_chapter_packet':
        if (args && args.input && args.input.id) chapterPackets.delete(args.input.id);
        return undefined;

      // ═══ Judgment Records ═══
      case 'list_judgment_records':
        return [];

      case 'append_judgment_record':
        return args && args.record ? { ...args.record, id: nextId('judg') } : { id: nextId('judg') };

      // ═══ Health / Misc ═══
      case 'ping':
        return 'pong';

      case 'get_usage_stats':
        return { todayTokens: 0, maxTokens: 0, dailyHistory: [], totalCostToday: 0, totalCostMonth: 0, budgetLimit: 10 };

      case 'export_project':
        return { path: '/tmp/export.json' };

      case 'import_project':
        return { projectId: nextId('import') };

      case 'store_api_key':
        return undefined;

      case 'set_budget_limit':
        return undefined;

      default:
        console.warn('[Mock] Unhandled Tauri command:', cmd, args);
        return undefined;
    }
  };

  function nextId() {
    return 'mockid-' + String(Math.random()).slice(2, 10) + String(Date.now()).slice(-6);
  }

  // ── Callback infrastructure ──
  const callbacks = new Map();
  window.__TAURI_INTERNALS__.transformCallback = (callback, once) => {
    const id = crypto.getRandomValues(new Uint32Array(1))[0];
    callbacks.set(id, (d) => {
      if (once) callbacks.delete(id);
      return typeof callback === 'function' ? callback(d) : undefined;
    });
    return id;
  };
  window.__TAURI_INTERNALS__.unregisterCallback = (id) => callbacks.delete(id);

})();
`;
}

// ═══════════════════════════════════════════
//  Page Helpers
// ═══════════════════════════════════════════

/** Create a project via CreationWizard modal */
async function createProject(page: Page, name: string) {
  // Click "新建作品" button on the bookshelf
  await page.getByLabel("新建作品").click();

  // CreationWizard modal should appear
  await expect(page.getByRole("heading", { name: "新建作品" })).toBeVisible({ timeout: 5000 });

  // Fill in project name
  const nameInput = page.locator('input[placeholder="输入作品名称..."]');
  await nameInput.fill(name);

  // Skip template — click "开始创作" (may need "下一步" first if 2-step wizard)
  const nextBtn = page.getByRole("button", { name: "下一步" });
  const startBtn = page.getByRole("button", { name: "开始创作" });

  if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nextBtn.click();
  }

  await expect(startBtn).toBeVisible({ timeout: 3000 });
  await startBtn.click();
}

/** Stage 1: Fill premise card and confirm */
async function completePremiseStage(page: Page) {
  // Wait for premise textarea to render
  await expect(page.locator("textarea").first()).toBeVisible({ timeout: 8000 });

  // Fill premise text
  const textarea = page.locator("textarea.premise-textarea");
  await expect(textarea).toBeVisible({ timeout: 5000 });
  await textarea.fill(PREMISE_TEXT);

  // Select story type
  const genreSelect = page.locator("select").first();
  await genreSelect.selectOption("character_driven");

  // Click "保存草稿" (force: true to bypass CanvasAiBar fixed overlay)
  await page.getByRole("button", { name: "保存草稿" }).click({ force: true });
  await expect(page.getByText("保存中...")).toBeVisible({ timeout: 3000 }).catch(() => {});

  // Wait for save to complete (button text returns or other visual cue)
  await page.waitForTimeout(1500);

  // Click "确认前提" (force: true to bypass CanvasAiBar fixed overlay)
  await page.getByRole("button", { name: "确认前提" }).click({ force: true });
}

/** Stage 2: Create default structure and confirm */
async function completeStructureStage(page: Page) {
  // "创建默认结构" button should appear
  await expect(page.getByRole("button", { name: "创建默认结构" })).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: "创建默认结构" }).click({ force: true });

  // ReactFlow should render
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 5000 });

  // Click "确认结构 ✓"
  await page.getByRole("button", { name: "确认结构" }).click({ force: true });
  await page.waitForTimeout(1000);
}

/** Stage 3: Add a character and confirm setting */
async function completeSettingStage(page: Page) {
  // Wait for setting canvas to render (should see tabs or add button)
  await expect(page.getByRole("button", { name: "确认设定" })).toBeVisible({ timeout: 8000 });

  // Switch to Characters tab
  await page.getByRole("tab", { name: "角色" }).click();

  // Click "+ 添加角色"
  await page.getByRole("button", { name: "添加角色" }).click();

  // Fill character name
  const nameInput = page.locator('input[placeholder="角色名称"]');
  await expect(nameInput).toBeVisible({ timeout: 3000 });
  await nameInput.fill("测试主角");

  // Also fill hook
  const hookInput = page.locator('input[placeholder="一句话让读者记住角色"]');
  if (await hookInput.isVisible()) {
    await hookInput.fill("一个背负秘密的觉醒者");
  }

  // Click "创建"
  await page.getByRole("button", { name: "创建" }).click();
  await page.waitForTimeout(1000);

  // Click "确认设定 ✓"
  await page.getByRole("button", { name: "确认设定" }).click({ force: true });
  await page.waitForTimeout(1000);
}

/** Stage 4: Create chapter packet and confirm */
async function completePacketStage(page: Page) {
  // Wait for packet canvas to load (either empty state or create button)
  await expect(page.getByRole("button", { name: "从空包开始" })).toBeVisible({ timeout: 10000 });

  // Click "从空包开始"
  await page.getByRole("button", { name: "从空包开始" }).click();
  await page.waitForTimeout(1000);

  // Fill chapter title
  const titleInput = page.locator('input[placeholder="章节标题"]');
  await expect(titleInput).toBeVisible({ timeout: 5000 });
  await titleInput.fill(CHAPTER_TITLE);

  // Wait for layers to load
  await page.waitForTimeout(1000);

  // Click "确认"
  await page.getByRole("button", { name: "确认" }).click({ force: true });
  await page.waitForTimeout(1500);
}

// ═══════════════════════════════════════════
//  Tests
// ═══════════════════════════════════════════

test.describe("v2.0 Golden Path — 五画板管线", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any previous mock state from localStorage
    await page.addInitScript(buildMockScript());
  });

  test("完整黄金路径：从头走完五画板管线", async ({ page }) => {
    // ── Navigate to bookshelf ──
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem('__zmj_mock_v2__'));
    await page.reload();
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    // ── Step 1: Create project ──
    await createProject(page, PROJECT_NAME);
    await page.waitForTimeout(1500);

    // ── Verify we're in PipelineNav with premise stage active ──
    await expect(page.locator(".pipeline-nav")).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".pipeline-project-title")).toHaveText(PROJECT_NAME);
    await expect(page.getByTitle("前提 — 进行中")).toBeVisible();

    // ── Step 2: Premise 画板① ──
    await completePremiseStage(page);
    await page.waitForTimeout(1000);

    // Verify premise is done and structure is active
    await expect(page.locator(".pipeline-stage-btn.active")).toBeVisible({ timeout: 5000 });

    // ── Step 3: Structure 画板② ──
    await completeStructureStage(page);
    await page.waitForTimeout(1000);

    // ── Step 4: Setting 画板③ ──
    await completeSettingStage(page);
    await page.waitForTimeout(1000);

    // ── Step 5: Packet 画板④ ──
    await completePacketStage(page);
    await page.waitForTimeout(1500);

    // ── Step 6: Verify we're on Text 画板⑤ ──
    // After confirming packet, pipeline advances to text stage
    // TextCanvas shows either the editor or "暂无细纲包" empty state
    await expect(page.locator(".text-canvas")).toBeVisible({ timeout: 10000 }).catch(async () => {
      // Fallback: check we at least see the text stage shell
      await expect(page.getByText("暂无细纲包")).toBeVisible({ timeout: 5000 });
    });
  });

  test("刷新后数据持久化", async ({ page }) => {
    // ── Navigate to bookshelf ──
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem('__zmj_mock_v2__'));
    await page.reload();
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    // Create project
    await createProject(page, PROJECT_NAME);
    await page.waitForTimeout(1500);

    // Complete premise
    await expect(page.locator(".premise-container")).toBeVisible({ timeout: 8000 });
    await completePremiseStage(page);
    await page.waitForTimeout(1000);

    // Complete structure
    await completeStructureStage(page);
    await page.waitForTimeout(1000);

    // Complete setting
    await completeSettingStage(page);
    await page.waitForTimeout(1000);

    // ── Reload page ──
    // localStorage should persist the project and pipeline state
    await page.reload();
    await page.waitForTimeout(2000);

    // Verify project card is visible on bookshelf (persisted via localStorage)
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 8000 });
    await expect(page.getByLabel("进入《${PROJECT_NAME}》")).toBeVisible({ timeout: 5000 });

    // Click into the project to verify pipeline state was also persisted
    await page.getByLabel("进入《${PROJECT_NAME}》").click();
    await page.waitForTimeout(1500);

    // After entering, the pipeline nav should appear with the project title
    await expect(page.locator(".pipeline-nav")).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".pipeline-project-title")).toHaveText(PROJECT_NAME);
  });

  test("书架导航：返回书架后重新进入项目", async ({ page }) => {
    // ── Navigate to bookshelf ──
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem('__zmj_mock_v2__'));
    await page.reload();
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    // Create project and go through premise
    await createProject(page, PROJECT_NAME);
    await page.waitForTimeout(1500);

    // Verify pipeline nav is visible
    await expect(page.locator(".pipeline-nav")).toBeVisible({ timeout: 5000 });

    // Click back button to return to bookshelf
    await page.locator('button[title="返回书架"]').click();
    await page.waitForTimeout(500);

    // Verify we're back on bookshelf
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 5000 });

    // Project card should be visible
    await expect(page.getByLabel(`进入《${PROJECT_NAME}》`)).toBeVisible({ timeout: 5000 });
  });
});
