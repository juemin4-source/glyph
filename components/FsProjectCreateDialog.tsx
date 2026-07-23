import { useMemo, useState, type ChangeEvent, type MouseEvent } from 'react';
import { FolderOpen } from 'lucide-react';

interface FsProjectCreateDialogProps {
  onChooseParent: () => Promise<string | null>;
  onConfirm: (name: string, rootPath: string) => Promise<void>;
  onCancel: () => void;
}

function safeFolderName(name: string): string {
  return name.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/[. ]+$/g, '') || '未命名作品';
}

function joinPath(parent: string, child: string): string {
  return `${parent.replace(/[\\/]+$/, '')}/${child}`;
}

export default function FsProjectCreateDialog({ onChooseParent, onConfirm, onCancel }: FsProjectCreateDialogProps) {
  const [name, setName] = useState('');
  const [parentPath, setParentPath] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const rootPath = useMemo(() => parentPath && name.trim() ? joinPath(parentPath, safeFolderName(name)) : '', [parentPath, name]);

  const chooseParent = async () => {
    const selected = await onChooseParent();
    if (selected) setParentPath(selected);
  };

  const submit = async () => {
    if (!name.trim() || !rootPath || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(name.trim(), rootPath);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onCancel}>
      <section className="fs-create-dialog" role="dialog" aria-modal="true" aria-labelledby="fs-create-title" onMouseDown={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}>
        <h2 id="fs-create-title">开始一部新作品</h2>
        <label>
          <span>作品名称</span>
          <input autoFocus value={name} onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)} placeholder="例如：边界来客" />
        </label>
        <label>
          <span>保存位置</span>
          <div className="fs-path-picker">
            <input value={parentPath} readOnly placeholder="选择一个父文件夹" />
            <button onClick={() => void chooseParent()}><FolderOpen size={15} /> 选择</button>
          </div>
        </label>
        {rootPath && <div className="fs-root-preview">将创建：{rootPath}</div>}
        <p className="fs-create-note">只会创建隔离的 .glyph 元数据和一份“正文.md”，不会强制生成目录骨架。</p>
        <footer>
          <button className="secondary" onClick={onCancel}>取消</button>
          <button className="primary" disabled={!rootPath || !name.trim() || submitting} onClick={() => void submit()}>
            {submitting ? '正在创建…' : '创建并开始写作'}
          </button>
        </footer>
      </section>
    </div>
  );
}
