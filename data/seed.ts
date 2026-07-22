import { WorldObject, Connection, TemplatePreset, Project } from '../types/world';

let nextId = 1;
function uid(): string { return `obj_${nextId++}`; }
function cid(): string { return `conn_${nextId++}`; }
function jid(): string { return `judg_${nextId++}`; }

const NOW = Date.now();
const DAY = 86400000;

export const SEED_OBJECTS: WorldObject[] = [
  {
    id: uid(),
    name: '张三',
    type: '人物',
    status: '锁定',
    canonLevel: '核心正典',
    tags: ['主角', '人造人', '觉醒者'],
    aliases: ['三哥', 'ZS'],
    selectedBoards: ['角色关系图', '设定推演图'],
    content: '张三是一名觉醒的人造人，在一次培养舱异常中获得了自我意识。他是整个事件的中心人物，连接着乐园机制、人造人组织和富豪阶层。他的觉醒打破了原本稳定的社会结构。',
    referencesCount: 0,
    judgmentHistory: [
      { id: jid(), objectId: '', objectName: '张三', operationType: '锁定', reason: '核心角色，锁定正典', timestamp: NOW - DAY * 30, previousStatus: '草稿', newStatus: '锁定' },
      { id: jid(), objectId: '', objectName: '张三', operationType: '提升正典', reason: '正典升级为核心', timestamp: NOW - DAY * 15, previousStatus: '草案正典', newStatus: '核心正典' }
    ],
    createdAt: NOW - DAY * 60,
    updatedAt: NOW - DAY * 15
  },
  {
    id: uid(),
    name: '李四',
    type: '人物',
    status: '草稿',
    canonLevel: '未收录',
    tags: ['配角', '研究员'],
    aliases: ['LS', '李博士'],
    selectedBoards: ['角色关系图'],
    content: '李四是研究人造人技术的首席科学家。他对自己的研究成果既感到自豪又充满忧虑。李四与富豪阶层有密切合作，但在某些原则问题上持有不同立场。',
    referencesCount: 0,
    judgmentHistory: [],
    createdAt: NOW - DAY * 45,
    updatedAt: NOW - DAY * 20
  },
  {
    id: uid(),
    name: '乐园机制',
    type: '规则/机制',
    status: '锁定',
    canonLevel: '核心正典',
    tags: ['核心设定', '社会规则', '系统'],
    aliases: ['乐园系统', 'The Garden'],
    selectedBoards: ['角色关系图', '设定推演图'],
    content: '乐园机制是维持这个虚构世界运转的根本规则系统。它决定了人造人的诞生、成长和功能限制。乐园机制的源代码由富豪阶层掌控，但并非所有人都了解其全部功能。',
    referencesCount: 0,
    judgmentHistory: [
      { id: jid(), objectId: '', objectName: '乐园机制', operationType: '锁定', reason: '核心设定，永久锁定', timestamp: NOW - DAY * 30, previousStatus: '待验证', newStatus: '锁定' }
    ],
    createdAt: NOW - DAY * 60,
    updatedAt: NOW - DAY * 30
  },
  {
    id: uid(),
    name: '替换计划',
    type: '事件',
    status: '待验证',
    canonLevel: '草案正典',
    tags: ['阴谋', '核心事件', '人造人'],
    aliases: ['Project Replace', '替换方案'],
    selectedBoards: ['角色关系图', '时间线', '设定推演图'],
    content: '替换计划是富豪阶层暗中策划的一项行动，旨在用更可控的新一代人造人逐步替换现有觉醒的人造人群体。该计划的暴露成为了整个故事的转折点。',
    referencesCount: 0,
    judgmentHistory: [
      { id: jid(), objectId: '', objectName: '替换计划', operationType: '待验证', reason: '需要更多证据支持', timestamp: NOW - DAY * 5, previousStatus: '草稿', newStatus: '待验证' }
    ],
    createdAt: NOW - DAY * 40,
    updatedAt: NOW - DAY * 5
  },
  {
    id: uid(),
    name: '培养舱觉醒开局',
    type: '事件',
    status: '废弃',
    canonLevel: '未收录',
    tags: ['开局', '废弃设定', '培养舱'],
    aliases: [],
    selectedBoards: ['设定推演图'],
    content: '【废弃设定】最初的开局方案：张三在培养舱中突然醒来，发现周围全是沉睡的人造人培养舱。弃用原因：节奏太慢，缺乏冲突张力。后被「第一次背叛」替换。',
    referencesCount: 0,
    judgmentHistory: [
      { id: jid(), objectId: '', objectName: '培养舱觉醒开局', operationType: '废弃', reason: '节奏太慢，被第一次背叛替换', timestamp: NOW - DAY * 25, previousStatus: '待定', newStatus: '废弃' }
    ],
    createdAt: NOW - DAY * 55,
    updatedAt: NOW - DAY * 25
  },
  {
    id: uid(),
    name: '人造人组织',
    type: '组织',
    status: '草稿',
    canonLevel: '草案正典',
    tags: ['组织', '人造人', '地下'],
    aliases: ['觉醒者联盟', 'A.O.'],
    selectedBoards: ['角色关系图', '设定推演图'],
    content: '由已觉醒的人造人组成的地下组织。他们在暗中联络其他觉醒者，试图破解乐园机制的限制代码，寻求真正的自由。组织内部存在温和派与激进派的分歧。',
    referencesCount: 0,
    judgmentHistory: [
      { id: jid(), objectId: '', objectName: '人造人组织', operationType: '提升正典', reason: '初步确认组织存在', timestamp: NOW - DAY * 10, previousStatus: '未收录', newStatus: '草案正典' }
    ],
    createdAt: NOW - DAY * 35,
    updatedAt: NOW - DAY * 10
  },
  {
    id: uid(),
    name: '富豪阶层',
    type: '组织',
    status: '草稿',
    canonLevel: '草案正典',
    tags: ['组织', '统治阶级', '财阀'],
    aliases: ['精英层', 'The Elite', '上层'],
    selectedBoards: ['角色关系图', '设定推演图'],
    content: '掌控社会绝大部分资源和乐园机制管理权的少数精英群体。他们制定规则、监控人造人状态，并在必要时执行替换计划。内部并非铁板一块，存在利益分歧。',
    referencesCount: 0,
    judgmentHistory: [],
    createdAt: NOW - DAY * 50,
    updatedAt: NOW - DAY * 12
  },
  {
    id: uid(),
    name: '第一次背叛',
    type: '事件',
    status: '锁定',
    canonLevel: '核心正典',
    tags: ['转折点', '背叛', '觉醒'],
    aliases: ['初叛'],
    selectedBoards: ['角色关系图', '时间线', '设定推演图'],
    content: '张三在觉醒后发现，自己最信任的引导者其实一直在向富豪阶层汇报他的状态。这次背叛成为了张三彻底倒向人造人组织的决定性因素，也让他对所有人产生了信任危机。',
    referencesCount: 0,
    judgmentHistory: [
      { id: jid(), objectId: '', objectName: '第一次背叛', operationType: '锁定', reason: '核心剧情转折点', timestamp: NOW - DAY * 20, previousStatus: '待验证', newStatus: '锁定' }
    ],
    createdAt: NOW - DAY * 45,
    updatedAt: NOW - DAY * 20
  },
  {
    id: uid(),
    name: '逃离',
    type: '事件',
    status: '待定',
    canonLevel: '草案正典',
    tags: ['行动', '逃亡'],
    aliases: ['Escape'],
    selectedBoards: ['角色关系图', '时间线', '设定推演图'],
    content: '人造人组织策划的一场大规模逃亡行动。目标是将尽可能多的觉醒人造人转移出富豪阶层的监控范围。该行动的成功率极低，但却是唯一的选择。目前行动方案仍在规划中。',
    referencesCount: 0,
    judgmentHistory: [],
    createdAt: NOW - DAY * 30,
    updatedAt: NOW - DAY * 8
  }
];

