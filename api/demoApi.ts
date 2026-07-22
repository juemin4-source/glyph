/**
 * demoApi — 织梦机 v2.0.1 Demo project seeding API.
 *
 * Provides a one-shot function to seed the Demo project into the database
 * on first app launch. Uses existing tauri-api + pipeline API clients.
 */
import * as api from '../tauri-api';
import { createPremiseCard } from './premiseApi';
import { createStructureNode } from './structureApi';
import { createWorldRule, createCharacterCard, createFactionCard } from './settingApi';
import { createChapterPacket } from './chapterPacketApi';
import {
  DEMO_PROJECT,
  DEMO_PREMISE,
  DEMO_STRUCTURE_NODES,
  DEMO_WORLD_RULE,
  DEMO_CHARACTER_CARD,
  DEMO_FACTION_CARD,
  DEMO_CHAPTER_PACKETS,
} from '../data/seed';

const DEMO_PROJECT_ID = 'demo-project-id';

/**
 * Seed the Demo project into the database if it does not already exist.
 * Safe to call multiple times — checks existence first.
 */
export async function seedDemoProject(): Promise<boolean> {
  // Check if Demo project already exists
  try {
    const existing = await api.getProject(DEMO_PROJECT_ID);
    if (existing) return false; // Already seeded
  } catch {
    // Project doesn't exist — proceed with seeding
  }

  try {
    // 1. Create project
    await api.createProject(
      DEMO_PROJECT.name,
      DEMO_PROJECT.genre,
      DEMO_PROJECT.status,
      DEMO_PROJECT.wordCount,
      DEMO_PROJECT.gradient,
    );

    // 2. Create premise card
    await createPremiseCard(DEMO_PREMISE);

    // 3. Create structure nodes (chapters)
    const createdNodes: Array<{ id: string; title: string }> = [];
    for (const node of DEMO_STRUCTURE_NODES) {
      const created = await createStructureNode(node);
      createdNodes.push({ id: created.id, title: created.title });
    }

    // 4. Create setting data (world rule, character, faction)
    await createWorldRule(DEMO_WORLD_RULE);
    const charCard = await createCharacterCard(DEMO_CHARACTER_CARD);
    await createFactionCard(DEMO_FACTION_CARD);

    // 5. Create chapter packets (link to created structure nodes)
    for (let i = 0; i < DEMO_CHAPTER_PACKETS.length; i++) {
      const packetDef = DEMO_CHAPTER_PACKETS[i];
      const nodeId = createdNodes[i]?.id ?? '';
      await createChapterPacket({
        ...packetDef,
        structureNodeId: nodeId,
      });
    }

    return true; // Successfully seeded
  } catch (err) {
    console.error('Failed to seed Demo project:', err);
    throw err;
  }
}

/**
 * Check whether the Demo project has been seeded into the database.
 */
export async function isDemoSeeded(): Promise<boolean> {
  try {
    const existing = await api.getProject(DEMO_PROJECT_ID);
    return !!existing;
  } catch {
    return false;
  }
}
