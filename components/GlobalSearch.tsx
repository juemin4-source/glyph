/**
 * GlobalSearch — Ctrl+K search modal for 织梦机 v1.2 (P1-08).
 *
 * Fuzzy + pinyin search via useGlobalSearch hook.
 * Results grouped by ObjectType.
 * Click navigates to object document.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { WorldObject } from '../types/world';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { Search, FileText, User, MapPin, Building2, Settings, Calendar, Package, BookOpen } from 'lucide-react';

interface GlobalSearchProps {
  objects: WorldObject[];
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (name: string) => void;
}

function renderTypeIcon(type: string): React.ReactNode {
  const iconMap: Record<string, React.ReactNode> = {
    '人物': <User size={14} />,
    '地点': <MapPin size={14} />,
    '组织': <Building2 size={14} />,
    '规则/机制': <Settings size={14} />,
    '事件': <Calendar size={14} />,
    '物品': <Package size={14} />,
    '术语': <BookOpen size={14} />,
    '章节': <FileText size={14} />,
  };
  return iconMap[type] || <FileText size={14} />;
}

export default function GlobalSearch({ objects, isOpen, onClose, onNavigate }: GlobalSearchProps) {
  const { query, setQuery, results, hasSearched } = useGlobalSearch(objects);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen, setQuery]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, getTotalResults() - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = getItemAtIndex(selectedIndex);
      if (item) {
        onNavigate(item.object.name);
        onClose();
      }
      return;
    }
  }, [onClose, onNavigate, selectedIndex, results]);

  function getTotalResults(): number {
    return results.reduce((sum, g) => sum + g.results.length, 0);
  }

  function getItemAtIndex(index: number): { object: WorldObject } | null {
    let count = 0;
    for (const group of results) {
      for (const item of group.results) {
        if (count === index) return item;
        count++;
      }
    }
    return null;
  }

  if (!isOpen) return null;

  return (
    <div
      className="dialog-overlay"
      style={{ zIndex: 900, alignItems: 'flex-start', paddingTop: '10vh' }}
      onClick={onClose}
    >
      <div
        style={{
          width: 520, maxWidth: '90vw', maxHeight: '60vh',
          background: '#1a1a1a', border: '1px solid #333', borderRadius: 12,
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={16} color="#666" />
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索对象名称、内容、标签、别名… (拼音/模糊)"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              fontSize: 15, color: '#e0e0e0', outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <kbd style={{ fontSize: 11, color: '#666', background: '#222', padding: '2px 6px', borderRadius: 3 }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {!hasSearched && !query && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#666', fontSize: 13 }}>
              输入关键词搜索对象
            </div>
          )}

          {hasSearched && results.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <Search size={28} style={{ opacity: 0.5, marginBottom: 8 }} />
              <div style={{ color: '#888', fontSize: 14 }}>无匹配结果</div>
              <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                尝试使用不同的关键词，或搜索对象的别名/标签
              </div>
            </div>
          )}

          {results.map((group) => (
            <div key={group.type} style={{ marginBottom: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 8px', fontSize: 11, color: '#888',
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}>
                <span>{renderTypeIcon(group.type)}</span>
                <span>{group.type}</span>
                <span style={{ fontSize: 10, color: '#555' }}>({group.results.length})</span>
              </div>
              {group.results.map((item) => (
                <div
                  key={item.object.id}
                  className="pool-item"
                  style={{
                    padding: '8px 12px', cursor: 'pointer', borderRadius: 6,
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: item.object === getItemAtIndex(selectedIndex)?.object ? '#1a1a2e' : 'transparent',
                  }}
                  onClick={() => { onNavigate(item.object.name); onClose(); }}
                  onMouseEnter={() => setSelectedIndex(results.flatMap(g => g.results).indexOf(item))}
                >
                  <span style={{ fontSize: 14 }}>{renderTypeIcon(item.object.type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: '#ccc', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.object.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#666', marginTop: 1 }}>
                      {item.matchField === 'name' ? '名称匹配' :
                       item.matchField === 'content' ? '内容匹配' :
                       item.matchField === 'tags' ? '标签匹配' : '别名匹配'}
                      {' · '}
                      <span style={{ color: '#888' }}>{item.object.status} · {item.object.canonLevel}</span>
                    </div>
                  </div>
                  {item.object.canonLevel && (
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 3,
                      background: item.object.canonLevel === '核心正典' ? '#3E2723' :
                                 item.object.canonLevel === '项目正典' ? '#1A237E' :
                                 item.object.canonLevel === '草案正典' ? '#4A148C' : '#333',
                      color: item.object.canonLevel === '核心正典' ? '#FFB74D' :
                             item.object.canonLevel === '项目正典' ? '#90CAF9' :
                             item.object.canonLevel === '草案正典' ? '#CE93D8' : '#999',
                    }}>
                      {item.object.canonLevel}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}

          {hasSearched && results.length > 0 && (
            <div style={{ padding: '8px 12px', fontSize: 11, color: '#555', textAlign: 'center', borderTop: '1px solid #1a1a1a', marginTop: 4 }}>
              方向键导航 · Enter 打开 · Esc 关闭
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
