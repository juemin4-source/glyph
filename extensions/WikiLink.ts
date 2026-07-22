import {
  Mark,
  markInputRule,
  markPasteRule,
  mergeAttributes,
} from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WikiLinkOptions {
  /**
   * Additional HTML attributes to forward to the rendered `<span>`.
   */
  HTMLAttributes: Record<string, any>

  /**
   * Called when a wiki‑link is single‑clicked inside the editor.
   * Return `true` to prevent ProseMirror's default click handling.
   */
  onClick?: (name: string, details: { pos: number; event: MouseEvent }) => void | boolean

  /**
   * Called when a wiki‑link is double‑clicked.
   */
  onDoubleClick?: (name: string, details: { pos: number; event: MouseEvent }) => void | boolean

  /**
   * Given a normalised object name, return `true` when the referenced
   * object already exists (solid underline), `false` when it does not
   * (dashed underline).  Defaults to always‑missing.
   */
  existsChecker?: (name: string) => boolean
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikiLink: {
      /**
       * Mark the current selection as a wiki‑link.
       */
      setWikiLink: (name: string) => ReturnType
      /**
       * Toggle the wiki‑link mark on the current selection.
       */
      toggleWikiLink: () => ReturnType
      /**
       * Remove the wiki‑link mark from the current selection.
       */
      unsetWikiLink: () => ReturnType
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise whitespace so that `[[  张 三  ]]` becomes `[[张 三]]`
 * (leading/trailing trimmed, internal runs collapsed to single space).
 */
function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ")
}

// ---- regex ---------------------------------------------------------------

/**
 * Global pattern matching `[[object name]]` with optional surrounding spaces.
 * Supports Chinese (CJK) and any non‑bracket characters.
 *
 * - Full match : `[[  张 三  ]]`
 * - Group 1    : `  张 三  `  (raw, before normalisation)
 */
const WIKI_LINK_PATTERN = /\[\[\s*([^\[\]]+?)\s*\]\]/g

// ---- input-rule regex (non-global, for per-insertion matching) -----------

const INPUT_PATTERN = /\[\[\s*([^\[\]]+?)\s*\]\]/

// ---------------------------------------------------------------------------
// Mark extension
// ---------------------------------------------------------------------------

/**
 * A TipTap **mark** that recognises `[[ObjectName]]` syntax and renders it
 * as a styled inline wiki‑link.
 *
 * CSS classes emitted on the `<span>`:
 * - `.wiki-link` — always present
 * - `.wiki-link-exists` — when `existsChecker` returns `true` (solid underline)
 * - `.wiki-link-missing` — when `existsChecker` returns `false` (dashed underline)
 *
 * ```css
 * .wiki-link                { cursor: pointer; color: #1a73e8; }
 * .wiki-link-missing        { text-decoration: underline dashed; }
 * .wiki-link-exists         { text-decoration: underline solid; }
 * ```
 */
export const WikiLink = Mark.create<WikiLinkOptions>({
  name: "wikiLink",

  // -- options ---------------------------------------------------------------

  addOptions() {
    return {
      HTMLAttributes: {},
      onClick: undefined,
      onDoubleClick: undefined,
      existsChecker: () => false,
    }
  },

  // -- attributes ------------------------------------------------------------

  addAttributes() {
    return {
      /**
       * The normalised object name (no `[[ ]]` brackets, whitespace trimmed).
       */
      name: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-wiki-link"),
        renderHTML: (attrs) => {
          // Return empty when there is no name so the attribute is omitted.
          if (!attrs.name) return {}
          return { "data-wiki-link": attrs.name as string }
        },
      },
    }
  },

  // -- parse / render --------------------------------------------------------

  parseHTML() {
    return [{ tag: "span[data-wiki-link]" }]
  },

  renderHTML({ HTMLAttributes }) {
    const name = HTMLAttributes["data-wiki-link"] as string | undefined
    const exists = name ? this.options.existsChecker?.(name) ?? false : false

    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `wiki-link ${exists ? "wiki-link-exists" : "wiki-link-missing"}`,
      }),
      0, // mark content slot
    ]
  },

  // -- commands --------------------------------------------------------------

  addCommands() {
    return {
      setWikiLink:
        (name: string) =>
        ({ commands }) =>
          commands.setMark(this.type, { name: normalizeName(name) }),

      toggleWikiLink:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.type),

      unsetWikiLink:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.type),
    }
  },

  // -- input rule (fires when user types `]]`) ------------------------------

  addInputRules() {
    return [
      markInputRule({
        find: INPUT_PATTERN,
        type: this.type,
        getAttributes: (match) => ({
          name: normalizeName(match[1]),
        }),
      }),
    ]
  },

  // -- paste rule (fires when pasted content contains `[[…]]`) --------------

  addPasteRules() {
    return [
      markPasteRule({
        find: WIKI_LINK_PATTERN,
        type: this.type,
        getAttributes: (match) => ({
          name: normalizeName(match[1]),
        }),
      }),
    ]
  },

  // -- ProseMirror plugin (click / double‑click handling) --------------------

  addProseMirrorPlugins() {
    const ext = this

    return [
      new Plugin({
        key: new PluginKey("wikiLink"),

        props: {
          handleClick(view, pos, event) {
            const $pos = view.state.doc.resolve(pos)
            const mark = $pos.marks().find((m) => m.type.name === ext.name)
            if (!mark) return false

            const result = ext.options.onClick?.(mark.attrs.name as string, {
              pos,
              event,
            })
            return result === true
          },

          handleDoubleClick(view, pos, event) {
            const $pos = view.state.doc.resolve(pos)
            const mark = $pos.marks().find((m) => m.type.name === ext.name)
            if (!mark) return false

            const result = ext.options.onDoubleClick?.(
              mark.attrs.name as string,
              { pos, event },
            )
            return result === true
          },
        },
      }),
    ]
  },
})

// ---------------------------------------------------------------------------
// Standalone parser
// ---------------------------------------------------------------------------

/**
 * Scan **plain text** (not a ProseMirror document) for all `[[objectName]]`
 * patterns and return the normalised object names.
 *
 * ```ts
 * parseWikiLinks("Hello [[张三]] and [[李四]]")
 * // → ["张三", "李四"]
 *
 * parseWikiLinks("Hello [[  张三  ]]")
 * // → ["张三"]
 * ```
 */
export function parseWikiLinks(text: string): string[] {
  const names: string[] = []
  let match: RegExpExecArray | null
  WIKI_LINK_PATTERN.lastIndex = 0 // defensive reset
  while ((match = WIKI_LINK_PATTERN.exec(text)) !== null) {
    names.push(normalizeName(match[1]))
  }
  return names
}
