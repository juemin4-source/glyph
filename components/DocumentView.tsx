/**
 * DocumentView — Markdown-first editor for 织梦机 v1.2 (P1-03, P1-04, P1-05).
 *
 * Default mode: source (beautified Markdown with syntax hints)
 * Preview mode: read-only rendered HTML
 * WYSIWYG mode: demoted to optional (TipTap with Markdown serialization)
 *
 * Unified toolbar adapts to mode.
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { WikiLink } from '../extensions/WikiLink';
import type { WorldObject, ObjectType, ObjectStatus, CanonLevel, SaveStatus } from '../types/world';
import { OBJECT_TYPES, OBJECT_STATUSES, CANON_LEVELS, STATUS_DISPLAY, CANON_COLORS } from '../types/world';
import { TEMPLATES } from '../data/seed';
import { markdownToHtml, ensureEditorContent, htmlToMarkdown, isHtmlContent, countWords } from '../utils/markdown';
import DocOutline from './DocOutline';
import { Check, RefreshCw, X, Eye } from 'lucide-react';
import type { ChapterPacket } from '../contracts/chapter-packet.contract';

type EditMode = 'source' | 'wysiwyg' | 'preview';

interface DocumentViewProps {
  currentObject: WorldObject | null;
  allObjects: WorldObject[];
  allBoardTabs: string[];
  onUpdateObject: (id: string, updates: Partial<WorldObject>) => void;
  onNavigate: (name: string) => void;
  onAddToBoard: (objectId: string, board: string) => void;
  onLockObject: (objectId: string, reason: string) => void;
  onDiscardObject: (objectId: string, reason: string) => void;
  onCreateObject: (templateType: ObjectType) => void;
  onCreateNamedObject?: (name: string, objectType: ObjectType) => void;
  saveStatus?: SaveStatus;
  onTriggerSave?: () => void;
  editMode?: 'source' | 'preview' | 'wysiwyg';
  onEditorModeChange?: (mode: 'source' | 'preview' | 'wysiwyg') => void;
  /** C3: 关联的 ChapterPacket，传入时在编辑器上方显示标识 */
  chapterPacket?: ChapterPacket;
  /** C3: 基于 packet 生成正文的回调（C5 集成时启用） */
  onGenerateFromPacket?: (packetId: string) => void;
}

