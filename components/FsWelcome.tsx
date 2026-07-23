import { FolderOpen, History, Import, Plus } from 'lucide-react';
import type { FsProject } from '../types/fs';
import type { Project } from '../types/world';

interface FsWelcomeProps {
  projects: FsProject[];
  legacyProjects: Project[];
  loading: boolean;
  onCreate: () => void;
  onOpenDirectory: () => void;
  onOpenRecent: (project: FsProject) => void;
  onRemoveRecent: (project: FsProject) => void;
  onMigrateLegacy: (project: Project) => void;
}

export default function FsWelcome({
  projects,
  legacyProjects,
  loading,
  onCreate,
  onOpenDirectory,
  onOpenRecent,
  onRemoveRecent,
  onMigrateLegacy,
}: FsWelcomeProps) {
  return (
    <main className="fs-welcome">
      <header className="fs-welcome-hero">
        <div className="fs-welcome-mark">织</div>
        <div>
          <h1>织梦机</h1>
          <p>从这里开始一部作品，或把已有创作原样带进来。</p>
        </div>
      </header>

      <section className="fs-entry-grid" aria-label="开始创作">
        <button className="fs-entry-card primary" onClick={onCreate}>
          <Plus size={24} />
          <strong>在织梦机开始创作</strong>
          <span>建立一个本地项目，直接进入第一份 Markdown 正文。</span>
        </button>
        <button className="fs-entry-card" onClick={onOpenDirectory}>
          <FolderOpen size={24} />
          <strong>导入已有创作</strong>
          <span>打开任意本地作品目录，不重组你的原有文件。</span>
        </button>
      </section>

      <section className="fs-recent-section">
        <div className="fs-section-title"><History size={16} /> 最近作品</div>
        {loading ? (
          <div className="fs-welcome-empty">正在读取最近项目…</div>
        ) : projects.length === 0 ? (
          <div className="fs-welcome-empty">还没有打开过本地作品。</div>
        ) : (
          <div className="fs-recent-list">
            {projects.map((project) => (
              <div className="fs-recent-row" key={project.id}>
                <button className="fs-recent-main" onClick={() => onOpenRecent(project)}>
                  <FolderOpen size={16} />
                  <span className="fs-recent-name">{project.name}</span>
                  <span className="fs-recent-path">{project.rootPath}</span>
                </button>
                <button className="fs-recent-remove" onClick={() => onRemoveRecent(project)} title="从最近列表移除">×</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {legacyProjects.length > 0 && (
        <section className="fs-legacy-section">
          <div className="fs-section-title"><Import size={16} /> 旧版项目迁移</div>
          <p>旧数据库项目不会再进入另一套工作区。迁移后，它们会成为普通本地项目。</p>
          <div className="fs-legacy-list">
            {legacyProjects.map((project) => (
              <div className="fs-legacy-row" key={project.id}>
                <span>{project.title}</span>
                <button onClick={() => onMigrateLegacy(project)}>迁移为本地项目</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
