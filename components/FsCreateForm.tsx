import React, { useState } from 'react';
import { FolderOpen } from 'lucide-react';

interface FsCreateFormProps {
  onConfirm: (name: string, rootPath: string, genre?: string) => void;
  onCancel: () => void;
}

const FsCreateForm: React.FC<FsCreateFormProps> = ({ onConfirm, onCancel }) => {
  const [name, setName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [genre, setGenre] = useState('');

  const handleSelectDir = async () => {
    // Use a prompt as a simple directory selector fallback
    // In production, this would use Tauri's dialog plugin
    const dir = prompt('选择或输入项目保存路径:', rootPath || '');
    if (dir) {
      setRootPath(dir);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const path = rootPath.trim() || name.trim();
    onConfirm(name.trim(), path, genre.trim() || undefined);
  };

  return (
    <form className="fs-create-form" onSubmit={handleSubmit}>
      <div className="fs-create-field">
        <label>作品名称 *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="我的小说"
          autoFocus
          required
        />
      </div>

      <div className="fs-create-field">
        <label>保存位置</label>
        <div className="fs-create-path-row">
          <input
            type="text"
            value={rootPath}
            onChange={(e) => setRootPath(e.target.value)}
            placeholder={`${name || '作品名'} 目录的完整路径`}
          />
          <button
            type="button"
            className="fs-create-browse-btn"
            onClick={handleSelectDir}
            title="选择目录"
          >
            <FolderOpen size={16} />
          </button>
        </div>
      </div>

      <div className="fs-create-field">
        <label>题材（可选）</label>
        <input
          type="text"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          placeholder="科幻、奇幻、推理..."
        />
      </div>

      <div className="fs-create-actions">
        <button
          type="button"
          className="fs-create-cancel-btn"
          onClick={onCancel}
        >
          取消
        </button>
        <button
          type="submit"
          className="fs-create-submit-btn"
          disabled={!name.trim()}
        >
          创建项目
        </button>
      </div>
    </form>
  );
};

export default FsCreateForm;
