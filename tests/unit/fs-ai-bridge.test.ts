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
  resolveFileReferences,
  runReadonlyAiTask,
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listProviderConfigs.mockResolvedValue([{
    id: 'config-1',
    providerId: 'ollama',
    providerName: 'Ollama',
    hasApiKey: false,
    endpoint: 'http://localhost:11434/v1',
    models: '["qwen3:8b"]',
    timeoutMs: 30_000,
    isActive: true,
    createdAt: 1,
    updatedAt: 1,
  }]);
  mocks.resolveProviderCredential.mockResolvedValue('secret');
  mocks.listDirectory.mockImplementation((_root: string, path?: string) => {
    if (!path) {
      return Promise.resolve([
        { name: '人物', path: '人物', isDir: true, extension: '', size: 0, modifiedAt: 1 },
        { name: '大纲.md', path: '大纲.md', isDir: false, extension: 'md', size: 20, modifiedAt: 1 },
        { name: '封面.png', path: '封面.png', isDir: false, extension: 'png', size: 20, modifiedAt: 1 },
      ]);
    }
    if (path === '人物') {
      return Promise.resolve([
        { name: '布兰.md', path: '人物/布兰.md', isDir: false, extension: 'md', size: 20, modifiedAt: 1 },
        { name: '旗丞.txt', path: '人物/旗丞.txt', isDir: false, extension: 'txt', size: 20, modifiedAt: 1 },
      ]);
    }
    return Promise.resolve([]);
  });
  mocks.searchFileContent.mockResolvedValue({
    matches: [{ filePath: '人物/布兰.md', matchCount: 2, previews: ['布兰知道黑潮的名字'] }],
    totalFilesSearched: 3,
    truncated: false,
  });
  mocks.readFile.mockImplementation((_root: string, path: string) => {
    if (path === '人物/布兰.md') return Promise.resolve('# 布兰\n\n布兰知道黑潮的名字，但不知道来源。');
    if (path === '大纲.md') return Promise.resolve('# 大纲');
    return Promise.reject(new Error('not found'));
  });
});

describe('Gate B file references', () => {
  it('parses compact and braced @ references without swallowing punctuation', () => {
    expect(parseFileReferences('根据 @人物/布兰.md 和 @{资料/第一版 人物表.md}，回答。')).toEqual([
      '人物/布兰.md',
      '资料/第一版 人物表.md',
    ]);
  });

  it('resolves exact paths before fuzzy file-name candidates', async () => {
    const index = await listProjectTextFiles(project.rootPath);
    const resolved = resolveFileReferences(index.files, ['人物/布兰.md', '旗丞']);
    expect(resolved[0].exactMatch).toBe('人物/布兰.md');
    expect(resolved[1].exactMatch).toBe('人物/旗丞.txt');
  });

  it('indexes only author-facing text files recursively', async () => {
    const index = await listProjectTextFiles(project.rootPath);
    expect(index.files.map((file) => file.path)).toEqual(['人物/布兰.md', '人物/旗丞.txt', '大纲.md']);
    expect(index.files.some((file) => file.path.endsWith('.png'))).toBe(false);
  });
});

