import React, { useEffect, useState, useCallback } from 'react';
import type { DirEntry } from '../types/fs';
import { useFsStore } from '../stores/fsStore';

interface FileTreeProps {
  onFileSelect: (path: string) => void;
  onContextMenu?: (entry: DirEntry, x: number, y: number) => void;
}

interface TreeNode {
  entry: DirEntry;
  children: TreeNode[];
  depth: number;
}

/**
 * FileTree — Recursive file tree component for the project sidebar.
 * Shows directories and Markdown files, with expand/collapse and file selection.
 */
const FileTree: React.FC<FileTreeProps> = ({ onFileSelect }) => {
  const {
    activeFsProject,
    fileTree,
    currentPath,
    navigateToDir,
    openFile,
    openFilePath,
    expandedPaths,
    toggleExpanded,
    refreshTree,
    loading,
  } = useFsStore();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: DirEntry;
  } | null>(null);

  // Build tree from flat list (current directory level)
  const buildTree = useCallback(
    (entries: DirEntry[], depth: number): TreeNode[] => {
      const dirs = entries.filter((e) => e.isDir);
      const files = entries.filter((e) => !e.isDir);
      const nodes: TreeNode[] = [];

      for (const dir of dirs) {
        nodes.push({
          entry: dir,
          children: [],
          depth,
        });
      }
      for (const file of files) {
        nodes.push({
          entry: file,
          children: [],
          depth,
        });
      }
      return nodes;
    },
    [],
  );

  const handleClick = async (entry: DirEntry) => {
    if (entry.isDir) {
      // Toggle expanded and navigate
      if (expandedPaths.has(entry.path)) {
        toggleExpanded(entry.path);
      } else {
        toggleExpanded(entry.path);
        await navigateToDir(entry.path);
      }
    } else {
      await openFile(entry.path);
      onFileSelect(entry.path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, entry: DirEntry) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const getFileIcon = (entry: DirEntry): string => {
    if (entry.isDir) {
      const isExpanded = expandedPaths.has(entry.path);
      return isExpanded ? '📂' : '📁';
    }
    switch (entry.extension.toLowerCase()) {
      case 'md':
      case 'markdown':
        return '📝';
      case 'txt':
        return '📄';
      case 'json':
        return '⚙️';
      default:
        return '📄';
    }
  };

  const nodes = buildTree(fileTree, 0);

  return (
    <div className="file-tree" onContextMenu={(e) => e.preventDefault()}>
      {loading && nodes.length === 0 && (
        <div className="file-tree-loading">Loading...</div>
      )}

      {!loading && nodes.length === 0 && currentPath !== '' && (
        <div className="file-tree-empty">Empty folder</div>
      )}

      {/* Breadcrumb / current path */}
      {currentPath && (
        <div
          className="file-tree-up"
          onClick={() => {
            const parent = currentPath.split('/').slice(0, -1).join('/');
            navigateToDir(parent || '');
          }}
          title="Go up"
        >
          📁 ..
        </div>
      )}

      {nodes.map((node) => (
        <FileTreeNode
          key={node.entry.path}
          node={node}
          expandedPaths={expandedPaths}
          openFilePath={openFilePath}
          onToggle={toggleExpanded}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onNavigate={navigateToDir}
        />
      ))}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="file-tree-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div
            className="file-tree-context-item"
            onClick={async () => {
              if (contextMenu.entry.isDir) {
                await navigateToDir(contextMenu.entry.path);
              } else {
                await openFile(contextMenu.entry.path);
                onFileSelect(contextMenu.entry.path);
              }
              setContextMenu(null);
            }}
          >
            Open
          </div>
          <div
            className="file-tree-context-item"
            onClick={() => {
              // Future: rename
              setContextMenu(null);
            }}
          >
            Rename
          </div>
          <div
            className="file-tree-context-item danger"
            onClick={() => {
              // Future: delete
              setContextMenu(null);
            }}
          >
            Delete
          </div>
        </div>
      )}
    </div>
  );
};

// Individual tree node with recursive children
interface FileTreeNodeProps {
  node: TreeNode;
  expandedPaths: Set<string>;
  openFilePath: string | null;
  onToggle: (path: string) => void;
  onClick: (entry: DirEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: DirEntry) => void;
  onNavigate: (path: string) => Promise<void>;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  node,
  expandedPaths,
  openFilePath,
  onToggle,
  onClick,
  onContextMenu,
  onNavigate,
}) => {
  const isActive = node.entry.path === openFilePath;
  const isExpanded = expandedPaths.has(node.entry.path);
  const [children, setChildren] = useState<DirEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const { activeFsProject } = useFsStore();

  // Load children when expanded
  useEffect(() => {
    if (isExpanded && !loaded && activeFsProject) {
      import('../tauri-api').then(async ({ listDirectory }) => {
        try {
          const entries = await listDirectory(activeFsProject.rootPath, node.entry.path);
          setChildren(entries);
          setLoaded(true);
        } catch {
          // Ignore errors loading children
        }
      });
    }
  }, [isExpanded, loaded, node.entry.path, activeFsProject]);

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-item ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
        onClick={() => onClick(node.entry)}
        onContextMenu={(e) => onContextMenu(e, node.entry)}
      >
        <span className="file-tree-icon">
          {node.entry.isDir ? (
            <span className={`folder-arrow ${isExpanded ? 'expanded' : ''}`}>
              ▶
            </span>
          ) : null}
        </span>
        <span className="file-tree-icon">
          {node.entry.isDir
            ? (isExpanded ? '📂' : '📁')
            : node.entry.extension === 'md' || node.entry.extension === 'markdown'
              ? '📝'
              : '📄'}
        </span>
        <span className="file-tree-name">{node.entry.name}</span>
      </div>

      {/* Children (only show when expanded) */}
      {isExpanded && (
        <div className="file-tree-children">
          {children.length === 0 && loaded && (
            <div className="file-tree-empty" style={{ paddingLeft: `${(node.depth + 1) * 16 + 8}px` }}>
              Empty
            </div>
          )}
          {children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={{ entry: child, children: [], depth: node.depth + 1 }}
              expandedPaths={expandedPaths}
              openFilePath={openFilePath}
              onToggle={onToggle}
              onClick={onClick}
              onContextMenu={onContextMenu}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FileTree;
