import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];

function check(name, pass, detail) {
  checks.push({ name, pass, detail });
}

const app = read('App.tsx');
const editor = read('components/FsDocumentView.tsx');
const store = read('stores/fsStore.ts');
const commands = read('src-tauri/src/fs_commands.rs');
const watcher = read('src-tauri/src/fs_watcher.rs');
const fsTypes = read('types/fs.ts');

check('one filesystem-first workspace', !app.includes('isFsMode') && !app.includes('FsAiPanel'), 'App must not branch into legacy/FS workspaces or mount Gate B AI');
check('two explicit entry paths', app.includes('FsWelcome') && read('components/FsWelcome.tsx').includes('在织梦机开始创作') && read('components/FsWelcome.tsx').includes('导入已有创作'));
check('truthful Markdown editor', editor.includes('<textarea') && !editor.includes('Tiptap') && !editor.includes('htmlToMarkdown'));
check('single automatic-save owner', (app.match(/setTimeout\(\(\) => \{\s*void saveCurrentFile\(\)/g) || []).length === 1);
check('arbitrary directory adoption', commands.includes('Open any existing directory as a local project') && !commands.includes('NOT_A_GLYPH_PROJECT'));
const createProjectSection = commands.slice(commands.indexOf('pub fn create_fs_project'), commands.indexOf('pub fn open_fs_project'));
check('minimal new project', createProjectSection.includes('let initial_file = "正文.md"') && !createProjectSection.includes('"chapters"') && !createProjectSection.includes('"characters"'), 'Creation path must not force a directory skeleton');
check('checked content-version writes', commands.includes('write_file_checked') && commands.includes('EXTERNAL_MODIFICATION') && store.includes('diskVersion'));
check('own watcher events resolved by versions', !watcher.includes('ignored_writes') && store.includes('if (external.version === state.diskVersion) return \'none\''));
check('session persistence uses Tauri', !app.includes('XMLHttpRequest') && store.includes('saveSessionState'));
check('backend/frontend project id contract', fsTypes.includes('id: string;') && !fsTypes.includes('projectId: string;'));
check('project-bound path validation', commands.includes('validate_relative_path') && commands.includes('PATH_ESCAPE'));

let failed = 0;
for (const item of checks) {
  const prefix = item.pass ? '[PASS]' : '[FAIL]';
  console.log(`${prefix} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
  if (!item.pass) failed += 1;
}

console.log(`\nGate A source-contract checks: ${checks.length - failed}/${checks.length} PASS`);
process.exitCode = failed === 0 ? 0 : 1;
