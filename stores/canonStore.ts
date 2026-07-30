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
} from '../tauri-api';
import { defaultSparrowSchema } from '../types/fs-ai';

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

  // AI scan (Phase 2, placeholder for wiring)
  scanCandidates: ScanCandidate[];
  scanning: boolean;
  setScanCandidates: (candidates: ScanCandidate[]) => void;
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

  setScanCandidates: (candidates) => set({ scanCandidates: candidates }),
  clearScanCandidates: () => set({ scanCandidates: [] }),

  clearError: () => set({ error: null }),
}));
