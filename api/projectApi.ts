/**
 * projectApi — Pipeline-specific API wrappers for 织梦机 v2.
 *
 * Re-exports pipeline-related functions from the core tauri-api layer
 * so features/pipeline-* modules import from a single entry point.
 */
import { getPipelineState, savePipelineState } from '../tauri-api';
import type { PipelineState } from '../contracts/project.contract';

export { getPipelineState, savePipelineState };
export type { PipelineState };
