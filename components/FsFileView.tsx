import React, { useEffect, useRef, useCallback } from 'react';

interface FsFileViewProps {
  content: string | null;
  filePath: string | null;
  fileName: string | null;
  isDirty: boolean;
  onContentChange: (content: string) => void;
  onSave: () => Promise<boolean>;
}

/**
 * FsFileView — Simple text area for editing filesystem Markdown files.
 * Phase 1: plain textarea. Future: Tiptap integration.
 */
const FsFileView: React.FC<FsFileViewProps> = ({
  content,
  filePath,
  fileName,
  isDirty,
  onContentChange,
  onSave,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-save with Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSave]);

  // Focus textarea when file changes
  useEffect(() => {
    textareaRef.current?.focus();
  }, [filePath]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onContentChange(e.target.value);
    },
    [onContentChange],
  );

  if (!filePath) {
    return (
      <div className="fs-file-empty">
        <div className="fs-file-empty-icon">📝</div>
        <p>选择一个文件开始编辑</p>
      </div>
    );
  }

  return (
    <div className="fs-file-view">
      <div className="fs-file-header">
        <div className="fs-file-path">{filePath}</div>
        <div className={`fs-file-status ${isDirty ? 'unsaved' : 'saved'}`}>
          {isDirty ? '未保存' : '已保存'}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        className="fs-file-textarea"
        value={content || ''}
        onChange={handleChange}
        spellCheck
        placeholder="开始写作..."
      />
    </div>
  );
};

export default FsFileView;
