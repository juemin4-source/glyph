import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Slash, SlashCmd, SlashCmdProvider, createSuggestionsItems, enableKeyboardNavigation } from '@harshtalks/slash-tiptap';
import { markdownToHtml, htmlToMarkdown, ensureEditorContent, countWords } from '../utils/markdown';
import { Eye, FileEdit } from 'lucide-react';

interface FsDocumentViewProps {
  content: string | null;
  filePath: string | null;
  fileName: string | null;
  isDirty: boolean;
  onContentChange: (content: string) => void;
  onSave: () => Promise<boolean>;
  wordCount?: number;
}

type EditMode = 'wysiwyg' | 'source' | 'preview';

const slashItems = createSuggestionsItems([
  { title: '标题 1', searchTerms: ['h1', 'heading1', '大标题'], command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run() },
  { title: '标题 2', searchTerms: ['h2', 'heading2', '章节'], command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run() },
  { title: '标题 3', searchTerms: ['h3', 'heading3', '小节'], command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run() },
  { title: '无序列表', searchTerms: ['ul', 'unordered', '列表', '圆点'], command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
  { title: '有序列表', searchTerms: ['ol', 'ordered', '编号'], command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
  { title: '引用', searchTerms: ['blockquote', 'quote', '引用'], command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
  { title: '代码块', searchTerms: ['code', 'pre', '代码'], command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run() },
  { title: '分割线', searchTerms: ['hr', 'divider', '分割'], command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run() },
]);

/**
 * FsDocumentView — Tiptap-based editor for filesystem Markdown files.
 * Mirrors the editing experience of DocumentView but works with raw file content.
 */
export default function FsDocumentView({
  content, filePath, fileName, isDirty, onContentChange, onSave,
}: FsDocumentViewProps) {
  const [editMode, setEditMode] = useState<EditMode>('wysiwyg');
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Slash.configure({
        suggestion: {
          items: () => slashItems,
        },
      }),
    ],
    content: ensureEditorContent(content || ''),
    onCreate: ({ editor: ed }) => { editorRef.current = ed; },
    editorProps: {
      attributes: {
        class: 'editor-content',
        'data-placeholder': '在此输入文档内容...',
      },
      handleDOMEvents: {
        keydown: (_, v) => {
          if (v.isComposing || v.keyCode === 229) return false;
          return enableKeyboardNavigation(v);
        },
      },
    },
    onUpdate: ({ editor: ed }) => {
      // WYSIWYG mode: serialize HTML → Markdown
      const html = ed.getHTML();
      const md = htmlToMarkdown(html);
      onContentChange(md);
    },
  });

  // Update editor content when switching files
  useEffect(() => {
    if (editor && filePath && content !== null) {
      const html = ensureEditorContent(content);
      if (editor.getHTML() !== html) {
        editor.commands.setContent(html);
      }
    }
  }, [editor, filePath]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setEditMode(prev => prev === 'preview' ? 'wysiwyg' : 'preview');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSave]);

  // Source mode handler
  const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onContentChange(e.target.value);
  }, [onContentChange]);

  // Preview HTML
  const previewHtml = useMemo(() => {
    if (!content) return '<p></p>';
    try {
      return markdownToHtml(content);
    } catch {
      return '<p>预览渲染失败</p>';
    }
  }, [content]);

  // Empty state
  if (!filePath || content === null) {
    return (
      <div className="fs-file-empty">
        <div className="fs-file-empty-icon">📝</div>
        <p>在侧栏选择一个文件开始编辑</p>
      </div>
    );
  }

  return (
    <div className="fs-document-view">
      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          {fileName && (
            <span className="editor-filename" title={filePath || undefined}>
              {fileName}
              {isDirty && <span className="editor-dirty-dot"> ●</span>}
            </span>
          )}
        </div>

        <div className="editor-toolbar-right">
          <div className="edit-mode-tabs">
            <button
              className={`edit-mode-tab ${editMode === 'wysiwyg' ? 'active' : ''}`}
              onClick={() => setEditMode('wysiwyg')}
              title="所见即所得模式"
            >
              可视化
            </button>
            <button
              className={`edit-mode-tab ${editMode === 'source' ? 'active' : ''}`}
              onClick={() => setEditMode('source')}
              title="源码模式"
            >
              <FileEdit size={14} /> 源码
            </button>
            <button
              className={`edit-mode-tab ${editMode === 'preview' ? 'active' : ''}`}
              onClick={() => setEditMode('preview')}
              title="预览模式 (Ctrl+Shift+P)"
            >
              <Eye size={14} /> 预览
            </button>
          </div>
        </div>
      </div>

      {/* Editor area */}
      <div className="editor-area">
        {editMode === 'wysiwyg' && (
          <div className="editor-wysiwyg">
            {editor && (
              <BubbleMenu editor={editor} tippyOptions={{ duration: 150 }}>
                <div className="bubble-menu">
                  <button onClick={() => editor.chain().focus().toggleBold().run()}>
                    <strong>B</strong>
                  </button>
                  <button onClick={() => editor.chain().focus().toggleItalic().run()}>
                    <em>I</em>
                  </button>
                  <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                    H2
                  </button>
                  <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                    H3
                  </button>
                  <button onClick={() => editor.chain().focus().toggleBulletList().run()}>
                    列表
                  </button>
                </div>
              </BubbleMenu>
            )}
            <EditorContent editor={editor} />
          </div>
        )}

        {editMode === 'source' && (
          <textarea
            ref={sourceRef}
            className="editor-source-textarea"
            value={content || ''}
            onChange={handleSourceChange}
            spellCheck
          />
        )}

        {editMode === 'preview' && (
          <div
            className="editor-preview"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
      </div>
    </div>
  );
}
