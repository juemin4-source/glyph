import { useState, useRef, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { User, Bot, X, Globe, Landmark, MapPin, FileText, Package } from 'lucide-react';
import type { WorldObject } from '../../types/world';
import type { Message, DocCardData, AiModel } from '../../types/ai';
import { DEFAULT_MODELS } from '../../types/ai';
import DocCard from './DocCard';
// [v2.1.1-AI] Router handles all AI calls including streaming
import * as api from '../../tauri-api';

const CANON_DOT_COLORS: Record<string, string> = {
  '核心正典': '#FFB74D',
  '项目正典': '#90CAF9',
  '草案正典': '#CE93D8',
  '未收录': '#666',
};

// ── System Prompt Builder ──
function buildSystemPrompt(focusObject: WorldObject | null): string {
  let prompt = `你是织梦机 AI 助手，帮助用户进行世界构建和叙事创作。

## 支持的对象类型
- 人物：角色设定、背景故事、性格特征
- 地点：场景描述、地理环境
- 组织：势力结构、派系关系
- 规则/机制：世界观规则、魔法系统、科技设定
- 事件：历史事件、剧情节点
- 物品：重要道具、特殊物品
- 术语：专有名词、概念定义

## 正典等级
- 核心正典：不可更改的设定
- 项目正典：当前项目确定的设定
- 草案正典：待讨论的初步设定
- 未收录：临时想法，未正式收录

## 回复格式
- 使用 Markdown 格式回复
- 对于可结构化的内容（人物、地点、组织等），请用 JSON 代码块标记结构化数据，格式为：
  \`\`\`json
  {
    "title": "名称",
    "type": "world|org|character|location|item|term",
    "typeLabel": "设定|组织|角色|地点|物品|术语",
    "status": "草案",
    "bodyHTML": "描述内容",
    "sections": [{"title": "章节标题", "content": "章节内容"}]
  }
  \`\`\``;

  if (focusObject) {
    prompt += `\n\n## 当前聚焦对象
用户正在关注以下对象：
- 名称：${focusObject.name}
- 类型：${focusObject.type}
- 正典等级：${focusObject.canonLevel}
- 标签：${focusObject.tags.join('、') || '无'}
- 内容：${focusObject.content || '暂无内容'}`;
  }

  return prompt;
}

// ── DocCard Extraction ──
function extractDocCards(content: string): DocCardData[] {
  const cards: DocCardData[] = [];
  const jsonBlockRegex = /```json\s*([\s\S]*?)```/g;
  let match;
  let idx = 0;
  while ((match = jsonBlockRegex.exec(content)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      if (data.title && data.bodyHTML !== undefined) {
        cards.push({
          id: 'doc_' + Date.now() + '_' + (idx++),
          type: data.type || 'world',
          typeLabel: data.typeLabel || '设定',
          title: data.title,
          status: data.status || '草案',
          bodyHTML: data.bodyHTML,
          sections: data.sections || [],
        });
      }
    } catch { /* skip invalid JSON blocks */ }
  }
  return cards;
}

// ── Safe Markdown Renderer ──
function renderMarkdown(text: string): ReactNode {
  if (!text) return null;
  const parts: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const codeBlockMatch = remaining.match(/```(\w*)\n?([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch.index !== undefined && codeBlockMatch.index >= 0) {
      if (codeBlockMatch.index > 0) {
        parts.push(renderInline(remaining.slice(0, codeBlockMatch.index), key++));
      }
      const lang = codeBlockMatch[1] || '';
      const code = codeBlockMatch[2].replace(/\n$/, '');
      parts.push(
        <pre key={key++} style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '12px 16px', overflow: 'auto', fontSize: '0.8125rem', lineHeight: 1.5, margin: '8px 0' }}>
          {lang ? <div style={{ fontSize: '0.6875rem', color: '#666', marginBottom: 6 }}>{lang}</div> : null}
          <code style={{ fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'pre', color: '#e0e0e0' }}>{code}</code>
        </pre>
      );
      remaining = remaining.slice(codeBlockMatch.index + codeBlockMatch[0].length);
    } else {
      parts.push(renderInline(remaining, key++));
      remaining = '';
    }
  }

  return <>{parts}</>;
}

function renderInline(text: string, keyBase: number): ReactNode {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  if (paragraphs.length === 0) {
    return renderFormatted(text.trim(), String(keyBase));
  }
  return paragraphs.map((p, i) => {
    const trimmed = p.trim();
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/m);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const fontSize = ['1.5rem', '1.25rem', '1.1rem', '1rem', '0.9375rem', '0.875rem'][level - 1];
      return (
        <div key={`${keyBase}-h${i}`} style={{ fontSize, fontWeight: 600, color: 'var(--text-primary, #e0e0e0)', margin: '12px 0 6px', lineHeight: 1.4 }}>
          {renderFormatted(headingMatch[2], `${keyBase}-h${i}`)}
        </div>
      );
    }
    if (/^[-*]\s+/.test(trimmed)) {
      const items = trimmed.split('\n').filter(l => /^[-*]\s+/.test(l.trim())).map(l => l.trim().replace(/^[-*]\s+/, ''));
      return (
        <ul key={`${keyBase}-ul${i}`} style={{ margin: '6px 0', paddingLeft: 20, color: 'var(--text-primary, #e0e0e0)', fontSize: '0.875rem', lineHeight: 1.6 }}>
          {items.map((item, j) => <li key={j}>{renderFormatted(item, `${keyBase}-li${j}`)}</li>)}
        </ul>
      );
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = trimmed.split('\n').filter(l => /^\d+\.\s+/.test(l.trim())).map(l => l.trim().replace(/^\d+\.\s+/, ''));
      return (
        <ol key={`${keyBase}-ol${i}`} style={{ margin: '6px 0', paddingLeft: 20, color: 'var(--text-primary, #e0e0e0)', fontSize: '0.875rem', lineHeight: 1.6 }}>
          {items.map((item, j) => <li key={j}>{renderFormatted(item, `${keyBase}-li${j}`)}</li>)}
        </ol>
      );
    }
    if (/^---+\s*$/.test(trimmed)) {
      return <hr key={`${keyBase}-hr${i}`} style={{ border: 'none', borderTop: '1px solid var(--border-default, #2a2a2a)', margin: '16px 0' }} />;
    }
    return (
      <p key={`${keyBase}-p${i}`} style={{ margin: '6px 0', lineHeight: 1.6 }}>
        {renderFormatted(trimmed, `${keyBase}-p${i}`)}
      </p>
    );
  });
}

function renderFormatted(text: string, key: string): ReactNode {
  const parts: ReactNode[] = [];
  let remaining = text;
  let idx = 0;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/`([^`]+)`/);
    if (codeMatch && codeMatch.index !== undefined && codeMatch.index >= 0) {
      if (codeMatch.index > 0) parts.push(<span key={`${key}-t${idx++}`}>{remaining.slice(0, codeMatch.index)}</span>);
      parts.push(
        <code key={`${key}-c${idx++}`} style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', color: '#CE93D8' }}>
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
      continue;
    }
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch && linkMatch.index !== undefined && linkMatch.index >= 0) {
      if (linkMatch.index > 0) parts.push(<span key={`${key}-t${idx++}`}>{remaining.slice(0, linkMatch.index)}</span>);
      parts.push(
        <a key={`${key}-l${idx++}`} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent, #B7FF00)', textDecoration: 'underline' }}>
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch.index + linkMatch[0].length);
      continue;
    }
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    if (boldMatch && boldMatch.index !== undefined && boldMatch.index >= 0) {
      if (boldMatch.index > 0) parts.push(<span key={`${key}-t${idx++}`}>{remaining.slice(0, boldMatch.index)}</span>);
      parts.push(<strong key={`${key}-b${idx++}`} style={{ fontWeight: 700, color: 'var(--text-primary, #e0e0e0)' }}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }
    const italicMatch = remaining.match(/\*([^*]+)\*/);
    if (italicMatch && italicMatch.index !== undefined && italicMatch.index >= 0) {
      if (italicMatch.index > 0) parts.push(<span key={`${key}-t${idx++}`}>{remaining.slice(0, italicMatch.index)}</span>);
      parts.push(<em key={`${key}-i${idx++}`} style={{ fontStyle: 'italic', color: '#a0a0a0' }}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
      continue;
    }
    const brMatch = remaining.match(/^([^\n]*)\n/);
    if (brMatch && brMatch.index !== undefined && brMatch.index >= 0) {
      if (brMatch[1]) parts.push(<span key={`${key}-t${idx++}`}>{brMatch[1]}</span>);
      parts.push(<br key={`${key}-br${idx++}`} />);
      remaining = remaining.slice(brMatch.index + brMatch[0].length);
      continue;
    }
    parts.push(<span key={`${key}-t${idx++}`}>{remaining}</span>);
    remaining = '';
  }

  return <>{parts}</>;
}

// ── Type mapping for DocCard → WorldObject ──
const DOC_TYPE_TO_OBJECT_TYPE: Record<string, string> = {
  'world': '规则/机制',
  'org': '组织',
  'character': '人物',
  'location': '地点',
  'item': '物品',
  'term': '术语',
};

interface AIChatProps {
  allObjects: WorldObject[];
  activeBookId: string | null;
  onNavigate: (name: string, id?: string) => void;
  onUpdateObject?: (id: string, updates: Partial<WorldObject>) => void;
  onShowToast?: (message: string, type?: 'info' | 'success' | 'error') => void;
  onCreateObject?: (templateType: string) => void;
}

let msgIdCounter = 0;
function uid(): string { return 'msg_' + (++msgIdCounter); }

export default function AIChat({ allObjects, activeBookId, onNavigate, onUpdateObject, onShowToast, onCreateObject }: AIChatProps) {
  // ── localStorage persistence ──
  const storageKey = useMemo(() => `glyph_ai_messages_${activeBookId || 'global'}`, [activeBookId]);

  const [messages, setMessages] = useState<Message[]>(() => {
    msgIdCounter = 0;
    try {
      const key = `glyph_ai_messages_${activeBookId || 'global'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore localStorage errors */ }
    return [
      {
        id: uid(), role: 'assistant',
        content: '你好！我是织梦机的 AI 助手。我可以帮你创建世界观、设计角色、展开设定——所有生成的内容都会以文档卡片的形式直接嵌入对话中，你可以随时编辑和收录。',
        timestamp: Date.now(),
      },
    ];
  });

  // Persist messages to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch { /* ignore storage errors */ }
  }, [messages, storageKey]);

  const [isLoading, setIsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [focusObjectId, setFocusObjectId] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<AiModel>(DEFAULT_MODELS[0]);
  const [tokenCount, setTokenCount] = useState(0);
  const [sessionTokens, setSessionTokens] = useState({ in: 0, out: 0 });
  const [showModelPicker, setShowModelPicker] = useState(false);

  const AVAILABLE_MODELS: AiModel[] = [
    { id: 'auto', name: 'FreeLLMAPI (Auto)', providerId: 'free_llm_api', providerName: 'FreeLLMAPI', description: '128K context · auto-routed', costPer1KTokens: 0, icon: '⚡', available: true },
    { id: 'gpt-4o', name: 'GPT-4o', providerId: 'openai', providerName: 'OpenAI', description: '128K context · GPT-4o', costPer1KTokens: 0.01, icon: '🤖', available: true },
    { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', providerId: 'anthropic', providerName: 'Anthropic', description: '200K context · Claude 3.5 Sonnet', costPer1KTokens: 0.015, icon: '🧠', available: true },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', providerId: 'google', providerName: 'Google', description: '1M context · Gemini 2.0 Flash', costPer1KTokens: 0, icon: '✨', available: true },
    { id: 'glm-4-plus', name: 'GLM-4-Plus', providerId: 'zhipu', providerName: '智谱清言', description: '智谱 AI · GLM-4-Plus', costPer1KTokens: 0, icon: '🧪', available: true },
    { id: 'glm-4-flash', name: 'GLM-4-Flash', providerId: 'zhipu', providerName: '智谱清言', description: '智谱 AI · GLM-4-Flash 免费', costPer1KTokens: 0, icon: '🧪', available: true },
    { id: 'qwen3:8b', name: 'Qwen3 8B (本地)', providerId: 'ollama', providerName: 'Ollama', description: '本地 · Ollama Qwen3 8B', costPer1KTokens: 0, icon: '💻', available: true },
  ];
  const [inputText, setInputText] = useState('');
  const [showNewChatConfirm, setShowNewChatConfirm] = useState(false);

  const convScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const outlineGroups = useMemo(() => {
    const groups: Array<{ label: string; icon: ReactNode; items: WorldObject[] }> = [
      { label: '世界观', icon: <Globe size={14} />, items: allObjects.filter(o => o.type === '规则/机制' && o.status !== '废弃' && o.status !== '草稿') },
      { label: '组织', icon: <Landmark size={14} />, items: allObjects.filter(o => o.type === '组织' && o.status !== '废弃') },
      { label: '地点', icon: <MapPin size={14} />, items: allObjects.filter(o => o.type === '地点' && o.status !== '废弃') },
      { label: '人物', icon: <User size={14} />, items: allObjects.filter(o => o.type === '人物' && o.status !== '废弃') },
      { label: '章节', icon: <FileText size={14} />, items: allObjects.filter(o => o.type === '章节') },
      { label: '其他', icon: <Package size={14} />, items: allObjects.filter(o => ['事件', '物品', '术语'].includes(o.type) && o.status !== '废弃') },
    ].filter(g => g.items.length > 0);
    return groups;
  }, [allObjects]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (convScrollRef.current) {
        convScrollRef.current.scrollTop = convScrollRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // ── Focus / Outline Click ──
  const handleOutlineClick = useCallback((obj: WorldObject) => {
    if (focusObjectId === obj.id) {
      setFocusObjectId(null);
    } else {
      setFocusObjectId(obj.id);
      onNavigate(obj.name, obj.id);
    }
  }, [focusObjectId, onNavigate]);

  const clearFocus = useCallback(() => { setFocusObjectId(null); }, []);

  // ── Send Message (streaming + system prompt) ──
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;
    setInputText('');
    if (inputRef.current) { inputRef.current.style.height = 'auto'; }

    const userMsg: Message = { id: uid(), role: 'user', content: text, timestamp: Date.now() };

    // Build system prompt with focus context if available
    const focusObject = focusObjectId ? (allObjects.find(o => o.id === focusObjectId) || null) : null;
    const systemPrompt = buildSystemPrompt(focusObject);
    const systemMsg: Message = { id: uid(), role: 'system', content: systemPrompt, timestamp: Date.now() };

    // API messages: system prompt + conversation history + current user message
    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
      { role: 'user' as const, content: text },
    ];

    // Optimistically add user message to UI
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Insert placeholder assistant message for streaming
      const placeholderId = uid();
      setMessages(prev => [...prev, { id: placeholderId, role: 'assistant', content: '', timestamp: Date.now() }]);

      // [v2.1.1-AI] Use Router for all AI calls including streaming
      const { route: routerRoute, executeLlmCall } = await import('../../lib/ai/command-router');
      const routeOutput = await routerRoute({
        message: text,
        canvasId: 'chat',
        projectId: 'ai-settings',
        outputType: 'discuss',
        providerId: activeModel.providerId,
        modelId: activeModel.id,
      });
      const llmResult = await executeLlmCall(
        routeOutput,
        apiMessages,
        {
          onToken: (token) => {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant') {
                const updated = [...prev];
                updated[updated.length - 1] = { ...last, content: last.content + token };
                return updated;
              }
              return prev;
            });
          },
        },
      );

      // After streaming completes, extract DocCards from the full response
      const docs = extractDocCards(llmResult.content);
      if (docs.length > 0) {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, docs };
          }
          return updated;
        });
      }

      setSessionTokens(prev => ({ in: prev.in + llmResult.tokensIn, out: prev.out + llmResult.tokensOut }));
      setTokenCount(prev => prev + llmResult.tokensIn + llmResult.tokensOut);
    } catch (err) {
      // Remove empty placeholder if streaming failed before any content
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });

      const errorMsg: Message = {
        id: uid(), role: 'assistant',
        content: '抱歉，AI 调用出错了: ' + (err instanceof Error ? err.message : '未知错误'),
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
      if (onShowToast) onShowToast('AI 调用失败', 'error');
    }
    setIsLoading(false);
  }, [inputText, isLoading, activeModel, messages, focusObjectId, allObjects, onShowToast]);

  // ── New Chat ──
  const handleNewChat = useCallback(() => { setShowNewChatConfirm(true); }, []);

  const confirmNewChat = useCallback(() => {
    const welcome = [{
      id: uid(), role: 'assistant' as const,
      content: '你好！我是织梦机的 AI 助手。我可以帮你创建世界观、设计角色、展开设定——所有生成的内容都会以文档卡片的形式直接嵌入对话中，你可以随时编辑和收录。',
      timestamp: Date.now(),
    }];
    setMessages(welcome);
    setTokenCount(0);
    setSessionTokens({ in: 0, out: 0 });
    setFocusObjectId(null);
    setShowNewChatConfirm(false);
    // Clear persisted messages for this project
    try { localStorage.removeItem(storageKey); } catch {}
  }, [storageKey]);

  // ── DocCard Save ──
  const handleDocCardSave = useCallback(async (cardId: string, updates: { title?: string; bodyHTML?: string; sections?: Array<{ title: string; content: string }> }) => {
    setMessages(prev => prev.map(msg => {
      if (!msg.docs) return msg;
      return { ...msg, docs: msg.docs.map(doc => doc.id === cardId ? { ...doc, ...updates, edited: true } : doc) };
    }));
    if (onUpdateObject) {
      const existing = allObjects.find(o => o.id === cardId);
      if (existing) {
        onUpdateObject(cardId, { content: '# ' + (updates.title || existing.name) + '\n\n' + (updates.bodyHTML || '') } as any);
      }
    }
  }, [allObjects, onUpdateObject]);

  // ── "收录为设定" — Actually create a WorldObject ──
  const handleCollect = useCallback(async (cardId: string) => {
    for (const msg of messages) {
      if (!msg.docs) continue;
      const card = msg.docs.find(d => d.id === cardId);
      if (!card) continue;

      const objectType = DOC_TYPE_TO_OBJECT_TYPE[card.type] || '规则/机制';
      const now = Date.now();
      const newObj: WorldObject = {
        id: 'obj_' + now,
        projectId: activeBookId || '',
        name: card.title,
        type: objectType as any,
        status: '草稿' as any,
        canonLevel: '草案正典' as any,
        tags: [],
        aliases: [],
        selectedBoards: [],
        content: '# ' + card.title + '\n\n' + (card.bodyHTML || ''),
        referencesCount: 0,
        judgmentHistory: [],
        createdAt: now,
        updatedAt: now,
        parentId: null,
        sortOrder: 0,
      };
      try {
        await api.createWorldObject(newObj);
        if (onShowToast) onShowToast('已收录为设定', 'success');
      } catch (e) {
        if (onShowToast) onShowToast('收录失败: ' + (e instanceof Error ? e.message : '未知错误'), 'error');
      }
      return;
    }
    if (onShowToast) onShowToast('未找到可收录的内容', 'error');
  }, [messages, activeBookId, onShowToast]);

  // ── Keyboard ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const btnHover = (e: React.MouseEvent) => { if (!(e.currentTarget as HTMLButtonElement).disabled) { Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(183,255,0,0.12)', borderColor: '#444' }); } };
  const btnLeave = (e: React.MouseEvent) => { Object.assign((e.currentTarget as HTMLElement).style, { background: 'transparent', borderColor: 'var(--border-default, #2a2a2a)' }); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Sidebar */}
        <div style={{
          width: sidebarCollapsed ? 0 : 220, minWidth: sidebarCollapsed ? 0 : 220,
          background: 'var(--sidebar-bg, #0e0e0e)',
          borderRight: sidebarCollapsed ? 'none' : '1px solid var(--border-default, #2a2a2a)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transition: 'width 0.25s ease, border-color 0.25s ease, min-width 0.25s ease', flexShrink: 0,
        }}>
          <div style={{ height: 40, display: 'flex', alignItems: 'center', padding: '0 8px 0 12px', gap: 8, borderBottom: '1px solid var(--border-default, #2a2a2a)', flexShrink: 0 }}>
            <button style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm, 6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--text-secondary, #a0a0a0)', cursor: 'pointer', flexShrink: 0, fontSize: '1rem' }}
              onClick={() => setSidebarCollapsed(true)} title="收起大纲"
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-raised, #1e1e1e)'; e.currentTarget.style.color = 'var(--text-primary, #e0e0e0)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary, #a0a0a0)'; }}>◀</button>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary, #e0e0e0)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>大纲</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {outlineGroups.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted, #666)' }}>暂无对象</div>
            ) : outlineGroups.map(group => (
              <div key={group.label} style={{ marginBottom: 4 }}>
                <div style={{ padding: '6px 16px 4px', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted, #666)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  {group.icon} {group.label}
                </div>
                {group.items.map(obj => (
                  <div key={obj.id} onClick={() => handleOutlineClick(obj)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 16px 5px 28px', fontSize: '0.75rem',
                      color: focusObjectId === obj.id ? 'var(--accent, #B7FF00)' : 'var(--text-secondary, #a0a0a0)',
                      background: focusObjectId === obj.id ? 'var(--accent-soft, rgba(183,255,0,0.1))' : 'transparent',
                      cursor: 'pointer', userSelect: 'none', position: 'relative',
                      borderLeft: focusObjectId === obj.id ? '2px solid var(--accent, #B7FF00)' : '2px solid transparent',
                    }}
                    onMouseEnter={e => { if (focusObjectId !== obj.id) { e.currentTarget.style.color = 'var(--text-primary, #e0e0e0)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; } }}
                    onMouseLeave={e => { if (focusObjectId !== obj.id) { e.currentTarget.style.color = 'var(--text-secondary, #a0a0a0)'; e.currentTarget.style.background = 'transparent'; } }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: CANON_DOT_COLORS[obj.canonLevel] || '#666' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{obj.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Sidebar model selector */}
          <div style={{ borderTop: '1px solid var(--border-default, #2a2a2a)', padding: '8px 12px', flexShrink: 0 }}>
            <div onClick={() => setShowModelPicker(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--bg-raised, #1e1e1e)', border: '1px solid var(--border-default, #2a2a2a)', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary, #a0a0a0)', overflow: 'hidden' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success, #4CAF50)', flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeModel.name}</span>
              <span style={{ flexShrink: 0, fontSize: '0.6875rem', color: 'var(--text-muted, #666)', marginLeft: 'auto' }}>▼</span>
            </div>
          </div>
        </div>

        {/* Sidebar reveal */}
        {sidebarCollapsed && (
          <button onClick={() => setSidebarCollapsed(false)}
            style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 20, width: 24, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: '0 var(--radius-sm, 6px) var(--radius-sm, 6px) 0', background: 'var(--sidebar-bg, #0e0e0e)', borderLeft: 'none', color: 'var(--text-secondary, #a0a0a0)', cursor: 'pointer', fontSize: '0.875rem' }}
            title="展开大纲">▶</button>
        )}

        {/* Main chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Chat Header */}
          <div style={{ height: 40, background: 'var(--bg-surface, #141414)', borderBottom: '1px solid var(--border-default, #2a2a2a)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary, #e0e0e0)' }}>AI 助手</span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #666)', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success, #4CAF50)', flexShrink: 0 }} />
              {activeModel.name}
            </span>
            <div style={{
              display: focusObjectId ? 'flex' : 'none', alignItems: 'center', gap: 6,
              padding: '2px 10px', background: 'rgba(183,255,0,0.05)', border: '1px solid rgba(183,255,0,0.12)',
              borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.6875rem', color: 'var(--accent, #B7FF00)', flexShrink: 0,
            }}>
              <span>聚焦: {focusObjectId ? (allObjects.find(o => o.id === focusObjectId)?.name || '') : ''}</span>
              <button onClick={clearFocus} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, border: 'none', background: 'transparent', color: 'var(--accent, #B7FF00)', cursor: 'pointer', borderRadius: '50%', fontSize: '0.6rem', opacity: 0.6, padding: 0 }}><X size={12} /></button>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={handleNewChat} style={{ fontSize: '0.6875rem', padding: '3px 10px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-default, #2a2a2a)', background: 'var(--bg-raised, #1e1e1e)', color: 'var(--text-secondary, #a0a0a0)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s' }}>+ 新对话</button>
              <button onClick={() => setShowModelPicker(true)} style={{ fontSize: '0.6875rem', padding: '3px 10px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-default, #2a2a2a)', background: 'var(--bg-raised, #1e1e1e)', color: 'var(--text-secondary, #a0a0a0)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s' }}>切换模型</button>
            </div>
          </div>
          {/* Conversation Scroll */}
          <div ref={convScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
            <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {messages.map(msg => (
                <div key={msg.id} className="ai-msg-fade" style={{ display: 'flex', gap: 12, maxWidth: '100%', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem',
                    background: msg.role === 'user' ? 'rgba(66,165,245,0.12)' : 'rgba(183,255,0,0.1)',
                    border: msg.role === 'user' ? '1px solid rgba(66,165,245,0.18)' : '1px solid rgba(183,255,0,0.15)' }}>
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {msg.role !== 'system' && (
                      <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-lg, 12px)', fontSize: '0.875rem', lineHeight: 1.6,
                        background: msg.role === 'user' ? 'rgba(66,165,245,0.08)' : 'var(--bg-surface, #141414)',
                        border: msg.role === 'user' ? '1px solid rgba(66,165,245,0.12)' : '1px solid var(--border-default, #2a2a2a)',
                        color: 'var(--text-primary, #e0e0e0)',
                        borderTopRightRadius: msg.role === 'user' ? 4 : 12,
                        borderTopLeftRadius: msg.role === 'assistant' ? 4 : 12,
                      }}>
                        {/* Safe Markdown rendering — no dangerouslySetInnerHTML */}
                        <div style={{ margin: 0 }}>{renderMarkdown(msg.content)}</div>
                        {msg.docs && msg.docs.map(doc => (
                          <DocCard key={doc.id} card={doc} highlighted={focusObjectId === doc.id}
                            onSave={handleDocCardSave}
                            onCollect={handleCollect}
                          />
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted, #666)', padding: '0 4px', marginTop: 2, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                      {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              {/* Typing indicator */}
              {isLoading && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(183,255,0,0.1)', border: '1px solid rgba(183,255,0,0.15)' }}><Bot size={16} /></div>
                  <div className="ai-typing"><span className="ai-typing-dot" /><span className="ai-typing-dot" /><span className="ai-typing-dot" /></div>
                </div>
              )}
              <div ref={scrollAnchorRef} style={{ height: 1, flexShrink: 0 }} />
            </div>
          </div>

          {/* Input Bar */}
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--border-default, #2a2a2a)', background: 'var(--bg-canvas, #0a0a0a)', padding: '12px 24px 16px' }}>
            <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div className="ai-input-wrap" style={{ flex: 1, background: 'var(--bg-surface, #141414)', border: '1px solid var(--border-default, #2a2a2a)', borderRadius: 'var(--radius-lg, 12px)', display: 'flex', alignItems: 'flex-end' }}>
                <textarea ref={inputRef} value={inputText} onChange={e => { setInputText(e.target.value); e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 120) + 'px'; }}
                  onKeyDown={handleKeyDown} placeholder="输入你的想法，让 AI 帮你创作..." rows={1}
                  style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary, #e0e0e0)', fontSize: '0.875rem', lineHeight: 1.5, resize: 'none', maxHeight: 120, minHeight: 44, fontFamily: 'var(--font-sans, sans-serif)', outline: 'none' }} />
              </div>
              <button onClick={handleSend} disabled={!inputText.trim() || isLoading}
                style={{ width: 44, height: 44, borderRadius: 'var(--radius-md, 8px)', border: 'none',
                  background: !inputText.trim() || isLoading ? 'rgba(183,255,0,0.3)' : 'var(--accent, #B7FF00)',
                  color: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: !inputText.trim() || isLoading ? 'not-allowed' : 'pointer', fontSize: '1.125rem', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Bottom Bar */}
      <div style={{ flexShrink: 0, height: 28, background: 'var(--bg-header, #0e0e0e)', borderTop: '1px solid var(--border-default, #2a2a2a)', display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: '0.6875rem', color: 'var(--text-muted, #666)', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success, #4CAF50)', flexShrink: 0, boxShadow: '0 0 4px rgba(76,175,80,0.5)' }} />
            AI 已连接
          </span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>tokens: <span style={{ color: 'var(--text-secondary, #a0a0a0)' }}>{(tokenCount / 1000).toFixed(1)}K</span></span>
          <span style={{ color: 'var(--border-default, #2a2a2a)' }}>|</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>用量</span>
            <span style={{ width: 60, height: 3, background: 'var(--bg-raised, #1e1e1e)', borderRadius: 2, overflow: 'hidden' }}>
              <span className="ai-usage-bar-fill" style={{ width: Math.min((tokenCount / 15000) * 100, 100) + '%', display: 'block', height: '100%', borderRadius: 2 }} />
            </span>
          </span>
        </div>
      </div>

      {/* New Chat Confirmation Modal */}
      {showNewChatConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowNewChatConfirm(false); }}>
          <div style={{ width: 360, background: 'var(--bg-surface, #141414)', border: '1px solid var(--border-default, #2a2a2a)', borderRadius: 'var(--radius-lg, 12px)', padding: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary, #e0e0e0)', marginBottom: 8 }}>新对话</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary, #a0a0a0)', marginBottom: 16 }}>开始新对话？当前对话将保留，不会被清除。</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewChatConfirm(false)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-default, #2a2a2a)', background: 'var(--bg-raised, #1e1e1e)', color: 'var(--text-secondary, #a0a0a0)', cursor: 'pointer', fontSize: '0.8125rem' }}>取消</button>
              <button onClick={confirmNewChat} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm, 6px)', border: 'none', background: 'var(--accent, #B7FF00)', color: '#0a0a0a', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500 }}>确认新对话</button>
            </div>
          </div>
        </div>
      )}

      {/* Model Picker Modal */}
      {showModelPicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowModelPicker(false)}>
          <div style={{ background: 'var(--bg-surface, #141414)', border: '1px solid var(--border-default, #2a2a2a)', borderRadius: 'var(--radius-lg, 14px)', maxWidth: 400, width: '90%', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>选择模型</h3>
            {AVAILABLE_MODELS.map(m => (
              <div key={m.name} onClick={() => { setActiveModel(m); setShowModelPicker(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 'var(--radius-sm, 6px)', cursor: 'pointer', marginBottom: 4,
                  background: activeModel.name === m.name ? 'var(--accent-soft, rgba(183,255,0,0.1))' : 'transparent',
                  border: activeModel.name === m.name ? '1px solid rgba(183,255,0,0.2)' : '1px solid transparent' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent, #B7FF00)', opacity: activeModel.name === m.name ? 1 : 0.2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{m.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #666)' }}>{m.providerName} · {m.description}</div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #666)' }}>{m.costPer1KTokens === 0 ? '免费' : `$${m.costPer1KTokens}/1K`}</div>
              </div>
            ))}
            <button onClick={() => setShowModelPicker(false)} style={{ marginTop: 16, width: '100%', padding: '8px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-default, #2a2a2a)', background: 'transparent', color: 'var(--text-secondary, #a0a0a0)', cursor: 'pointer', fontSize: '0.8125rem' }}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
