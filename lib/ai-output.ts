/**
 * ai-output.ts — AI 输出三态枚举与行为定义 (织梦机 v2 / D2-UX)
 *
 * 不绑定到任何画板数据——这是 AI 调用时的参数行为。
 * 由 D1 的 contract 层定义，供前端 UI 和生成函数使用。
 */

export type AiOutputType = 'discuss' | 'suggest' | 'write_preview'
  | 'generatePacket' | 'generateDraft' | 'assumption_flow';

export interface AiOutputBehavior {
  type: AiOutputType;
  label: string;
  description: string;
  effect: string;
}

export const AI_OUTPUT_BEHAVIORS: Record<AiOutputType, AiOutputBehavior> = {
  discuss: {
    type: 'discuss',
    label: '讨论',
    description: 'AI 仅以对话形式回复，不影响任何画板数据',
    effect: '不影响画板数据，仅出现在对话气泡中',
  },
  suggest: {
    type: 'suggest',
    label: '建议',
    description: 'AI 以建议卡形式展示，用户采纳后才写入画板',
    effect: '用户采纳后才写入画板数据',
  },
  write_preview: {
    type: 'write_preview',
    label: '写入预览',
    description: 'AI 直接填入画板字段，但需用户确认后才正式生效',
    effect: '用户确认后才写入画板数据',
  },
  generatePacket: {
    type: 'generatePacket',
    label: '生成章节包',
    description: 'AI 根据上下文自动生成或扩写章节包四层内容',
    effect: '直接写入章节包对应层级，用户可后续修改',
  },
  generateDraft: {
    type: 'generateDraft',
    label: '生成正文草稿',
    description: 'AI 基于章节包和设定生成正文段落',
    effect: '写入正文草稿区，用户可后续编辑',
  },
  assumption_flow: {
    type: 'assumption_flow',
    label: '临时假设流程',
    description: 'AI 以临时假设模式工作，不影响正式数据',
    effect: '临时数据保存在假设层，采纳后才写入正式数据',
  },
};
