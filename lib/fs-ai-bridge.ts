/**
 * fs-ai-bridge.ts — Bridge between filesystem projects and the AI router.
 *
 * Gate B: AI can search and read project files.
 * No writing to files yet (that's Gate C).
 *
 * v2: Added content search, @file references, evidence tracking.
 */

import type { FsProject, DirEntry, SearchMatch } from '../types/fs';
import { listDirectory, readFile, searchFileContent } from '../tauri-api';
import { route } from './ai/command-router';
import { callLlm } from './llm-client';
import type { LlmCallOptions } from './llm-client';
import { listProviderConfigs, resolveProviderCredential } from '../api/aiControlCenterApi';
import type { RouteInput, RouteOutput } from '../docs/contracts/ai-router.contract';

export interface FsAiContext {
  projectRoot: string;
  currentFilePath: string | null;
  currentFileContent: string | null;
  projectFiles: DirEntry[];
}

export interface FsAiTask {
  userInput: string;
  context: FsAiContext;
  status: 'thinking' | 'searching' | 'reading' | 'responding' | 'error';
  messages: FsAiMessage[];
  readFiles: string[];
  searchResults: string[];
  /** Evidence tracking: what files were read and what was found */
  evidence: FsAiEvidenceStep[];
}

export interface FsAiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/** Evidence step — records what the AI did during a task */
export interface FsAiEvidenceStep {
  type: 'search' | 'read' | 'analyze' | 'respond';
  detail: string;
  files: string[];
}

/**
 * Parse @file references from user input.
 * Returns an array of referenced file paths/patterns.
 */
export function parseFileReferences(input: string): string[] {
  const refs: string[] = [];
  const atRegex = /@([\w一-鿿\-\.\/]+\.?\w*)/g;
  let match;
  while ((match = atRegex.exec(input)) !== null) {
    const ref = match[1].trim();
    if (ref && ref.length > 0 && ref.length < 200) {
      refs.push(ref);
    }
  }
  return refs;
}

/**
 * Search for @file references in the project.
 * Tries to find files matching each reference by name or path.
 */
export async function resolveFileReferences(
  projectRoot: string,
  refs: string[],
): Promise<{ ref: string; matches: string[]; exactMatch?: string }[]> {
  const results: { ref: string; matches: string[]; exactMatch?: string }[] = [];

  for (const ref of refs) {
    const allFiles = await listAllFiles(projectRoot);
    const lowerRef = ref.toLowerCase();

    // Try exact match first
    const exact = allFiles.find(f => {
      const name = f.path.toLowerCase();
      return name === lowerRef || name.endsWith('/' + lowerRef) || name.replace(/\\/g, '/').endsWith('/' + lowerRef);
    });

    if (exact) {
      results.push({ ref, matches: [exact.path], exactMatch: exact.path });
      continue;
    }

    // Fuzzy match by name
    const nameMatches = allFiles
      .filter(f => f.name.toLowerCase().includes(lowerRef) || f.path.toLowerCase().includes(lowerRef))
      .slice(0, 5)
      .map(f => f.path);

    results.push({ ref, matches: nameMatches });
  }

  return results;
}

/**
 * Collect filesystem context for the AI.
 * Recursively lists all project files and reads the current file if open.
 */
export async function collectContext(project: FsProject, currentFilePath: string | null): Promise<FsAiContext> {
  let rootEntries: DirEntry[] = [];
  let allFiles: DirEntry[] = [];
  let fileContent: string | null = null;

  try {
    rootEntries = await listDirectory(project.rootPath, '');
  } catch {
    rootEntries = [];
  }

  // Recursively collect ALL files for full project context
  try {
    allFiles = await listAllFiles(project.rootPath);
  } catch {
    allFiles = rootEntries;
  }

  if (currentFilePath) {
    try {
      fileContent = await readFile(project.rootPath, currentFilePath);
    } catch {
      fileContent = null;
    }
  }

  return {
    projectRoot: project.rootPath,
    currentFilePath,
    currentFileContent: fileContent,
    projectFiles: allFiles,  // Now includes files from subdirectories
  };
}

