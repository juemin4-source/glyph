/**
 * assumption-helper.ts — 织梦机 v2 D 轮临时假设辅助函数。
 *
 * 提供 adoptAssumption / rejectAssumption 两个顶层操作，
 * 连接假设 UI → settingApi(创建实体) → chapterPacketApi(更新 resolution) → decisionLogApi(留痕)。
 *
 * 硬规则：
 * - 不修改 ChapterPacket contract / Assumption 类型
 * - 不修改 settingApi 方法签名
 * - source='from_assumption' 写入 DecisionLog.details
 * - 不新增 setting contract 字段
 */
import {
  createWorldRule,
  createCharacterCard,
  createFactionCard,
} from '../api/settingApi';
import { updateChapterPacketLayers } from '../api/chapterPacketApi';
import { appendDecisionLog } from '../api/decisionLogApi';
import type { Assumption } from '../contracts/chapter-packet.contract';

/**
 * 推理假设内容应创建的目标实体类型。
 * 基于简单关键词匹配。UI 层应提供确认弹窗供用户二次确认。
 *
 * @param content 假设内容
 * @returns 推断的实体类型
 */
export type AssumptionEntityType = 'rule' | 'character' | 'faction' | 'unknown';

export function detectAssumptionType(content: string): AssumptionEntityType {
  const low = content.toLowerCase();
  // 角色关键词
  const characterKeywords = [
    '角色', '人物', '名', '姓', '者', '她', '他', '它', '师',
    'character', 'person', 'someone', 'who', 'hero', 'villain',
  ];
  // 规则关键词
  const ruleKeywords = [
    '规则', '法则', '定律', '限制', '禁忌', '不能', '可以', '必须',
    'rule', 'law', 'principle', 'cannot', 'must',
  ];
  // 势力关键词
  const factionKeywords = [
    '势力', '组织', '派系', '家族', '王国', '帝国', '联盟',
    'faction', 'organization', 'kingdom', 'empire', 'clan', 'guild',
  ];

  const score = { character: 0, rule: 0, faction: 0 };
  for (const kw of characterKeywords) {
    if (low.includes(kw)) score.character += 1;
  }
  for (const kw of ruleKeywords) {
    if (low.includes(kw)) score.rule += 1;
  }
  for (const kw of factionKeywords) {
    if (low.includes(kw)) score.faction += 1;
  }

  if (score.character >= score.rule && score.character >= score.faction && score.character > 0) return 'character';
  if (score.rule >= score.faction && score.rule > 0) return 'rule';
  if (score.faction > 0) return 'faction';
  return 'unknown';
}

/**
 * 采纳假设：创建对应设定实体 + 更新假设 resolution + 记录决策日志。
 *
 * @param packetId 所属 ChapterPacket ID
 * @param projectId 所属项目 ID
 * @param assumption 假设对象
 * @param entityType 目标实体类型（可由 detectAssumptionType 推断，UI 确认后传入）
 * @param layer3 当前层 3 JSON 字符串（需传入，因为调用方已加载数据）
 * @returns 创建的实体 ID
 */
export async function adoptAssumption(
  packetId: string,
  projectId: string,
  assumption: Assumption,
  entityType: AssumptionEntityType,
  layer3: string,
): Promise<string> {
  let entityId: string;
  let entityTypeName: string;

  switch (entityType) {
    case 'character': {
      const card = await createCharacterCard({
        projectId,
        name: assumption.content.slice(0, 50),
        hook: '',
        currentWant: '',
        realBlock: '',
        archetype: '',
        description: assumption.content,
      });
      entityId = card.id;
      entityTypeName = 'character_card';
      break;
    }
    case 'faction': {
      const card = await createFactionCard({
        projectId,
        name: assumption.content.slice(0, 50),
        trueGoal: '',
        publicSlogan: '',
        resources: [],
        representativeCharacterIds: [],
        dailyInterface: '',
      });
      entityId = card.id;
      entityTypeName = 'faction_card';
      break;
    }
    case 'rule':
    default: {
      const rule = await createWorldRule({
        projectId,
        title: assumption.content.slice(0, 50),
        ruleText: assumption.content,
        cost: '',
        enforcer: '',
      });
      entityId = rule.id;
      entityTypeName = 'world_rule';
      break;
    }
  }

  // 更新假设 resolution
  const updatedLayer3 = updateAssumptionResolution(layer3, assumption.id, 'adopted');
  await updateChapterPacketLayers({
    packetId,
    layer3: updatedLayer3,
  });

  // 记录决策日志
  const details = JSON.stringify({
    source: 'from_assumption',
    entityType: entityTypeName,
    entityId,
    assumptionContent: assumption.content,
    riskLevel: assumption.riskLevel,
  });
  await appendDecisionLog({
    projectId,
    operation: 'assumption_adopted',
    summary: `采纳假设: ${assumption.content}`,
    entityType: entityTypeName,
    entityId,
    details,
  });

  return entityId;
}

/**
 * 驳回假设：标记 resolution='rejected' + 记录决策日志。
 *
 * @param packetId 所属 ChapterPacket ID
 * @param projectId 所属项目 ID
 * @param assumption 假设对象
 * @param layer3 当前层 3 JSON 字符串
 */
export async function rejectAssumption(
  packetId: string,
  projectId: string,
  assumption: Assumption,
  layer3: string,
): Promise<void> {
  const updatedLayer3 = updateAssumptionResolution(layer3, assumption.id, 'rejected');
  await updateChapterPacketLayers({
    packetId,
    layer3: updatedLayer3,
  });

  const details = JSON.stringify({
    source: 'from_assumption',
    assumptionContent: assumption.content,
    riskLevel: assumption.riskLevel,
  });
  await appendDecisionLog({
    projectId,
    operation: 'assumption_rejected',
    summary: `驳回假设: ${assumption.content}`,
    entityType: '',
    entityId: '',
    details,
  });
}

// ─── 内部辅助 ───

/**
 * 在 layer3 JSON 中查找假设并更新其 resolution。
 */
function updateAssumptionResolution(
  layer3: string,
  assumptionId: string,
  resolution: 'adopted' | 'rejected',
): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(layer3);
  } catch {
    // 如果 layer3 无效 JSON，记录错误并返回原值
    console.error('[assumption-helper] invalid layer3 JSON:', layer3);
    return layer3;
  }

  const assumptions = parsed.assumptions;
  if (!Array.isArray(assumptions)) {
    return layer3;
  }

  const updatedAssumptions = assumptions.map((a: Record<string, unknown>) => {
    if (a.id === assumptionId) {
      return { ...a, resolution };
    }
    return a;
  });

  parsed.assumptions = updatedAssumptions;
  return JSON.stringify(parsed);
}
