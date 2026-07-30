import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type UIEvent,
  type ReactNode,
} from 'react';
import {
  Bold,
  Code2,
  Eye,
  FileEdit,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Undo2,
} from 'lucide-react';
import type { FileSyncStatus } from '../types/fs';
import type { EditorSelectionContext, ProvenanceRecord } from '../types/fs-ai';
import { countWords } from '../utils/markdown';
import { editorHtmlToMarkdown, markdownToEditorHtml } from '../utils/markdown-editor';
import { useCanonStore } from '../stores/canonStore';

/** Post-process HTML to convert [[entity]] wiki links into clickable elements */
function renderWikiLinksInHtml(html: string): string {
  return html.replace(
    /\[\[([^\[\]]+?)\]\]/g,
    (_match, inner: string) => {
      const parts = inner.split('|');
      const label = parts[1]?.trim() || parts[0].split(':').pop()?.trim() || inner;
      const typeAndName = parts[0].split(':');
      const type = typeAndName.length > 1 ? typeAndName[0].trim() : '';
      const name = (typeAndName.length > 1 ? typeAndName[1] : typeAndName[0]).trim();
      const escaped = name.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const typeAttr = type ? ` data-type="${type.replace(/"/g, '&quot;')}"` : '';
      return `<wiki-link data-entity="${escaped}"${typeAttr}>${label}</wiki-link>`;
    }
  );
}

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
  onSelectionChange: (selection: EditorSelectionContext | null) => void;
  sourceMode?: boolean;
  provenance?: ProvenanceRecord[];
  onSourceModeToggle?: () => void;
}

type EditMode = 'wysiwyg' | 'source' | 'preview';

type SlashCommand = {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  command: () => void;
};

type FloatingPosition = { top: number; left: number } | null;

const START_MARKER = '\uE200GLYPH_SELECTION_START\uE201';
const END_MARKER = '\uE202GLYPH_SELECTION_END\uE203';
const CURSOR_MARKER = '\uE204GLYPH_CURSOR\uE205';

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

function nodePath(root: Node, node: Node): number[] | null {
  const path: number[] = [];
  let current: Node | null = node;
  while (current && current !== root) {
    const parent: Node | null = current.parentNode;
    if (!parent) return null;
    const index = Array.prototype.indexOf.call(parent.childNodes, current) as number;
    if (index < 0) return null;
    path.unshift(index);
    current = parent;
  }
  return current === root ? path : null;
}

function resolvePath(root: Node, path: number[]): Node | null {
  let current: Node = root;
  for (const index of path) {
    const next = current.childNodes.item(index);
    if (!next) return null;
    current = next;
  }
  return current;
}

function cloneRangeIntoRoot(root: HTMLElement, range: Range): { clone: HTMLElement; range: Range } | null {
  const startPath = nodePath(root, range.startContainer);
  const endPath = nodePath(root, range.endContainer);
  if (!startPath || !endPath) return null;

  const clone = root.cloneNode(true) as HTMLElement;
  const start = resolvePath(clone, startPath);
  const end = resolvePath(clone, endPath);
  if (!start || !end) return null;

  const clonedRange = document.createRange();
  try {
    clonedRange.setStart(start, Math.min(range.startOffset, start.nodeType === Node.TEXT_NODE ? (start.nodeValue?.length ?? 0) : start.childNodes.length));
    clonedRange.setEnd(end, Math.min(range.endOffset, end.nodeType === Node.TEXT_NODE ? (end.nodeValue?.length ?? 0) : end.childNodes.length));
    return { clone, range: clonedRange };
  } catch {
    return null;
  }
}