/**
 * Search for files by name or content within the project.
 * Returns matching file paths.
 */
export async function searchProjectFiles(
  projectRoot: string,
  query: string,
  maxResults: number = 10,
): Promise<string[]> {
  const results: string[] = [];
  try {
    const allFiles = await listAllFiles(projectRoot);
    const lowerQuery = query.toLowerCase();

    for (const file of allFiles) {
      if (results.length >= maxResults) break;
      if (file.name.toLowerCase().includes(lowerQuery) || file.path.toLowerCase().includes(lowerQuery)) {
        results.push(file.path);
      }
    }
  } catch {
    // Silently degrade
  }
  return results;
}

/**
 * Search file contents within the project.
 * Uses the Rust backend for efficient server-side search.
 */
export async function searchFileContents(
  projectRoot: string,
  query: string,
  maxResults: number = 10,
): Promise<{ filePath: string; matchCount: number; previews: string[] }[]> {
  try {
    const result = await searchFileContent(projectRoot, query, maxResults, 'md');
    return result.matches.map((m: SearchMatch) => ({
      filePath: m.filePath,
      matchCount: m.matchCount,
      previews: m.previews,
    }));
  } catch {
    return [];
  }
}

/**
 * Recursively list all files in the project.
 */
async function listAllFiles(projectRoot: string, dirPath: string = ''): Promise<DirEntry[]> {
  const results: DirEntry[] = [];
  try {
    const entries = await listDirectory(projectRoot, dirPath || undefined);
    for (const entry of entries) {
      results.push(entry);
      if (entry.isDir) {
        const children = await listAllFiles(projectRoot, entry.path);
        results.push(...children);
      }
    }
  } catch {
    // Skip unreadable directories
  }
  return results;
}

/**
 * Read multiple files and return their contents as a formatted context string.
 */
export async function readFilesAsContext(
  projectRoot: string,
  filePaths: string[],
): Promise<string> {
  let context = '';
  for (const path of filePaths) {
    try {
      const content = await readFile(projectRoot, path);
      context += `--- ${path} ---\n${content}\n\n`;
    } catch {
      context += `--- ${path} ---\n[无法读取此文件]\n\n`;
    }
  }
  return context;
}

/**
 * Build a system prompt for the AI based on the FS project context.
 * v2: Enhanced for deeper novel analysis capabilities.
 */
export function buildFsSystemPrompt(context: FsAiContext): string {
  const fileList = context.projectFiles
    .filter(f => !f.isDir)
    .map(f => `  📄 ${f.path}`)
    .join('\n');
  const dirList = context.projectFiles
    .filter(f => f.isDir)
    .map(f => `  📁 ${f.path}/`)
    .join('\n');

  // If no project files or context, return minimal prompt
  if (!context.projectFiles || context.projectFiles.length === 0) {
    return `你是一个小说创作助手。

## 当前状态

当前没有打开任何项目文件。你无法读取项目内容。

请提示用户：
1. 先在织梦机中打开或创建一个本地项目
2. 之后你才能搜索和读取他们的作品文件
3. 在没有项目的情况下，你只能提供一般性的写作建议

注意：不要编造不存在的项目结构、人物或情节。`;
  }

  let prompt = `你是一个小说创作助手，正在协助作者创作长篇小说。

## 当前项目结构

`;
  if (dirList) prompt += `目录：\n${dirList}\n\n`;
  if (fileList) prompt += `文件：\n${fileList}\n\n`;

  if (context.currentFilePath) {
    prompt += `## 当前编辑中的文件\n\n路径：${context.currentFilePath}\n`;
    if (context.currentFileContent) {
      const preview = context.currentFileContent.substring(0, 3000);
      prompt += `\n内容预览（前3000字）：\n\`\`\`\n${preview}\n\`\`\`\n`;
    }
  }

  prompt += `\n## 你的能力

1. **搜索文件** — 使用关键词在项目中查找文件
2. **搜索内容** — 搜索文件中的具体内容（角色名、情节关键词等）
3. **读取文件** — 读取项目中的任意 Markdown 文件
4. **分析内容** — 分析人物关系、情节结构、设定一致性等
5. **提供建议** — 基于项目实际内容给出写作建议

## 回答规范

1. **区分依据与推测：**
   - ✅ "根据 人物/布兰.md 中的描述，布兰的年龄是 16 岁"
   - ❌ 把自己记得的或推测的内容说成是文件中明确存在的
   - 如果信息在文件中不存在，明确说"项目文件中没有找到相关信息"

2. **展示证据：**
   - 引用具体文件名和段落说明依据
   - 归纳多份材料时说明综合了哪些文件

3. **阅读模式：**
   - 你只能读取文件，不能直接修改
   - 需要创建或修改文件时，告诉用户需要 Gate C 能力

4. **诚实面对缺失：**
   - 搜索不到相关内容时，如实告知
   - 可以建议用户补充哪些内容
`;

  return prompt;
}

