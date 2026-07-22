/**
 * CanvasAiBar — 画板 AI 输入壳 (织梦机 v2 / D2-UX)
 *
 * 底部固定 AI 输入栏。支持 AI 三态真实路由：
 * - discuss  → 只进 ChatDrawer，不写 DB
 * - suggest  → 只出建议卡（AiSuggestionCard），采纳前不写 DB
 * - write_preview → 只进预览（AiWritePreviewPanel），确认前不写正式数据
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, AlertDialog } from '../ui';
import ChatDrawer from './ChatDrawer';
import AiSuggestionCard from './AiSuggestionCard';
import AiWritePreviewPanel from './AiWritePreviewPanel';
import { useProjectStore } from '../../stores/projectStore';
import { useToast } from '../../components/Toast';
import { AI_OUTPUT_BEHAVIORS } from '../../lib/ai-output';
import { DEFAULT_MODELS } from '../../types/ai';
import type { AiOutputType } from '../../lib/ai-output';
import type { AiModel } from '../../types/ai';
import type { ChatMessage } from './ChatDrawer';
import type { ParseResult } from '../../lib/ai/structured-parser';
import { appendDecisionLog } from '../../api/decisionLogApi';
import { listPremiseCards, updatePremiseCard, createPremiseCard } from '../../api/premiseApi';
import { createStructureNode, listStructureNodes } from '../../api/structureApi';
import { createWorldRule } from '../../api/settingApi';
import { createChapterPacket, updateChapterPacketLayers, listChapterPackets } from '../../api/chapterPacketApi';
import { generateChapterPacketFromUpstream } from '../../lib/generateChapterPacket';
import { generateDraftFromChapterPacket } from '../../lib/generateDraft';
import type { GeneratePacketOptions } from '../../lib/generateChapterPacket';
import type { GenerateDraftOptions } from '../../lib/generateDraft';
import { routeAiMessage, fetchAiContext } from '../../api/aiContextApi';
import { listProviderConfigs } from '../../api/aiControlCenterApi';
import { parseStructuredOutput } from '../../lib/ai/structured-parser';
// [v2.1.1-AI] Router replaces direct callLlm imports
import { route, executeLlmCall, RouterError } from '../../lib/ai/command-router';
import './canvas-ai-bar.css';

// ─── Types ───

interface CanvasAiBarProps {
  stage: string;
}

interface SuggestionItem {
  id: string;
  title: string;
  content: string;
  stage: string;
  /** 结构化数据（如 packet 生成的 layer 对象），用于 accept 时直接写入 DB */
  rawWriteData?: unknown;
  /** 结构化解析输出，用于在 AiSuggestionCard 中显示格式化字段 */
  structuredData?: ParseResult;
}

interface PreviewItem {
  content: string;
  title: string;
  subtitle?: string;
  /** 结构化数据，用于 confirm 时直接写入 DB */
  rawWriteData?: unknown;
  /** 结构化解析输出，用于在 AiWritePreviewPanel 中显示格式化字段 */
  structuredData?: ParseResult;
}

const STAGE_NAMES: Record<string, string> = {
  premise: '前提',
  structure: '大纲',
  setting: '设定',
  packet: '细纲',
  text: '正文',
};

let msgIdCounter = 0;
function uid(): string {
  return 'cab_msg_' + (++msgIdCounter);
}

let suggestionIdCounter = 0;
function sugUid(): string {
  return 'cab_sug_' + (++suggestionIdCounter);
}

// ─── Helpers ───

