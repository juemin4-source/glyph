import { Page } from "@playwright/test";

export interface MockData {
  projects?: unknown[];
  objects?: unknown[];
  connections?: unknown[];
  canvasStates?: unknown[];
  createProject?: unknown;
}

/**
 * Sets up Tauri IPC mocks before page load using addInitScript.
 * Call this in test.beforeEach before page.goto().
 */
export async function setupMocks(page: Page, data: MockData): Promise<void> {
  const script = `
    window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = window.__TAURI_EVENT_PLUGIN_INTERNALS__ || {};

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

    const MOCK = ${JSON.stringify(data)};

    window.__TAURI_INTERNALS__.invoke = async (cmd, args) => {
      switch (cmd) {
        case 'list_projects':
          return MOCK.projects || [];
        case 'create_project':
          return MOCK.createProject || {
            id: 'mock-book',
            name: args?.name || '新作品',
            genre: '未分类',
            status: 'conceiving',
            wordCount: 0,
            gradient: '["#6366f1","#8b5cf6"]',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
        case 'list_world_objects':
          return MOCK.objects || [];
        case 'get_world_object':
          return (MOCK.objects || []).find(o => o.id === args?.id) || null;
        case 'list_connections':
          return MOCK.connections || [];
        case 'list_canvas_tab_states':
          return MOCK.canvasStates || [];
        case 'create_world_object':
          return { ...(args?.object || {}), id: args?.object?.id || 'mock-obj' };
        case 'update_world_object':
          return undefined;
        case 'delete_world_object':
          return undefined;
        case 'append_judgment_record':
          return { ...(args?.record || {}), id: 'mock-judg' };
        case 'save_canvas_tab_state':
          return { ...(args?.state || {}) };
        case 'create_connection':
          return { ...(args?.connection || {}) };
        default:
          return undefined;
      }
    };
  `;

  await page.addInitScript(script);
}

/** Default mock projects used by multiple tests */
export const DEFAULT_PROJECTS = [
  {
    id: "book-1",
    name: "觉醒纪元",
    genre: "科幻",
    status: "drafting",
    wordCount: 12500,
    gradient: '["#667eea","#764ba2"]',
    createdAt: 1000,
    updatedAt: 2000,
  },
  {
    id: "book-2",
    name: "星空彼岸",
    genre: "奇幻",
    status: "conceiving",
    wordCount: 3800,
    gradient: '["#0f2027","#203a43"]',
    createdAt: 1000,
    updatedAt: 1500,
  },
];

/** A single mock world object */
export const DEFAULT_OBJECTS = [
  {
    id: "obj-1",
    projectId: "book-1",
    name: "张三",
    type: "人物",
    status: "锁定",
    canonLevel: "核心正典",
    tags: ["主角", "人造人", "觉醒者"],
    aliases: ["三哥", "ZS"],
    selectedBoards: ["角色关系图", "设定推演图"],
    content:
      "张三是一名觉醒的人造人，在一次培养舱异常中获得了自我意识。",
    referencesCount: 2,
    judgmentHistory: [
      {
        id: "judg-1",
        objectId: "obj-1",
        objectName: "张三",
        operationType: "锁定",
        reason: "核心角色，锁定正典",
        timestamp: Date.now() - 86400000 * 30,
        previousStatus: "草稿",
        newStatus: "锁定",
      },
      {
        id: "judg-2",
        objectId: "obj-1",
        objectName: "张三",
        operationType: "提升正典",
        reason: "正典升级为核心",
        timestamp: Date.now() - 86400000 * 15,
        previousStatus: "草案正典",
        newStatus: "核心正典",
      },
    ],
    createdAt: Date.now() - 86400000 * 60,
    updatedAt: Date.now() - 86400000 * 15,
  },
  {
    id: "obj-2",
    projectId: "book-1",
    name: "李四",
    type: "人物",
    status: "草稿",
    canonLevel: "未收录",
    tags: ["配角", "研究员"],
    aliases: ["LS", "李博士"],
    selectedBoards: ["角色关系图"],
    content: "李四是研究人造人技术的首席科学家。",
    referencesCount: 0,
    judgmentHistory: [],
    createdAt: Date.now() - 86400000 * 45,
    updatedAt: Date.now() - 86400000 * 20,
  },
  {
    id: "obj-5",
    projectId: "book-1",
    name: "人造人组织",
    type: "组织",
    status: "草稿",
    canonLevel: "草案正典",
    tags: ["组织", "人造人", "地下"],
    aliases: ["觉醒者联盟", "A.O."],
    selectedBoards: ["角色关系图", "设定推演图"],
    content: "由已觉醒的人造人组成的地下组织。",
    referencesCount: 0,
    judgmentHistory: [
      {
        id: "judg-3",
        objectId: "obj-5",
        objectName: "人造人组织",
        operationType: "提升正典",
        reason: "初步确认组织存在",
        timestamp: Date.now() - 86400000 * 10,
        previousStatus: "未收录",
        newStatus: "草案正典",
      },
    ],
    createdAt: Date.now() - 86400000 * 35,
    updatedAt: Date.now() - 86400000 * 10,
  },
];
