/**
 * detail-mode-prompt.ts — DetailMode AI 提示词注入
 *
 * 根据 detailMode 调整 AI 生成提示词中的颗粒度指示。
 * 用于画板④ AI 生成细纲包时控制输出粒度。
 */

import type { DetailMode } from '../../../contracts/chapter-packet.contract';

/**
 * 根据模式返回对应的 AI 提示词指令。
 */
export function getDetailModeInstruction(mode: DetailMode): string {
  switch (mode) {
    case 'sketch':
      return '请输出简洁的摘要格式，每部分1-2句话，重点突出核心信息。';
    case 'refined':
      return '请输出详细格式，包含子章节、具体描述和分点说明，字数不低于标准输出的2倍。';
    case 'standard':
    default:
      return '请输出标准格式，平衡详细程度和可读性。';
  }
}
