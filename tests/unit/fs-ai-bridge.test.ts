/// <reference types="vitest/globals" />
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listDirectory: vi.fn(),
  readFile: vi.fn(),
  searchFileContent: vi.fn(),
  listProviderConfigs: vi.fn(),
  resolveProviderCredential: vi.fn(),
  callLlm: vi.fn(),
}));

vi.mock('../../tauri-api', () => ({
  listDirectory: (...args: unknown[]) => mocks.listDirectory(...args),
  readFile: (...args: unknown[]) => mocks.readFile(...args),
  searchFileContent: (...args: unknown[]) => mocks.searchFileContent(...args),
}));

vi.mock('../../api/aiControlCenterApi', () => ({
  listProviderConfigs: (...args: unknown[]) => mocks.listProviderConfigs(...args),
  resolveProviderCredential: (...args: unknown[]) => mocks.resolveProviderCredential(...args),
}));

vi.mock('../../lib/llm-client', () => ({
  LlmError: class LlmError extends Error {},
  callLlm: (...args: unknown[]) => mocks.callLlm(...args),
}));

import {
  listProjectTextFiles,
  parseFileReferences,
  parseProjectAiPlan,
  resolveFileReferences,
  runProjectAiTask,
} from '../../lib/fs-ai-bridge';

const project = {
  id: 'project-1',
  name: '边界来客',
  rootPath: 'C:/novels/边界来客',
  genre: '',
  createdAt: 1,
  lastOpenedAt: 2,
  updatedAt: 2,
};

const committed = {
  operationId: 'ai-1',
  actionType: 'modify' as const,
  targetPath: '正文/ch10.md',
  modifiedAt: 3,
  version: 'new-version',
  snapshotPath: '.glyph/snapshots/ai-1.md',
  recordPath: '.glyph/actions/ai-1.json',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listProviderConfigs.mockResolvedValue([{
    id: 'config-1', providerId: 'ollama', providerName: 'Ollama', hasApiKey: false,
    endpoint: 'http://localhost:11434/v1', models: '["qwen3:8b"]', timeoutMs: 30_000,
    isActive: true, createdAt: 1, updatedAt: 1,
  }]);
  mocks.listDirectory.mockImplementation((_root: string, path?: string) => {
    if (!path) return Promise.resolve([
      { name: '人物', path: '人物', isDir: true, extension: '', size: 0, modifiedAt: 1 },
      { name: '大纲.md', path: '大纲.md', isDir: false, extension: 'md', size: 20, modifiedAt: 1 },
      { name: '封面.png', path: '封面.png', isDir: false, extension: 'png', size: 20, modifiedAt: 1 },
    ]);
    if (path === '人物') return Promise.resolve([
      { name: '布兰.md', path: '人物/布兰.md', isDir: false, extension: 'md', size: 20, modifiedAt: 1 },
      { name: '旗丞.txt', path: '人物/旗丞.txt', isDir: false, extension: 'txt', size: 20, modifiedAt: 1 },
    ]);
    return Promise.resolve([]);
  });
  mocks.searchFileContent.mockResolvedValue({ matches: [], totalFilesSearched: 3, truncated: false });
  mocks.readFile.mockImplementation((_root: string, path: string) => {
    if (path === '人物/布兰.md') return Promise.resolve('# 布兰\n\n布兰知道黑潮的名字。');
    if (path === '大纲.md') return Promise.resolve('# 大纲');
    return Promise.reject(new Error('not found'));
  });
});

describe('Gate C planning boundary', () => {
  it('parses explicit file references and project indexes', async () => {
    expect(parseFileReferences('根据 @人物/布兰.md 和 @{资料/第一版 人物表.md}，回答。')).toEqual([
      '人物/布兰.md', '资料/第一版 人物表.md',
    ]);
    const index = await listProjectTextFiles(project.rootPath);
    expect(index.files.map((file) => file.path)).toEqual(['人物/布兰.md', '人物/旗丞.txt', '大纲.md']);
    expect(resolveFileReferences(index.files, ['旗丞'])[0].exactMatch).toBe('人物/旗丞.txt');
  });

  it('rejects internal write paths while parsing a plan', () => {
    const plan = parseProjectAiPlan(JSON.stringify({
      action: 'create_file', targetPath: '.glyph/evil.md', searchQueries: [], includeCurrentFile: false,
      requestedFiles: [], focus: 'x', changeSummary: 'x',
    }));
    expect(plan?.targetPath).toBeNull();
  });
});