// Fix judgmentHistory objectId references
for (const obj of SEED_OBJECTS) {
  for (const j of obj.judgmentHistory) {
    j.objectId = obj.id;
  }
}

export const SEED_CONNECTIONS: Connection[] = [
  { id: cid(), sourceId: SEED_OBJECTS[0].id, targetId: SEED_OBJECTS[1].id, type: '相关', label: '研究对象' },
  { id: cid(), sourceId: SEED_OBJECTS[0].id, targetId: SEED_OBJECTS[2].id, type: '属于', label: '受规则约束' },
  { id: cid(), sourceId: SEED_OBJECTS[0].id, targetId: SEED_OBJECTS[3].id, type: '影响', label: '被替换目标' },
  { id: cid(), sourceId: SEED_OBJECTS[0].id, targetId: SEED_OBJECTS[5].id, type: '属于', label: '成员' },
  { id: cid(), sourceId: SEED_OBJECTS[0].id, targetId: SEED_OBJECTS[7].id, type: '发生于', label: '经历者' },
  { id: cid(), sourceId: SEED_OBJECTS[0].id, targetId: SEED_OBJECTS[8].id, type: '导致', label: '推动逃离' },
  { id: cid(), sourceId: SEED_OBJECTS[1].id, targetId: SEED_OBJECTS[6].id, type: '属于', label: '合作者' },
  { id: cid(), sourceId: SEED_OBJECTS[3].id, targetId: SEED_OBJECTS[6].id, type: '属于', label: '策划者' },
  { id: cid(), sourceId: SEED_OBJECTS[5].id, targetId: SEED_OBJECTS[6].id, type: '冲突', label: '对立' },
  { id: cid(), sourceId: SEED_OBJECTS[5].id, targetId: SEED_OBJECTS[8].id, type: '导致', label: '执行者' },
  { id: cid(), sourceId: SEED_OBJECTS[7].id, targetId: SEED_OBJECTS[8].id, type: '导致', label: '催化因素' },
  { id: cid(), sourceId: SEED_OBJECTS[2].id, targetId: SEED_OBJECTS[5].id, type: '影响', label: '规则约束' },
  { id: cid(), sourceId: SEED_OBJECTS[2].id, targetId: SEED_OBJECTS[6].id, type: '属于', label: '被掌控' },
  { id: cid(), sourceId: SEED_OBJECTS[4].id, targetId: SEED_OBJECTS[7].id, type: '替代', label: '被替换' },
];

