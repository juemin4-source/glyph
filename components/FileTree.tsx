import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { ChevronRight, FileText, Folder, FolderOpen, MoreHorizontal, Plus, RefreshCw } from 'lucide-react';
import type { DirEntry } from '../types/fs';
import { useFsStore } from '../stores/fsStore';

interface TreeNodeProps {
  entry: DirEntry;
  depth: number;
}

function parentPath(path: string): string {
  const index = path.lastIndexOf('/');
  return index >= 0 ? path.slice(0, index) : '';
}

function replaceName(path: string, name: string): string {
  const parent = parentPath(path);
  return parent ? `${parent}/${name}` : name;
}

function isEditableText(entry: DirEntry): boolean {
  if (entry.isDir) return false;
  const extension = entry.extension.toLowerCase();
  return extension === 'md' || extension === 'markdown' || extension === 'txt';
}

function TreeNode({ entry, depth }: TreeNodeProps) {
  const {
    expandedPaths,
    childrenByPath,
    openFilePath,
    toggleDirectory,
    openFile,
    renameEntry,
    deleteEntry,
  } = useFsStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const expanded = entry.isDir && expandedPaths.has(entry.path);
  const children = childrenByPath[entry.path] || [];
  const active = !entry.isDir && openFilePath === entry.path;
  const editable = isEditableText(entry);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpen]);

  const handleOpen = async () => {
    if (entry.isDir) await toggleDirectory(entry.path);
    else if (editable) await openFile(entry.path);
  };

  const handleRename = async () => {
    setMenuOpen(false);
    const nextName = window.prompt('新名称：', entry.name)?.trim();
    if (!nextName || nextName === entry.name) return;
    await renameEntry(entry.path, replaceName(entry.path, nextName));
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    const confirmed = window.confirm(
      entry.isDir
        ? `确认删除空文件夹“${entry.name}”？`
        : `将“${entry.name}”移入织梦机回收区？`,
    );
    if (!confirmed) return;
    await deleteEntry(entry);
  };

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-item ${active ? 'active' : ''} ${!entry.isDir && !editable ? 'unsupported' : ''}`}
        style={{ paddingLeft: depth * 14 + 8 }}
        aria-disabled={!entry.isDir && !editable}
        title={!entry.isDir && !editable ? '阶段一仅编辑 Markdown 与纯文本文件' : entry.path}
        onClick={() => void handleOpen()}
        onContextMenu={(event: MouseEvent<HTMLDivElement>) => {
          event.preventDefault();
          setMenuOpen(true);
        }}
      >
        <span className={`folder-arrow ${expanded ? 'expanded' : ''}`}>
          {entry.isDir ? <ChevronRight size={13} /> : null}
        </span>
        <span className="file-tree-icon">
          {entry.isDir ? (expanded ? <FolderOpen size={15} /> : <Folder size={15} />) : <FileText size={15} />}
        </span>
        <span className="file-tree-name" title={entry.path}>{entry.name}</span>
        <button
          className="file-tree-more"
          aria-label={`${entry.name} 更多操作`}
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            setMenuOpen((value) => !value);
          }}
        >
          <MoreHorizontal size={14} />
        </button>
        {menuOpen && (
          <div className="file-tree-inline-menu" onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}>
            <button onClick={() => void handleRename()}>重命名</button>
            <button className="danger" onClick={() => void handleDelete()}>删除</button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="file-tree-children">
          {children.length === 0 ? (
            <div className="file-tree-empty" style={{ paddingLeft: (depth + 1) * 14 + 28 }}>空文件夹</div>
          ) : (
            children.map((child) => <TreeNode key={child.path} entry={child} depth={depth + 1} />)
          )}
        </div>
      )}
    </div>
  );
}

export default function FileTree() {
  const {
    activeProject,
    rootEntries,
    loading,
    refreshVisibleTree,
    createMarkdownFile,
    createFolder,
    openFilePath,
  } = useFsStore();
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  useEffect(() => {
    if (!createMenuOpen) return;
    const close = () => setCreateMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [createMenuOpen]);

  const defaultParent = useMemo(() => openFilePath ? parentPath(openFilePath) : '', [openFilePath]);

  const handleNewFile = async () => {
    setCreateMenuOpen(false);
    const suggested = defaultParent ? `${defaultParent}/未命名.md` : '未命名.md';
    const path = window.prompt('新建 Markdown（项目内相对路径）：', suggested)?.trim();
    if (path) await createMarkdownFile(path);
  };

  const handleNewFolder = async () => {
    setCreateMenuOpen(false);
    const suggested = defaultParent ? `${defaultParent}/新文件夹` : '新文件夹';
    const path = window.prompt('新建文件夹（项目内相对路径）：', suggested)?.trim();
    if (path) await createFolder(path);
  };

  return (
    <div className="file-tree-shell">
      <div className="file-tree-header">
        <div className="file-tree-project" title={activeProject?.rootPath}>{activeProject?.name || '项目'}</div>
        <div className="file-tree-actions">
          <button title="刷新" onClick={() => void refreshVisibleTree()}><RefreshCw size={14} /></button>
          <div className="file-tree-create-wrap">
            <button
              title="新建"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation();
                setCreateMenuOpen((value) => !value);
              }}
            >
              <Plus size={15} />
            </button>
            {createMenuOpen && (
              <div className="file-tree-create-menu" onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}>
                <button onClick={() => void handleNewFile()}>新建 Markdown</button>
                <button onClick={() => void handleNewFolder()}>新建文件夹</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="file-tree" onContextMenu={(event: MouseEvent<HTMLDivElement>) => event.preventDefault()}>
        {loading && rootEntries.length === 0 ? (
          <div className="file-tree-loading">正在读取目录…</div>
        ) : rootEntries.length === 0 ? (
          <div className="file-tree-empty">项目里还没有文件</div>
        ) : (
          rootEntries.map((entry) => <TreeNode key={entry.path} entry={entry} depth={0} />)
        )}
      </div>
    </div>
  );
}
