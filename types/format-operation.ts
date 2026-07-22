export type FormatOperation =
  | { type: 'wrap'; before: string; after: string }
  | { type: 'insert-line-prefix'; prefix: string; toggle?: boolean }
  | { type: 'link'; defaultUrl?: string }
  | { type: 'code-block'; language?: string }
  | { type: 'undo' }
  | { type: 'redo' }

export const formatOperationMap: Record<string, FormatOperation> = {
  bold: { type: 'wrap', before: '**', after: '**' },
  italic: { type: 'wrap', before: '*', after: '*' },
  strikethrough: { type: 'wrap', before: '~~', after: '~~' },
  inlineCode: { type: 'wrap', before: '`', after: '`' },
  h1: { type: 'insert-line-prefix', prefix: '# ' },
  h2: { type: 'insert-line-prefix', prefix: '## ' },
  h3: { type: 'insert-line-prefix', prefix: '### ' },
  blockquote: { type: 'insert-line-prefix', prefix: '> ' },
  unorderedList: { type: 'insert-line-prefix', prefix: '- ' },
  orderedList: { type: 'insert-line-prefix', prefix: '1. ' },
  link: { type: 'link', defaultUrl: '' },
  codeBlock: { type: 'code-block', language: '' },
  undo: { type: 'undo' },
  redo: { type: 'redo' }
}

export type FormatOperationId = keyof typeof formatOperationMap