function markdownSelectionFromDom(root: HTMLElement, range: Range): {
  markdown: string;
  start: number;
  end: number;
  text: string;
} | null {
  const cloned = cloneRangeIntoRoot(root, range);
  if (!cloned) return null;

  if (range.collapsed) {
    cloned.range.insertNode(document.createTextNode(CURSOR_MARKER));
    const marked = editorHtmlToMarkdown(cloned.clone.innerHTML);
    const cursor = marked.indexOf(CURSOR_MARKER);
    if (cursor < 0) return null;
    const markdown = marked.replace(CURSOR_MARKER, '');
    return { markdown, start: cursor, end: cursor, text: '' };
  }

  const endRange = cloned.range.cloneRange();
  endRange.collapse(false);
  endRange.insertNode(document.createTextNode(END_MARKER));
  const startRange = cloned.range.cloneRange();
  startRange.collapse(true);
  startRange.insertNode(document.createTextNode(START_MARKER));

  const marked = editorHtmlToMarkdown(cloned.clone.innerHTML);
  const startIndex = marked.indexOf(START_MARKER);
  const endIndex = marked.indexOf(END_MARKER);
  if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) return null;

  const withoutStart = marked.replace(START_MARKER, '');
  const adjustedEnd = endIndex - START_MARKER.length;
  const markdown = withoutStart.replace(END_MARKER, '');
  return {
    markdown,
    start: startIndex,
    end: adjustedEnd,
    text: markdown.slice(startIndex, adjustedEnd),
  };
}

function pointAtPlainTextOffset(root: HTMLElement, target: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, target);
  let last: Text | null = null;
  let current = walker.nextNode() as Text | null;
  while (current) {
    last = current;
    const length = current.nodeValue?.length ?? 0;
    if (remaining <= length) return { node: current, offset: remaining };
    remaining -= length;
    current = walker.nextNode() as Text | null;
  }
  if (last) return { node: last, offset: last.nodeValue?.length ?? 0 };
  return { node: root, offset: root.childNodes.length };
}

function markdownOffsetAtPlainTextOffset(root: HTMLElement, plainOffset: number): number {
  const point = pointAtPlainTextOffset(root, plainOffset);
  const range = document.createRange();
  range.setStart(point.node, point.offset);
  range.collapse(true);
  return markdownSelectionFromDom(root, range)?.start ?? 0;
}

function setVisualCursorFromMarkdownOffset(root: HTMLElement, markdownOffset: number): void {
  const total = root.textContent?.length ?? 0;
  let low = 0;
  let high = total;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const mapped = markdownOffsetAtPlainTextOffset(root, middle);
    if (mapped < markdownOffset) low = middle + 1;
    else high = middle;
  }
  const point = pointAtPlainTextOffset(root, low);
  const range = document.createRange();
  range.setStart(point.node, point.offset);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function selectionBelongsTo(root: HTMLElement, selection: Selection | null): selection is Selection {
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  return root.contains(range.startContainer) && root.contains(range.endContainer);
}

function nearestTextBeforeCursor(range: Range): { node: Text; slashOffset: number; query: string } | null {
  if (!range.collapsed || range.startContainer.nodeType !== Node.TEXT_NODE) return null;
  const node = range.startContainer as Text;
  const before = (node.nodeValue ?? '').slice(0, range.startOffset);
  const match = before.match(/(?:^|\s)\/([^/\s]*)$/);
  if (!match) return null;
  const slashOffset = range.startOffset - match[1].length - 1;
  return { node, slashOffset, query: match[1] };
}

function caretPosition(range: Range): FloatingPosition {
  const rect = range.getBoundingClientRect();
  if (!rect) return null;
  return { top: rect.bottom + 8, left: Math.max(12, Math.min(rect.left, window.innerWidth - 280)) };
}

interface ProvenanceMarker {
  topPct: number;
  heightPct: number;
  state: string;
  label: string;
}