export const TIMELINE_ORDER: Array<{ objectId: string; position: number; mark: boolean }> = [
  { objectId: SEED_OBJECTS[0].id, position: 1, mark: false },
  { objectId: SEED_OBJECTS[5].id, position: 2, mark: false },
  { objectId: SEED_OBJECTS[7].id, position: 3, mark: true },
  { objectId: SEED_OBJECTS[3].id, position: 4, mark: true },
  { objectId: SEED_OBJECTS[8].id, position: 5, mark: false },
];

export const TEMPLATES: TemplatePreset[] = [
  {
    type: '人物',
    defaultStatus: '草稿',
    defaultTags: ['人物'],
    defaultContent: '## 基本信息\n\n姓名：\n年龄：\n身份：\n\n## 外貌\n\n\n## 性格\n\n\n## 背景故事\n\n\n## 能力\n\n'
  },
  {
    type: '地点',
    defaultStatus: '草稿',
    defaultTags: ['地点'],
    defaultContent: '## 描述\n\n\n## 地理位置\n\n\n## 重要场所\n\n\n## 相关事件\n\n'
  },
  {
    type: '组织',
    defaultStatus: '草稿',
    defaultTags: ['组织'],
    defaultContent: '## 概述\n\n\n## 结构\n\n\n## 目的\n\n\n## 成员\n\n\n## 冲突\n\n'
  },
  {
    type: '规则/机制',
    defaultStatus: '待定',
    defaultTags: ['规则', '设定'],
    defaultContent: '## 规则描述\n\n\n## 触发条件\n\n\n## 限制\n\n\n## 影响范围\n\n'
  },
  {
    type: '事件',
    defaultStatus: '草稿',
    defaultTags: ['事件'],
    defaultContent: '## 时间\n\n\n## 地点\n\n\n## 参与者\n\n\n## 经过\n\n\n## 结果\n\n\n## 影响\n\n'
  },
  {
    type: '物品',
    defaultStatus: '草稿',
    defaultTags: ['物品'],
    defaultContent: '## 描述\n\n\n## 来历\n\n\n## 功能\n\n\n## 重要性\n\n'
  },
  {
    type: '术语',
    defaultStatus: '草稿',
    defaultTags: ['术语'],
    defaultContent: '## 定义\n\n\n## 出处\n\n\n## 相关概念\n\n'
  },
  {
    type: '章节',
    defaultStatus: '待定',
    defaultTags: ['章节'],
    defaultContent: '## 章节概要\n\n\n## 关键场景\n\n\n## 出场人物\n\n\n## 待办\n\n'
  }
];

export const SEED_PROJECTS: Project[] = [
  { id: 'book-1', title: '觉醒纪元', genre: '科幻', status: 'drafting', wordCount: 12500, gradient: ['#667eea', '#764ba2'] as [string, string] },
  { id: 'book-2', title: '星空彼岸', genre: '奇幻', status: 'conceiving', wordCount: 3800, gradient: ['#0f2027', '#203a43'] as [string, string] },
  { id: 'book-3', title: '江湖行', genre: '武侠', status: 'editing', wordCount: 28600, gradient: ['#8e0e00', '#1f1c18'] as [string, string] },
];

// ══════════════════════════════════════════
//  Demo Project Seed Data (v2.0.1)
// ══════════════════════════════════════════

export const DEMO_PROJECT = {
  id: 'demo-project-id',
  name: 'Demo：星际拓荒者',
  genre: '科幻',
  status: 'demo',
  wordCount: 1860,
  gradient: '["#0f2027","#203a43"]',
};

export const DEMO_PREMISE = {
  projectId: 'demo-project-id',
  premiseText: '公元2157年，人类收到了一段来自银河系边缘的神秘重复信号。信号中包含着远超人类当前科技水平的数学模式，证明它来自一个高等智慧文明。主角林星舰长率领深空探索飞船"先驱号"前往信号源头执行首次接触任务。然而，当他们到达目的地时，发现的不仅是一个外星文明，更是一个关乎两个文明存亡的宇宙级抉择。',
  readerQuestions: [
    '人类准备好面对比自身更先进的文明了吗？',
    '当两个文明的根本利益冲突时，和平共处是否只是幻想？',
  ],
  storyType: 'high_concept' as const,
  status: 'confirmed' as const,
};