describe('Gate B read-only task', () => {
  it('plans search, reads evidence, and answers with no write operation', async () => {
    mocks.callLlm
      .mockResolvedValueOnce({
        content: JSON.stringify({
          searchQueries: ['布兰', '黑潮'],
          includeCurrentFile: true,
          requestedFiles: [],
          focus: '判断布兰知道到什么程度',
        }),
        model: 'qwen3:8b', tokensIn: 1, tokensOut: 1, cost: 0,
      })
      .mockResolvedValueOnce({
        content: '布兰知道黑潮的名称，但材料没有证明他知道其来源。[S2]',
        model: 'qwen3:8b', tokensIn: 1, tokensOut: 1, cost: 0,
      });

    const progress: string[] = [];
    const result = await runReadonlyAiTask({
      userInput: '布兰目前知道黑潮真相吗？',
      project,
      currentFilePath: '大纲.md',
      currentFileContent: '# 当前未保存的大纲',
      selection: null,
      onProgress: (event) => progress.push(event.phase),
    });

    expect(mocks.searchFileContent).toHaveBeenCalledWith(project.rootPath, '布兰', 10, 'md,markdown,txt');
    expect(mocks.readFile).toHaveBeenCalledWith(project.rootPath, '人物/布兰.md');
    expect(result.answer).toContain('[S2]');
    expect(result.evidence.some((item) => item.filePath === '大纲.md' && item.detail.includes('当前编辑缓存'))).toBe(true);
    expect(result.evidence.some((item) => item.filePath === '人物/布兰.md')).toBe(true);
    expect(progress).toContain('searching');
    expect(progress).toContain('reading');
    expect(progress).toContain('answering');
  });

  it('uses current selection as explicit evidence', async () => {
    mocks.callLlm
      .mockResolvedValueOnce({
        content: JSON.stringify({ searchQueries: [], includeCurrentFile: false, requestedFiles: [], focus: '分析选区' }),
        model: 'qwen3:8b', tokensIn: 1, tokensOut: 1, cost: 0,
      })
      .mockResolvedValueOnce({
        content: '选区中的人物语气明显失控。[S1]',
        model: 'qwen3:8b', tokensIn: 1, tokensOut: 1, cost: 0,
      });

    const result = await runReadonlyAiTask({
      userInput: '这一段的人物语气是否越界？',
      project,
      currentFilePath: '正文/ch10.md',
      currentFileContent: '前文\n他突然大喊。\n后文',
      selection: {
        start: 3,
        end: 10,
        text: '他突然大喊。',
        cursorOffset: 3,
        startLine: 1,
        endLine: 1,
      },
    });

    expect(result.evidence[0].kind).toBe('selection');
    expect(result.evidence[0].excerpt).toContain('他突然大喊');
  });

  it('keeps answering when one search query fails', async () => {
    mocks.callLlm
      .mockResolvedValueOnce({
        content: JSON.stringify({ searchQueries: ['坏查询', '布兰'], includeCurrentFile: false, requestedFiles: [], focus: '回答人物问题' }),
        model: 'qwen3:8b', tokensIn: 1, tokensOut: 1, cost: 0,
      })
      .mockResolvedValueOnce({
        content: '布兰知道黑潮的名称。[S2]',
        model: 'qwen3:8b', tokensIn: 1, tokensOut: 1, cost: 0,
      });
    mocks.searchFileContent
      .mockRejectedValueOnce(new Error('SEARCH_IO_ERROR'))
      .mockResolvedValueOnce({
        matches: [{ filePath: '人物/布兰.md', matchCount: 2, previews: ['布兰知道黑潮的名字'] }],
        totalFilesSearched: 3,
        truncated: false,
      });

    const result = await runReadonlyAiTask({
      userInput: '布兰知道什么？',
      project,
      currentFilePath: null,
      currentFileContent: null,
      selection: null,
    });

    expect(result.evidence.some((item) => item.kind === 'read-error' && item.title.includes('搜索失败'))).toBe(true);
    expect(result.evidence.some((item) => item.filePath === '人物/布兰.md')).toBe(true);
    expect(result.answer).toContain('[S2]');
  });

  it('reports missing @ references as evidence instead of inventing a file', async () => {
    mocks.callLlm
      .mockResolvedValueOnce({
        content: JSON.stringify({ searchQueries: [], includeCurrentFile: false, requestedFiles: [], focus: '回答引用问题' }),
        model: 'qwen3:8b', tokensIn: 1, tokensOut: 1, cost: 0,
      })
      .mockResolvedValueOnce({
        content: '当前项目中没有找到该人物卡。',
        model: 'qwen3:8b', tokensIn: 1, tokensOut: 1, cost: 0,
      });

    const result = await runReadonlyAiTask({
      userInput: '根据 @{人物/不存在.md} 回答',
      project,
      currentFilePath: null,
      currentFileContent: null,
      selection: null,
    });

    expect(result.evidence.some((item) => item.kind === 'read-error' && item.title.includes('未找到引用'))).toBe(true);
    expect(result.answer).toContain('没有找到足够依据');
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.callLlm).toHaveBeenCalledTimes(1);
  });
});