/** 根据画板 stage 将内容写入对应实体（用于 suggest accept / write_preview confirm） */
async function writeAIContentToCanvas(
  stage: string,
  projectId: string,
  title: string,
  content: string,
  rawWriteData?: unknown,
): Promise<void> {
  switch (stage) {
    case 'premise': {
      const premises = await listPremiseCards(projectId);
      if (premises.length > 0) {
        await updatePremiseCard({
          id: premises[0].id,
          premiseText: content,
          readerQuestions: premises[0].readerQuestions,
          storyType: premises[0].storyType,
          status: premises[0].status,
        });
      } else {
        await createPremiseCard({
          projectId,
          premiseText: content,
          readerQuestions: [],
          storyType: '' as any,
          status: 'draft',
        });
      }
      break;
    }
    case 'structure':
      await createStructureNode({
        projectId,
        parentId: null,
        title,
        nodeType: 'chapter',
        narrativeFunction: '',
        summary: content,
        positionX: 0,
        positionY: 0,
        sortOrder: 0,
      });
      break;
    case 'setting':
      await createWorldRule({
        projectId,
        title,
        ruleText: content,
        cost: '',
        enforcer: '',
      });
      break;
    case 'packet': {
      // rawWriteData 包含 AI 生成的完整 packet 结构化数据
      const pd = rawWriteData as Record<string, unknown> | undefined;
      const created = await createChapterPacket({
        projectId,
        structureNodeId: '',
        chapterNumber: 1,
        title: (pd?.title as string) || title,
        line: (pd?.line as string) || '',
        position: (pd?.position as string) || '',
        chapterFunction: (pd?.chapterFunction as string) || '',
      } as any);
      await updateChapterPacketLayers({
        packetId: created.id,
        layer1: pd?.layer1 || {},
        layer2: pd?.layer2 || {},
        layer3: pd?.layer3 || {},
        layer4: pd?.layer4 || {},
        status: 'draft',
      } as any);
      break;
    }
    case 'text': {
      // Write AI-generated text to chapter packet layer4
      // If a chapter packet exists, update it; otherwise create one
      const packets = await listChapterPackets(projectId);
      if (packets.length > 0) {
        const p = packets[0];
        await updateChapterPacketLayers({
          packetId: p.id,
          layer4: JSON.stringify({ aiGeneratedText: content, title }),
          status: 'draft',
        } as any);
      } else {
        const created = await createChapterPacket({
          projectId,
          structureNodeId: '',
          chapterNumber: 1,
          title,
          position: '',
          chapterFunction: '',
        } as any);
        await updateChapterPacketLayers({
          packetId: created.id,
          layer4: JSON.stringify({ aiGeneratedText: content, title }),
          status: 'draft',
        } as any);
      }
      break;
    }
    default:
      break;
  }
}

// ─── Component ───

