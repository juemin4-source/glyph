/**
 * structureApi — 织梦机 v2 StructureNode API layer.
 */
import { invoke } from '@tauri-apps/api/core';
import type {
  StructureNode, CreateStructureNodeInput, UpdateStructureNodeInput,
  Canvas2NodeRecord, SaveCanvas2NodeInput, StructureTreeOutput,
  UpdateNodePositionInput, ZoomToLayerInput, ZoomToLayerOutput,
  AiGenerateStructureInput, AiGenerateStructureOutput,
} from '../contracts/structure.contract';

export async function createStructureNode(input: CreateStructureNodeInput): Promise<StructureNode> {
  return invoke('create_structure_node', { input });
}

export async function listStructureNodes(projectId: string): Promise<StructureNode[]> {
  return invoke('list_structure_nodes', { input: { projectId } });
}

export async function getStructureNode(id: string): Promise<StructureNode | null> {
  return invoke('get_structure_node', { input: { id } });
}

export async function updateStructureNode(input: UpdateStructureNodeInput): Promise<StructureNode> {
  return invoke('update_structure_node', { input });
}

export async function deleteStructureNode(id: string): Promise<void> {
  return invoke('delete_structure_node', { input: { id } });
}

// ===== CN-MET-02: Canvas 2 StructureGraph L1-L4 API =====

export async function saveCanvas2Node(input: SaveCanvas2NodeInput): Promise<Canvas2NodeRecord> {
  return invoke('save_structure_node', { input });
}

export async function getCanvas2StructureTree(projectId: string): Promise<StructureTreeOutput> {
  return invoke('get_structure_tree', { input: { projectId } });
}

export async function updateCanvas2NodePosition(input: UpdateNodePositionInput): Promise<void> {
  return invoke('update_node_position', { input });
}

export async function zoomToLayer(input: ZoomToLayerInput): Promise<ZoomToLayerOutput> {
  return invoke('zoom_to_layer', { input });
}

export async function deleteCanvas2Node(id: string): Promise<void> {
  return invoke('delete_canvas2_node', { input: { id } });
}

/**
 * getStructureUpdatedAt — 查询大纲画板最近更新时间 (CN-INT-01).
 * 返回 Unix ms 时间戳，0 表示不存在。
 */
export async function getStructureUpdatedAt(projectId: string): Promise<number> {
  const result = await invoke<{ updatedAt: number }>('get_structure_updated_at', { input: { projectId } });
  return result.updatedAt;
}

export async function aiGenerateStructure(projectId: string): Promise<AiGenerateStructureOutput> {
  return invoke('ai_generate_structure', { input: { projectId } });
}
