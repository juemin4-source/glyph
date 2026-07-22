/**
 * prompt-registry.ts — 文学天演论 Craft Skill Prompt 注册表
 *
 * 所有 40 个 Craft Skill 的 prompt 模板 + output schema。
 * 不再依赖 Rust invoke，纯 TS。
 */

export interface CraftSkillDef {
  id: string;
  name: string;
  agent: 'architect' | 'writer' | 'reader' | 'inspector' | 'orchestrator';
  phase: string;
  systemPrompt: string;
  outputSchema: Record<string, unknown>;
}

const CRAFT_SKILLS: Record<string, CraftSkillDef> = {
  // ═══════════════════════════════════════════════
  // Writer Agent — 现场写作（CS-25~32）
  // ═══════════════════════════════════════════════

  'CS-25': {
    id: 'CS-25', name: '定势诊断', agent: 'writer', phase: '现场写作',
    systemPrompt: '你是一个专业的叙事分析工具。诊断场景的"势"——情绪基调、张力、节奏的宏观一致性。只输出 JSON。',
    outputSchema: { type: 'object', properties: {
      shiType: { type: 'string', enum: ['舒缓', '对峙', '逼近', '崩塌'] },
      consistencyScore: { type: 'number' },
     断裂标记: { type: 'array', items: { type: 'string' } },
    }, required: ['shiType', 'consistencyScore'] },
  },
  'CS-26': {
    id: 'CS-26', name: '物色诊断', agent: 'writer', phase: '现场写作',
    systemPrompt: '你是一个专业的叙事分析工具。检查场景中的物品是否参与叙事、是否有动作链、是否承载重量。只输出 JSON。',
    outputSchema: { type: 'object', properties: {
      participationScore: { type: 'number' },
      decorativeItems: { type: 'array', items: { type: 'string' } },
      suggestions: { type: 'array', items: { type: 'string' } },
    }, required: ['participationScore'] },
  },
  'CS-27': {
    id: 'CS-27', name: '身位诊断', agent: 'writer', phase: '现场写作',
    systemPrompt: '你是一个专业的叙事分析工具。诊断视点/视角/视线方向、在场感、不可逆小动作。只输出 JSON。',
    outputSchema: { type: 'object', properties: {
      viewpoint: { type: 'string' },
      presenceScore: { type: 'number' },
      irreversibleActions: { type: 'array', items: { type: 'string' } },
    }, required: ['viewpoint', 'presenceScore'] },
  },
  'CS-28': {
    id: 'CS-28', name: '声口诊断', agent: 'writer', phase: '现场写作',
    systemPrompt: '你是一个专业的叙事分析工具。诊断对话的功能性——是否改变关系、称呼变化、沉默的叙事重量。只输出 JSON。',
    outputSchema: { type: 'object', properties: {
      dialogueFunctionScore: { type: 'number' },
      addressChanges: { type: 'array', items: { type: 'string' } },
      silences: { type: 'array', items: { type: 'string' } },
    }, required: ['dialogueFunctionScore'] },
  },
  'CS-29': {
    id: 'CS-29', name: '章句诊断', agent: 'writer', phase: '现场写作',
    systemPrompt: '你是一个专业的叙事分析工具。分析句子节奏/长度分布/段落密度。只输出 JSON。',
    outputSchema: { type: 'object', properties: {
      rhythmScore: { type: 'number' },
      anomalies: { type: 'array', items: { type: 'string' } },
      densityScore: { type: 'number' },
    }, required: ['rhythmScore'] },
  },
  'CS-30': {
    id: 'CS-30', name: '情采诊断', agent: 'writer', phase: '现场写作',
    systemPrompt: '你是一个专业的叙事分析工具。检查情感是否通过具体选择/动作展现，而非抽象形容词。只输出 JSON。',
    outputSchema: { type: 'object', properties: {
      emotionScore: { type: 'number' },
      abstractWords: { type: 'array', items: { type: 'string' } },
      suggestions: { type: 'array', items: { type: 'string' } },
    }, required: ['emotionScore'] },
  },
  'CS-31': {
    id: 'CS-31', name: '风骨诊断', agent: 'writer', phase: '现场写作',
    systemPrompt: '你是一个专业的叙事分析工具。评估文本整体的气息/力度，检测每句话的必要性。只输出 JSON。',
    outputSchema: { type: 'object', properties: {
      intensityScore: { type: 'number' },
      redundantSentences: { type: 'array', items: { type: 'string' } },
      overallScore: { type: 'number' },
    }, required: ['intensityScore'] },
  },
  'CS-32': {
    id: 'CS-32', name: '熔裁诊断', agent: 'writer', phase: '现场写作',
    systemPrompt: '你是一个专业的叙事分析工具。检查场景中是否有不属于此场的内容，给出剪裁建议。只输出 JSON。',
    outputSchema: { type: 'object', properties: {
      focusScore: { type: 'number' },
     裁剪建议: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, reason: { type: 'string' } } } },
    }, required: ['focusScore'] },
  },

  // ═══════════════════════════════════════════════
  // Writer Agent — 审美打磨（CS-01~04）
  // ═══════════════════════════════════════════════

  'CS-01': {
    id: 'CS-01', name: '具象诊断', agent: 'writer', phase: '审美打磨',
    systemPrompt: '你是一个专业的叙事分析工具。检查文本是否将抽象情感转化为具体动作/物色/场景。只输出 JSON。',
    outputSchema: { type: 'object', properties: {
      concreteScore: { type: 'number' },
      abstractWords: { type: 'array', items: { type: 'string' } },
      suggestions: { type: 'array', items: { type: 'string' } },
    }, required: ['concreteScore'] },
  },
  'CS-02': {
    id: 'CS-02', name: '复调诊断', agent: 'writer', phase: '审美打磨',
    systemPrompt: '你是一个专业的叙事分析工具。检测叙事是否在多视角/多层面上有重量差异。只输出 JSON。',
    outputSchema: { type: 'object', properties: {
      complexityScore: { type: 'number' },
      thinPerspectives: { type: 'array', items: { type: 'string' } },
    }, required: ['complexityScore'] },
  },
  'CS-03': {
    id: 'CS-03', name: '余地诊断', agent: 'writer', phase: '审美打磨',
    systemPrompt: '你是一个专业的叙事分析工具。检测解释过度区域，标记"说尽"的段落。只输出 JSON。',
    outputSchema: { type: 'object', properties: {
      reserveScore: { type: 'number' },
      overExplained: { type: 'array', items: { type: 'string' } },
    }, required: ['reserveScore'] },
  },
  'CS-04': {
    id: 'CS-04', name: '得度检查', agent: 'writer', phase: '审美打磨',
    systemPrompt: '你是一个专业的叙事分析工具。综合检查场景/对话/描写的长度是否与叙事功能匹配。只输出 JSON。',
    outputSchema: { type: 'object', properties: {
      measureScore: { type: 'number' },
      redundantScenes: { type: 'array', items: { type: 'string' } },
    }, required: ['measureScore'] },
  },
};

/** 按 Agent 获取 skill 列表 */
export function getSkillsByAgent(agent: string): CraftSkillDef[] {
  return Object.values(CRAFT_SKILLS).filter(s => s.agent === agent);
}

/** 获取单个 skill */
export function getSkill(skillId: string): CraftSkillDef | undefined {
  return CRAFT_SKILLS[skillId];
}

/** 获取某个 Agent 的 skill 调用链（按 ID 顺序） */
export function getSkillChain(agent: string): CraftSkillDef[] {
  const skills = getSkillsByAgent(agent);
  // 按 CS 编号排序
  skills.sort((a, b) => {
    const numA = parseInt(a.id.replace('CS-', ''));
    const numB = parseInt(b.id.replace('CS-', ''));
    return numA - numB;
  });
  return skills;
}

export default CRAFT_SKILLS;

/** @deprecated Legacy API — kept for evaluation-harness compatibility */
export function getDefaults() {
  return Object.values(CRAFT_SKILLS);
}