export default function CanvasAiBar({ stage }: CanvasAiBarProps) {
  // ── Core state ──
  const [input, setInput] = useState('');
  const [aiStatus, setAiStatus] = useState<'checking' | 'ready' | 'unconfigured'>('checking');
  const [activeModel, setActiveModel] = useState<AiModel>(DEFAULT_MODELS[0]);
  const [activeApiKey, setActiveApiKey] = useState('');
  const [outputType, setOutputType] = useState<AiOutputType>('discuss');

  // ── ChatDrawer state ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Suggestion state ──
  const [currentSuggestions, setCurrentSuggestions] = useState<SuggestionItem[]>([]);

  // ── Preview state ──
  const [currentPreview, setCurrentPreview] = useState<PreviewItem | null>(null);

  // ── External ──
  const projectId = useProjectStore(s => s.currentProjectId);
  const { showToast } = useToast();
  const stageName = STAGE_NAMES[stage] || stage;

  // ── Load active model on mount ──
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const hasTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

      // Try v2 AI Control Center config first
      if (hasTauri) {
        try {
          const configs = await listProviderConfigs();
          const activeConfig = configs.find(c => c.isActive) || configs[0];
          if (activeConfig) {
            let models: string[];
            try { models = JSON.parse(activeConfig.models); } catch { models = []; }
            if (models.length > 0) {
              // Try to match against DEFAULT_MODELS by id
              const matched = DEFAULT_MODELS.find(m => models.includes(m.id) || models.includes(m.name));
              if (matched && !cancelled) {
                setActiveModel(matched);
              }
            }
            if (!cancelled) { setAiStatus('ready'); return; }
          }
        } catch {
          // Fall through: no v2 config found
        }
      }

      // Check connection — if we reach here, no provider was configured
      if (!cancelled) {
        setAiStatus('unconfigured');
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  // ── Handler: discuss send (wired through AI Command Router) ──
  const sendDiscuss = useCallback(async (text: string, signal: AbortSignal) => {
    setDrawerOpen(true);
    setChatLoading(true);
    try {
      const hasTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
      const messages: Array<{ role: 'user' | 'system'; content: string }> = [];

      // Try AI Router pipeline: route → context build → call LLM
      if (hasTauri && projectId) {
        try {
          const routeResult = await routeAiMessage({
            message: text,
            canvasId: stage,
            projectId,
          });
          const context = await fetchAiContext({
            canvasId: stage,
            projectId,
            outputType: routeResult.intent,
            additionalPrompt: text,
          });
          const systemContent = context.systemPrompt + '\n\nContext:\n' + context.contextData;
          messages.push({ role: 'system', content: systemContent });
        } catch {
          // Fall through: no AI pipeline available
        }
      }

      messages.push({ role: 'user', content: text });

      // [v2.1.1-AI] Use Router for all AI calls
      const routeOutput = await route({
        message: text,
        canvasId: stage,
        projectId: projectId || '',
        outputType: 'discuss',
      });
      const llmResult = await executeLlmCall(routeOutput, messages, { signal });

      // Try to parse as structured output
      let structuredData: ParseResult | undefined;
      try {
        const schema = JSON.stringify({
          type: 'object',
          properties: { response: { type: 'string' } },
          required: [],
        });
        const parsed = parseStructuredOutput({
          rawContent: llmResult.content,
          schema,
          strict: false,
        });
        if (parsed.status !== 'failed' && parsed.status !== 'fallback') {
          structuredData = parsed;
        }
      } catch {
        // Not structured — use as plain text
      }

      const aiMsg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content: llmResult.content,
        timestamp: Date.now(),
        outputType: 'discuss',
        structuredData,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg = (err as Error).message || '未知错误';
      const aiMsg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content: `AI 回复出错: ${errorMsg}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
      showToast(`AI 调用失败: ${errorMsg}`, 'error');
    } finally {
      setChatLoading(false);
    }
  }, [activeModel, projectId, stage, showToast]);

  // ── Handler: suggest send (wired through AI Command Router + structured parser) ──
  const sendSuggestion = useCallback(async (text: string, signal: AbortSignal) => {
    try {
      const hasTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

      // Try AI Router pipeline first (when Tauri available)
      if (hasTauri && projectId) {
        try {
          const routeResult = await routeAiMessage({
            message: text,
            canvasId: stage,
            projectId,
          });
          const context = await fetchAiContext({
            canvasId: stage,
            projectId,
            outputType: routeResult.intent,
            additionalPrompt: text,
          });

          const systemContent = context.systemPrompt + '\n\nContext:\n' + context.contextData;

          // [v2.1.1-AI] Use Router for all AI calls
          const routeOutput = await route({
            message: text,
            canvasId: stage,
            projectId,
            outputType: 'suggest',
          });
          const llmResult = await executeLlmCall(routeOutput, [
            { role: 'system' as const, content: systemContent },
            { role: 'user' as const, content: text },
          ], { signal });

          // Parse output with structured parser
          let structuredData: ParseResult | undefined;
          try {
            const parsed = parseStructuredOutput({
              rawContent: llmResult.content,
              schema: JSON.stringify({
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  suggestion: { type: 'string' },
                  reasoning: { type: 'string' },
                  alternatives: { type: 'array' },
                },
                required: [],
              }),
              strict: false,
            });
            if (parsed.status !== 'failed' && parsed.status !== 'fallback') {
              structuredData = parsed;
            }
          } catch {
            // Not structured — display as plain text
          }

          const titleText = structuredData?.data?.title
            ? String(structuredData.data.title)
            : (llmResult.content.slice(0, 60) + (llmResult.content.length > 60 ? '...' : ''));

          setCurrentSuggestions(prev => [...prev, {
            id: sugUid(),
            title: titleText,
            content: llmResult.content,
            stage,
            structuredData,
          }]);
          return;
        } catch {
          // Fall through to stage-specific branching
        }
      }

      // Fallback: stage-specific branch (existing behavior)
      // For packet stage, use specialized generator (without DB write)
      if (stage === 'packet' && projectId) {
        try {
          const nodes = await listStructureNodes(projectId);
          const chapterNodes = nodes.filter(n => n.nodeType === 'chapter');
          const nodeId = chapterNodes.length > 0 ? chapterNodes[0].id : '';
          const chapterNumber = 1; // Default for suggestions

          const options: GeneratePacketOptions = {
            projectId,
            structureNodeId: nodeId,
            chapterNumber,
            model: activeModel,
            outputType: 'suggest',
            signal,
          };

          const result = await generateChapterPacketFromUpstream(options);

          if ('packetData' in result) {
            const titleText = result.packetData.title || `细纲生成建议`;
            const contentText = JSON.stringify(result.packetData, null, 2);
            setCurrentSuggestions(prev => [...prev, {
              id: sugUid(),
              title: titleText,
              content: contentText,
              stage: 'packet',
              rawWriteData: result.packetData,
            }]);
          }
          return;
        } catch {
          // Fall through to generic AI call
        }
      }

      // For text stage, use draft generator (no DB write)
      if (stage === 'text' && projectId) {
        try {
          const packets = await listChapterPackets(projectId);
          if (packets.length > 0) {
            const packet = packets[0];
            const draftOptions: GenerateDraftOptions = {
              packet,
              model: activeModel,
              outputType: 'suggest',
              signal,
            };
            const draftContent = await generateDraftFromChapterPacket(draftOptions);
            setCurrentSuggestions(prev => [...prev, {
              id: sugUid(),
              title: `正文建议 — ${packet.title}`,
              content: draftContent,
              stage: 'text',
            }]);
            return;
          }
        } catch {
          // Fall through to generic AI call
        }
      }

      // [v2.1.1-AI] Generic fallback: use Router
      const routeOutput = await route({
        message: text,
        canvasId: stage,
        projectId: projectId || '',
        outputType: 'suggest',
      });
      const llmResult = await executeLlmCall(routeOutput, [
        { role: 'user' as const, content: text },
      ], { signal });
      setCurrentSuggestions(prev => [...prev, {
        id: sugUid(),
        title: llmResult.content.slice(0, 60) + (llmResult.content.length > 60 ? '...' : ''),
        content: llmResult.content,
        stage,
      }]);
    } catch (err) {
      showToast(`AI 建议生成失败: ${(err as Error).message}`, 'error');
    }
  }, [stage, projectId, activeModel, showToast]);

  // ── Handler: write_preview send (wired through AI Command Router + structured parser) ──
  const sendPreview = useCallback(async (text: string, signal: AbortSignal) => {
    try {
      const hasTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

      // Try AI Router pipeline first
      if (hasTauri && projectId) {
        try {
          const routeResult = await routeAiMessage({
            message: text,
            canvasId: stage,
            projectId,
          });
          const context = await fetchAiContext({
            canvasId: stage,
            projectId,
            outputType: routeResult.intent,
            additionalPrompt: text,
          });

          // [v2.1.1-AI] Use Router for all AI calls
          const routeOutput = await route({
            message: text,
            canvasId: stage,
            projectId,
            outputType: 'write_preview',
          });
          const llmResult = await executeLlmCall(routeOutput, [
            { role: 'system' as const, content: context.systemPrompt + '\n\nContext:\n' + context.contextData },
            { role: 'user' as const, content: text },
          ], { signal });

          // Parse output with structured parser
          let structuredData: ParseResult | undefined;
          try {
            const parsed = parseStructuredOutput({
              rawContent: llmResult.content,
              schema: JSON.stringify({
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  content: { type: 'string' },
                  summary: { type: 'string' },
                  sections: { type: 'array' },
                },
                required: [],
              }),
              strict: false,
            });
            if (parsed.status !== 'failed' && parsed.status !== 'fallback') {
              structuredData = parsed;
            }
          } catch {
            // Not structured — use as plain text
          }

          const titleText = structuredData?.data?.title
            ? String(structuredData.data.title)
            : 'AI 生成预览';

          setCurrentPreview({
            content: llmResult.content,
            title: titleText,
            subtitle: `基于「${text}」生成`,
            structuredData,
          });
          return;
        } catch {
          // Fall through to stage-specific branching
        }
      }

      // Fallback: stage-specific branch (existing behavior)
      // For packet stage, use specialized generator (without DB write)
      if (stage === 'packet' && projectId) {
        try {
          const nodes = await listStructureNodes(projectId);
          const chapterNodes = nodes.filter(n => n.nodeType === 'chapter');
          const nodeId = chapterNodes.length > 0 ? chapterNodes[0].id : '';

          const options: GeneratePacketOptions = {
            projectId,
            structureNodeId: nodeId,
            chapterNumber: 1,
            model: activeModel,
            outputType: 'write_preview',
            signal,
          };

          const result = await generateChapterPacketFromUpstream(options);

          if ('packetData' in result) {
            const titleText = result.packetData.title || `细纲生成预览`;
            const contentText = JSON.stringify(result.packetData, null, 2);
            setCurrentPreview({
              content: contentText,
              title: titleText,
              subtitle: `基于「${text}」生成`,
              rawWriteData: result.packetData,
            });
          }
          return;
        } catch {
          // Fall through to generic AI call
        }
      }

      // For text stage, use draft generator (no DB write)
      if (stage === 'text' && projectId) {
        try {
          const packets = await listChapterPackets(projectId);
          if (packets.length > 0) {
            const packet = packets[0];
            const draftOptions: GenerateDraftOptions = {
              packet,
              model: activeModel,
              outputType: 'write_preview',
              signal,
            };
            const draftContent = await generateDraftFromChapterPacket(draftOptions);
            setCurrentPreview({
              content: draftContent,
              title: `正文预览 — ${packet.title}`,
              subtitle: '基于细纲包生成',
            });
            return;
          }
        } catch {
          // Fall through to generic AI call
        }
      }

      // [v2.1.1-AI] Generic fallback: use Router
      const routeOutput = await route({
        message: text,
        canvasId: stage,
        projectId: projectId || '',
        outputType: 'write_preview',
      });
      const llmResult = await executeLlmCall(routeOutput, [
        { role: 'user' as const, content: text },
      ], { signal });
      setCurrentPreview({
        content: llmResult.content,
        title: 'AI 生成预览',
        subtitle: `基于「${text}」生成`,
      });
    } catch (err) {
      showToast(`AI 生成失败: ${(err as Error).message}`, 'error');
    }
  }, [stage, projectId, activeModel, showToast]);

  // ── Handler: Accept suggestion ──
  const handleAcceptSuggestion = useCallback(async (suggestionId: string) => {
    const suggestion = currentSuggestions.find(s => s.id === suggestionId);
    if (!suggestion || !projectId) return;

    try {
      // Write to appropriate canvas with raw data if available
      await writeAIContentToCanvas(
        suggestion.stage,
        projectId,
        suggestion.title,
        suggestion.content,
        suggestion.rawWriteData,
      );

      // Append decision log
      await appendDecisionLog({
        projectId,
        operation: 'ai_suggestion_accepted',
        summary: `采纳 AI 建议: ${suggestion.title.slice(0, 100)}`,
        entityType: suggestion.stage,
        details: suggestion.content.slice(0, 500),
      });

      showToast('建议已采纳并写入画板', 'success');
    } catch (err) {
      showToast(`采纳失败: ${(err as Error).message}`, 'error');
    } finally {
      setCurrentSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    }
  }, [currentSuggestions, projectId, showToast]);

  // ── Handler: Dismiss suggestion ──
  const handleDismissSuggestion = useCallback(async (suggestionId: string) => {
    const suggestion = currentSuggestions.find(s => s.id === suggestionId);
    if (!suggestion || !projectId) return;

    try {
      await appendDecisionLog({
        projectId,
        operation: 'ai_suggestion_rejected',
        summary: `驳回 AI 建议: ${suggestion.title.slice(0, 100)}`,
        entityType: suggestion.stage,
        details: '',
      });
    } catch {
      // Silent: log is non-critical
    } finally {
      setCurrentSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    }
  }, [currentSuggestions, projectId]);

  // ── Handler: Confirm preview ──
  const handleConfirmPreview = useCallback(async () => {
    if (!currentPreview || !projectId) return;

    try {
      // Write to canvas with raw data if available
      await writeAIContentToCanvas(
        stage,
        projectId,
        currentPreview.title,
        currentPreview.content,
        currentPreview.rawWriteData,
      );

      // Append decision log
      await appendDecisionLog({
        projectId,
        operation: 'write_preview_confirmed',
        summary: `确认 AI 写入: ${currentPreview.title.slice(0, 100)}`,
        entityType: stage,
        details: currentPreview.content.slice(0, 500),
      });

      showToast('内容已确认写入', 'success');
    } catch (err) {
      showToast(`确认写入失败: ${(err as Error).message}`, 'error');
    } finally {
      setCurrentPreview(null);
    }
  }, [currentPreview, projectId, stage, showToast]);

  // ── Handler: Abandon preview ──
  const handleAbandonPreview = useCallback(async () => {
    if (!currentPreview || !projectId) return;

    try {
      await appendDecisionLog({
        projectId,
        operation: 'write_preview_rejected',
        summary: `放弃 AI 写入: ${currentPreview.title.slice(0, 100)}`,
        entityType: stage,
        details: '',
      });
    } catch {
      // Silent
    } finally {
      setCurrentPreview(null);
    }
  }, [currentPreview, projectId, stage]);

  // ── Main send handler ──
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || aiStatus !== 'ready' || isGenerating) return;

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      outputType,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGenerating(true);
    try {
      switch (outputType) {
        case 'discuss':
          await sendDiscuss(text, controller.signal);
          break;
        case 'suggest':
          await sendSuggestion(text, controller.signal);
          break;
        case 'write_preview':
          await sendPreview(text, controller.signal);
          break;
      }
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setIsGenerating(false);
    }
  }, [input, aiStatus, isGenerating, outputType, sendDiscuss, sendSuggestion, sendPreview]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // ── Keyboard handler ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // ── Chat handlers ──
  const handleClearChat = useCallback(() => {
    setMessages([]);
  }, []);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen(prev => !prev);
  }, []);

  // ── Output type selector style helper ──
  const outputTypeStyle = (type: AiOutputType): React.CSSProperties => ({
    padding: '3px 8px',
    borderRadius: 4,
    border: `1px solid ${outputType === type ? 'var(--accent, #B7FF00)' : 'var(--border-default, #2a2a2a)'}`,
    background: outputType === type ? 'rgba(183,255,0,0.12)' : 'transparent',
    color: outputType === type ? 'var(--accent, #B7FF00)' : 'var(--text-muted, #888)',
    cursor: 'pointer',
    fontSize: '0.65rem',
    fontWeight: outputType === type ? 600 : 400,
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  });

  return (
    <>
      <div className="canvas-ai-bar">
        <div className="canvas-ai-bar-stage">
          <span
            className="canvas-ai-bar-dot"
            style={{
              background:
                aiStatus === 'ready' ? '#4CAF50' :
                aiStatus === 'unconfigured' ? '#f44336' :
                '#888',
            }}
          />
          {stageName} 画板
        </div>

        {/* Output type selector */}
        <div style={{
          display: 'flex',
          gap: 4,
          flexShrink: 0,
        }}>
          {(['discuss', 'suggest', 'write_preview'] as AiOutputType[]).map(type => (
            <button
              key={type}
              onClick={() => setOutputType(type)}
              style={outputTypeStyle(type)}
              title={AI_OUTPUT_BEHAVIORS[type].description}
            >
              {AI_OUTPUT_BEHAVIORS[type].label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            aiStatus === 'checking' ? '检测 AI 连接...' :
            aiStatus === 'ready'
              ? `输入指令 (${AI_OUTPUT_BEHAVIORS[outputType].effect})`
              : 'AI 未配置，请前往设置 API Key'
          }
          disabled={aiStatus !== 'ready' || isGenerating}
          className="canvas-ai-bar-input"
        />
        {messages.length > 0 && (
          <Button
            variant="ghost"
            onClick={toggleDrawer}
            size="sm"
            style={{ fontSize: '0.6875rem', whiteSpace: 'nowrap' }}
          >
            {drawerOpen ? '关闭聊天' : `聊天 (${messages.length})`}
          </Button>
        )}
        {currentSuggestions.length > 0 && (
          <span style={{
            fontSize: '0.65rem',
            color: 'var(--accent, #B7FF00)',
            whiteSpace: 'nowrap',
            background: 'rgba(183,255,0,0.08)',
            padding: '2px 8px',
            borderRadius: 4,
          }}>
            {currentSuggestions.length} 条建议
          </span>
        )}
        {isGenerating && (
          <Button variant="ghost" onClick={handleCancel} size="sm">
            停止
          </Button>
        )}
        <Button
          variant="primary"
          onClick={handleSend}
          disabled={aiStatus !== 'ready' || !input.trim() || isGenerating}
          size="sm"
        >
          {isGenerating ? '生成中…' : '发送'}
        </Button>
      </div>

      {/* ChatDrawer */}
      <ChatDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        messages={messages}
        loading={chatLoading}
        onClear={handleClearChat}
      />

      {/* AiSuggestionCards — rendered inline near the bar */}
      {currentSuggestions.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          width: '90%',
          maxWidth: 560,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {currentSuggestions.map(sug => (
            <AiSuggestionCard
              key={sug.id}
              id={sug.id}
              title={sug.title}
              content={sug.content}
              target={STAGE_NAMES[sug.stage] || sug.stage}
              structuredData={sug.structuredData}
              onAccept={handleAcceptSuggestion}
              onDismiss={handleDismissSuggestion}
            />
          ))}
        </div>
      )}

      {/* AiWritePreviewPanel */}
      <AiWritePreviewPanel
        content={currentPreview?.content || ''}
        title={currentPreview?.title || ''}
        subtitle={currentPreview?.subtitle}
        structuredData={currentPreview?.structuredData}
        open={currentPreview !== null}
        onConfirm={handleConfirmPreview}
        onAbandon={handleAbandonPreview}
      />
    </>
  );
}
