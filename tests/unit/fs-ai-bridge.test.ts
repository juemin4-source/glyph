/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock tauri-api module ──
const mockListDirectory = vi.fn();
const mockReadFile = vi.fn();
const mockSearchFileContent = vi.fn();

vi.mock('../../tauri-api', () => ({
  listDirectory: (...args: unknown[]) => mockListDirectory(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  searchFileContent: (...args: unknown[]) => mockSearchFileContent(...args),
}));

// ── Mock AI router ──
vi.mock('../../lib/ai/command-router', () => ({
  route: vi.fn().mockResolvedValue({ fallbackReason: 'No AI provider configured' }),
}));

// ── Mock AI control center API ──
vi.mock('../../api/aiControlCenterApi', () => ({
  listProviderConfigs: vi.fn().mockResolvedValue([]),
  resolveProviderCredential: vi.fn().mockRejectedValue(new Error('No providers')),
}));

// ── Mock LLM client ──
vi.mock('../../lib/llm-client', () => ({
  callLlm: vi.fn().mockResolvedValue({
    content: 'AI response',
    model: 'test-model',
    tokensIn: 100,
    tokensOut: 50,
    cost: 0.001,
  }),
}));

// ── Import after mocks ──
import {
  parseFileReferences,
  resolveFileReferences,
  collectContext,
  searchProjectFiles,
  searchFileContents,
  readFilesAsContext,
  buildFsSystemPrompt,
  executeFsAiTask,
} from '../../lib/fs-ai-bridge';
import type { FsProject, DirEntry } from '../../types/fs';

// ── Test Fixtures ──
const mockProject: FsProject = {
  id: 'proj-1',
  name: '测试小说',
  rootPath: 'C:/novels/test-novel',
  genre: '科幻',
  createdAt: 1000,
  lastOpenedAt: 2000,
  updatedAt: 2000,
};

const mockDirEntries: DirEntry[] = [
  { name: 'chapters', path: 'chapters', isDir: true, extension: '', size: 0, modifiedAt: 2000 },
  { name: 'characters', path: 'characters', isDir: true, extension: '', size: 0, modifiedAt: 2000 },
  { name: '大纲.md', path: '大纲.md', isDir: false, extension: 'md', size: 500, modifiedAt: 2400 },
  { name: '布兰.md', path: 'characters/布兰.md', isDir: false, extension: 'md', size: 800, modifiedAt: 2500 },
  { name: 'ch01.md', path: 'chapters/ch01.md', isDir: false, extension: 'md', size: 1200, modifiedAt: 2500 },
];

// =========================================================================
//  parseFileReferences
// =========================================================================

describe('parseFileReferences', () => {
  it('extracts @file references from text', () => {
    const result = parseFileReferences('看看 @布兰.md 的内容');
    expect(result).toEqual(['布兰.md']);
  });

  it('extracts multiple @file references', () => {
    const result = parseFileReferences('对比 @布兰.md 和 @大纲.md');
    expect(result).toEqual(['布兰.md', '大纲.md']);
  });

  it('returns empty array when no @ references', () => {
    const result = parseFileReferences('你好，帮我分析一下这个');
    expect(result).toEqual([]);
  });

  it('handles @ with Chinese file names', () => {
    const result = parseFileReferences('读一下 @人物/布兰.md');
    expect(result).toEqual(['人物/布兰.md']);
  });

  it('rejects empty @ references', () => {
    const result = parseFileReferences('just @');
    expect(result).toEqual([]);
  });
});

// =========================================================================
//  resolveFileReferences
// =========================================================================

describe('resolveFileReferences', () => {
  beforeEach(() => {
    mockListDirectory.mockReset();
    mockListDirectory
      .mockResolvedValueOnce(mockDirEntries)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
  });

  it('finds exact file match', async () => {
    // First call from listAllFiles(root, '')
    // Subsequent calls from subdirectory recursion
    mockListDirectory
      .mockReset()
      .mockResolvedValueOnce(mockDirEntries)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await resolveFileReferences('/test/root', ['布兰.md']);
    expect(result[0].exactMatch).toBe('characters/布兰.md');
    expect(result[0].matches).toContain('characters/布兰.md');
  });

  it('returns empty matches for unknown files', async () => {
    mockListDirectory
      .mockReset()
      .mockResolvedValueOnce(mockDirEntries)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await resolveFileReferences('/test/root', ['unknown.md']);
    expect(result[0].exactMatch).toBeUndefined();
    expect(result[0].matches).toEqual([]);
  });
});

// =========================================================================
//  collectContext
// =========================================================================

describe('collectContext', () => {
  beforeEach(() => {
    mockListDirectory.mockReset();
    mockReadFile.mockReset();
  });

  it('collects project context without current file', async () => {
    mockListDirectory.mockResolvedValue(mockDirEntries);

    const context = await collectContext(mockProject, null);

    expect(context.projectRoot).toBe(mockProject.rootPath);
    expect(context.currentFilePath).toBeNull();
    expect(context.currentFileContent).toBeNull();
    expect(context.projectFiles).toEqual(mockDirEntries);
  });

  it('reads current file content when provided', async () => {
    mockListDirectory.mockResolvedValue(mockDirEntries);
    mockReadFile.mockResolvedValue('# 第一章\n\n这是正文内容。');

    const context = await collectContext(mockProject, 'chapters/ch01.md');

    expect(context.currentFilePath).toBe('chapters/ch01.md');
    expect(context.currentFileContent).toBe('# 第一章\n\n这是正文内容。');
  });

  it('handles listDirectory error gracefully', async () => {
    mockListDirectory.mockRejectedValue(new Error('permission denied'));

    const context = await collectContext(mockProject, null);

    expect(context.projectFiles).toEqual([]);
  });

  it('handles readFile error gracefully', async () => {
    mockListDirectory.mockResolvedValue(mockDirEntries);
    mockReadFile.mockRejectedValue(new Error('file not found'));

    const context = await collectContext(mockProject, 'missing.md');

    expect(context.currentFileContent).toBeNull();
  });
});

// =========================================================================
//  searchProjectFiles
// =========================================================================

describe('searchProjectFiles', () => {
  beforeEach(() => {
    mockListDirectory.mockReset();
  });

  it('finds files by name match', async () => {
    mockListDirectory
      .mockResolvedValueOnce(mockDirEntries)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const results = await searchProjectFiles('/test/root', '布兰');

    expect(results).toContain('characters/布兰.md');
  });

  it('finds files by path match', async () => {
    mockListDirectory
      .mockResolvedValueOnce(mockDirEntries)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const results = await searchProjectFiles('/test/root', 'ch01');

    expect(results).toContain('chapters/ch01.md');
  });

  it('respects maxResults', async () => {
    mockListDirectory
      .mockResolvedValueOnce(mockDirEntries)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const results = await searchProjectFiles('/test/root', 'md', 1);

    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('returns empty array on error', async () => {
    mockListDirectory.mockRejectedValue(new Error('error'));
    const results = await searchProjectFiles('/test/root', 'test');
    expect(results).toEqual([]);
  });
});

// =========================================================================
//  searchFileContents
// =========================================================================

describe('searchFileContents', () => {
  beforeEach(() => {
    mockSearchFileContent.mockReset();
  });

  it('searches file content via backend', async () => {
    mockSearchFileContent.mockResolvedValue({
      matches: [
        { filePath: 'characters/布兰.md', matchCount: 3, previews: ['布兰是一个勇敢的少年', '布兰的年龄是16岁'] },
      ],
      totalFilesSearched: 5,
    });

    const results = await searchFileContents('/test/root', '布兰');

    expect(results.length).toBe(1);
    expect(results[0].filePath).toBe('characters/布兰.md');
    expect(results[0].matchCount).toBe(3);
    expect(results[0].previews).toContain('布兰是一个勇敢的少年');
  });

  it('returns empty array on error', async () => {
    mockSearchFileContent.mockRejectedValue(new Error('error'));
    const results = await searchFileContents('/test/root', 'test');
    expect(results).toEqual([]);
  });

  it('filters to .md files by default', async () => {
    mockSearchFileContent.mockResolvedValue({
      matches: [],
      totalFilesSearched: 0,
    });

    const results = await searchFileContents('/test/root', 'test');
    expect(results).toEqual([]);
    expect(mockSearchFileContent).toHaveBeenCalledWith('/test/root', 'test', 10, 'md');
  });
});

// =========================================================================
//  readFilesAsContext
// =========================================================================

describe('readFilesAsContext', () => {
  beforeEach(() => {
    mockReadFile.mockReset();
  });

  it('reads files and formats as context', async () => {
    mockReadFile
      .mockResolvedValueOnce('# 布兰\n\n布兰是一个角色。')
      .mockResolvedValueOnce('# 大纲\n\n这是大纲。');

    const result = await readFilesAsContext('/test/root', ['characters/布兰.md', '大纲.md']);

    expect(result).toContain('--- characters/布兰.md ---');
    expect(result).toContain('布兰是一个角色。');
    expect(result).toContain('--- 大纲.md ---');
    expect(result).toContain('这是大纲。');
  });

  it('handles individual file read errors', async () => {
    mockReadFile
      .mockResolvedValueOnce('# 布兰\n\n内容')
      .mockRejectedValueOnce(new Error('not found'));

    const result = await readFilesAsContext('/test/root', ['characters/布兰.md', 'missing.md']);

    expect(result).toContain('--- characters/布兰.md ---');
    expect(result).toContain('[无法读取此文件]');
  });
});

// =========================================================================
//  buildFsSystemPrompt
// =========================================================================

describe('buildFsSystemPrompt', () => {
  it('includes file list in prompt', () => {
    const context = {
      projectRoot: '/test',
      currentFilePath: null,
      currentFileContent: null,
      projectFiles: mockDirEntries.filter(e => !e.isDir),
    };

    const prompt = buildFsSystemPrompt(context);

    expect(prompt).toContain('当前项目结构');
    expect(prompt).toContain('大纲.md');
    expect(prompt).toContain('布兰.md');
    expect(prompt).toContain('ch01.md');
  });

  it('includes current file content when provided', () => {
    const context = {
      projectRoot: '/test',
      currentFilePath: 'chapters/ch01.md',
      currentFileContent: '# 第一章\n\n正文开始...',
      projectFiles: mockDirEntries,
    };

    const prompt = buildFsSystemPrompt(context);

    expect(prompt).toContain('当前编辑中的文件');
    expect(prompt).toContain('chapters/ch01.md');
    expect(prompt).toContain('正文开始...');
  });

  it('mentions reading-only capability', () => {
    const context = {
      projectRoot: '/test',
      currentFilePath: null,
      currentFileContent: null,
      projectFiles: [],
    };

    const prompt = buildFsSystemPrompt(context);

    expect(prompt).toContain('只能读取文件');
    expect(prompt).toContain('不能直接修改');
  });
});

// =========================================================================
//  executeFsAiTask
// =========================================================================

describe('executeFsAiTask', () => {
  const baseContext = {
    projectRoot: '/test',
    currentFilePath: null,
    currentFileContent: null,
    projectFiles: [],
  };

  it('returns no-provider message when no active providers', async () => {
    // listProviderConfigs already mocked to return empty
    const task = {
      userInput: '你好',
      context: baseContext,
      status: 'thinking' as const,
      messages: [],
      readFiles: [],
      searchResults: [],
      evidence: [],
    };

    const result = await executeFsAiTask(task);

    expect(result.status).toBe('responding');
    expect(result.messages.some(m => m.content.includes('还没有配置 AI 模型'))).toBe(true);
  });

  it('preserves existing messages', async () => {
    const task = {
      userInput: '你好',
      context: baseContext,
      status: 'thinking' as const,
      messages: [{ role: 'assistant' as const, content: '上次的回复', timestamp: 100 }],
      readFiles: [],
      searchResults: [],
      evidence: [],
    };

    const result = await executeFsAiTask(task);

    expect(result.messages.length).toBeGreaterThanOrEqual(2);
    expect(result.messages[0].content).toBe('上次的回复');
    expect(result.messages[result.messages.length - 1].role).toBe('assistant');
  });

  it('tracks evidence steps', async () => {
    const task = {
      userInput: '帮我分析人物',
      context: baseContext,
      status: 'thinking' as const,
      messages: [],
      readFiles: [],
      searchResults: [],
      evidence: [],
    };

    const result = await executeFsAiTask(task);

    expect(result.evidence).toBeDefined();
    expect(result.evidence.length).toBeGreaterThanOrEqual(1);
  });

  it('uses provided LLM options', async () => {
    const { listProviderConfigs } = await import('../../api/aiControlCenterApi');
    (listProviderConfigs as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{
      isActive: true,
      providerId: 'test',
      endpoint: 'http://localhost:11434/v1',
      models: '["test-model"]',
      timeout_ms: 30000,
    }]);

    const task = {
      userInput: 'test',
      context: baseContext,
      status: 'thinking' as const,
      messages: [],
      readFiles: [],
      searchResults: [],
      evidence: [],
    };

    const result = await executeFsAiTask(task, {
      apiKey: 'test-key',
      model: { id: 'test-model', name: 'test-model', provider: 'test', context: 8192 },
      endpoint: 'http://localhost:3000/v1',
    });

    expect(result.status).toBe('responding');
    expect(result.messages.length).toBeGreaterThanOrEqual(1);
  });
});
