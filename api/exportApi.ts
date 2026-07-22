/**
 * exportApi — 织梦机 v2.0.1 Markdown Export API wrapper.
 *
 * T1 created the backend command `export_text_as_markdown`.
 * This client wraps it for frontend consumption.
 */
import { invoke } from '@tauri-apps/api/core';

export interface ExportInput {
  chapterContent: string;
  defaultName: string;
}

export async function exportTextAsMarkdown(input: ExportInput): Promise<string> {
  return invoke<string>('export_text_as_markdown', { input });
}