/**
 * Execute an AI task with filesystem context.
 * This is the main entry point for Gate B AI operations.
 * v2: Enhanced with content search support and evidence tracking.
 */
export async function executeFsAiTask(
  task: FsAiTask,
  llmOptions?: Partial<LlmCallOptions>,
): Promise<FsAiTask> {
  const { userInput, context } = task;
  const messages: FsAiMessage[] = [...task.messages];
  const evidence: FsAiEvidenceStep[] = [...(task.evidence || [])];

  // Add user message
  messages.push({ role: 'user', content: userInput, timestamp: Date.now() });

  task.status = 'thinking';
  task.messages = messages;
  task.evidence = evidence;

  try {
    // Check if AI providers are configured
    const providers = await listProviderConfigs();
    const activeProviders = providers.filter(p => p.isActive);

    if (activeProviders.length === 0) {
      // No provider — return helpful message
      messages.push({
        role: 'assistant',
        content: '还没有配置 AI 模型。请先在设置中配置 API（支持 OpenAI、Anthropic、Ollama 等兼容接口）。',
        timestamp: Date.now(),
      });
      evidence.push({ type: 'respond', detail: '无可用 AI 提供者', files: [] });
      task.status = 'responding';
      task.messages = messages;
      task.evidence = evidence;
      return task;
    }

    // Check for @file references
    const fileRefs = parseFileReferences(userInput);
    if (fileRefs.length > 0) {
      task.status = 'reading';
      const resolved = await resolveFileReferences(context.projectRoot, fileRefs);
      const refFilesToRead: string[] = [];
      for (const r of resolved) {
        if (r.exactMatch) {
          refFilesToRead.push(r.exactMatch);
        } else if (r.matches.length > 0) {
          refFilesToRead.push(r.matches[0]);
        }
      }
      if (refFilesToRead.length > 0) {
        const refContent = await readFilesAsContext(context.projectRoot, refFilesToRead);
        evidence.push({
          type: 'read',
          detail: `通过 @ 引用读取了 ${refFilesToRead.length} 个文件`,
          files: refFilesToRead,
        });
        // Inject file content into the last user message
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          content: `${userInput}\n\n[已读取引用的文件内容]\n${refContent}`,
        };
      }
    }

    // Determine if content search is needed
    const searchKeywords = extractSearchKeywords(userInput);
    if (searchKeywords.length > 0) {
      task.status = 'searching';
      const contentResults = await searchFileContents(context.projectRoot, searchKeywords[0], 5);
      if (contentResults.length > 0) {
        evidence.push({
          type: 'search',
          detail: `搜索 "${searchKeywords[0]}" 找到 ${contentResults.length} 个相关文件`,
          files: contentResults.map(r => r.filePath),
        });

        // Read top matching files for context
        const filesToRead = contentResults.slice(0, 3).map(r => r.filePath);
        if (filesToRead.length > 0) {
          const searchContext = await readFilesAsContext(context.projectRoot, filesToRead);
          evidence.push({
            type: 'read',
            detail: `读取了 ${filesToRead.length} 个搜索结果文件`,
            files: filesToRead,
          });
          // Append to the last message
          messages[messages.length - 1] = {
            ...messages[messages.length - 1],
            content: messages[messages.length - 1].content + `\n\n[根据相关性搜索并读取了以下文件]\n${searchContext}`,
          };
        }
      } else {
        evidence.push({
          type: 'search',
          detail: `搜索 "${searchKeywords[0]}" 未找到匹配内容`,
          files: [],
        });

        // Fallback: auto-read files based on user intent
        const autoReadFiles = await autoReadRelevantFiles(
          context.projectRoot, userInput, context.projectFiles,
        );
        if (autoReadFiles.length > 0) {
          const readContext = await readFilesAsContext(context.projectRoot, autoReadFiles);
          evidence.push({
            type: 'read',
            detail: `自动读取了 ${autoReadFiles.length} 个相关文件`,
            files: autoReadFiles,
          });
          // Prepend file context to the last user message
          messages[messages.length - 1] = {
            ...messages[messages.length - 1],
            content: `${userInput}\n\n[已自动读取项目中的相关文件]\n${readContext}`,
          };
        }
      }
    }

    // Build the system prompt with project context
    const systemPrompt = buildFsSystemPrompt(context);

    // Try to use the router first
    const routeInput: RouteInput = {
      message: userInput,
      canvasId: 'fs-workspace',
      projectId: context.projectRoot,
    };

    const routeResult: RouteOutput = await route(routeInput);

    if (routeResult.fallbackReason && routeResult.fallbackReason.includes('No AI provider')) {
      messages.push({
        role: 'assistant',
        content: routeResult.fallbackReason,
        timestamp: Date.now(),
      });
      evidence.push({ type: 'respond', detail: 'AI 路由回落', files: [] });
      task.status = 'responding';
      task.messages = messages;
      task.evidence = evidence;
      return task;
    }

    // Build LLM call
    const llmMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    const activeProvider = activeProviders[0];
    let modelList: string[] = [];
    try { modelList = JSON.parse(activeProvider.models); } catch { modelList = [activeProvider.models]; }

    // Resolve credential
    let apiKey: string | undefined;
    try {
      const credential = await resolveProviderCredential(activeProvider.providerId);
      apiKey = credential as unknown as string;
    } catch {
      apiKey = llmOptions?.apiKey || undefined;
    }

    const options: LlmCallOptions = {
      model: llmOptions?.model || {
        id: modelList[0] || 'gpt-4',
        name: modelList[0] || 'GPT-4',
        provider: activeProvider.providerId,
        context: 8192,
      },
      endpoint: activeProvider.endpoint || undefined,
      apiKey,
      timeout: activeProvider.timeout_ms as number || 30000,
    };

    // Make the LLM call
    const response = await callLlm(llmMessages, options);

    messages.push({
      role: 'assistant',
      content: response.content || response.text || '(AI 没有返回内容)',
      timestamp: Date.now(),
    });

    evidence.push({ type: 'respond', detail: 'AI 回复生成完成', files: [] });
    task.status = 'responding';
    task.messages = messages;
    task.evidence = evidence;
  } catch (err) {
    messages.push({
      role: 'assistant',
      content: `发生错误：${err instanceof Error ? err.message : String(err)}`,
      timestamp: Date.now(),
    });
    evidence.push({ type: 'respond', detail: `错误: ${err instanceof Error ? err.message : String(err)}`, files: [] });
    task.status = 'error';
    task.messages = messages;
    task.evidence = evidence;
  }

  return task;
}

