/**
 * writer-agent.ts — Writer Agent 调用器
 *
 * 在 AI 生成文本后，自动过 Writer Agent 的 skill 链
 * （CS-25~32 现场写作 + CS-01~04 审美打磨），
 * 输出方法论诊断报告。
 */

import { callLlm } from '../llm-client';
import { getSkillChain } from './prompt-registry';

export interface WriterAgentReport {
  skillId: string;
  skillName: string;
  score: number;
  findings: string[];
  suggestions: string[];
}

/**
 * 对生成的文本运行 Writer Agent skill 链。
 * 逐 skill 调用本地 LLM 诊断，产出完整报告。
 */
export async function runWriterAgent(text: string): Promise<{
  reports: WriterAgentReport[];
  summary: string;
}> {
  const skills = getSkillChain('writer');
  const reports: WriterAgentReport[] = [];

  const model = {
    id: 'qwen3:8b', name: 'qwen3:8b', providerId: 'ollama',
    providerName: 'Ollama', description: '本地 Qwen 38B',
    costPer1KTokens: 0, icon: '🖥️', available: true,
  };

  for (const skill of skills) {
    try {
      const result = await callLlm([
        { role: 'system', content: skill.systemPrompt },
        { role: 'user', content: `请分析以下文本：\n\n${text.slice(0, 3000)}` },
      ], { model, apiKey: '', timeout: 30000 });

      let data: Record<string, unknown> = {};
      try { data = JSON.parse(result.content); } catch { /* skip */ }

      reports.push({
        skillId: skill.id,
        skillName: skill.name,
        score: (data.score || data.concreteScore || data.consistencyScore || data.measureScore || data.focusScore || data.rhythmScore || data.emotionScore || data.reserveScore || data.complexityScore || data.intensityScore || data.presenceScore || data.dialogueFunctionScore || 0.5) as number,
        findings: (() => {
          const d = data as any;
          const items: string[] = d.断裂标记 || d.anomalies || d.redundantSentences || d.overExplained || d.decorativeItems || [];
          const thin: string[] = d.thinPerspectives || [];
          return [...items.map(String), ...thin.map(String)];
        })(),
        suggestions: ([] as string[]).concat(
          ...((Array.isArray(data.suggestions) ? data.suggestions : []) as string[]),
          ...((Array.isArray(data.裁剪建议) ? data.裁剪建议 : []) as string[]).map((s: any) => typeof s === 'string' ? s : (s.content || JSON.stringify(s))),
        ),
      });
    } catch (err) {
      reports.push({ skillId: skill.id, skillName: skill.name, score: 0, findings: ['诊断调用失败'], suggestions: [] });
    }
  }

  const avgScore = reports.reduce((s, r) => s + r.score, 0) / Math.max(reports.length, 1);
  const lowScoreItems = reports.filter(r => r.score < 0.6).map(r => `${r.skillName}(${Math.round(r.score * 100)}分)`);

  return {
    reports,
    summary: lowScoreItems.length > 0
      ? `Writer Agent 诊断完成。${lowScoreItems.length} 项需关注：${lowScoreItems.join('、')}`
      : `Writer Agent 诊断完成。所有维度评分良好（平均${Math.round(avgScore * 100)}分）。`,
  };
}
