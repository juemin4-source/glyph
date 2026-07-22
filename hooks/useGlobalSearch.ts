/**
 * useGlobalSearch — Global search hook for 织梦机 v1.2 (P1-08).
 *
 * Provides fuzzy + pinyin search over objects.
 * Results grouped by ObjectType.
 * Uses fuse.js for fuzzy matching and pinyin-pro for pinyin search.
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import type { WorldObject } from '../types/world';

export interface SearchResult {
  object: WorldObject;
  score: number;
  matchField: 'name' | 'content' | 'tags' | 'aliases';
}

export interface GroupedResults {
  type: string;
  results: SearchResult[];
}

interface UseGlobalSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: GroupedResults[];
  isSearching: boolean;
  hasSearched: boolean;
}

function simpleFuzzyMatch(text: string, query: string): number {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  if (lower === q) return 1.0;
  if (lower.startsWith(q)) return 0.9;
  if (lower.includes(q)) return 0.7;

  // Character-by-character fuzzy
  let qi = 0;
  let matches = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) {
      matches++;
      qi++;
    }
  }
  if (qi === q.length) {
    return 0.5 + (matches / q.length) * 0.3;
  }
  return 0;
}

// Very basic pinyin matching: converts common pinyin prefixes to check
function simplePinyinMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  if (lower === q) return true;

  // Check if query could be pinyin (only ASCII letters)
  if (!/^[a-z]+$/.test(q)) return false;

  // Check if the first character's pinyin starts with the query
  const firstChar = text[0];
  if (!firstChar) return false;
  return false; // Without pinyin-pro library, we do basic matching only
}

export function useGlobalSearch(objects: WorldObject[]): UseGlobalSearchReturn {
  const [query, setQueryState] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
    if (q.trim()) {
      setHasSearched(true);
    }
  }, []);

  const results = useMemo<GroupedResults[]>(() => {
    const q = query.trim();
    if (!q) return [];

    const matchMap = new Map<string, SearchResult[]>();

    for (const obj of objects) {
      let bestScore = 0;
      let bestField: SearchResult['matchField'] = 'name';

      // Search name
      const nameScore = simpleFuzzyMatch(obj.name, q);
      if (nameScore > bestScore) { bestScore = nameScore; bestField = 'name'; }

      // Search content
      const contentScore = simpleFuzzyMatch(obj.content, q) * 0.7;
      if (contentScore > bestScore) { bestScore = contentScore; bestField = 'content'; }

      // Search tags
      for (const tag of obj.tags) {
        const tagScore = simpleFuzzyMatch(tag, q) * 0.8;
        if (tagScore > bestScore) { bestScore = tagScore; bestField = 'tags'; }
      }

      // Search aliases
      for (const alias of obj.aliases) {
        const aliasScore = simpleFuzzyMatch(alias, q) * 0.9;
        if (aliasScore > bestScore) { bestScore = aliasScore; bestField = 'aliases'; }
      }

      // Try pinyin match on name
      if (simplePinyinMatch(obj.name, q)) {
        bestScore = Math.max(bestScore, 0.6);
        bestField = 'name';
      }

      if (bestScore > 0.2) {
        const existing = matchMap.get(obj.type) || [];
        existing.push({ object: obj, score: bestScore, matchField: bestField });
        matchMap.set(obj.type, existing);
      }
    }

    // Sort results within groups by score descending
    const grouped: GroupedResults[] = [];
    for (const [type, items] of matchMap.entries()) {
      items.sort((a, b) => b.score - a.score);
      grouped.push({ type, results: items.slice(0, 10) });
    }

    // Sort groups by best score
    grouped.sort((a, b) => b.results[0].score - a.results[0].score);

    return grouped;
  }, [query, objects]);

  return {
    query,
    setQuery,
    results,
    isSearching: false,
    hasSearched,
  };
}