/**
 * Extract search keywords from user input.
 * Looks for Chinese/English keywords that might be file/search targets.
 */
function extractSearchKeywords(input: string): string[] {
  const keywords: string[] = [];

  // Remove @file references
  const withoutRefs = input.replace(/@[\w一-鿿\-\.\/]+/g, '');

  // Extract quoted phrases
  const quotedRegex = /[""「」『』]([^""「」『』]{2,30})[""「」『』]/g;
  let match;
  while ((match = quotedRegex.exec(input)) !== null) {
    keywords.push(match[1]);
  }

  // Look for character/plot names (Chinese words that aren't common verbs)
  // Simple heuristic: extract 2-4 char sequences after common search verbs
  const searchPatterns = [
    /(?:找|查|搜索|寻找|查找|看看|了解|关于|分析|整理|梳理|读|阅读|查看)[的了的]?[\s]*(.{2,20})/g,
    /(.{2,20})(?:是谁|什么|在哪|怎么样|的关系|的设定|的情节|的结局|的经历|的性格|的背景|的关系|的介绍)/g,
  ];

  for (const pattern of searchPatterns) {
    let m;
    while ((m = pattern.exec(withoutRefs)) !== null) {
      const kw = m[1].trim();
      if (kw.length >= 2 && !keywords.includes(kw)) {
        keywords.push(kw);
      }
    }
  }

  // If no specific keywords found, use the first meaningful phrase
  if (keywords.length === 0 && withoutRefs.trim().length > 2) {
    keywords.push(withoutRefs.trim().substring(0, 30));
  }

  return keywords.slice(0, 3);
}

