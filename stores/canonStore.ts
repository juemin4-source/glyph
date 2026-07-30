import { create } from 'zustand';
import type {
  SparrowSchema,
  Entity,
  ScanCandidate,
  EntityType,
} from '../types/fs-ai';
import {
  getSchema,
  saveSchema,
  listEntities,
  getEntity as getEntityApi,
  saveEntity,
  deleteEntity,
  readFile,
  listDirectory,
} from '../tauri-api';
import { defaultSparrowSchema, ENTITY_TYPES } from '../types/fs-ai';
import { listProjectTextFiles } from '../lib/fs-ai-bridge';
import { listProviderConfigs, resolveProviderCredential } from '../api/aiControlCenterApi';
import { callLlm } from '../lib/llm-client';

interface CanonStore {
  // Data
  schema: SparrowSchema;
  entities: Entity[];
  loading: boolean;
  error: string | null;

  // Schema
  loadSchema: (projectRoot: string) => Promise<void>;
  updateSchema: (projectRoot: string, patch: Partial<SparrowSchema>) => Promise<void>;

  // Entities
  loadEntities: (projectRoot: string) => Promise<void>;
  addEntity: (projectRoot: string, entity: Entity) => Promise<void>;
  updateEntity: (projectRoot: string, entity: Entity) => Promise<void>;
  removeEntity: (projectRoot: string, entityId: string) => Promise<void>;
  getEntityById: (entityId: string) => Entity | undefined;

  // Convenience
  loadAll: (projectRoot: string) => Promise<void>;

  // AI scan
  scanCandidates: ScanCandidate[];
  scanning: boolean;
  scanProject: (projectRoot: string) => Promise<void>;
  acceptCandidate: (candidateId: string) => void;
  rejectCandidate: (candidateId: string) => void;
  confirmCandidates: (projectRoot: string) => Promise<void>;
  clearScanCandidates: () => void;

  clearError: () => void;
}

const initialSchema: SparrowSchema = defaultSparrowSchema();