export const DEMO_STRUCTURE_NODES = [
  {
    projectId: 'demo-project-id',
    parentId: null,
    title: '深空信号',
    nodeType: 'chapter' as const,
    narrativeFunction: '引入冲突——神秘信号打破常规探索任务',
    summary: '先驱号在执行常规深空探测任务时，接收到一段来自银河系边缘的重复信号。首席科学家方晴解析发现信号中嵌入了质数序列和圆周率，证实其为智慧文明产物。舰长林星必须在继续原定任务和转向追踪信号之间做出抉择。',
    positionX: 0,
    positionY: 0,
    sortOrder: 1,
    chapterFunction: 'opening' as const,
  },
  {
    projectId: 'demo-project-id',
    parentId: null,
    title: '异星之门',
    nodeType: 'chapter' as const,
    narrativeFunction: '首次接触与真相揭露',
    summary: '先驱号跟随信号抵达坐标点，发现一座悬浮在虚空中的巨型外星建筑——星门。星门自动激活，开启了一道通往另一个星系的空间通道。穿过星门后，船员们遇到了古老的守望者文明。守望者揭示：他们数千年来一直在观测人类文明的发展，而这次召唤正是为了决定是否将人类纳入星际文明共同体。但守望者内部对此存在严重分歧。',
    positionX: 200,
    positionY: 0,
    sortOrder: 2,
    chapterFunction: 'escalation' as const,
  },
  {
    projectId: 'demo-project-id',
    parentId: null,
    title: '最后的抉择',
    nodeType: 'chapter' as const,
    narrativeFunction: '高潮与结局——人类的回答',
    summary: '守望者议会分裂为两派：接纳派认为人类已经展现出足够的智慧和同理心，应当被接纳；隔离派则认为人类尚处于文明早期阶段，其侵略性和短视可能对整个星际秩序构成威胁。林星必须在有限的时间内向守望者证明人类的价值。与此同时，飞船上的AI发现了一个惊人的真相——守望者文明的母星正在衰亡，他们需要的不仅是新成员，更是一个文明的延续。',
    positionX: 400,
    positionY: 0,
    sortOrder: 3,
    chapterFunction: 'climax' as const,
  },
];

export const DEMO_WORLD_RULE = {
  projectId: 'demo-project-id',
  title: '超光速通信协议',
  ruleText: '在2157年，人类已掌握量子纠缠通信技术，实现了太阳系内的实时通信。但远距离（超过10光年）通信仍存在显著延迟。外星文明"守望者"使用一种名为"共鸣网"的跨维度通信技术，可以实现银河系范围内的即时信息传递，但这种技术有被"监听"的风险。',
  cost: '量子纠缠信道需要极高能量维持，每次通信约消耗相当于一个中型城市日用电量。',
  enforcer: '联合政府太空通信管理局',
};

export const DEMO_CHARACTER_CARD = {
  projectId: 'demo-project-id',
  name: '林星',
  hook: '地球最后的理想主义舰长',
  currentWant: '完成首次接触任务，为人类带来和平',
  realBlock: '内心深处质疑人类是否真的准备好面对外星文明',
  archetype: '船长 / 探索者',
  description: '38岁，联合政府深空探索舰队最年轻的舰长。冷静理性，但在关键时刻会跟随直觉。曾参与火星殖民地的建设，对人类的团结充满理想。父亲是失踪的深空科学家，这个未解之谜驱使他走向星辰大海。'
};

export const DEMO_FACTION_CARD = {
  projectId: 'demo-project-id',
  name: '守望者议会',
  trueGoal: '寻找能够继承守望者文明遗产的种族，确保文明知识不会随母星衰亡而消失',
  publicSlogan: '宇宙的守护者，文明的引路人',
  resources: ['星际通信网络（共鸣网）', '跨星系星门系统', '千万年级文明知识库', '先进生物技术改造能力'],
  representativeCharacterIds: [],
  dailyInterface: '在闪耀的水晶殿堂中围绕全息星图展开永恒辩论',
};

export const DEMO_CHAPTER_PACKETS = [
  {
    projectId: 'demo-project-id',
    structureNodeId: null,
    chapterNumber: 1,
    title: '深空信号',
    position: '开篇',
    chapterFunction: 'opening',
  },
  {
    projectId: 'demo-project-id',
    structureNodeId: null,
    chapterNumber: 2,
    title: '异星之门',
    position: '发展',
    chapterFunction: 'escalation',
  },
];
