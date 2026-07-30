/// <reference types="vitest/globals" />
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSchema: vi.fn(),
  saveSchema: vi.fn(),
  listEntities: vi.fn(),
  getEntity: vi.fn(),
  saveEntity: vi.fn(),
  deleteEntity: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('../../tauri-api', () => mocks);

vi.mock('../../lib/fs-ai-bridge', () => ({
  listProjectTextFiles: vi.fn().mockResolvedValue({ files: [], truncated: false, unreadableDirectories: [] }),
}));

vi.mock('../../api/aiControlCenterApi', () => ({
  listProviderConfigs: vi.fn().mockResolvedValue([]),
  resolveProviderCredential: vi.fn().mockResolvedValue(''),
}));

vi.mock('../../lib/llm-client', () => ({
  callLlm: vi.fn(),
  LlmError: class LlmError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

const PROJECT_ROOT = 'C:/novels/test-project';

let useCanonStore: typeof import('../../stores/canonStore').useCanonStore;

beforeEach(async () => {
  vi.clearAllMocks();
  ({ useCanonStore } = await import('../../stores/canonStore'));
  useCanonStore.setState({
    schema: { version: 1, updatedAt: 0, coreQuestion: '', aestheticSignature: '', coreMechanism: '', worldLack: '', protagonistLack: '', rulesAndCost: '', enforcer: '', currentSituation: '', compressionField: '' },
    entities: [],
    loading: false,
    error: null,
    scanCandidates: [],
    scanning: false,
  });
});

describe('canonStore', () => {
  // ── Schema ──

  it('loadSchema loads from API and sets state', async () => {
    const schema = { version: 1, updatedAt: 100, coreQuestion: 'test', aestheticSignature: '', coreMechanism: '', worldLack: '', protagonistLack: '', rulesAndCost: '', enforcer: '', currentSituation: '', compressionField: '' };
    mocks.getSchema.mockResolvedValue(schema);

    await useCanonStore.getState().loadSchema(PROJECT_ROOT);

    expect(mocks.getSchema).toHaveBeenCalledWith(PROJECT_ROOT);
    expect(useCanonStore.getState().schema).toEqual(schema);
    expect(useCanonStore.getState().loading).toBe(false);
  });

  it('loadSchema handles API error gracefully', async () => {
    mocks.getSchema.mockRejectedValue(new Error('NETWORK_ERROR'));

    await useCanonStore.getState().loadSchema(PROJECT_ROOT);

    expect(useCanonStore.getState().error).toContain('NETWORK_ERROR');
    expect(useCanonStore.getState().loading).toBe(false);
  });

  it('updateSchema patches a field and saves', async () => {
    mocks.saveSchema.mockResolvedValue(undefined);

    await useCanonStore.getState().updateSchema(PROJECT_ROOT, { coreQuestion: '新的核心追问' });

    expect(useCanonStore.getState().schema.coreQuestion).toBe('新的核心追问');
    expect(useCanonStore.getState().schema.updatedAt).toBeGreaterThan(0);
    expect(mocks.saveSchema).toHaveBeenCalledTimes(1);
  });

  it('updateSchema rolls back on save failure', async () => {
    mocks.saveSchema.mockRejectedValue(new Error('SAVE_FAILED'));

    // Set initial state
    useCanonStore.setState({ schema: { ...useCanonStore.getState().schema, coreQuestion: '原始值' } });
    const orig = useCanonStore.getState().schema;

    await useCanonStore.getState().updateSchema(PROJECT_ROOT, { coreQuestion: '新值' });

    // Should have rolled back
    expect(useCanonStore.getState().error).toContain('SAVE_FAILED');
  });

  // ── Entities ──

  it('loadEntities returns empty list when no entities exist', async () => {
    mocks.listEntities.mockResolvedValue([]);

    await useCanonStore.getState().loadEntities(PROJECT_ROOT);

    expect(mocks.listEntities).toHaveBeenCalledWith(PROJECT_ROOT);
    expect(useCanonStore.getState().entities).toEqual([]);
  });

  it('addEntity creates a new entity', async () => {
    const entity = { id: 'ent-001', type: '人物', name: '陈末', aliases: [], status: '待验证', canonLevel: '草案正典', summary: '一名觉醒的人造人', detail: '', schemaKeys: [], sourceRefs: [], tags: [], referencesCount: 0, createdAt: 100, updatedAt: 100 };
    mocks.saveEntity.mockResolvedValue(entity);

    await useCanonStore.getState().addEntity(PROJECT_ROOT, entity);

    expect(useCanonStore.getState().entities).toContainEqual(entity);
  });

  it('removeEntity deletes an entity', async () => {
    mocks.deleteEntity.mockResolvedValue(undefined);
    useCanonStore.setState({
      entities: [
        { id: 'ent-001', type: '人物', name: '陈末', aliases: [], status: '待验证', canonLevel: '草案正典', summary: '', detail: '', schemaKeys: [], sourceRefs: [], tags: [], referencesCount: 0, createdAt: 1, updatedAt: 1 },
        { id: 'ent-002', type: '地点', name: '灰楼', aliases: [], status: '草稿', canonLevel: '核心正典', summary: '', detail: '', schemaKeys: [], sourceRefs: [], tags: [], referencesCount: 0, createdAt: 2, updatedAt: 2 },
      ],
    });

    await useCanonStore.getState().removeEntity(PROJECT_ROOT, 'ent-001');

    expect(useCanonStore.getState().entities).toHaveLength(1);
    expect(useCanonStore.getState().entities[0].id).toBe('ent-002');
  });

  it('getEntityById returns correct entity', () => {
    useCanonStore.setState({
      entities: [
        { id: 'ent-001', type: '人物', name: '陈末', aliases: [], status: '待验证', canonLevel: '草案正典', summary: '', detail: '', schemaKeys: [], sourceRefs: [], tags: [], referencesCount: 0, createdAt: 1, updatedAt: 1 },
      ],
    });

    const found = useCanonStore.getState().getEntityById('ent-001');
    expect(found).toBeDefined();
    expect(found!.name).toBe('陈末');

    const notFound = useCanonStore.getState().getEntityById('nonexistent');
    expect(notFound).toBeUndefined();
  });

  // ── Convenience ──

  it('loadAll loads both schema and entities', async () => {
    const schema = { version: 1, updatedAt: 100, coreQuestion: 'test', aestheticSignature: '', coreMechanism: '', worldLack: '', protagonistLack: '', rulesAndCost: '', enforcer: '', currentSituation: '', compressionField: '' };
    mocks.getSchema.mockResolvedValue(schema);
    mocks.listEntities.mockResolvedValue([]);

    await useCanonStore.getState().loadAll(PROJECT_ROOT);

    expect(mocks.getSchema).toHaveBeenCalled();
    expect(mocks.listEntities).toHaveBeenCalled();
  });

  // ── Scan Candidates ──

  it('acceptCandidate and rejectCandidate manage candidates', () => {
    useCanonStore.setState({
      scanCandidates: [
        { id: 'cand-1', type: '人物', name: '陈末', appearingChapters: ['ch1.md'], evidenceText: '...', sourcePath: 'ch1.md', confidence: 'high' },
        { id: 'cand-2', type: '地点', name: '灰楼', appearingChapters: ['ch1.md'], evidenceText: '...', sourcePath: 'ch1.md', confidence: 'medium' },
      ],
    });

    // accept keeps it, reject removes it
    useCanonStore.getState().rejectCandidate('cand-2');
    expect(useCanonStore.getState().scanCandidates).toHaveLength(1);

    useCanonStore.getState().clearScanCandidates();
    expect(useCanonStore.getState().scanCandidates).toHaveLength(0);
  });
});