/**
 * Auto-read relevant files based on user intent.
 * When content search fails, this provides intelligent fallback context.
 */
async function autoReadRelevantFiles(
  projectRoot: string,
  userInput: string,
  allFiles: DirEntry[],
  maxFiles: number = 5,
): Promise<string[]> {
  const input = userInput.toLowerCase();
  const candidates: string[] = [];

  // Determine intent categories
  const wantsCharacters = /人物|角色|关系|人设|主角|配角/.test(input);
  const wantsPlot = /情节|剧情|故事|大纲|结构|章节|内容/.test(input);
  const wantsSetting = /设定|世界|背景|世界观|规则/.test(input);
  const wantsChapter = /章|节|正文|最近|继续/.test(input);
  const wantsOverview = /项目|结构|文件|目录|概览/.test(input) || input.length < 5;

  // Scan files and match by directory/category
  for (const file of allFiles) {
    if (file.isDir) continue;
    if (!file.extension || !['md', 'txt'].includes(file.extension)) continue;
    if (candidates.length >= maxFiles) break;

    const path = file.path.toLowerCase();
    const name = file.name.toLowerCase();

    // Character files
    if (wantsCharacters && (path.includes('character') || path.includes('人物'))) {
      candidates.push(file.path);
      continue;
    }

    // Chapter files
    if (wantsChapter && (path.includes('chapter') || path.includes('章'))) {
      candidates.push(file.path);
      continue;
    }

    // Plot/outline files
    if (wantsPlot && (path.includes('大纲') || path.includes('outline') || path.includes('plot') || path.includes('structure') || path.includes('结构'))) {
      candidates.push(file.path);
      continue;
    }

    // Setting files
    if (wantsSetting && (path.includes('设定') || path.includes('setting') || path.includes('world') || path.includes('规则'))) {
      candidates.push(file.path);
      continue;
    }
  }

  // If still nothing matched and it's an overview query, pick first few .md files
  if (candidates.length === 0 && wantsOverview) {
    const mdFiles = allFiles.filter(f => !f.isDir && f.extension === 'md');
    for (const f of mdFiles.slice(0, maxFiles)) {
      candidates.push(f.path);
    }
  }

  return candidates;
}
