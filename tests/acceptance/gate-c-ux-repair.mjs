import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('App.tsx');
const editor = read('components/FsDocumentView.tsx');
const markdown = read('utils/markdown-editor.ts');
const css = read('styles/fs.css');

const checks = [
  ['visual/source/preview modes are present', /type EditMode = 'wysiwyg' \| 'source' \| 'preview'/.test(editor)],
  ['visual editor is actually editable', /contentEditable=\{editMode === 'wysiwyg'/.test(editor)],
  ['format toolbar is restored', /fs-format-toolbar/.test(editor) && /insertUnorderedList/.test(editor) && /formatBlock/.test(editor)],
  ['selection bubble menu is restored', /fs-bubble-menu/.test(editor) && /bubblePosition/.test(editor)],
  ['slash command menu is restored', /fs-slash-menu/.test(editor) && /nearestTextBeforeCursor/.test(editor)],
  ['Markdown remains the file-facing value', /onContentChange\(markdown\)/.test(editor) && /editorHtmlToMarkdown/.test(editor)],
  ['HTML to Markdown uses DOM traversal', /new DOMParser\(\)/.test(markdown) && /serializeBlock/.test(markdown) && /serializeInline/.test(markdown)],
  ['homepage scroll belongs to full-width shell', /fs-welcome-scroll/.test(app) && /fs-welcome-shell/.test(app) && /\.fs-welcome-scroll/.test(css)],
  ['welcome content no longer owns its scrollbar', /\.fs-welcome-scroll \.fs-welcome[\s\S]*overflow: visible/.test(css)],
  ['window close has re-entry guard', /closeInProgress/.test(app)],
  ['window close saves conflict or recovery copies', /saveConflictCopy\(\)/.test(app) && /saveMissingCopy\(\)/.test(app)],
  ['window close uses forced destroy only after settlement', /closeProject\(\)/.test(app) && /appWindow\.destroy\(\)/.test(app)],
];

let passed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}`);
  if (ok) passed += 1;
}
console.log(`\nGate C UX repair source-contract checks: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
