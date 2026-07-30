import {
  BookOpenText,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileSearch,
  FileText,
  PencilLine,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  Square,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

// AI conversation persistence key (per project)
function convKey(projectId: string): string {
  return `glyph-ai-conv-${projectId}`;
}

function saveConversation(projectId: string, tasks: ProjectAiTaskCard[]): void {
  try {
    const recent = tasks.slice(-50); // keep last 50 messages
    localStorage.setItem(convKey(projectId), JSON.stringify({ tasks: recent, savedAt: Date.now() }));
  } catch { /* storage full — silently skip */ }
}

function loadConversation(projectId: string, existingTasks: ProjectAiTaskCard[]): ProjectAiTaskCard[] {
  if (existingTasks.length > 0) return existingTasks; // don't overwrite active conversation
  try {
    const raw = localStorage.getItem(convKey(projectId));
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (Array.isArray(data?.tasks)) return data.tasks;
  } catch { /* corrupt data */ }
  return [];
}
import type { FsProject } from '../types/fs';
import type { AiActionDetail } from '../types/fs-ai';
import { useFsStore } from '../stores/fsStore';
import { useCanonStore } from '../stores/canonStore';
import FsAiProviderDialog from './FsAiProviderDialog';
import AiRevertConflictDialog from './AiRevertConflictDialog';
import { createTextFile, readFileState } from '../tauri-api';
import { markdownToEditorHtml } from '../utils/markdown-editor';
import type {
  AiCommitOutcome,
  AiWriteProposal,
  EditorSelectionContext,
  PreparedWriteTarget,
  ProjectAiPhase,
  ProjectAiPlan,
  ProjectAiTaskCard,
  ProjectFileIndex,
  ReadEvidence,
  ReadonlyProviderChoice,
} from '../types/fs-ai';
import {
  listProjectAiProviders,
  listProjectTextFiles,
  readableAiError,
  runProjectAiTask,
} from '../lib/fs-ai-bridge';

interface FsAiPanelProps {
  project: FsProject;
  currentFilePath: string | null;
  currentFileContent: string | null;
  selection: EditorSelectionContext | null;
  onOpenFile: (path: string) => Promise<boolean>;
  onPrepareWrite: (plan: ProjectAiPlan, context: {
    currentFilePath: string | null;
    currentFileContent: string | null;
    selection: EditorSelectionContext | null;
  }) => Promise<PreparedWriteTarget>;
  onCommitWrite: (proposal: AiWriteProposal) => Promise<AiCommitOutcome>;
}

const PHASE_LABEL: Record<ProjectAiPhase, string> = {
  idle: '等待',
  planning: '判断任务',
  searching: '查找项目',
  reading: '读取材料',
  preparing: '锁定目标',
  generating: '生成内容',
  committing: '正式提交',
  completed: '已完成',
  cancelled: '已取消',
  blocked: '未写入',
  error: '失败',
};

const ACTION_LABEL: Record<ProjectAiPlan['action'], string> = {
  answer: '只读回答',
  create_file: '新建文件',
  replace_selection: '改写选区',
  insert_at_cursor: '续写正文',
  replace_file: '整文件修改',
};

function createTask(input: string): ProjectAiTaskCard {
  return {
    id: `project-task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userInput: input,
    createdAt: Date.now(),
    phase: 'planning',
    phaseDetail: '正在判断回答、创建或修改',
    answer: '',
    evidence: [],
    error: null,
    providerLabel: null,
    plan: null,
    commit: null,
    draft: null,
  };
}

function mentionAtCursor(value: string, cursor: number): { start: number; query: string } | null {
  const before = value.slice(0, cursor);
  const bracedStart = before.lastIndexOf('@{');
  if (bracedStart >= 0 && !before.slice(bracedStart + 2).includes('}')) {
    return { start: bracedStart, query: before.slice(bracedStart + 2) };
  }
  const match = before.match(/(?:^|\s)@([^\s@{}]*)$/);
  if (!match) return null;
  const at = before.lastIndexOf('@');
  return { start: at, query: match[1] };
}

function EvidenceItem({ item, onOpenFile }: { item: ReadEvidence; onOpenFile: (path: string) => Promise<boolean> }) {
  const [expanded, setExpanded] = useState(false);
  const canOpen = Boolean(item.filePath && item.kind !== 'read-error');
  return (
    <div className={`fs-ai-evidence-item fs-ai-evidence-${item.kind}`}>
      <button className="fs-ai-evidence-heading" onClick={() => setExpanded((value) => !value)}>
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span className="fs-ai-source-id">[{item.id}]</span>
        <span className="fs-ai-evidence-title">{item.title}</span>
        {item.matchCount ? <span className="fs-ai-evidence-count">{item.matchCount}</span> : null}
      </button>
      {expanded && (
        <div className="fs-ai-evidence-body">
          {item.detail && <p>{item.detail}</p>}
          {item.excerpt && <pre>{item.excerpt}</pre>}
          {item.truncated && <span className="fs-ai-truncated">只展示了与任务相关的节选</span>}
          {canOpen && (
            <button className="fs-ai-open-source" onClick={() => void onOpenFile(item.filePath!)}>
              <FileText size={13} /> 在编辑器中打开
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onOpenFile }: { task: ProjectAiTaskCard; onOpenFile: (path: string) => Promise<boolean> }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);
  const [conflictDetail, setConflictDetail] = useState<AiActionDetail | null>(null);
  const [conflictCurrentContent, setConflictCurrentContent] = useState('');
  const [conflictLoading, setConflictLoading] = useState(false);
  const revertAction = useFsStore((s) => s.revertAction);
  const loadActionHistory = useFsStore((s) => s.loadActionHistory);
  const openActionDetail = useFsStore((s) => s.openActionDetail);
  const activeProject = useFsStore((s) => s.activeProject);

  const handleRevert = useCallback(async () => {
    if (!task.commit || reverting) return;
    setReverting(true);
    setRevertError(null);
    try {
      const result = await revertAction({
        operationId: task.commit.operationId,
        targetPath: task.commit.targetPath,
        expectedVersion: task.commit.version,
      });
      if (result && !result.restored) {
        if (result.reason && result.reason.includes('VERSION_MISMATCH')) {
          // Open conflict dialog
          setConflictLoading(true);
          try {
            const detail = await openActionDetail(task.commit!.operationId);
            if (detail) {
              setConflictDetail(detail);
              if (activeProject) {
                try {
                  const fileState = await readFileState(activeProject.rootPath, task.commit!.targetPath);
                  setConflictCurrentContent(fileState.content);
                } catch {
                  setConflictCurrentContent('（无法读取当前文件内容）');
                }
              }
            }
          } catch {
            // fallback: show error text
            setRevertError(result.reason || '撤销失败');
          } finally {
            setConflictLoading(false);
          }
        } else {
          setRevertError(result.reason || '撤销失败');
        }
      }
      await loadActionHistory();
    } catch (e) {
      setRevertError(String(e));
    } finally {
      setReverting(false);
    }
  }, [task.commit, reverting, revertAction, loadActionHistory, openActionDetail, activeProject]);

  const handleCloseConflict = useCallback(() => {
    setConflictDetail(null);
  }, []);

  const handleKeepCurrent = useCallback(() => {
    setConflictDetail(null);
  }, []);

  const handleViewOlder = useCallback(async () => {
    if (!conflictDetail?.snapshotPath || !activeProject) return;
    setConflictLoading(true);
    try {
      const snapshotState = await readFileState(activeProject.rootPath, conflictDetail.snapshotPath);
      // Show snapshot by temporarily replacing the revertError with snapshot content
      setRevertError('【快照内容】\n───\n' + snapshotState.content.slice(0, 1000) + '\n───\n（快照前 1000 字，关闭冲突面板后消失）');
    } catch {
      setRevertError('（无法读取快照文件）');
    } finally {
      setConflictLoading(false);
    }
  }, [conflictDetail, activeProject]);

  const handleSaveOlder = useCallback(async () => {
    if (!conflictDetail?.snapshotPath || !activeProject) return;
    setConflictLoading(true);
    try {
      const snapshotState = await readFileState(activeProject.rootPath, conflictDetail.snapshotPath);
      const savePath = conflictDetail.targetPath.replace(/\.md$/i, '') + '.AI修改前快照.md';
      await createTextFile(activeProject.rootPath, savePath, snapshotState.content);
      setConflictDetail(null);
      setRevertError(`快照已另存为 ${savePath}`);
    } catch {
      setRevertError('（保存快照失败）');
    } finally {
      setConflictLoading(false);
    }
  }, [conflictDetail, activeProject]);

  const handleOverwrite = useCallback(async () => {
    setConflictDetail(null);
    setRevertError('覆盖功能需要后端支持，暂不可用。请先另存快照，再手动还原。');
  }, []);

  return (
    <article className={`fs-ai-task fs-ai-task-${task.phase}`}>
      <div className="fs-ai-user-message">{task.userInput}</div>
      <div className="fs-ai-task-state">
        <span className={`fs-ai-phase-dot fs-ai-phase-dot-${task.phase}`} />
        <span>{PHASE_LABEL[task.phase]}</span>
        {task.phaseDetail && <span className="fs-ai-phase-detail">· {task.phaseDetail}</span>}
      </div>

      {task.plan && (
        <div className="fs-ai-action-summary">
          {task.plan.action === 'create_file' ? <FilePlus2 size={13} /> : task.plan.action === 'answer' ? <BookOpenText size={13} /> : <PencilLine size={13} />}
          <strong>{ACTION_LABEL[task.plan.action]}</strong>
          {task.plan.targetPath && <span>{task.plan.targetPath}</span>}
        </div>
      )}

      {task.answer && (
        <div
          className="fs-ai-answer"
          dangerouslySetInnerHTML={{ __html: markdownToEditorHtml(task.answer) }}
        />
      )}
      {task.error && <div className="fs-ai-error">{task.error}</div>}

      {task.commit && (
        <div className="fs-ai-commit-result">
          <strong>{task.commit.actionType === 'create' ? '文件已创建' : '文件已修改'}</strong>
          <button onClick={() => void onOpenFile(task.commit!.targetPath)}>{task.commit.targetPath}</button>
          {task.commit.snapshotPath && <span>修改前快照已保存</span>}
          <div className="fs-ai-revert-row">
            <button className="fs-ai-revert-btn" onClick={handleRevert} disabled={reverting}>
              <RotateCcw size={13} /> {reverting ? '撤销中…' : '撤销本次修改'}
            </button>
          </div>
          {conflictLoading && <div className="fs-ai-error" style={{ marginTop: 4, fontStyle: 'italic' }}>正在读取快照…</div>}
          {revertError && !conflictDetail && <div className="fs-ai-error" style={{ marginTop: 4 }}>{revertError}</div>}
        </div>
      )}

      {conflictDetail && (
        <AiRevertConflictDialog
          action={conflictDetail}
          currentContent={conflictCurrentContent}
          onClose={handleCloseConflict}
          onViewOlder={handleViewOlder}
          onSaveOlder={handleSaveOlder}
          onKeepCurrent={handleKeepCurrent}
          onOverwrite={handleOverwrite}
        />
      )}

      {task.draft && (
        <div className="fs-ai-draft">
          <button className="fs-ai-evidence-toggle" onClick={() => setShowDraft((value) => !value)}>
            <FileText size={14} /> 未提交草稿 {showDraft ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          {showDraft && <pre>{task.draft}</pre>}
        </div>
      )}

      {task.evidence.length > 0 && (
        <div className="fs-ai-evidence">
          <button className="fs-ai-evidence-toggle" onClick={() => setShowEvidence((value) => !value)}>
            <FileSearch size={14} /> 实际依据 {task.evidence.length} 项
            {showEvidence ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          {showEvidence && (
            <div className="fs-ai-evidence-list">
              {task.evidence.map((item) => <EvidenceItem key={`${task.id}-${item.id}`} item={item} onOpenFile={onOpenFile} />)}
            </div>
          )}
        </div>
      )}

      {task.providerLabel && <div className="fs-ai-provider-used">{task.providerLabel}</div>}
    </article>
  );
}

export default function FsAiPanel({
  project,
  currentFilePath,
  currentFileContent,
  selection,
  onOpenFile,
  onPrepareWrite,
  onCommitWrite,
}: FsAiPanelProps) {
  const [input, setInput] = useState('');
  const [tasks, setTasks] = useState<ProjectAiTaskCard[]>([]);
  const [providers, setProviders] = useState<ReadonlyProviderChoice[]>([]);
  const [providerId, setProviderId] = useState('');
  const [fileIndex, setFileIndex] = useState<ProjectFileIndex>({ files: [], truncated: false, unreadableDirectories: [] });
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const taskListRef = useRef<HTMLDivElement | null>(null);

  const refreshProviders = useCallback(async () => {
    const nextProviders = await listProjectAiProviders().catch(() => []);
    setProviders(nextProviders);
    setProviderId((current) => nextProviders.some((provider) => provider.id === current) ? current : nextProviders[0]?.id ?? '');
  }, []);

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    let disposed = false;
    setLoadingSetup(true);
    // Restore AI conversation from localStorage (only on fresh mount)
    try {
      const raw = localStorage.getItem(convKey(project.id));
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data?.tasks) && data.tasks.length > 0) {
          setTasks(data.tasks);
        }
      }
    } catch { /* ignore corrupt data */ }
    setInput('');
    Promise.all([
      listProjectAiProviders().catch(() => []),
      listProjectTextFiles(project.rootPath).catch(() => ({ files: [], truncated: false, unreadableDirectories: [] })),
    ]).then(([nextProviders, nextIndex]) => {
      if (disposed) return;
      setProviders(nextProviders);
      setProviderId((current) => nextProviders.some((provider) => provider.id === current) ? current : nextProviders[0]?.id ?? '');
      setFileIndex(nextIndex);
      setLoadingSetup(false);
    });
    return () => {
      disposed = true;
      abortRef.current?.abort();
      // Save conversation on unmount (use ref for latest value)
      saveConversation(project.id, tasksRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.rootPath]);

  useEffect(() => {
    const node = taskListRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [tasks]);

  const running = tasks.some((task) => ['planning', 'searching', 'reading', 'preparing', 'generating', 'committing'].includes(task.phase));

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const query = mention.query.trim().toLowerCase();
    return fileIndex.files
      .filter((file) => !query || file.path.toLowerCase().includes(query) || file.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [fileIndex.files, mention]);

  const updateMention = useCallback((value: string) => {
    const textarea = inputRef.current;
    setMention(mentionAtCursor(value, textarea?.selectionStart ?? value.length));
  }, []);

  const insertReference = useCallback((path: string) => {
    const textarea = inputRef.current;
    if (!textarea || !mention) return;
    const cursor = textarea.selectionStart;
    const next = `${input.slice(0, mention.start)}@{${path}} ${input.slice(cursor)}`;
    setInput(next);
    setMention(null);
    requestAnimationFrame(() => {
      const position = mention.start + path.length + 4;
      textarea.focus();
      textarea.setSelectionRange(position, position);
    });
  }, [input, mention]);

  const patchTask = useCallback((id: string, patch: Partial<ProjectAiTaskCard>) => {
    setTasks((items) => {
      const next = items.map((item) => item.id === id ? { ...item, ...patch } : item);
      saveConversation(project.id, next);
      return next;
    });
  }, [project.id]);

  const scanProject = useCanonStore((s) => s.scanProject);
  const canonSchema = useCanonStore((s) => s.schema);
  const canonEntities = useCanonStore((s) => s.entities);
  const loadAll = useCanonStore((s) => s.loadAll);

  /** Command registry: maps command name → handler */
  type CommandHandler = (args: string, taskId: string) => Promise<string>;

  const commands: Record<string, { label: string; desc: string; handler: CommandHandler }> = {
    scan: {
      label: '扫描项目', desc: '从正文中提取人物、地点、组织、物品等设定',
      handler: async (_args, task) => {
        patchTask(task, { phase: 'searching', phaseDetail: '正在扫描项目…' });
        await scanProject(project.rootPath);
        const candidates = useCanonStore.getState().scanCandidates;
        if (candidates.length > 0) {
          const names = candidates.map((c) => `- ${c.type} **${c.name}**（${c.sourcePath}）`).join('\n');
          return `## 扫描完成\n\n发现 ${candidates.length} 个候选设定：\n\n${names}\n\n打开「设定」标签查看和确认。`;
        }
        return '扫描完成，未发现新的候选设定。';
      },
    },

    整理: {
      label: '整理设定', desc: '综合分析项目设定状态，给出整理建议',
      handler: async (_args, task) => {
        patchTask(task, { phase: 'searching', phaseDetail: '正在分析设定状态…' });
        await loadAll(project.rootPath);
        const schema = useCanonStore.getState().schema;
        const entities = useCanonStore.getState().entities;

        if (!schema) return '尚未创建世界观数据。请先填写世界观或运行 /scan。';

        // Schema completeness
        const p0Fields = ['coreQuestion', 'aestheticSignature', 'coreMechanism', 'worldLack',
          'protagonistLack', 'rulesAndCost', 'enforcer', 'currentSituation', 'compressionField'];
        const filled = p0Fields.filter((k) => (schema as any)[k]?.trim()).length;
        const p0Labels: Record<string, string> = {
          coreQuestion: '核心追问', aestheticSignature: '美学辨识度', coreMechanism: '核心机制',
          worldLack: '世界缺憾', protagonistLack: '主角缺憾', rulesAndCost: '规则与代价',
          enforcer: '执行人', currentSituation: '当前局势', compressionField: '压缩场',
        };

        const filledItems = p0Fields.filter((k) => (schema as any)[k]?.trim())
          .map((k) => `- ✅ **${p0Labels[k]}**：${(schema as any)[k].slice(0, 40)}`).join('\n');
        const missingItems = p0Fields.filter((k) => !(schema as any)[k]?.trim())
          .map((k) => `- ❌ ${p0Labels[k]}：未填写`).join('\n');

        // Entity stats
        const byType: Record<string, number> = {};
        for (const e of entities) { byType[e.type] = (byType[e.type] || 0) + 1; }
        const entitySummary = Object.entries(byType)
          .map(([t, c]) => `- ${t}：${c} 个`).join('\n') || '（暂无实体）';

        return [
          `## 设定整理报告`,
          ``,
          `### 📊 世界观骨架`,
          `P0 骨架：**${filled}/${p0Fields.length}** 已填写`,
          ``,
          filledItems || '（无）',
          missingItems ? `\n${missingItems}` : '',
          ``,
          `### 📖 实体索引`,
          `共 **${entities.length}** 个设定实体`,
          entitySummary,
          ``,
          `### 💡 推荐操作`,
          missingItems ? `- 补充世界观：\`/世界观\`` : '',
          entities.length === 0 ? `- 扫描项目：\`/scan\`` : '',
          `- 使用双链：在正文中用 \`[[人物名]]\` 引用设定`,
        ].filter(Boolean).join('\n');
      },
    },

    help: {
      label: '帮助', desc: '显示所有可用命令',
      handler: async (_args, _task) => {
        const lines = Object.entries(commands).map(
          ([name, cmd]) => `- \`/${name}\` — ${cmd.desc}`
        );
        return `## 可用命令\n\n${lines.join('\n')}\n\n在 AI 面板输入 \`/命令名\` 执行。`;
      },
    },
  };

  /** Slash command router: /cmd ...args */
  async function runCommand(cmd: string, _args: string, taskId: string): Promise<boolean> {
    const def = commands[cmd];
    if (!def) {
      const available = Object.keys(commands).map((k) => `\`/${k}\``).join('、');
      patchTask(taskId, {
        phase: 'error',
        phaseDetail: '未知命令',
        error: `未知命令 /${cmd}。可用命令：${available}`,
      });
      return true;
    }
    patchTask(taskId, { phase: 'searching', phaseDetail: def.label + '…' });
    try {
      const answer = await def.handler(_args, taskId);
      patchTask(taskId, { phase: 'completed', phaseDetail: def.label + ' 完成', answer });
    } catch (e: any) {
      patchTask(taskId, { phase: 'error', phaseDetail: def.label + ' 失败', error: String(e?.message || e) });
    }
    return true;
  }

  const submit = useCallback(async () => {
    const value = input.trim();
    if (!value || running) return;
    const task = createTask(value);
    const controller = new AbortController();
    abortRef.current = controller;
    setInput('');
    setMention(null);
    setTasks((items) => [...items.slice(-19), task]);

    // Slash command dispatch
    if (value.startsWith('/')) {
      const spaceIdx = value.indexOf(' ');
      const cmd = spaceIdx > 0 ? value.slice(1, spaceIdx).toLowerCase() : value.slice(1).toLowerCase();
      const args = spaceIdx > 0 ? value.slice(spaceIdx + 1).trim() : '';
      if (await runCommand(cmd, args, task.id)) {
        saveConversation(project.id, [...tasks.slice(-19), task]);
        return;
      }
    }

    try {
      const result = await runProjectAiTask({
        userInput: value,
        project,
        currentFilePath,
        currentFileContent,
        selection,
        providerId: providerId || undefined,
        signal: controller.signal,
        prepareWrite: onPrepareWrite,
        commitWrite: onCommitWrite,
        onProgress: (progress) => patchTask(task.id, { phase: progress.phase, phaseDetail: progress.detail }),
      });
      patchTask(task.id, {
        phase: result.commit ? 'completed' : result.draft ? 'blocked' : 'completed',
        phaseDetail: result.commit ? '作品已经安全更新' : result.draft ? '生成完成，但没有写入正式作品' : '只读任务完成',
        answer: result.answer,
        evidence: result.evidence,
        providerLabel: result.providerLabel,
        plan: result.plan,
        commit: result.commit,
        draft: result.draft,
      });
      if (result.commit?.actionType === 'create') {
        const nextIndex = await listProjectTextFiles(project.rootPath).catch(() => null);
        if (nextIndex) setFileIndex(nextIndex);
      }
    } catch (error) {
      const cancelled = controller.signal.aborted;
      patchTask(task.id, {
        phase: cancelled ? 'cancelled' : 'error',
        phaseDetail: cancelled ? '任务已停止，正式作品没有变化' : '任务没有完成',
        error: cancelled ? null : readableAiError(error),
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [currentFileContent, currentFilePath, input, onCommitWrite, onPrepareWrite, patchTask, project, providerId, running, selection]);

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && mention) {
      event.preventDefault();
      setMention(null);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !mention) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <section className="fs-ai-panel" aria-label="AI 项目副手">
      <header className="fs-ai-header">
        <div>
          <strong><Sparkles size={15} /> AI 副手</strong>
          <span>可查阅项目，并在明确范围内创建或修改一个 Markdown 文件</span>
        </div>
        <BookOpenText size={18} />
      </header>

      <div className="fs-ai-context-strip">
        {currentFilePath ? <span title={currentFilePath}>当前：{currentFilePath}</span> : <span>尚未打开文件</span>}
        {selection?.text.trim() && <span className="fs-ai-selection-chip">选区 {selection.text.length} 字</span>}
      </div>

      <div className="fs-ai-provider-row">
        <label htmlFor="fs-ai-provider">模型</label>
        <select id="fs-ai-provider" value={providerId} disabled={running || loadingSetup || providers.length === 0} onChange={(event) => setProviderId(event.target.value)}>
          {providers.length === 0 ? <option value="">未配置可用模型</option> : null}
          {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
        </select>
        <button className="fs-ai-provider-settings" onClick={() => setProviderDialogOpen(true)} aria-label="配置 AI 模型" title="配置 AI 模型">
          <Settings size={13} />
        </button>
      </div>

      <div className="fs-ai-task-list" ref={taskListRef}>
        {tasks.length === 0 ? (
          <div className="fs-ai-empty">
            <Sparkles size={24} />
            <strong>直接交代作品任务</strong>
            <p>例如：“布兰目前知道什么？”、“把选中段落写得更克制”或“按施工卡新建下一章”。</p>
          </div>
        ) : tasks.map((task) => <TaskCard key={task.id} task={task} onOpenFile={onOpenFile} />)}
      </div>

      <div className="fs-ai-composer">
        {mention && suggestions.length > 0 && (
          <div className="fs-ai-mention-menu">
            {suggestions.map((file) => (
              <button key={file.path} onMouseDown={(event) => event.preventDefault()} onClick={() => insertReference(file.path)}>
                <FileText size={13} /><span>{file.path}</span>
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={inputRef}
          value={input}
          disabled={running}
          rows={3}
          placeholder={providers.length === 0 ? '请先配置 AI 模型' : '提问、续写、改选区或新建文件；输入 @ 引用文件'}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setInput(value);
            requestAnimationFrame(() => updateMention(value));
          }}
          onClick={(event) => updateMention(event.currentTarget.value)}
          onKeyUp={(event) => updateMention(event.currentTarget.value)}
          onKeyDown={handleInputKeyDown}
        />
        <div className="fs-ai-composer-actions">
          <span>Enter 发送 · Shift+Enter 换行</span>
          {running ? (
            <button className="fs-ai-stop" onClick={() => abortRef.current?.abort()} title="停止任务"><Square size={14} /> 停止</button>
          ) : (
            <button className="fs-ai-send" disabled={!input.trim() || providers.length === 0} onClick={() => void submit()} title="发送"><Send size={14} /> 发送</button>
          )}
        </div>
      </div>

      {providerDialogOpen && <FsAiProviderDialog onClose={() => setProviderDialogOpen(false)} onSaved={refreshProviders} />}
    </section>
  );
}