export default function DocumentView({
  currentObject, allObjects,
  onUpdateObject, onNavigate, onCreateObject, onCreateNamedObject,
  saveStatus, onTriggerSave,
  editMode: externalEditorMode,
  onEditorModeChange,
  chapterPacket,
  onGenerateFromPacket,
}: DocumentViewProps) {
  const [localEditMode, setLocalEditMode] = useState<EditMode>('source');
  // Use external editMode when provided by parent (nav-bar controlled)
  const editMode = externalEditorMode ?? localEditMode;
  const setEditMode = (mode: EditMode) => {
    if (onEditorModeChange) {
      onEditorModeChange(mode);
    } else {
      setLocalEditMode(mode);
    }
  };
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const [contentDirty, setContentDirty] = useState(false);
  const markdownMigratedRef = useRef<Set<string>>(new Set());

  // Markdown migration on first load
  useEffect(() => {
    if (currentObject && !markdownMigratedRef.current.has(currentObject.id)) {
      if (isHtmlContent(currentObject.content)) {
        const md = htmlToMarkdown(currentObject.content);
        if (md !== currentObject.content) {
          onUpdateObject(currentObject.id, { content: md });
        }
      }
      markdownMigratedRef.current.add(currentObject.id);
    }
  }, [currentObject?.id]);

  // ── Create bubble state ──
  const [showCreateBubble, setShowCreateBubble] = useState(false);
  const [createBubbleName, setCreateBubbleName] = useState('');
  const [createBubbleType, setCreateBubbleType] = useState<ObjectType>('人物');

  // ── WikiLink exists checker ──
  const wikiExists = useCallback((name: string): boolean => {
    return allObjects.some(o => o.name === name);
  }, [allObjects]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      WikiLink.configure({
        existsChecker: wikiExists,
        onDoubleClick: (name) => {
          const exists = wikiExists(name);
          if (exists) {
            onNavigate(name);
          } else {
            setCreateBubbleName(name);
            setCreateBubbleType('人物');
            setShowCreateBubble(true);
          }
          return true;
        },
      }),
    ],
    content: ensureEditorContent(currentObject?.content || ''),
    editorProps: {
      attributes: {
        class: 'editor-content',
        'data-placeholder': '在此输入文档内容... 使用 [[对象名]] 引用其他对象',
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (currentObject) {
        // In v1.2 Markdown-first, serialize to Markdown
        try {
          const md = ed.getText(); // Fallback to text
          onUpdateObject(currentObject.id, { content: md });
        } catch {
          // If markdown extension not available, store HTML
          onUpdateObject(currentObject.id, { content: ed.getHTML() });
        }
        setContentDirty(true);
        if (onTriggerSave) onTriggerSave();
      }
    },
  });

  // Update editor content when switching objects
  useEffect(() => {
    if (editor && currentObject) {
      const html = ensureEditorContent(currentObject.content);
      if (editor.getHTML() !== html) {
        editor.commands.setContent(html);
      }
    }
  },   [editor, currentObject?.id, editMode]);

  const wikiLinks = useMemo(() => {
    if (!currentObject) return [];
    const content = editMode === 'wysiwyg'
      ? editor?.getText() || ''
      : currentObject.content;
    const matches = content.match(/\[\[([^\]]+)\]\]/g);
    if (!matches) return [];
    return matches.map(m => m.slice(2, -2).trim()).filter(Boolean);
  }, [currentObject, editMode, editor]);

  const wordCount = useMemo(() => {
    return countWords(currentObject?.content || '');
  }, [currentObject]);

  // ── Source mode handlers ──

  const insertFormat = useCallback((prefix: string, suffix: string = '') => {
    const ta = sourceRef.current;
    if (!ta || !currentObject) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = currentObject.content;
    const before = text.slice(0, start);
    const selected = text.slice(start, end);
    const after = text.slice(end);
    const newText = before + prefix + selected + suffix + after;
    onUpdateObject(currentObject.id, { content: newText });
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  }, [currentObject, onUpdateObject]);

  const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (currentObject) {
      onUpdateObject(currentObject.id, { content: e.target.value });
      setContentDirty(true);
      if (onTriggerSave) onTriggerSave();
    }
  }, [currentObject, onUpdateObject, onTriggerSave]);

  const handleSourceDoubleClick = useCallback(() => {
    const ta = sourceRef.current;
    if (!ta || !currentObject) return;
    const pos = ta.selectionStart;
    const text = currentObject.content;
    const before = text.slice(0, pos);
    const lastOpen = before.lastIndexOf('[[');
    const fromOpen = text.slice(pos);
    const nextClose = fromOpen.indexOf(']]');
    if (lastOpen >= 0 && nextClose >= 0) {
      const name = text.slice(lastOpen + 2, pos + nextClose).trim();
      if (name) {
        const target = allObjects.find(o => o.name === name);
        if (target) {
          onNavigate(name);
        } else {
          setCreateBubbleName(name);
          setCreateBubbleType('人物');
          setShowCreateBubble(true);
        }
      }
    }
  }, [currentObject, allObjects, onNavigate]);

  // ── Property change handlers ──
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (currentObject) onUpdateObject(currentObject.id, { type: e.target.value as ObjectType });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (currentObject) onUpdateObject(currentObject.id, { status: e.target.value as ObjectStatus });
  };

  const handleCanonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (currentObject) onUpdateObject(currentObject.id, { canonLevel: e.target.value as CanonLevel });
  };

  // ── Create bubble confirm ──
  const handleCreateFromBubble = useCallback(() => {
    if (!createBubbleName.trim()) return;
    if (onCreateNamedObject) {
      onCreateNamedObject(createBubbleName.trim(), createBubbleType);
    } else {
      onCreateObject(createBubbleType);
    }
    setShowCreateBubble(false);
    setCreateBubbleName('');
  }, [createBubbleName, createBubbleType, onCreateObject, onCreateNamedObject]);

  // ── WYSIWYG toolbar handlers ──
  const execBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
  const execItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor]);
  const execStrike = useCallback(() => editor?.chain().focus().toggleStrike().run(), [editor]);
  const execH2 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 2 }).run(), [editor]);
  const execH3 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 3 }).run(), [editor]);
  const execBlockquote = useCallback(() => editor?.chain().focus().toggleBlockquote().run(), [editor]);
  const execBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor]);
  const execCode = useCallback(() => editor?.chain().focus().toggleCode().run(), [editor]);
  const execCodeBlock = useCallback(() => editor?.chain().focus().toggleCodeBlock().run(), [editor]);

  // ── Unified toolbar ──
  const renderToolbar = () => {
    const isSource = editMode === 'source';
    const isPreview = editMode === 'preview';

    return (
      <div className="doc-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, flexWrap: 'wrap' }}>
          {/* Common formatting buttons — behavior changes by mode */}
          {!isPreview && (
            <>
              {isSource ? (
                <>
                  <button className="tb-btn" onClick={() => insertFormat('## ', '')} title="Heading 2">H2</button>
                  <button className="tb-btn" onClick={() => insertFormat('### ', '')} title="Heading 3">H3</button>
                  <span className="separator" />
                  <button className="tb-btn" onClick={() => insertFormat('**', '**')} title="Bold" style={{ fontWeight: 700 }}>B</button>
                  <button className="tb-btn" onClick={() => insertFormat('*', '*')} title="Italic" style={{ fontStyle: 'italic' }}>I</button>
                  <button className="tb-btn" onClick={() => insertFormat('~~', '~~')} title="Strikethrough" style={{ textDecoration: 'line-through' }}>S</button>
                  <span className="separator" />
                  <button className="tb-btn" onClick={() => insertFormat('> ', '')} title="Blockquote">❝</button>
                  <button className="tb-btn" onClick={() => insertFormat('- ', '')} title="List">≡</button>
                  <button className="tb-btn" onClick={() => insertFormat('`', '`')} title="Inline Code">{'</>'}</button>
                </>
              ) : editor && (
                <>
                  <button className={`tb-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`} onClick={execH2} title="Heading 2">H2</button>
                  <button className={`tb-btn ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`} onClick={execH3} title="Heading 3">H3</button>
                  <span className="separator" />
                  <button className={`tb-btn ${editor.isActive('bold') ? 'active' : ''}`} onClick={execBold} title="Bold" style={{ fontWeight: 700 }}>B</button>
                  <button className={`tb-btn ${editor.isActive('italic') ? 'active' : ''}`} onClick={execItalic} title="Italic" style={{ fontStyle: 'italic' }}>I</button>
                  <button className={`tb-btn ${editor.isActive('strike') ? 'active' : ''}`} onClick={execStrike} title="Strikethrough" style={{ textDecoration: 'line-through' }}>S</button>
                  <span className="separator" />
                  <button className={`tb-btn ${editor.isActive('blockquote') ? 'active' : ''}`} onClick={execBlockquote} title="Blockquote">❝</button>
                  <button className={`tb-btn ${editor.isActive('bulletList') ? 'active' : ''}`} onClick={execBulletList} title="Bullet List">≡</button>
                  <button className={`tb-btn ${editor.isActive('code') ? 'active' : ''}`} onClick={execCode} title="Inline Code">{'</>'}</button>
                  <button className={`tb-btn ${editor.isActive('codeBlock') ? 'active' : ''}`} onClick={execCodeBlock} title="Code Block">▦</button>
                </>
              )}
            </>
          )}

          {/* Save status indicator */}
          {saveStatus && (
            <span style={{ marginLeft: 12, fontSize: 11, color: saveStatus === 'saved' ? '#4CAF50' : saveStatus === 'saving' ? '#FF9800' : saveStatus === 'failed' ? '#f44336' : saveStatus === 'offline' ? '#888' : '#FF9800' }}>
              {saveStatus === 'saved' ? <><Check size={11} /> 已保存</> : saveStatus === 'saving' ? <><RefreshCw size={11} /> 保存中</> : saveStatus === 'failed' ? <><X size={11} /> 保存失败</> : saveStatus === 'offline' ? '● 离线' : '● 未保存'}
            </span>
          )}
        </div>

        {/* Mode switch — right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <span className="separator" />
          <button
            className={`tb-btn ${isSource ? 'active' : ''}`}
            onClick={() => setEditMode('source')}
            title="源码模式（默认）"
            style={{ fontSize: 12 }}
          >
            {'</>'} 编辑
          </button>
          <button
            className={`tb-btn ${editMode === 'wysiwyg' ? 'active' : ''}`}
            onClick={() => {
              if (editor && currentObject) {
                editor.commands.setContent(ensureEditorContent(currentObject.content));
              }
              setEditMode('wysiwyg');
            }}
            title="富文本模式"
            style={{ fontSize: 12 }}
          >
            ✎ 富文本
          </button>
          <button
            className={`tb-btn ${isPreview ? 'active' : ''}`}
            onClick={() => setEditMode('preview')}
            title="预览模式"
            style={{ fontSize: 12 }}
          >
            <Eye size={14} /> 预览
          </button>
        </div>
      </div>
    );
  };

  // ── Property selectors (compressed) ──
  const renderProperties = () => {
    if (!currentObject || editMode === 'preview') return null;
    const sd = STATUS_DISPLAY[currentObject.status];
    return (
      <div className="doc-properties">
        <div className="prop-item">
          <label>类型</label>
          <select value={currentObject.type} onChange={handleTypeChange}>
            {OBJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="prop-item">
          <label>状态</label>
          <select value={currentObject.status} onChange={handleStatusChange}
            style={{ background: sd.background, color: sd.text, border: sd.border }}>
            {OBJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="prop-item">
          <label>正典</label>
          <select value={currentObject.canonLevel} onChange={handleCanonChange}>
            {CANON_LEVELS.map(c => (
              <option key={c} value={c} style={{
                color: CANON_COLORS[c] || '#999',
              }}>{c}</option>
            ))}
          </select>
        </div>
        {saveStatus && (
          <div className="prop-item" style={{ marginLeft: 'auto' }}>
            <span style={{
              fontSize: 11, padding: '2px 6px', borderRadius: 3,
              background: saveStatus === 'saved' ? '#1B5E20' : saveStatus === 'saving' ? '#E65100' : saveStatus === 'failed' ? '#B71C1C' : saveStatus === 'offline' ? '#333' : '#E65100',
              color: saveStatus === 'saved' ? '#A5D6A7' : saveStatus === 'saving' ? '#FFCC80' : saveStatus === 'failed' ? '#EF9A9A' : saveStatus === 'offline' ? '#888' : '#FFCC80',
            }}>
              {saveStatus === 'saved' ? '已保存' : saveStatus === 'saving' ? '保存中' : saveStatus === 'failed' ? '保存失败' : saveStatus === 'offline' ? '离线' : '未保存'}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderEditorContent = () => {
    if (editMode === 'source') {
      return (
        <div className="doc-editor">
          <textarea
            ref={sourceRef}
            value={currentObject?.content || ''}
            onChange={handleSourceChange}
            onDoubleClick={handleSourceDoubleClick}
            placeholder="在此输入文档内容... 使用 [[对象名]] 引用其他对象"
            spellCheck={false}
          />
        </div>
      );
    }
    if (editMode === 'wysiwyg') {
      return (
        <div className="doc-editor tiptap-editor">
          {editor && <EditorContent editor={editor} />}
        </div>
      );
    }
    // Preview mode
    return (
      <div className="doc-editor">
        <div
          className="editor-content preview-content"
          dangerouslySetInnerHTML={{
            __html: currentObject ? markdownToHtml(currentObject.content) : '',
          }}
        />
      </div>
    );
  };

  if (!currentObject) {
    return (
      <div className="doc-view">
        <DocOutline allObjects={allObjects} currentObjectId={null} onNavigate={onNavigate} onCreateObject={onCreateObject} />
        <div className="doc-editor-area">
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
            <p style={{ fontSize: 18, marginBottom: 16 }}>选择或创建一个对象</p>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: '#888', fontSize: 13, width: '100%', marginBottom: 8 }}>使用模板快速创建：</span>
              {TEMPLATES.map(t => (
                <button key={t.type} className="tb-btn primary" onClick={() => onCreateObject(t.type)} style={{ background: '#333' }}>+ {t.type}</button>
              ))}
            </div>
            <div style={{ marginTop: 24, fontSize: 13, color: '#666' }}>或在文档中写入 [[对象名]] 来创建引用</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="doc-view">
      <DocOutline allObjects={allObjects} currentObjectId={currentObject.id} onNavigate={onNavigate} onCreateObject={onCreateObject} />
      <div className="doc-editor-area">
        {renderToolbar()}
        {renderProperties()}
        {chapterPacket && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 16px',
            fontSize: 11,
            color: 'var(--accent-text, #B7FF00)',
            background: 'var(--accent-soft, rgba(183, 255, 0, 0.06))',
            borderBottom: '1px solid var(--border-subtle, #222)',
          }}>
            <span>📄</span>
            <span>基于 ChapterPacket: <strong>{chapterPacket.title || `第${chapterPacket.chapterNumber}章`}</strong></span>
            {chapterPacket.position && (
              <span style={{ color: 'var(--text-muted, #666)', marginLeft: 4 }}>| {chapterPacket.position}</span>
            )}
            {chapterPacket.chapterFunction && (
              <span style={{
                marginLeft: 'auto',
                padding: '0 8px',
                fontSize: 10,
                background: 'var(--bg-raised, #1e1e1e)',
                borderRadius: 4,
                color: 'var(--text-secondary, #a0a0a0)',
              }}>
                {chapterPacket.chapterFunction}
              </span>
            )}
            {onGenerateFromPacket && (
              <button
                className="btn btn-primary btn-sm"
                style={{ marginLeft: 8 }}
                onClick={() => onGenerateFromPacket(chapterPacket.id)}
              >
                AI 写本章
              </button>
            )}
          </div>
        )}
        {renderEditorContent()}

        <div className="word-count">
          字数: {wordCount.toLocaleString()} | [[链接]]: {wikiLinks.length}
          {wikiLinks.length > 0 && (
            <span style={{ marginLeft: 8 }}>
              | 双击 [[链接]] 跳转
            </span>
          )}
          {saveStatus && (
            <span style={{ marginLeft: 12, color: saveStatus === 'saved' ? '#4CAF50' : saveStatus === 'failed' ? '#f44336' : '#888' }}>
              {saveStatus === 'saved' ? '已保存' : saveStatus === 'saving' ? '保存中...' : saveStatus === 'failed' ? '保存失败' : saveStatus === 'offline' ? '离线' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Create bubble for missing wiki links */}
      {showCreateBubble && (
        <div className="dialog-overlay" onClick={() => setShowCreateBubble(false)}>
          <div className="dialog-box create-bubble" onClick={e => e.stopPropagation()}>
            <h4>创建对象「{createBubbleName}」</h4>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
              对象不存在，选择类型后创建并打开：
            </p>
            <div className="bubble-type-selector">
              {OBJECT_TYPES.map(t => (
                <button
                  key={t}
                  className={`bubble-type-btn ${createBubbleType === t ? 'selected' : ''}`}
                  onClick={() => setCreateBubbleType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="dialog-actions" style={{ marginTop: 16 }}>
              <button className="ia-btn" onClick={() => setShowCreateBubble(false)}>取消</button>
              <button
                className="ia-btn"
                style={{ background: '#1a73e8' }}
                onClick={handleCreateFromBubble}
              >
                创建并打开
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
