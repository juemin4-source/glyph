import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Send, Search, FileText, Loader, BookOpen, Settings, Key, Check, X, FileSearch, Info } from 'lucide-react';
import type { FsProject } from '../types/fs';
import { collectContext, executeFsAiTask, searchProjectFiles, searchFileContents, parseFileReferences, resolveFileReferences } from '../lib/fs-ai-bridge';
import type { FsAiTask, FsAiMessage, FsAiContext, FsAiEvidenceStep } from '../lib/fs-ai-bridge';

interface FsAiPanelProps {
  project: FsProject;
  currentFilePath: string | null;
  currentFileContent: string | null;
}

const FsAiPanel: React.FC<FsAiPanelProps> = ({ project, currentFilePath, currentFileContent }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<FsAiMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'thinking' | 'searching' | 'reading' | 'error'>('idle');
  const [evidence, setEvidence] = useState<FsAiEvidenceStep[]>([]);
  const [readFiles, setReadFiles] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [providerEndpoint, setProviderEndpoint] = useState('http://localhost:11434/v1');
  const [providerKey, setProviderKey] = useState('');
  const [providerModel, setProviderModel] = useState('qwen3:8b');
  const [configStatus, setConfigStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' as ScrollBehavior }); } catch {}
  }, [messages]);

  // Check existing providers on mount
  useEffect(() => {
    const checkProviders = async () => {
      try {
        const { listProviderConfigs } = await import('../api/aiControlCenterApi');
        const providers = await listProviderConfigs();
        const active = providers.filter((p: { isActive: boolean }) => p.isActive);
        if (active.length > 0) {
          setProviderEndpoint(active[0].endpoint || '');
          // models is a JSON string like '["qwen3:8b"]' — extract the model name
          const modelsRaw = active[0].models;
          if (modelsRaw) {
            try {
              const parsed = JSON.parse(modelsRaw);
              const firstModel = Array.isArray(parsed) ? parsed[0] : parsed;
              setProviderModel(String(firstModel || ''));
            } catch {
              setProviderModel(String(modelsRaw));
            }
          }
        }
      } catch {
        // No providers configured yet
      }
    };
    checkProviders();
  }, []);

  const handleSaveProvider = useCallback(async () => {
    setConfigStatus('saving');
    try {
      const { saveProviderConfig } = await import('../api/aiControlCenterApi');
      await saveProviderConfig({
        providerId: 'custom',
        providerName: 'Custom API',
        apiKeyEncrypted: providerKey,
        endpoint: providerEndpoint,
        models: [providerModel],
        timeoutMs: 30000,
        clearApiKey: false,
      });
      setConfigStatus('done');
      setTimeout(() => { setShowSettings(false); setConfigStatus('idle'); }, 1500);
    } catch (err) {
      setConfigStatus('error');
    }
  }, [providerEndpoint, providerKey, providerModel]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');

    // Guard: no real project loaded
    if (!project.rootPath) {
      const msg: FsAiMessage = {
        role: 'assistant',
        content: '请先打开或创建一个本地项目，我才能搜索和读取你的作品文件。\n\n在书架中选择"新建本地项目"或打开已有目录。',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, msg]);
      setStatus('idle');
      return;
    }

    // Add user message
    const userMsg: FsAiMessage = { role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    setStatus('thinking');
    setEvidence([]);
    setReadFiles([]);

    try {
      // Collect filesystem context
      const context = await collectContext(project, currentFilePath);

      // Check for @file references in input
      const fileRefs = parseFileReferences(text);
      const refFilesToRead: string[] = [];
      if (fileRefs.length > 0) {
        setStatus('reading');
        const resolved = await resolveFileReferences(project.rootPath, fileRefs);
        for (const r of resolved) {
          if (r.exactMatch) {
            refFilesToRead.push(r.exactMatch);
          } else if (r.matches.length > 0) {
            refFilesToRead.push(r.matches[0]);
          }
        }
      }

      // Check if user's message looks like a search request
      const isSearchRequest = text.includes('找') || text.includes('搜索') ||
                              text.includes('查找') || text.includes('search') ||
                              text.includes('关于') || text.includes('分析') ||
                              text.includes('了解');

      if (isSearchRequest && fileRefs.length === 0) {
        setStatus('searching');

        // Try content search first (more powerful)
        const contentResults = await searchFileContents(project.rootPath, text, 5);

        if (contentResults.length > 0) {
          const newEvidence: FsAiEvidenceStep[] = [{
            type: 'search',
            detail: `内容搜索找到 ${contentResults.length} 个相关文件`,
            files: contentResults.map(r => r.filePath),
          }];
          setEvidence(newEvidence);
          setReadFiles(contentResults.map(r => r.filePath));

          // Read found files
          const filesToRead = contentResults.slice(0, 3).map(r => r.filePath);
          const { readFile } = await import('../tauri-api');
          const content = await Promise.all(
            filesToRead.map(async (path) => {
              try {
                const c = await readFile(project.rootPath, path);
                return { path, content: c };
              } catch {
                return { path, content: '(无法读取)' };
              }
            }),
          );

          newEvidence.push({
            type: 'read',
            detail: `读取了 ${content.length} 个相关文件`,
            files: filesToRead,
          });
          setEvidence([...newEvidence]);

          // Build response with evidence
          const assistantMsg: FsAiMessage = {
            role: 'assistant',
            content: `我找到了以下相关文件：\n\n${content.map(f => `📄 **${f.path}**`).join('\n')}\n\n已读取这些文件的内容。以下是与"${text}"相关的内容：\n\n${content.map(f => `### ${f.path}\n\`\`\`\n${f.content.substring(0, 800)}\n\`\`\``).join('\n\n')}\n\n请告诉我你想进一步了解什么，或者我可以帮你分析这些材料。`,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, assistantMsg]);
          setStatus('idle');
          return;
        }

        // Fall back to filename search
        const searchResults = await searchProjectFiles(project.rootPath, text);
        if (searchResults.length > 0) {
          setReadFiles(searchResults);
          const content = await Promise.all(
            searchResults.slice(0, 3).map(async (path) => {
              try {
                const { readFile } = await import('../tauri-api');
                const c = await readFile(project.rootPath, path);
                return { path, content: c };
              } catch {
                return { path, content: '(无法读取)' };
              }
            }),
          );

          setEvidence([{
            type: 'search',
            detail: `文件名搜索找到 ${searchResults.length} 个文件`,
            files: searchResults,
          }, {
            type: 'read',
            detail: `读取了 ${content.length} 个文件`,
            files: content.map(c => c.path),
          }]);

          const assistantMsg: FsAiMessage = {
            role: 'assistant',
            content: `我通过文件名找到了以下相关文件：\n\n${content.map(f => `📄 ${f.path}`).join('\n')}\n\n已读取这些文件的内容，请告诉我你想针对这些材料做什么？`,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, assistantMsg]);
          setStatus('idle');
          return;
        } else {
          // Content search failed — proceed with AI chat
          const assistantMsg: FsAiMessage = {
            role: 'assistant',
            content: '我搜索了项目文件，但没有找到直接相关的文件。你可以：\n\n1. 试试其他关键词\n2. 用 @文件名 直接指定文件\n3. 告诉我你想了解什么，我可以基于已有知识提供帮助',
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, assistantMsg]);
          setStatus('idle');
          return;
        }
      }

      // General AI chat
      const task: FsAiTask = {
        userInput: text,
        context,
        status: 'thinking',
        messages: [...messages, userMsg],
        readFiles: refFilesToRead,
        searchResults: [],
        evidence: [],
      };

      const result = await executeFsAiTask(task, {
        endpoint: providerEndpoint,
        model: { id: providerModel, name: providerModel, provider: 'custom', context: 8192 },
      });

      if (result.messages.length > messages.length + 1) {
        const lastMsg = result.messages[result.messages.length - 1];
        setMessages(prev => [...prev, lastMsg]);
      }

      if (result.evidence && result.evidence.length > 0) {
        setEvidence(result.evidence);
        const readEvidence = result.evidence.filter(e => e.type === 'read' || e.type === 'search');
        const allFiles = readEvidence.flatMap(e => e.files).filter(Boolean);
        if (allFiles.length > 0) {
          setReadFiles(allFiles);
        }
      }

      setStatus(result.status === 'error' ? 'error' : 'idle');
    } catch (err) {
      const errorMsg: FsAiMessage = {
        role: 'assistant',
        content: `操作失败：${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
      setStatus('error');
    }
  }, [input, project, currentFilePath, currentFileContent, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  /** Get status display text */
  const statusText = status === 'searching' ? '正在搜索项目文件...' :
                     status === 'reading' ? '正在读取文件...' :
                     status === 'thinking' ? '正在思考...' : '';

  /** Evidence icons */
  const evidenceIcon = (type: string) => {
    switch (type) {
      case 'search': return <Search size={12} />;
      case 'read': return <FileText size={12} />;
      case 'analyze': return <Info size={12} />;
      default: return <Info size={12} />;
    }
  };

  return (
    <div className="fs-ai-panel">
      {/* Header */}
      <div className="fs-ai-header">
        <BookOpen size={16} />
        <span>AI 助手</span>
        <span className={`fs-ai-status-dot ${status !== 'idle' ? 'active' : ''}`} />
        <div className="glyph-topbar-spacer" />
        <button
          className="fs-ai-settings-btn"
          onClick={() => setShowSettings(v => !v)}
          title="AI 设置"
        >
          <Settings size={14} />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="fs-ai-settings">
          <div className="fs-ai-setting-field">
            <label>API 地址</label>
            <input value={providerEndpoint} onChange={e => setProviderEndpoint(e.target.value)} placeholder="http://localhost:11434/v1" />
          </div>
          <div className="fs-ai-setting-field">
            <label>API Key</label>
            <input value={providerKey} onChange={e => setProviderKey(e.target.value)} type="password" placeholder="sk-..." />
          </div>
          <div className="fs-ai-setting-field">
            <label>模型</label>
            <input value={providerModel} onChange={e => setProviderModel(e.target.value)} placeholder="gpt-4 / qwen3:8b" />
          </div>
          <button className="fs-ai-save-btn" onClick={handleSaveProvider} disabled={configStatus === 'saving'}>
            {configStatus === 'saving' ? '保存中...' : configStatus === 'done' ? '✓ 已保存' : '保存配置'}
          </button>
          {configStatus === 'error' && <div className="fs-ai-setting-error">保存失败，请检查配置</div>}
        </div>
      )}

      {/* Messages */}
      <div className="fs-ai-messages">
        {messages.length === 0 && (
          <div className="fs-ai-welcome">
            <BookOpen size={32} />
            <p>我是你的创作助手</p>
            <p className="fs-ai-hints">
              我可以帮你搜索项目文件、分析人物和情节、提供写作建议。
            </p>
            <p className="fs-ai-hints">
              💡 输入 <code>@文件名</code> 引用具体文件
            </p>
            <div className="fs-ai-suggestions">
              <button onClick={() => setInput('帮我看看项目里都有什么文件')}>
                查看项目文件
              </button>
              <button onClick={() => setInput('分析当前文件的内容')}>
                分析当前文件
              </button>
              <button onClick={() => setInput('帮我梳理主要人物关系')}>
                梳理人物关系
              </button>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`fs-ai-message ${msg.role}`}>
            <div className="fs-ai-message-content">{msg.content}</div>
            <div className="fs-ai-message-time">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}

        {/* Evidence display */}
        {evidence.length > 0 && (
          <div className="fs-ai-evidence">
            <button
              className="fs-ai-evidence-toggle"
              onClick={() => setShowEvidence(v => !v)}
            >
              <FileSearch size={12} />
              <span>AI 操作记录 ({evidence.length})</span>
              <span className="fs-ai-evidence-arrow">{showEvidence ? '▼' : '▶'}</span>
            </button>
            {showEvidence && (
              <div className="fs-ai-evidence-steps">
                {evidence.map((step, i) => (
                  <div key={i} className={`fs-ai-evidence-step fs-ai-evidence-${step.type}`}>
                    <span className="fs-ai-evidence-icon">{evidenceIcon(step.type)}</span>
                    <span className="fs-ai-evidence-detail">{step.detail}</span>
                    {step.files.length > 0 && (
                      <div className="fs-ai-evidence-files">
                        {step.files.map((file, j) => (
                          <span key={j} className="fs-ai-evidence-file">{file}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {status !== 'idle' && (
          <div className="fs-ai-loading">
            <Loader size={16} className="fs-ai-spinner" />
            {' '}{statusText}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="fs-ai-input-area">
        <textarea
          className="fs-ai-input"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="输入创作任务...（用 @文件名 引用文件）"
          rows={2}
          disabled={status !== 'idle'}
        />
        <button
          className="fs-ai-send-btn"
          onClick={handleSubmit}
          disabled={!input.trim() || status !== 'idle'}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

export default FsAiPanel;
