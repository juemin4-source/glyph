import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import type { Project } from '../types/world';
import QuickDraftButton from '../features/quick-draft/QuickDraftButton';
import QuickDraftPanel from '../features/quick-draft/QuickDraftPanel';
import { seedDemoProject, isDemoSeeded } from '../api/demoApi';
import * as api from '../tauri-api';

interface BookshelfProps {
  projects: Project[];
  onEnterProject: (project: Project) => void;
  onCreateProject?: () => void;
  onTransferred?: (projectId: string) => void;
  onRefreshProjects?: () => Promise<void>;
}

const STATUS_LABEL: Record<Project['status'], string> = {
  drafting: '草稿中',
  conceiving: '构思中',
  editing: '修改中',
  done: '已完成',
  demo: '示例作品',
};

const STATUS_COLOR: Record<Project['status'], string> = {
  drafting: '#FF9800',
  conceiving: '#666666',
  editing: '#CE93D8',
  done: '#4CAF50',
  demo: '#B7FF00',
};

const GENRE_GRADIENT_BG: Record<string, string> = {
  '科幻': 'linear-gradient(145deg, #1a1a3e, #0d0d2b, #16213e, #0f3460, #1a1a3e)',
  '奇幻': 'linear-gradient(145deg, #1a2e1a, #0f1f0f, #1e3a1e, #2a4a1a, #1a2e1a)',
  '武侠': 'linear-gradient(145deg, #2e1a1a, #1f0f0f, #3e1e1a, #4a2a1a, #2e1a1a)',
  '悬疑': 'linear-gradient(145deg, #1a1a2e, #0f0f1a, #2a2a3e, #1a1a2e, #0f0f1a)',
  '历史': 'linear-gradient(145deg, #2e2a1a, #1f1f0f, #3e3a1e, #2e2a1a, #1f1f0f)',
  '都市': 'linear-gradient(145deg, #1a2a3e, #0f1f2e, #1e3a4e, #1a2a3e, #0f1f2e)',
  '其他': 'linear-gradient(145deg, #1e1e1e, #141416, #2a2a2a, #1e1e1e, #141416)',
  '未分类': 'linear-gradient(145deg, #1e1e1e, #141416, #2a2a2a, #1e1e1e, #141416)',
};

const GENRE_RADIAL_GLOW: Record<string, string> = {
  '科幻': 'radial-gradient(ellipse 80% 50% at 20% 30%, rgba(144,202,249,0.12) 0%, transparent 70%), radial-gradient(ellipse 50% 60% at 80% 70%, rgba(206,147,216,0.10) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 50% 10%, rgba(183,255,0,0.04) 0%, transparent 60%)',
  '奇幻': 'radial-gradient(ellipse 70% 50% at 70% 20%, rgba(183,255,0,0.10) 0%, transparent 60%), radial-gradient(ellipse 50% 60% at 30% 70%, rgba(255,183,77,0.08) 0%, transparent 50%), radial-gradient(ellipse 40% 50% at 50% 50%, rgba(144,202,249,0.06) 0%, transparent 50%)',
  '武侠': 'radial-gradient(ellipse 70% 50% at 30% 25%, rgba(255,183,77,0.12) 0%, transparent 60%), radial-gradient(ellipse 50% 60% at 70% 70%, rgba(244,67,54,0.06) 0%, transparent 50%), radial-gradient(ellipse 40% 50% at 50% 50%, rgba(255,152,0,0.05) 0%, transparent 50%)',
  '悬疑': 'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(148,130,201,0.10) 0%, transparent 60%), radial-gradient(ellipse 40% 50% at 50% 70%, rgba(100,100,150,0.06) 0%, transparent 50%)',
  '历史': 'radial-gradient(ellipse 70% 40% at 50% 20%, rgba(255,183,77,0.10) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 50% 70%, rgba(133,147,152,0.06) 0%, transparent 50%)',
  '都市': 'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(144,202,249,0.10) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 50% 70%, rgba(100,150,200,0.06) 0%, transparent 50%)',
};

function formatWordCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万`;
  return String(n);
}

const menuItemBaseStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.45rem 1rem',
  fontSize: '0.8125rem',
  color: '#a0a0a0',
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  width: '100%',
  textAlign: 'left',
  fontFamily: 'inherit',
};

function BookCard({ project, onEnter }: { project: Project; onEnter: (p: Project) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const genreBg = GENRE_GRADIENT_BG[project.genre] || GENRE_GRADIENT_BG['其他'];
  const genreRadial = GENRE_RADIAL_GLOW[project.genre] || '';

  return (
    <div
      onClick={() => onEnter(project)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEnter(project); } }}
      aria-label={`进入《${project.title}》`}
      style={{
        position: 'relative',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        boxShadow: hovered ? '0 8px 32px rgba(0,0,0,0.5)' : '0 2px 12px rgba(0,0,0,0.3)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        background: '#141416',
        border: `1px solid ${hovered ? '#333' : '#2a2a2a'}`,
        aspectRatio: '3 / 4',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* Gradient background layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background: genreBg,
          backgroundSize: '200% 200%',
          backgroundPosition: '0% 50%',
          animation: hovered ? 'gradientShift 5s ease-in-out infinite' : undefined,
        }}
      />
      {/* Radial glow overlays */}
      {genreRadial && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            background: genreRadial,
            transition: 'opacity 0.3s',
          }}
        />
      )}

      {/* Cover edit button (pencil, shown on hover) */}
      <button
        onClick={(e) => e.stopPropagation()}
        aria-label="换封面色"
        title="换封面色"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: hovered ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.85)',
          zIndex: 5,
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: '2px solid #B7FF00',
          background: 'rgba(0,0,0,0.45)',
          color: '#B7FF00',
          fontSize: '1.2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.25s, transform 0.25s',
          backdropFilter: 'blur(4px)',
          pointerEvents: hovered ? 'auto' : 'none',
          cursor: 'pointer',
        }}
      >
        &#9998;
      </button>

      {/* Menu toggle (three dots, shown on hover) */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
        aria-label="更多操作"
        style={{
          position: 'absolute',
          top: '0.75rem',
          right: '0.75rem',
          zIndex: 4,
          width: 28,
          height: 28,
          borderRadius: 6,
          border: 'none',
          background: menuOpen ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)',
          color: menuOpen ? '#B7FF00' : 'rgba(255,255,255,0.6)',
          fontSize: '1.15rem',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: hovered || menuOpen ? 1 : 0,
          transition: 'opacity 0.15s',
          backdropFilter: 'blur(4px)',
          cursor: 'pointer',
        }}
      >
        &#8942;
      </button>

      {/* Card context menu */}
      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 19 }}
          />
          <div
            style={{
              position: 'absolute',
              top: '2.75rem',
              right: '0.75rem',
              zIndex: 20,
              background: '#1e1e1e',
              border: '1px solid #2a2a2a',
              borderRadius: 10,
              padding: '0.35rem 0',
              minWidth: 140,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            <button style={menuItemBaseStyle} onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}>&#9998; 编辑作品名</button>
            <button style={menuItemBaseStyle} onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}>&#9986; 更改体裁</button>
            <button style={{ ...menuItemBaseStyle, color: '#f44336' }} onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}>&#10006; 删除作品</button>
            <button style={menuItemBaseStyle} onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}>&#8659; 导出</button>
          </div>
        </>
      )}

      {/* Canon dots (top-right horizontal strip) */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          right: '3rem',
          display: 'flex',
          gap: 5,
          zIndex: 3,
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', background: '#FFB74D', display: 'inline-block' }} title="正典核心" />
        <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', background: '#90CAF9', display: 'inline-block' }} title="正典项目" />
        <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', background: '#CE93D8', display: 'inline-block' }} title="正典草稿" />
        <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', background: '#666', display: 'inline-block' }} title="未分类" />
      </div>

      {/* Demo badge */}
      {project.status === 'demo' && (
        <div
          style={{
            position: 'absolute',
            top: '0.75rem',
            left: '0.75rem',
            zIndex: 5,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.2rem 0.55rem',
            borderRadius: 20,
            background: '#B7FF00',
            color: '#0a0a0a',
            fontSize: '0.65rem',
            fontWeight: 600,
            letterSpacing: '0.03em',
          }}
        >
          示例
        </div>
      )}

      {/* Card content overlay (gradient fade at bottom) */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '1.5rem 1.25rem 1.25rem',
          background: 'linear-gradient(transparent 20%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.88) 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          minHeight: '55%',
          justifyContent: 'flex-end',
        }}
      >
        <div
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '0.04em',
            textShadow: '0 1px 6px rgba(0,0,0,0.4)',
            lineHeight: 1.3,
          }}
        >
          {project.title}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginTop: '0.15rem',
          }}
        >
          <span
            style={{
              fontSize: '0.7rem',
              padding: '0.15rem 0.55rem',
              borderRadius: 20,
              background: 'rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(4px)',
              fontWeight: 500,
              letterSpacing: '0.03em',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {project.genre}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                display: 'inline-block',
                background: STATUS_COLOR[project.status],
                boxShadow: `0 0 4px ${STATUS_COLOR[project.status]}`,
              }}
            />
            {STATUS_LABEL[project.status]}
          </span>
        </div>
        <div
          style={{
            fontSize: '0.8125rem',
            color: 'rgba(255,255,255,0.55)',
            fontWeight: 400,
          }}
        >
          <strong style={{ color: '#fff', fontWeight: 600 }}>{formatWordCount(project.wordCount)}</strong> 字
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '4rem 2rem',
        gap: '1.25rem',
      }}
    >
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: '#1e1e1e',
          border: '2px dashed #2a2a2a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.5rem',
          color: '#666',
          marginBottom: '0.5rem',
        }}
      >
        &#x1F4D6;
      </div>
      <div
        style={{
          fontSize: '1.2rem',
          fontWeight: 600,
          color: '#a0a0a0',
        }}
      >
        还没有作品
      </div>
      <div
        style={{
          fontSize: '0.875rem',
          color: '#666',
          maxWidth: 320,
        }}
      >
        创建你的第一个作品，开始编织属于你的世界。
      </div>
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginTop: '0.5rem',
        }}
      >
        {onCreate && (
          <button
            onClick={onCreate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1.25rem',
              borderRadius: 6,
              background: '#B7FF00',
              color: '#0a0a0a',
              fontSize: '0.8125rem',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + 创建第一个作品
          </button>
        )}
        <button
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 1.25rem',
            borderRadius: 6,
            background: 'transparent',
            color: '#a0a0a0',
            border: '1px solid #2a2a2a',
            fontSize: '0.8125rem',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          从模板开始
        </button>
        <button
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            fontSize: '0.8125rem',
            fontFamily: 'inherit',
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          查看教程 &rarr;
        </button>
      </div>
    </div>
  );
}

export default function Bookshelf({ projects, onEnterProject, onCreateProject, onTransferred, onRefreshProjects }: BookshelfProps) {
  const [showQuickDraft, setShowQuickDraft] = useState(false);
  const [demoSeeding, setDemoSeeding] = useState(false);
  const isEmpty = !projects || projects.length === 0;

  // Seed Demo project on first mount if it doesn't exist
  useEffect(() => {
    const attemptSeed = async () => {
      try {
        const seeded = await isDemoSeeded();
        if (!seeded) {
          setDemoSeeding(true);
          await seedDemoProject();
          if (onRefreshProjects) {
            await onRefreshProjects();
          }
        }
      } catch (err) {
        console.error('Demo seeding failed:', err);
      } finally {
        setDemoSeeding(false);
      }
    };
    attemptSeed();
  }, []);

  const totalWordCount = useMemo(() => {
    return projects.reduce((sum, p) => sum + p.wordCount, 0);
  }, [projects]);

  const maxCanonCount = 5;

  const handleTransferred = useCallback(async (projectId: string) => {
    setShowQuickDraft(false);
    // Fetch project from backend and navigate directly
    try {
      const dto = await api.getProject(projectId);
      if (dto) {
        let gradient: [string, string] = ['#6366f1', '#8b5cf6'];
        try {
          const g = JSON.parse(dto.gradient);
          if (Array.isArray(g) && g.length >= 2) gradient = [g[0], g[1]];
        } catch { /* keep default */ }
        const project: Project = {
          id: dto.id,
          title: dto.name,
          genre: dto.genre || '未分类',
          status: (dto.status as Project['status']) || 'conceiving',
          wordCount: dto.wordCount ?? 0,
          gradient,
        };
        onEnterProject(project);
      }
    } catch (err) {
      console.error('Failed to navigate to transferred project:', err);
    }
  }, [onEnterProject]);

  return (
    <div
      style={{
        maxWidth: 1400,
        width: '100%',
        margin: '0 auto',
        padding: '2rem 1rem',
        height: '100%',
        overflowY: 'auto',
        fontFamily: "-apple-system, 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif",
        color: '#e0e0e0',
        fontSize: '0.9375rem',
        lineHeight: 1.6,
        background: '#0a0a0a',
      }}
    >
      {/* ===== Top Bar ===== */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 0 0.75rem',
          borderBottom: '1px solid #2a2a2a',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '1.35rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              background: 'linear-gradient(135deg, #B7FF00, #d4ff5e)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            作品书架
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {onCreateProject && (
            <button
              onClick={onCreateProject}
              aria-label="新建作品"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 1rem',
                borderRadius: 6,
                background: '#B7FF00',
                color: '#0a0a0a',
                fontSize: '0.8125rem',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}
            >
              <span>+</span> 新建作品
            </button>
          )}
          <QuickDraftButton onClick={() => setShowQuickDraft(true)} />
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select
              aria-label="排序方式"
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                background: '#0e0e0e',
                color: '#a0a0a0',
                padding: '0.45rem 1.75rem 0.45rem 0.75rem',
                border: '1px solid #2a2a2a',
                borderRadius: 6,
                fontSize: '0.8125rem',
                fontFamily: 'inherit',
                cursor: 'pointer',
                minWidth: '7rem',
              }}
            >
              <option value="updated">最近更新</option>
              <option value="created">创建时间</option>
              <option value="name">作品名 A-Z</option>
              <option value="words">字数多→少</option>
            </select>
            <span
              style={{
                position: 'absolute',
                right: '0.6rem',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '0.55rem',
                color: '#666',
                pointerEvents: 'none',
              }}
            >
              &#9660;
            </span>
          </div>
        </div>
      </header>

      {/* ===== Filter Bar ===== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.75rem 0',
          flexWrap: 'wrap',
          borderBottom: '1px solid #222',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 320 }}>
          <span
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#666',
              fontSize: '0.85rem',
              pointerEvents: 'none',
            }}
          >
            <Search size={14} />
          </span>
          <input
            type="text"
            placeholder="搜索作品..."
            aria-label="搜索作品"
            style={{
              width: '100%',
              background: '#0e0e0e',
              color: '#e0e0e0',
              border: '1px solid #2a2a2a',
              borderRadius: 6,
              padding: '0.5rem 0.75rem 0.5rem 2.1rem',
              fontSize: '0.8125rem',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Demo seeding indicator */}
      {demoSeeding && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0',
            fontSize: '0.75rem',
            color: '#666',
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              border: '2px solid #2a2a2a',
              borderTopColor: '#B7FF00',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          准备示例作品...
        </div>
      )}

      {/* ===== Statistics Bar ===== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          padding: '0.6rem 0',
          fontSize: '0.8125rem',
          color: '#666',
          borderBottom: '1px solid #222',
          flexWrap: 'wrap',
        }}
      >
        {!isEmpty && (
          <span>共 {projects.length} 部作品</span>
        )}
        {!isEmpty && <span>|</span>}
        {!isEmpty && (
          <span>总字数 {totalWordCount.toLocaleString()}</span>
        )}
        {!isEmpty && <span>|</span>}
        {!isEmpty && (
          <span>最高正典对象 {maxCanonCount} 个</span>
        )}
      </div>

      {/* ===== Card Grid / Empty State ===== */}
      {isEmpty ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr' }}>
          <EmptyState onCreate={onCreateProject} />
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.25rem',
            padding: '1.5rem 0',
            width: '100%',
          }}
        >
          {projects.map((project) => (
            <BookCard key={project.id} project={project} onEnter={onEnterProject} />
          ))}
        </div>
      )}

      {/* QuickDraft Panel Overlay */}
      {showQuickDraft && (
        <QuickDraftPanel
          onClose={() => setShowQuickDraft(false)}
          onTransferred={handleTransferred}
        />
      )}
    </div>
  );
}