function computeProvenanceMarkers(content: string, records: ProvenanceRecord[]): ProvenanceMarker[] {
  if (!content || records.length === 0) return [];
  const total = content.length;
  if (total === 0) return [];
  return records.map((record) => {
    const start = Math.max(0, Math.min(record.startOffset, total - 1));
    const end = Math.max(start, Math.min(record.endOffset, total));
    const topPct = (start / total) * 100;
    const heightPct = Math.max(0.5, ((end - start) / total) * 100);
    const stateLabel = record.currentState === 'ai_original' ? 'AI 写入' :
      record.currentState === 'ai_edited_by_user' ? '用户已编辑' : '来源可能失准';
    return {
      topPct,
      heightPct,
      state: record.currentState,
      label: `${stateLabel}: ${record.textBlock.slice(0, 60)}`,
    };
  });
}

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
  onSelectionChange,
  sourceMode = false,
  provenance = [],
  onSourceModeToggle,
}: FsDocumentViewProps) {
  const [editMode, setEditMode] = useState<EditMode>('wysiwyg');
  const [bubblePosition, setBubblePosition] = useState<FloatingPosition>(null);
  const [slashPosition, setSlashPosition] = useState<FloatingPosition>(null);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const visualRef = useRef<HTMLDivElement | null>(null);
  const visualScrollRef = useRef<HTMLDivElement | null>(null);
  const sourceRef = useRef<HTMLTextAreaElement | null>(null);
  const slashRangeRef = useRef<Range | null>(null);
  const restoredKeyRef = useRef<string | null>(null);
  const contentRef = useRef(content ?? '');
  const readOnly = status === 'conflict' || status === 'missing';
  const wordCount = useMemo(() => countWords(content || ''), [content]);

  useEffect(() => {
    contentRef.current = content ?? '';
  }, [content]);

  const syncVisualFromMarkdown = useCallback((markdown: string) => {
    const root = visualRef.current;
    if (!root) return;
    const current = editorHtmlToMarkdown(root.innerHTML);
    if (current === markdown) return;
    // Render wiki links [[entity]] after markdown → HTML conversion
    root.innerHTML = renderWikiLinksInHtml(markdownToEditorHtml(markdown));
  }, []);

  // Wiki link click handler
  const handleWikiLinkClick = useCallback((e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest('wiki-link') as HTMLElement | null;
    if (!link) return;
    e.preventDefault();
    e.stopPropagation();
    const entityName = link.getAttribute('data-entity');
    if (!entityName) return;
    const entities = useCanonStore.getState().entities;
    const entity = entities.find((e) => e.name === entityName);
    if (entity) {
      alert(`[${entity.type}] ${entity.name}\n${entity.summary || '(无摘要)'}`);
    } else {
      alert(`未找到设定「${entityName}」。运行 /scan 或手动创建。`);
    }
  }, []);

  // Attach wiki link click handler to visual editor container
  useEffect(() => {
    const root = visualRef.current;
    if (!root) return;
    root.addEventListener('click', handleWikiLinkClick);
    return () => root.removeEventListener('click', handleWikiLinkClick);
  }, [handleWikiLinkClick]);

  const reportSourceSelection = useCallback(() => {
    const textarea = sourceRef.current;
    const markdown = contentRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const startPosition = lineColumnFromOffset(markdown, start);
    const endPosition = lineColumnFromOffset(markdown, end);
    onViewportChange({ cursorLine: startPosition.line, cursorColumn: startPosition.column });
    onSelectionChange({
      start,
      end,
      text: markdown.slice(start, end),
      cursorOffset: start,
      startLine: startPosition.line,
      endLine: endPosition.line,
    });
  }, [onSelectionChange, onViewportChange]);

  const reportVisualSelection = useCallback(() => {
    const root = visualRef.current;
    const selection = window.getSelection();
    if (!root || !selectionBelongsTo(root, selection)) {
      setBubblePosition(null);
      onSelectionChange(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const mapped = markdownSelectionFromDom(root, range);
    if (!mapped) return;
    const startPosition = lineColumnFromOffset(mapped.markdown, mapped.start);
    const endPosition = lineColumnFromOffset(mapped.markdown, mapped.end);
    onViewportChange({ cursorLine: startPosition.line, cursorColumn: startPosition.column });
    onSelectionChange({
      start: mapped.start,
      end: mapped.end,
      text: mapped.text,
      cursorOffset: mapped.start,
      startLine: startPosition.line,
      endLine: endPosition.line,
    });

    if (range.collapsed) {
      setBubblePosition(null);
      const slash = nearestTextBeforeCursor(range);
      if (slash) {
        const slashRange = document.createRange();
        slashRange.setStart(slash.node, slash.slashOffset);
        slashRange.setEnd(slash.node, range.startOffset);
        slashRangeRef.current = slashRange.cloneRange();
        setSlashQuery(slash.query);
        setSlashPosition(caretPosition(range));
        setSlashIndex(0);
      } else {
        slashRangeRef.current = null;
        setSlashPosition(null);
      }
    } else {
      slashRangeRef.current = null;
      setSlashPosition(null);
      const rect = range.getBoundingClientRect();
      setBubblePosition({
        top: Math.max(8, rect.top - 44),
        left: Math.max(12, Math.min(rect.left + rect.width / 2 - 90, window.innerWidth - 200)),
      });
    }
  }, [onSelectionChange, onViewportChange]);

  const handleVisualInput = useCallback(() => {
    const root = visualRef.current;
    if (!root) return;
    const markdown = editorHtmlToMarkdown(root.innerHTML);
    contentRef.current = markdown;
    onContentChange(markdown);
    reportVisualSelection();
  }, [onContentChange, reportVisualSelection]);

  const runCommand = useCallback((command: string, value?: string) => {
    const root = visualRef.current;
    if (!root || readOnly) return;
    root.focus();
    document.execCommand(command, false, value);
    window.requestAnimationFrame(handleVisualInput);
  }, [handleVisualInput, readOnly]);

  const insertHorizontalRule = useCallback(() => {
    runCommand('insertHorizontalRule');
  }, [runCommand]);

  const slashCommands = useMemo<SlashCommand[]>(() => [
    { id: 'h1', label: '标题 1', description: '大标题', icon: <Heading1 size={16} />, command: () => runCommand('formatBlock', 'H1') },
    { id: 'h2', label: '标题 2', description: '章节标题', icon: <Heading2 size={16} />, command: () => runCommand('formatBlock', 'H2') },
    { id: 'h3', label: '标题 3', description: '小节标题', icon: <Heading3 size={16} />, command: () => runCommand('formatBlock', 'H3') },
    { id: 'bullet', label: '无序列表', description: '项目符号', icon: <List size={16} />, command: () => runCommand('insertUnorderedList') },
    { id: 'ordered', label: '有序列表', description: '编号列表', icon: <ListOrdered size={16} />, command: () => runCommand('insertOrderedList') },
    { id: 'quote', label: '引用', description: '引用块', icon: <Quote size={16} />, command: () => runCommand('formatBlock', 'BLOCKQUOTE') },
    { id: 'code', label: '代码块', description: '预格式文本', icon: <Code2 size={16} />, command: () => runCommand('formatBlock', 'PRE') },
    { id: 'divider', label: '分割线', description: '章节分隔', icon: <Minus size={16} />, command: insertHorizontalRule },
  ], [insertHorizontalRule, runCommand]);

  const filteredSlashCommands = useMemo(() => {
    const query = slashQuery.trim().toLowerCase();
    if (!query) return slashCommands;
    return slashCommands.filter((item) => `${item.label} ${item.description} ${item.id}`.toLowerCase().includes(query));
  }, [slashCommands, slashQuery]);

  const executeSlashCommand = useCallback((item: SlashCommand) => {
    const range = slashRangeRef.current;
    const root = visualRef.current;
    if (!range || !root) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    range.deleteContents();
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    setSlashPosition(null);
    slashRangeRef.current = null;
    item.command();
  }, []);

  useEffect(() => {
    if (!slashPosition) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSlashIndex((value) => filteredSlashCommands.length ? (value + 1) % filteredSlashCommands.length : 0);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSlashIndex((value) => filteredSlashCommands.length ? (value - 1 + filteredSlashCommands.length) % filteredSlashCommands.length : 0);
      } else if (event.key === 'Enter' && filteredSlashCommands[slashIndex]) {
        event.preventDefault();
        executeSlashCommand(filteredSlashCommands[slashIndex]);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setSlashPosition(null);
        slashRangeRef.current = null;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [executeSlashCommand, filteredSlashCommands, slashIndex, slashPosition]);

  useEffect(() => {
    if (!filePath || content === null) return;
    if (editMode === 'wysiwyg' || editMode === 'preview') syncVisualFromMarkdown(content);

    const key = `${filePath}:${contentRevision}:${editMode}`;
    if (restoredKeyRef.current === key) return;
    restoredKeyRef.current = key;
    const markdownOffset = offsetFromLineColumn(content, cursorLine, cursorColumn);

    const frame = window.requestAnimationFrame(() => {
      if (editMode === 'source') {
        const textarea = sourceRef.current;
        if (!textarea) return;
        textarea.setSelectionRange(markdownOffset, markdownOffset);
        textarea.scrollTop = scrollPosition;
        reportSourceSelection();
        return;
      }
      const root = visualRef.current;
      const scroller = visualScrollRef.current;
      if (!root || !scroller) return;
      scroller.scrollTop = scrollPosition;
      if (editMode === 'wysiwyg') {
        setVisualCursorFromMarkdownOffset(root, markdownOffset);
        reportVisualSelection();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    content,
    contentRevision,
    cursorColumn,
    cursorLine,
    editMode,
    filePath,
    reportSourceSelection,
    reportVisualSelection,
    scrollPosition,
    syncVisualFromMarkdown,
  ]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void onSave();
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setEditMode((mode) => mode === 'preview' ? 'wysiwyg' : 'preview');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSave]);

  useEffect(() => {
    onSelectionChange(null);
    setBubblePosition(null);
    setSlashPosition(null);
  }, [filePath, contentRevision, editMode, onSelectionChange]);

  if (!filePath || content === null) {
    return (
      <div className="fs-file-empty">
        <div className="fs-file-empty-icon">📝</div>
        <p>从左侧打开一份 Markdown，继续你的作品。</p>
      </div>
    );
  }

  return (
    <div className="fs-document-view fs-rich-markdown-editor">
      <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          <span className="editor-filename" title={filePath}>{fileName}</span>
          <span className={`fs-save-state fs-save-state-${status}`}>{STATUS_TEXT[status]}</span>
        </div>
        <div className="editor-toolbar-right">
          <span className="fs-word-count">{wordCount} 字</span>
          <div className="edit-mode-tabs" aria-label="编辑模式">
            <button className={`edit-mode-tab ${editMode === 'wysiwyg' ? 'active' : ''}`} onClick={() => setEditMode('wysiwyg')}>可视化</button>
            <button className={`edit-mode-tab ${editMode === 'source' ? 'active' : ''}`} onClick={() => setEditMode('source')}><FileEdit size={13} />源码</button>
            <button className={`edit-mode-tab ${editMode === 'preview' ? 'active' : ''}`} onClick={() => setEditMode('preview')}><Eye size={13} />预览</button>
          </div>
          {onSourceModeToggle && (
            <button
              className={`fs-source-mode-toggle ${sourceMode ? 'active' : ''}`}
              onClick={onSourceModeToggle}
              title={sourceMode ? '关闭来源模式' : '显示 AI 写入标记'}
            >
              {sourceMode ? '来源' : '纯净'}
            </button>
          )}
        </div>
      </div>

      {editMode === 'wysiwyg' && (
        <div className="fs-format-toolbar" aria-label="Markdown 格式工具">
          <button title="撤销" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('undo')}><Undo2 size={15} /></button>
          <button title="重做" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('redo')}><Redo2 size={15} /></button>
          <span className="fs-format-separator" />
          <button title="加粗" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('bold')}><Bold size={15} /></button>
          <button title="斜体" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('italic')}><Italic size={15} /></button>
          <span className="fs-format-separator" />
          <button title="标题 1" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'H1')}><Heading1 size={15} /></button>
          <button title="标题 2" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'H2')}><Heading2 size={15} /></button>
          <button title="标题 3" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'H3')}><Heading3 size={15} /></button>
          <span className="fs-format-separator" />
          <button title="无序列表" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('insertUnorderedList')}><List size={15} /></button>
          <button title="有序列表" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('insertOrderedList')}><ListOrdered size={15} /></button>
          <button title="引用" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'BLOCKQUOTE')}><Quote size={15} /></button>
          <button title="代码块" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'PRE')}><Code2 size={15} /></button>
          <button title="分割线" onMouseDown={(event) => event.preventDefault()} onClick={insertHorizontalRule}><Minus size={15} /></button>
          <span className="fs-format-hint">输入 / 可快速插入结构</span>
        </div>
      )}

      <div className={`fs-editor-area ${sourceMode && provenance.length > 0 ? 'fs-provenance-mode' : ''}`}>
        {sourceMode && provenance.length > 0 && (
          <div className="fs-provenance-strip" aria-hidden="true">
            {computeProvenanceMarkers(content || '', provenance).map((marker, i) => (
              <div
                key={i}
                className={`fs-provenance-marker fs-provenance-marker-${marker.state}`}
                style={{ top: `${marker.topPct}%`, height: `${marker.heightPct}%` }}
                title={marker.label}
              />
            ))}
          </div>
        )}
        {editMode === 'source' ? (
          <textarea
            ref={sourceRef}
            className={`editor-source-textarea fs-source-editor ${sourceMode ? 'fs-source-provenance' : ''}`}
            aria-label="Markdown 源码编辑器"
            value={content}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
              contentRef.current = event.target.value;
              onContentChange(event.target.value);
            }}
            onClick={reportSourceSelection}
            onKeyUp={reportSourceSelection}
            onSelect={reportSourceSelection}
            onScroll={(event: UIEvent<HTMLTextAreaElement>) => onViewportChange({ scrollPosition: event.currentTarget.scrollTop })}
            spellCheck
            readOnly={readOnly}
          />
        ) : (
          <div
            ref={visualScrollRef}
            className={`fs-editor-scroll ${editMode === 'preview' ? 'is-preview' : ''} ${sourceMode ? 'fs-source-provenance' : ''}`}
            onScroll={(event: UIEvent<HTMLDivElement>) => onViewportChange({ scrollPosition: event.currentTarget.scrollTop })}
          >
            <div
              ref={visualRef}
              className={`fs-visual-editor ${editMode === 'preview' ? 'fs-editor-preview' : ''}`}
              contentEditable={editMode === 'wysiwyg' && !readOnly}
              suppressContentEditableWarning
              role="textbox"
              aria-label={editMode === 'preview' ? 'Markdown 预览' : 'Markdown 可视化编辑器'}
              data-placeholder="在这里继续你的作品……"
              onInput={handleVisualInput}
              onMouseUp={reportVisualSelection}
              onKeyUp={reportVisualSelection}
              onClick={reportVisualSelection}
              spellCheck={editMode === 'wysiwyg'}
            />
          </div>
        )}
      </div>

      {bubblePosition && editMode === 'wysiwyg' && (
        <div className="fs-bubble-menu" style={bubblePosition}>
          <button onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('bold')} title="加粗"><Bold size={14} /></button>
          <button onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('italic')} title="斜体"><Italic size={14} /></button>
          <button onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'H2')} title="标题 2">H2</button>
          <button onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'BLOCKQUOTE')} title="引用"><Quote size={14} /></button>
        </div>
      )}

      {slashPosition && editMode === 'wysiwyg' && (
        <div className="fs-slash-menu" style={slashPosition} role="listbox" aria-label="插入结构">
          {filteredSlashCommands.length === 0 ? (
            <div className="fs-slash-empty">没有匹配的命令</div>
          ) : filteredSlashCommands.map((item, index) => (
            <button
              key={item.id}
              className={index === slashIndex ? 'active' : ''}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setSlashIndex(index)}
              onClick={() => executeSlashCommand(item)}
            >
              <span className="fs-slash-icon">{item.icon}</span>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
