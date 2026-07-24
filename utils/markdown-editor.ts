const BLOCK_START = /^(#{1,6}\s+|>|\s*[-*+]\s+|\s*\d+[.)]\s+|```|~~~|(?:-{3,}|\*{3,}|_{3,})\s*$|<\/?[A-Za-z][^>]*>)/;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

function renderInline(source: string): string {
  const codeSpans: string[] = [];
  let text = source.replace(/`([^`]+)`/g, (_, code: string) => {
    const index = codeSpans.push(`<code>${escapeHtml(code)}</code>`) - 1;
    return `\uE100${index}\uE101`;
  });

  text = escapeHtml(text);
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g,
    (_, alt: string, src: string, title?: string) => `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}"${title ? ` title="${escapeAttribute(title)}"` : ''}>`);
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g,
    (_, label: string, href: string, title?: string) => `<a href="${escapeAttribute(href)}"${title ? ` title="${escapeAttribute(title)}"` : ''}>${label}</a>`);
  text = text.replace(/\[\[([^\]]+)\]\]/g, '<span class="wiki-link">$1</span>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  text = text.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
  text = text.replace(/  $/, '<br>');
  text = text.replace(/\uE100(\d+)\uE101/g, (_, index: string) => codeSpans[Number(index)] ?? '');
  return text;
}

function renderParagraph(lines: string[]): string {
  return `<p>${lines.map(renderInline).join('<br>')}</p>`;
}

/**
 * Render the Markdown subset used by the writing workspace into editable HTML.
 * Raw HTML blocks are preserved rather than silently discarded.
 */
export function markdownToEditorHtml(markdown: string): string {
  if (!markdown) return '<p></p>';
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const raw = lines[index];
    const trimmed = raw.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fence = trimmed.match(/^(```|~~~)(.*)$/);
    if (fence) {
      const marker = fence[1];
      const language = fence[2].trim();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith(marker)) {
        body.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      output.push(`<pre${language ? ` data-language="${escapeAttribute(language)}"` : ''}><code>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = raw.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(raw)) {
      output.push('<hr>');
      index += 1;
      continue;
    }

    if (/^\s*>/.test(raw)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      output.push(`<blockquote>${renderParagraph(quoteLines)}</blockquote>`);
      continue;
    }

    const listMatch = raw.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[2]);
      const tag = ordered ? 'ol' : 'ul';
      const items: string[] = [];
      while (index < lines.length) {
        const match = lines[index].match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
        if (!match || /^\d/.test(match[2]) !== ordered) break;
        items.push(`<li>${renderInline(match[3])}</li>`);
        index += 1;
      }
      output.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    if (/^\s*</.test(raw) && />\s*$/.test(raw)) {
      const htmlLines = [raw];
      index += 1;
      while (index < lines.length && lines[index].trim()) {
        htmlLines.push(lines[index]);
        index += 1;
      }
      output.push(htmlLines.join('\n'));
      continue;
    }

    const paragraph: string[] = [raw];
    index += 1;
    while (index < lines.length && lines[index].trim() && !BLOCK_START.test(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    output.push(renderParagraph(paragraph));
  }

  return output.join('\n') || '<p></p>';
}

function escapeMarkdownText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/([*_~`])/g, '\\$1');
}

function serializeInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeMarkdownText(node.nodeValue ?? '');
  if (!(node instanceof HTMLElement)) return '';

  const tag = node.tagName.toLowerCase();
  const inner = Array.from(node.childNodes).map(serializeInline).join('');
  switch (tag) {
    case 'strong':
    case 'b': return `**${inner}**`;
    case 'em':
    case 'i': return `*${inner}*`;
    case 's':
    case 'strike': return `~~${inner}~~`;
    case 'code': return node.parentElement?.tagName.toLowerCase() === 'pre' ? node.textContent ?? '' : `\`${node.textContent ?? ''}\``;
    case 'a': {
      const href = node.getAttribute('href') ?? '';
      const title = node.getAttribute('title');
      return `[${inner}](${href}${title ? ` "${title}"` : ''})`;
    }
    case 'img': {
      const src = node.getAttribute('src') ?? '';
      const alt = node.getAttribute('alt') ?? '';
      const title = node.getAttribute('title');
      return `![${alt}](${src}${title ? ` "${title}"` : ''})`;
    }
    case 'br': return '\n';
    case 'span':
      if (node.classList.contains('wiki-link')) return `[[${node.textContent ?? ''}]]`;
      return inner;
    default: return inner;
  }
}

function serializeListItem(item: Element, ordered: boolean, index: number, depth: number): string {
  const indent = '  '.repeat(depth);
  const marker = ordered ? `${index + 1}. ` : '- ';
  const inlineParts: string[] = [];
  const nested: Element[] = [];

  for (const child of Array.from(item.childNodes)) {
    if (child instanceof HTMLElement && ['ul', 'ol'].includes(child.tagName.toLowerCase())) {
      nested.push(child);
    } else if (child instanceof HTMLElement && child.tagName.toLowerCase() === 'p') {
      inlineParts.push(Array.from(child.childNodes).map(serializeInline).join(''));
    } else {
      inlineParts.push(serializeInline(child));
    }
  }

  let result = `${indent}${marker}${inlineParts.join('').trimEnd()}\n`;
  for (const list of nested) result += serializeList(list, depth + 1);
  return result;
}

function serializeList(list: Element, depth = 0): string {
  const ordered = list.tagName.toLowerCase() === 'ol';
  const items = Array.from(list.children).filter((child) => child.tagName.toLowerCase() === 'li');
  return items.map((item, index) => serializeListItem(item, ordered, index, depth)).join('') + (depth === 0 ? '\n' : '');
}

function serializeBlock(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';
  if (!(node instanceof HTMLElement)) return '';
  const tag = node.tagName.toLowerCase();

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag.slice(1));
    return `${'#'.repeat(level)} ${Array.from(node.childNodes).map(serializeInline).join('').trim()}\n\n`;
  }

  switch (tag) {
    case 'p': return `${Array.from(node.childNodes).map(serializeInline).join('').trimEnd()}\n\n`;
    case 'blockquote': {
      const body = Array.from(node.childNodes).map(serializeBlock).join('').trim();
      return `${body.split('\n').map((line) => `> ${line}`.trimEnd()).join('\n')}\n\n`;
    }
    case 'ul':
    case 'ol': return serializeList(node);
    case 'pre': {
      const language = node.getAttribute('data-language') ?? '';
      const code = node.textContent ?? '';
      return `\`\`\`${language}\n${code.replace(/\n$/, '')}\n\`\`\`\n\n`;
    }
    case 'hr': return '---\n\n';
    case 'table': return `${node.outerHTML}\n\n`;
    case 'div':
    case 'section':
    case 'article': return Array.from(node.childNodes).map(serializeBlock).join('');
    default: {
      const inlineOnly = !Array.from(node.children).some((child) => ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'pre', 'hr'].includes(child.tagName.toLowerCase()));
      return inlineOnly
        ? `${Array.from(node.childNodes).map(serializeInline).join('')}\n\n`
        : Array.from(node.childNodes).map(serializeBlock).join('');
    }
  }
}

/** Serialize editable HTML back to stable Markdown without regex-based DOM flattening. */
export function editorHtmlToMarkdown(html: string): string {
  if (!html) return '';
  const parser = new DOMParser();
  const document = parser.parseFromString(`<body>${html}</body>`, 'text/html');
  const result = Array.from(document.body.childNodes).map(serializeBlock).join('');
  return result
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}