describe('Gate C bounded project actions', () => {
  it('keeps analysis tasks read-only', async () => {
    mocks.callLlm
      .mockResolvedValueOnce({ content: JSON.stringify({ action: 'answer', targetPath: null, searchQueries: [], includeCurrentFile: true, requestedFiles: [], focus: '判断人物状态', changeSummary: '只读回答' }), model: 'qwen3:8b', tokensIn: 1, tokensOut: 1, cost: 0 })
      .mockResolvedValueOnce({ content: '材料显示布兰知道黑潮的名字。[S1]', model: 'qwen3:8b', tokensIn: 1, tokensOut: 1, cost: 0 });
    const commitWrite = vi.fn();
    const result = await runProjectAiTask({
      userInput: '布兰目前知道什么？', project,
      currentFilePath: '大纲.md', currentFileContent: '# 当前大纲', selection: null,
      prepareWrite: vi.fn(), commitWrite,
    });
    expect(result.plan.action).toBe('answer');
    expect(result.answer).toContain('[S1]');
    expect(commitWrite).not.toHaveBeenCalled();
  });

  it('replaces only the captured selection and commits one file', async () => {
    const base = '前文\n他说得太直接了。\n后文';
    const selection = { start: 3, end: 11, text: '他说得太直接了。', cursorOffset: 3, startLine: 1, endLine: 1 };
    mocks.callLlm
      .mockResolvedValueOnce({ content: JSON.stringify({ action: 'replace_selection', targetPath: '正文/ch10.md', searchQueries: [], includeCurrentFile: true, requestedFiles: [], focus: '收敛语气', changeSummary: '改写选区' }), model: 'qwen3:8b', tokensIn: 1, tokensOut: 1, cost: 0 })
      .mockResolvedValueOnce({ content: '他顿了顿，只说了一半。', model: 'qwen3:8b', tokensIn: 1, tokensOut: 1, cost: 0 });
    const commitWrite = vi.fn(async (proposal) => {
      expect(proposal.targetPath).toBe('正文/ch10.md');
      expect(proposal.finalContent).toBe(`前文\n他顿了顿，只说了一半。\n后文`);
      return { status: 'committed' as const, commit: committed, reason: null };
    });
    const result = await runProjectAiTask({
      userInput: '把选中这句写得更克制', project,
      currentFilePath: '正文/ch10.md', currentFileContent: base, selection,
      prepareWrite: vi.fn(async () => ({ action: 'replace_selection' as const, targetPath: '正文/ch10.md', baseContent: base, baseVersion: 'v1', baseEditorRevision: 0, selection, cursorOffset: 3 })),
      commitWrite,
    });
    expect(result.commit?.actionType).toBe('modify');
    expect(commitWrite).toHaveBeenCalledTimes(1);
  });

  it('creates one new Markdown file without an existing-file overwrite path', async () => {
    mocks.callLlm
      .mockResolvedValueOnce({ content: JSON.stringify({ action: 'create_file', targetPath: '正文/ch32.md', searchQueries: [], includeCurrentFile: false, requestedFiles: [], focus: '写下一章', changeSummary: '新建第三十二章' }), model: 'qwen3:8b', tokensIn: 1, tokensOut: 1, cost: 0 })
      .mockResolvedValueOnce({ content: '# 第三十二章\n\n正文。', model: 'qwen3:8b', tokensIn: 1, tokensOut: 1, cost: 0 });
    const createCommit = { ...committed, actionType: 'create' as const, targetPath: '正文/ch32.md', snapshotPath: null };
    const result = await runProjectAiTask({
      userInput: '新建 正文/ch32.md，写下一章', project,
      currentFilePath: null, currentFileContent: null, selection: null,
      prepareWrite: vi.fn(async () => ({ action: 'create_file' as const, targetPath: '正文/ch32.md', baseContent: null, baseVersion: null, baseEditorRevision: null, selection: null, cursorOffset: null })),
      commitWrite: vi.fn(async (proposal) => {
        expect(proposal.finalContent).toContain('第三十二章');
        return { status: 'committed' as const, commit: createCommit, reason: null };
      }),
    });
    expect(result.commit?.actionType).toBe('create');
    expect(result.commit?.snapshotPath).toBeNull();
  });

  it('keeps the generated result as an uncommitted draft when the editor changed', async () => {
    mocks.callLlm
      .mockResolvedValueOnce({ content: JSON.stringify({ action: 'insert_at_cursor', targetPath: '正文/ch10.md', searchQueries: [], includeCurrentFile: true, requestedFiles: [], focus: '续写', changeSummary: '在光标处续写' }), model: 'qwen3:8b', tokensIn: 1, tokensOut: 1, cost: 0 })
      .mockResolvedValueOnce({ content: '新的段落。', model: 'qwen3:8b', tokensIn: 1, tokensOut: 1, cost: 0 });
    const result = await runProjectAiTask({
      userInput: '从这里继续写', project,
      currentFilePath: '正文/ch10.md', currentFileContent: '原文',
      selection: { start: 2, end: 2, text: '', cursorOffset: 2, startLine: 0, endLine: 0 },
      prepareWrite: vi.fn(async () => ({ action: 'insert_at_cursor' as const, targetPath: '正文/ch10.md', baseContent: '原文', baseVersion: 'v1', baseEditorRevision: 0, selection: null, cursorOffset: 2 })),
      commitWrite: vi.fn(async () => ({ status: 'blocked' as const, commit: null, reason: 'AI 生成期间当前文件已经发生变化' })),
    });
    expect(result.commit).toBeNull();
    expect(result.draft).toBe('新的段落。');
    expect(result.answer).toContain('没有写入正式作品');
  });
});
