import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (name, pass, detail = '') => checks.push({ name, pass, detail });

const app = read('App.tsx');
const panel = read('components/FsAiPanel.tsx');
const bridge = read('lib/fs-ai-bridge.ts');
const store = read('stores/fsStore.ts');
const api = read('tauri-api.ts');
const commands = read('src-tauri/src/fs_commands.rs');
const models = read('src-tauri/src/fs_models.rs');
const lib = read('src-tauri/src/lib.rs');

check('AI panel is connected to prepare and commit boundaries', app.includes('onPrepareWrite={handlePrepareAiWrite}') && app.includes('onCommitWrite={handleCommitAiWrite}'));
check('planner supports only the five bounded outcomes', bridge.includes("'create_file'") && bridge.includes("'replace_selection'") && bridge.includes("'insert_at_cursor'") && bridge.includes("'replace_file'"));
check('one task has one targetPath', bridge.includes('targetPath: prepared.targetPath') && !bridge.includes('targetPaths'));
check('model generation is separated from commit', bridge.indexOf('callLlm([') < bridge.lastIndexOf('commitWrite(proposal)'));
check('selection replacement is constructed locally', bridge.includes('base.slice(0, selection.start)') && bridge.includes('base.slice(selection.end)'));
check('whole-file writes require explicit whole-file wording', bridge.includes('explicitWholeFileRequest') && bridge.includes("plan.action === 'replace_file'"));
check('create target cannot write internal metadata', bridge.includes("value.startsWith('.glyph/')") && commands.includes('AI_TARGET_FORBIDDEN'));
check('only Markdown targets are accepted by Rust', commands.includes('AI_TARGET_TYPE_FORBIDDEN') && commands.includes('extension != "md"'));
check('Rust command permits create or modify only', commands.includes('AI_ACTION_FORBIDDEN') && commands.includes('input.action_type != "create"'));
check('create never overwrites an existing path', commands.includes('atomic_create(&target, &input.content)') && commands.includes('FILE_EXISTS: file already exists'));
check('modify requires an expected disk version', commands.includes('AI_EXPECTED_VERSION_REQUIRED') && commands.includes('atomic_write_checked(&target'));
check('modification snapshot is created before target write', commands.indexOf('atomic_create(&snapshot_file, &old_content)') < commands.indexOf('atomic_write_checked(&target, &input.content'));
check('action record exists for every prepared action', commands.includes('write_ai_action_record') && commands.includes('"prepared"') && commands.includes('"completed"'));
check('frontend re-validates live editor state before commit', store.includes('state.editRevision === proposal.baseEditorRevision') && store.includes('state.fileContent === proposal.baseContent'));
check('dirty current file is saved before AI preparation', store.includes("get().fileStatus === 'dirty'") && store.includes('await get().saveCurrentFile()'));
check('editor changes block commit and preserve a draft', bridge.includes("outcome.status === 'blocked'") && panel.includes('未提交草稿'));
check('external changes block AI commit', store.includes('目标文件在提交前发生了外部变化') && store.includes("fileStatus: 'conflict'"));
check('successful create refreshes and opens the new file', store.includes("proposal.action === 'create_file'") && store.includes('await get().openFile(proposal.targetPath)'));
check('cancel happens before formal commit', bridge.includes('assertNotAborted(input.signal)') && panel.includes('abortRef.current?.abort()'));
check('Tauri API and Rust handler expose the same commit command', api.includes("invoke('commit_ai_file_action'") && lib.includes('fs_commands::commit_ai_file_action'));
check('action models are camelCase across the boundary', models.includes('pub struct AiFileActionInput') && models.includes('#[serde(rename_all = "camelCase")]'));
check('product language no longer claims read-only mode', panel.includes('可查阅项目，并在明确范围内创建或修改一个 Markdown 文件') && !panel.includes('只查找、读取和回答，不修改作品'));
check('delete and multi-file actions are absent from the planner schema', !bridge.includes("action: 'delete'") && !bridge.includes('modify_files'));

let failed = 0;
for (const item of checks) {
  console.log(`${item.pass ? '[PASS]' : '[FAIL]'} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
  if (!item.pass) failed += 1;
}
console.log(`\nGate C source-contract checks: ${checks.length - failed}/${checks.length} PASS`);
process.exitCode = failed === 0 ? 0 : 1;