export const useCanonStore = create<CanonStore>((set, get) => ({
  schema: initialSchema,
  entities: [],
  loading: false,
  error: null,
  scanCandidates: [],
  scanning: false,

  loadSchema: async (projectRoot) => {
    set({ loading: true, error: null });
    try {
      const schema = await getSchema(projectRoot);
      set({ schema, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  updateSchema: async (projectRoot, patch) => {
    const current = get().schema;
    const updated = { ...current, ...patch, updatedAt: Date.now() };
    set({ schema: updated });
    try {
      await saveSchema(projectRoot, updated);
      set({ error: null });
    } catch (e) {
      // Rollback on failure
      set({ schema: current, error: String(e) });
    }
  },

  loadEntities: async (projectRoot) => {
    set({ loading: true, error: null });
    try {
      const entities = await listEntities(projectRoot);
      set({ entities, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  addEntity: async (projectRoot, entity) => {
    try {
      const saved = await saveEntity(projectRoot, entity);
      set((state) => ({
        entities: [...state.entities, saved],
        error: null,
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  updateEntity: async (projectRoot, entity) => {
    const prev = get().entities;
    // Optimistic update
    set((state) => ({
      entities: state.entities.map((e) =>
        e.id === entity.id ? { ...e, ...entity } : e
      ),
    }));
    try {
      await saveEntity(projectRoot, entity);
      set({ error: null });
    } catch (e) {
      // Rollback
      set({ entities: prev, error: String(e) });
    }
  },

  removeEntity: async (projectRoot, entityId) => {
    const prev = get().entities;
    set((state) => ({
      entities: state.entities.filter((e) => e.id !== entityId),
    }));
    try {
      await deleteEntity(projectRoot, entityId);
    } catch (e) {
      set({ entities: prev, error: String(e) });
    }
  },

  getEntityById: (entityId) => {
    return get().entities.find((e) => e.id === entityId);
  },

  loadAll: async (projectRoot) => {
    set({ loading: true, error: null });
    try {
      const [schema, entities] = await Promise.all([
        getSchema(projectRoot),
        listEntities(projectRoot),
      ]);
      set({ schema, entities, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  scanProject: async (projectRoot) => {
    set({ scanning: true, scanCandidates: [], error: null });
    try {
      // Get provider config
      const providers = await listProviderConfigs();
      const active = providers.find((p) => p.isActive);
      if (!active) {
        set({ scanning: false, error: '请先配置 AI 模型（设置 → AI 模型）' });
        return;
      }
      const apiKey = await resolveProviderCredential(active.id);

      // Get file list (recursive)
      const fileIndex = await listProjectTextFiles(projectRoot);
      const mdFiles = fileIndex.files;
      if (mdFiles.length === 0) {
        set({ scanning: false, error: '项目中没有 Markdown 文件' });
        return;
      }

      // Read first 2000 chars of each file
      let combinedText = '';
      for (const file of mdFiles.slice(0, 20)) {
        try {
          const content = await readFile(projectRoot, file.path);
          combinedText += `\n--- ${file.path} ---\n${content.slice(0, 2000)}\n`;
        } catch { /* skip unreadable files */ }
      }

      // Call LLM
      const systemPrompt = `你是一个小说设定分析工具。从以下正文中提取出现的人物、地点、组织和物品。
对每个实体，提供：类型(人物/地点/组织/物品)、名称、出自哪个文件、一句原文证据、置信度(high/medium/low)。

只输出 JSON 数组，格式：
[{"type":"人物","name":"陈末","sourcePath":"正文/第1章.md","evidenceText":"陈末把钥匙插进锁孔","confidence":"high"}]

不输出任何其他文字。如果没有任何实体，输出空数组 []。`;

      const response = await callLlm(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `项目文件内容:\n${combinedText.slice(0, 30000)}` },
        ],
        {
          model: {
            id: `${active.providerId}:${active.models.split(',')[0].trim()}`,
            name: active.models.split(',')[0].trim(),
            providerId: active.providerId,
            providerName: active.providerName,
            description: '',
            costPer1KTokens: 0,
            icon: '',
            available: true,
          },
          endpoint: active.endpoint,
          apiKey,
          timeout: 60000,
          outputSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ENTITY_TYPES },
                name: { type: 'string' },
                sourcePath: { type: 'string' },
                evidenceText: { type: 'string' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              },
              required: ['type', 'name', 'sourcePath', 'evidenceText', 'confidence'],
            },
          },
          outputType: 'detection',
        }
      );

      let candidates: ScanCandidate[] = [];
      if (response.parsed && Array.isArray(response.parsed)) {
        candidates = (response.parsed as any[]).map((item: any, i: number) => ({
          id: `cand-${i}`,
          type: item.type as EntityType,
          name: item.name,
          appearingChapters: [item.sourcePath],
          evidenceText: item.evidenceText || '',
          sourcePath: item.sourcePath || '',
          confidence: item.confidence as 'high' | 'medium' | 'low',
        }));
      } else {
        // Fallback: try JSON parse from content
        try {
          const parsed = JSON.parse(response.content);
          if (Array.isArray(parsed)) {
            candidates = parsed.map((item: any, i: number) => ({
              id: `cand-${i}`,
              type: item.type as EntityType,
              name: item.name,
              appearingChapters: [item.sourcePath],
              evidenceText: item.evidenceText || '',
              sourcePath: item.sourcePath || '',
              confidence: item.confidence as 'high' | 'medium' | 'low',
            }));
          }
        } catch { /* leave empty */ }
      }

      set({ scanning: false, scanCandidates: candidates });
    } catch (e) {
      set({ scanning: false, error: String(e) });
    }
  },

  acceptCandidate: (candidateId) => {
    set((state) => ({
      scanCandidates: state.scanCandidates.map((c) =>
        c.id === candidateId ? { ...c, confidence: 'high' as const } : c
      ),
    }));
  },

  rejectCandidate: (candidateId) => {
    set((state) => ({
      scanCandidates: state.scanCandidates.filter((c) => c.id !== candidateId),
    }));
  },

  confirmCandidates: async (projectRoot) => {
    const state = get();
    const accepted = state.scanCandidates.filter(
      (c) => c.confidence === 'high'
    );
    if (accepted.length === 0) return;
    for (const candidate of accepted) {
      const entity: Entity = {
        id: '',
        type: candidate.type,
        name: candidate.name,
        aliases: [],
        status: '待验证',
        canonLevel: '草案正典',
        summary: candidate.evidenceText,
        detail: '',
        schemaKeys: [],
        sourceRefs: candidate.sourcePath
          ? [{ filePath: candidate.sourcePath, textSnippet: candidate.evidenceText, offset: 0 }]
          : [],
        tags: [],
        referencesCount: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await get().addEntity(projectRoot, entity);
    }
    set({ scanCandidates: [] });
  },

  clearScanCandidates: () => set({ scanCandidates: [] }),

  clearError: () => set({ error: null }),
}));
