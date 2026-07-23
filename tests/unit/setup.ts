import '@testing-library/jest-dom/vitest';

// Provide fake IndexedDB for environments that lack it (jsdom)
import { IDBFactory } from 'fake-indexeddb';
globalThis.indexedDB = new IDBFactory();
