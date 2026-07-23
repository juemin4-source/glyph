import { useEffect, useMemo, useRef, type ChangeEvent, type UIEvent } from 'react';
import type { FileSyncStatus } from '../types/fs';
import { countWords } from '../utils/markdown';

interface FsDocumentViewProps {
  content: string | null;
  filePath: string | null;
  fileName: string | null;
  status: FileSyncStatus;
  contentRevision: number;
  cursorLine: number;
  cursorColumn: number;
  scrollPosition: number;
  onContentChange: (content: string) => void;
  onSave: () => Promise<boolean>;
  onViewportChange: (state: {
    cursorLine?: number;
    cursorColumn?: number;
    scrollPosition?: number;
  }) => void;
}

function offsetFromLineColumn(content: string, line: number, column: number): number {
  const lines = content.split('\n');
  const safeLine = Math.max(0, Math.min(line, lines.length - 1));
  let offset = 0;
  for (let index = 0; index < safeLine; index += 1) offset += lines[index].length + 1;
  return Math.min(offset + Math.max(0, column), content.length);
}

function lineColumnFromOffset(content: string, offset: number): { line: number; column: number } {
  const safeOffset = Math.max(0, Math.min(offset, content.length));
  const before = content.slice(0, safeOffset);
  const lines = before.split('\n');
  return { line: lines.length - 1, column: lines[lines.length - 1].length };
}

const STATUS_TEXT: Record<FileSyncStatus, string> = {
  clean: '已保存',
  dirty: '未保存',
  saving: '正在保存',
  'save-error': '保存失败',
  conflict: '外部冲突',
  missing: '文件已丢失',
};

/**
 * A single truthful Markdown editor.
 * Gate A intentionally avoids WYSIWYG round-tripping so existing Markdown is never rewritten by a lossy serializer.
 */
export default function FsDocumentView({
  content,
  filePath,
  fileName,
  status,
  contentRevision,
  cursorLine,
  cursorColumn,
  scrollPosition,
  onContentChange,
  onSave,
  onViewportChange,
}: FsDocumentViewProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const restoredRevisionRef = useRef<number | null>(null);
  const wordCount = useMemo(() => countWords(content || ''), [content]);

  useEffect(() => {
    if (!textareaRef.current || content === null) return;
    if (restoredRevisionRef.current === contentRevision) return;
    restoredRevisionRef.current = contentRevision;
    const offset = offsetFromLineColumn(content, cursorLine, cursorColumn);
    const restore = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.setSelectionRange(offset, offset);
      textarea.scrollTop = scrollPosition;
    };
    if (typeof window.requestAnimationFrame === 'function') {
      const frame = window.requestAnimationFrame(restore);
      return () => window.cancelAnimationFrame(frame);
    }
    const timer = window.setTimeout(restore, 0);
    return () => window.clearTimeout(timer);
  }, [contentRevision, content, cursorLine, cursorColumn, scrollPosition]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void onSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSave]);

  if (!filePath || content === null) {
    return (
      <div className="fs-file-empty">
        <div className="fs-file-empty-icon">📝</div>
        <p>从左侧打开一份 Markdown，继续你的作品。</p>
      </div>
    );
  }

  const reportCursor = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const position = lineColumnFromOffset(content, textarea.selectionStart);
    onViewportChange({ cursorLine: position.line, cursorColumn: position.column });
  };

  return (
    <div className="fs-document-view fs-markdown-only">
      <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          <span className="editor-filename" title={filePath}>{fileName}</span>
          <span className={`fs-save-state fs-save-state-${status}`}>{STATUS_TEXT[status]}</span>
        </div>
        <div className="editor-toolbar-right">
          <span className="fs-word-count">{wordCount} 字</span>
          <span className="fs-editor-mode">Markdown</span>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        className="fs-markdown-textarea"
        aria-label="Markdown 正文编辑器"
        value={content}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onContentChange(event.target.value)}
        onClick={reportCursor}
        onKeyUp={reportCursor}
        onSelect={reportCursor}
        onScroll={(event: UIEvent<HTMLTextAreaElement>) => onViewportChange({ scrollPosition: event.currentTarget.scrollTop })}
        spellCheck
        readOnly={status === 'conflict' || status === 'missing'}
      />
    </div>
  );
}
