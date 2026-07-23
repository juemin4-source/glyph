# 织梦机 (Zhimengji) — Master Prototype Screen Map

> **编制**: Product Strategy | **日期**: 2026-07-08
> **来源**: v1.2 prototypes (5 files) + v1.3 prototypes (4 files) + codebase + product-think + spec + roadmap-to-v2.0

---

## 1. Screen Inventory — 93 Screens Across 17 Phases

### Phase 1 — Outer Shell (5 screens)
| # | ID | Name | Description | Status |
|---|-----|------|-------------|--------|
| 01 | shelf | Bookshelf | Project card grid with gradient covers, genre badges, word counts, canon dots | Implemented |
| 02 | shelf-empty | Bookshelf Empty State | Example cards + from-template CTA + tutorial link | Implemented |
| 03 | shelf-search | Search & Filter | Search box, genre/status filter, sort (name/updated/created/words) | Implemented |
| 04 | shelf-card-menu | Card Context Menu | "..." menu: rename, change genre, delete, export | Prototyped |
| 05 | shelf-cover-edit | Cover Color Picker | Hover circular edit button to cycle gradient accent | Prototyped |

### Phase 2 — Project Creation & Onboarding (4 screens)
| # | ID | Name | Description | Status |
|---|-----|------|-------------|--------|
| 06 | wizard | Creation Wizard | Modal: title + genre (color preview) + template selection + preset preview | Implemented |
| 07 | wizard-template-preview | Template Preview | Shows preset objects the template will auto-create | Implemented |
| 08 | first-launch-guide | First Launch Guide | 3-step overlay: canon levels, WikiLink syntax, canvas visualization | Implemented |
| 09 | canon-guide | Canon Guide Popup | Appears at 3+ objects, explains 4 levels with examples | Implemented |

### Phase 3 — Main Workspace Layout (5 screens)
| # | ID | Name | Description | Status |
|---|-----|------|-------------|--------|
| 10 | workspace-shell | Workspace Shell | 3-column: left sidebar + main content + right inspector. Nav top, status bottom | Implemented |
| 11 | nav-bar | Navigation Bar | Back to bookshelf, project name, editor mode, nav tabs, search, badges | Implemented |
| 12 | status-bar | Bottom Status Bar | Save indicator (5 states) + sync queue + word count + links + canon | Implemented |
| 13 | offline-banner | Offline Banner | Yellow banner when offline | Implemented |
| 14 | loading-screen | Loading Screen | Spinner during project load | Implemented |

### Phase 4 — Workspace Modes (v2.0 Roadmap, 2 screens)
| # | ID | Name | Description | Status |
|---|-----|------|-------------|--------|
| 15 | workspace-mode-toggle | Mode Toggle | Writing / Review / Collaboration modes | Roadmap |
| 16 | quick-action-panel | Quick Action (Ctrl+K) | Command palette: search, recent, run agent, optimize, dashboard | Roadmap |

### Phase 5 — Document Editor (6 screens)
| # | ID | Name | Description | Status |
|---|-----|------|-------------|--------|
| 17 | editor-source | Source Mode | Markdown textarea with syntax highlighting | Implemented |
| 18 | editor-preview | Preview Mode | Rendered HTML, clickable WikiLinks | Implemented |
| 19 | editor-wysiwyg | WYSIWYG Mode | TipTap rich text with WikiLink extension | Implemented |
| 20 | editor-toolbar | Unified Toolbar | H1/H2/H3, B/I/U/S, blockquote, code, list, link. Type/canon/status badges | Implemented |
| 21 | wiki-create-bubble | WikiLink Create | Popup on non-existent [[name]], select type, create-and-open | Implemented |
| 22 | editor-empty | Empty Object | CTA to create first object with template types | Implemented |

### Phase 6 — Left Sidebar (4 screens)
| # | ID | Name | Description | Status |
|---|-----|------|-------------|--------|
| 23 | outline-tree | Outline Tree | Hierarchical, collapsible, searchable, canon colors | Implemented |
| 24 | outline-search | Outline Search | Filter tree items by name | Implemented |
| 25 | outline-smart-group | Smart Group (v2.0) | Auto-group by type with count badges | Roadmap |
| 26 | outline-recent | Recent Items (v2.0) | Recently accessed objects | Roadmap |

### Phase 7 — Right Sidebar / Inspector (7 screens)
| # | ID | Name | Description | Status |
|---|-----|------|-------------|--------|
| 27 | inspector-summary | Project Summary | Stats when no object selected | Implemented |
| 28 | inspector-detail | Object Inspector | Type, canon (clickable popup), status, timestamps | Implemented |
| 29 | inspector-linked | Linked Objects | Referenced/referencing objects list | Implemented |
| 30 | inspector-judgment | Judgment Timeline | Inline action timeline with dates | Implemented |
| 31 | inspector-canon-popup | Canon Popup | 4-tier dropdown | Implemented |
| 32 | inspector-board-menu | Add-to-Board | Canvas board assignment | Implemented |
| 33 | inspector-reason-dialog | Reason Dialog | Required for lock/discard/promote | Implemented |

### Phase 8 — Canvas (12 screens)
| # | ID | Name | Description | Status |
|---|-----|------|-------------|--------|
| 34 | canvas-relation | Relationship Diagram | Node graph with connections, canon borders | Implemented |
| 35 | canvas-timeline | Timeline | Horizontal timeline, draggable events, year markers | Implemented |
| 36 | canvas-deduction | Deduction Map | Zone-based: Problem/Candidate/Verify/Locked/Discarded | Implemented |
| 37 | canvas-tool-panel | Tool Palette | Select, marquee, connect, pool, template, text, sticky, partition | Implemented |
| 38 | canvas-zoom | Zoom Controls | +/-/percentage/fit, Ctrl+scroll | Implemented |
| 39 | canvas-pool | Object Pool Drawer | All objects by type, searchable, drag to canvas | Implemented |
| 40 | canvas-marquee | Marquee Select | Rectangular multi-select | Implemented |
| 41 | canvas-layout-lock | Layout Lock | Toggle to protect manual positions | Implemented |
| 42 | canvas-connect | Connection Drawing | Click source, drag to target | Implemented |
| 43 | canvas-sticky | Sticky Note | Free-floating text annotations | Implemented |
| 44 | canvas-timeline-unsorted | Unsorted Events | Sidebar: unscheduled events for timeline drag | Implemented |
| 45 | canvas-hint | Canvas Hint | Bottom-center hint for pan/zoom | Implemented |

### Phase 9 — Settings & Collections (4 screens)
| # | ID | Name | Description | Status |
|---|-----|------|-------------|--------|
| 46 | setting-collection | Setting Collection | Canon objects, filterable/searchable | Implemented |
| 47 | setting-promote | Promote/Demote | Canon level change buttons | Implemented |
| 48 | judgment-records | Judgment Records | Action Log + Field Changes tabs, filterable | Implemented |
| 49 | canon-handbook | Canon Handbook | 4-level reference with timeline and badges | Prototyped |

### Phase 10 — Global Operations (3 screens)
| # | ID | Name | Description | Status |
|---|-----|------|-------------|--------|
| 50 | global-search | Global Search | Ctrl+K, fuzzy + pinyin, grouped results | Implemented |
| 51 | undo-redo-toast | Undo/Redo Toast | Boundary feedback | Implemented |
| 52 | error-toast | Error Toast | Failure notifications | Implemented |

### Phase 11 — AI Assistant v1.3 (10 screens)
| # | ID | Name | Description | Status |
|---|-----|------|-------------|--------|
| 53 | ai-chat | AI Full-Page Chat | Sidebar outline + conversation + input + doc cards | Prototyped |
| 54 | ai-chat-header | Chat Header | Title, model indicator, focus badge, new/model buttons | Prototyped |
| 55 | ai-doc-card | Document Card | Type badge, title, body, sections, edit/save/expand buttons | Prototyped |
| 56 | ai-doc-card-edit | Inline Card Edit | Editable title/body fields, save/cancel | Design only |
| 57 | ai-input-bar | Input Bar | Auto-resize textarea, send button | Prototyped |
| 58 | ai-focus | Focus Indicator | Header badge for focused outline object | Prototyped |
| 59 | ai-typing | Typing Indicator | 3-dot bounce animation | Prototyped |
| 60 | ai-sidebar-model | Sidebar Model Selector | Active model name, clickable to settings | Prototyped |
| 61 | ai-bottom-bar | AI Bottom Bar | Connection dot, tokens, usage bar | Prototyped |
| 62 | ai-new-chat | New Chat Confirm | Confirm dialog before clearing conversation | Prototyped |

### Phase 12 — AI Settings v1.3 (7 screens)
| # | ID | Name | Description | Status |
|---|-----|------|-------------|--------|
| 63 | settings-shell | Settings Panel | Left nav: API Keys, Usage, Appearance, Storage, Notifications, About | Prototyped |
| 64 | settings-api-keys | API Key Management | Per-provider cards: OpenAI, Anthropic, Local. Key/endpoint/timeout/test | Prototyped |
| 65 | settings-models | Model Selector | Radio list with pricing, daily token bar, breakdown, sparkline | Prototyped |
| 66 | settings-cost | Cost Estimate | Today + monthly cost, budget limit input | Prototyped |
| 67 | settings-breakdown | Per-Model Breakdown | Bar + token count + cost per model | Prototyped |
| 68 | settings-sparkline | Weekly Sparkline | 7-day bar chart | Prototyped |
| 69 | settings-test | Connection Test | Inline success/failure result with latency | Prototyped |

### Phase 13 — Agent AI v1.4+ Roadmap (10 screens)
| # | ID | Name | Description | Status |
|---|-----|------|-------------|--------|
| 70 | ai-agent-tab | Agent Control Center | Agent cards + task queue + run/stop | Roadmap |
| 71 | agent-card | Agent Card | Icon, name, status, progress, step description | Roadmap |
| 72 | task-queue | Task Queue | Draggable pending/running/complete tasks | Roadmap |
| 73 | skill-marketplace | Skill Marketplace | Installable skills overlay | Roadmap |
| 74 | agent-collab | Collaborative Editor | Real-time AI writing, color cursors | Roadmap |
| 75 | change-history | Change History | AI modifications timeline, accept/reject | Roadmap |
| 76 | collaborator-list | Collaborator List | Active agents + user listed in sidebar | Roadmap |
| 77 | ai-suggestions | AI Suggestions Panel | Auto-layout recs, consistency issues, one-click fix | Roadmap |
| 78 | consistency-report | Consistency Scan Report | Issues by severity, jump-to, auto-fix | Roadmap |
| 79 | ai-layout-recommend | AI Layout Recommendation | 2-3 schemes, preview, apply | Roadmap |

### Phase 14 — Dashboard v1.7+ Roadmap (3 screens)
| # | ID | Name | Description | Status |
|---|-----|------|-------------|--------|
| 80 | dashboard | Dashboard Tab | Object trends, AI hours, consistency score, skill activity | Roadmap |
| 81 | style-recognition | Style Recognition | Detected genre/style with match % | Roadmap |
| 82 | skill-recommend | Dynamic Skill Recommendation | Smart skill suggestions per project | Roadmap |

### Phase 15 — Web v1.8+ Roadmap (4 screens)
| # | ID | Name | Description | Status |
|---|-----|------|-------------|--------|
| 83 | platform-switcher | Platform Indicator | Desktop/Web badge, responsive breakpoints | Roadmap |
| 84 | pwa-install | PWA Install Prompt | Install app toast | Roadmap |
| 85 | cloud-sync | Cloud Sync Settings | Sync toggle, conflict strategy | Roadmap |
| 86 | share-button | Share Button | Read-only project share link | Roadmap |

### Phase 16 — Release v1.9+ Roadmap (4 screens)
| # | ID | Name | Description | Status |
|---|-----|------|-------------|--------|
| 87 | feedback | Feedback Button | Bug report with screenshot | Roadmap |
| 88 | beta-badge | Beta/RC Badge | Version indicator | Roadmap |
| 89 | skeleton | Skeleton Loading | Content placeholder | Roadmap |
| 90 | crash-recovery | Crash Recovery | Abnormal exit detection, session restore | Roadmap |

### Phase 17 — v2.0 North Star Roadmap (3 screens)
| # | ID | Name | Description | Status |
|---|-----|------|-------------|--------|
| 91 | publish | Publish Panel | QA checklist, export/publish | Roadmap |
| 92 | version-footprint | Version Footprint | v1.1 to v2.0 timeline | Roadmap |
| 93 | knowledge-base | Knowledge Base Link | Indexed items count | Roadmap |

---

## 2. Key Interactions Per Screen (Summary)

**Outer Shell**: Click to enter project; hover for animation; search/filter/sort projects; card menu for rename/delete/export; cover color cycling.

**Creation & Onboarding**: Type name (max 40 chars); select genre with live color preview; choose template with preset preview; 3-step tutorial navigation; canon level reading; dismiss with or without "don't show again".

**Workspace**: Click nav tabs to switch views; click sidebar items to navigate objects; type to filter outline; click canon badge for level change; click linked objects to navigate; enter reason for destructive actions.

**Document Editor**: Type Markdown in source mode; preview rendered HTML; WYSIWYG rich editing; format via toolbar; double-click [[nonexistent]] to create object; select object type template from empty state.

**Canvas**: Click/drag nodes; pan empty space; scroll to zoom; marquee select; draw connections click-drag-release; toggle layout lock; add sticky notes; drag unscheduled events onto timeline; drag between deduction zones to change status.

**AI Assistant**: Type and Enter to chat; AI responds with embedded doc cards; edit cards inline; save to project; expand content; click outline to set AI focus; switch models; view token usage.

**Settings**: Enter API keys per provider; test connection; select active model; view daily/weekly usage breakdown; set budget limits.

---

## 3. Navigation Flow

### Entry Flow
```
App Launch -> Loading Screen -> Bookshelf
  +-- click existing project -> Workspace Shell (nav tabs + outline + content + inspector)
  +-- click New -> Creation Wizard -> Workspace Shell
  +-- Ctrl+click New -> quick-create -> Workspace Shell
```

### Workspace Navigation
```
Nav Bar tabs: [文档] [画板] [设定集] [判断记录]
  文档 tab: Document Editor (3 modes) + Outline (left) + Inspector (right)
  画板 tab: Canvas (3 sub-views via canvas tabs) + Tool Palette + Object Pool
  设定集 tab: Setting Collection (filterable list) + Inspector
  判断记录 tab: Judgment Records (Action Log / Field Changes)

Left Sidebar: click outline item -> select+navigate; type search -> filter
Right Inspector: click canon -> popup change; click linked -> navigate; click lock/discard -> reason dialog
Ctrl+K: Global Search -> type query -> arrow keys -> Enter to jump
```

### Canvas Sub-Views
```
Canvas Tabs: [角色关系图] [时间线] [设定推演图]
  角色关系图: node graph, connections, drag/pan/zoom/create
  时间线: horizontal track + event cards + unsorted sidebar
  设定推演图: status zones, drag between zones
```

### AI Assistant Flow (v1.3)
```
AI Chat:
  Type -> Enter -> AI responds with doc cards
    -> click Edit -> inline edit -> Save/Cancel
    -> click "收录为设定" -> saves to project
    -> click "继续展开" -> AI expands
  Click outline item -> sets AI focus to that object
  New Chat -> confirm dialog -> fresh conversation
  Switch Model -> Model Selector settings
```

### Settings Flow (v1.3)
```
Settings Shell:
  API Keys -> per-provider: key input -> test -> save/remove
  Model & Usage -> select active model; view daily/weekly stats
  Cost Estimate -> view costs; set monthly budget
```

---

## 4. Shared UI Components

### App Shell
| Component | Screens |
|-----------|---------|
| Nav Bar (back, project name, tabs, mode, search, badges) | All workspace screens |
| Status Bar (save state, word count, links, canon label) | All workspace screens |
| Offline Banner | All screens when offline |
| Toast System | Global |

### Design Tokens
| Token | Value | Usage |
|-------|-------|-------|
| --accent | #B7FF00 | Brand color, active states, CTAs |
| --bg-canvas | #0a0a0a | App background |
| --bg-surface | #141414 | Card backgrounds |
| --bg-raised | #1e1e1e | Interactive surfaces |
| --bg-header | #0e0e0e | Navigation/header |
| --border-default | #2a2a2a | All borders |
| --text-primary | #e0e0e0 | Body text |
| --text-secondary | #a0a0a0 | Secondary text |
| --text-muted | #666666 | Hint text |
| --canon-core | #FFB74D | Core canon badge |
| --canon-project | #90CAF9 | Project canon badge |
| --canon-draft | #CE93D8 | Draft canon badge |
| --canon-none | #666666 | Unlisted badge |

### Canon Visual System
| Level | Color | Border | Badge |
|-------|-------|--------|-------|
| Core | #FFB74D amber | Solid | Core |
| Project | #90CAF9 blue | Solid | Project |
| Draft | #CE93D8 purple | Dashed | Draft |
| Unlisted | #666666 gray | Subtle | None |

### Reusable UI Patterns
| Pattern | Used In |
|---------|---------|
| Gradient Cards (3:4, genre colors) | Bookshelf |
| Canon Dots (6px circles, colored by level) | Outline, inspector, canvas nodes |
| Type Icons (emoji per type) | Inspector, outline, canvas |
| Modal Overlay (backdrop blur, slide-up) | Wizard, guides, reason dialog |
| Status Dot (green=active, red=threat) | Object cards |
| Genre Badge (translucent pill) | Bookshelf cards |
| Progress Bar (8px, green-yellow-red) | Usage monitor |
| Collapsible Sections (toggle + animate) | Outline, handbook, provider cards |

---

## 5. Priority for North Star Prototype

### Tier 0 — Must Have (22 screens)
These form the essential "create -> write -> link -> organize -> visualize" loop.

| # | Screen | Why Essential |
|---|--------|---------------|
| 01 | shelf | Entry point for all usage |
| 06 | wizard | Project creation is entry gate |
| 10 | workspace-shell | Main container for all work |
| 11 | nav-bar | Navigation between all views |
| 17-19 | editor-* | Core writing experience (3 modes) |
| 20 | editor-toolbar | Formatting controls |
| 23 | outline-tree | Object navigation and discovery |
| 27-28 | inspector-* | Object detail viewing |
| 34 | canvas-relation | Visual relationship graph |
| 35 | canvas-timeline | Timeline view |
| 36 | canvas-deduction | Deduction zone view |
| 37 | canvas-tool-panel | All canvas interactions |
| 38 | canvas-zoom | Canvas usability |
| 46 | setting-collection | Setting/canon management |
| 48 | judgment-records | Judgment tracking |
| 12 | status-bar | Save state + metadata visibility |
| 50 | global-search | Navigation efficiency |
| 08 | first-launch-guide | New user onboarding |

### Tier 1 — High Value (18 screens)
Major quality-of-life and AI integration features.

| # | Screen | Why |
|---|--------|-----|
| 03 | shelf-search | Project discovery with 5+ projects |
| 04 | shelf-card-menu | Project management (rename/delete) |
| 07 | wizard-template-preview | Better creation UX |
| 09 | canon-guide | Canon system comprehension |
| 21 | wiki-create-bubble | WikiLink creation flow |
| 30 | inspector-judgment | Judgment history visibility |
| 31 | inspector-canon-popup | Canon change UX |
| 33 | inspector-reason-dialog | Mandatory for judgment recording |
| 39 | canvas-pool | Add existing objects to canvas |
| 40 | canvas-marquee | Multi-select on canvas |
| 41 | canvas-layout-lock | Prevent layout data loss |
| 42 | canvas-connect | Connection creation UX |
| 44 | canvas-timeline-unsorted | Unscheduled event management |
| 53 | ai-chat | AI assistant -- major value driver |
| 55 | ai-doc-card | AI output as usable content |
| 63-64 | settings-api-keys | BYOK -- required for AI to work |
| 65 | settings-models | Model switching for AI |
| 49 | canon-handbook | Reference documentation |

### Tier 2 — Polish (13 screens)
Complete the experience and remove friction.

| # | Screen | Why |
|---|--------|-----|
| 02 | shelf-empty | Empty state for new users |
| 05 | shelf-cover-edit | Personalization |
| 13 | offline-banner | Error transparency |
| 22 | editor-empty | Empty state guidance |
| 24 | outline-search | Large-project navigation |
| 29 | inspector-linked | Link awareness |
| 32 | inspector-board-menu | Add-to-canvas from inspector |
| 43 | canvas-sticky | Canvas annotation |
| 47 | setting-promote | Canon management from settings |
| 51 | undo-redo-toast | Feedback on boundaries |
| 56 | ai-doc-card-edit | AI content correction without leaving chat |
| 61 | ai-bottom-bar | AI usage awareness |
| 68 | settings-sparkline | Usage trend visibility |

### Tier 3 — Future (20+ screens)
v1.4+ milestones, prototype in later phases.

| # | Screen | Version |
|---|--------|---------|
| 15-16 | workspace-mode-toggle, quick-action | v2.0 |
| 25-26 | outline-smart-group, recent | v2.0 |
| 70-79 | agent ecosystem (10 screens) | v1.4+ |
| 80-82 | dashboard + analytics | v1.7+ |
| 83-86 | web platform | v1.8+ |
| 87-90 | release polish | v1.9+ |
| 91-93 | v2.0 north star | v2.0 |

---

## Appendix: Version Distribution Summary

| Version | Screens | Status |
|---------|---------|--------|
| v0.1-v0.2 (current) | 35 | Implemented in TypeScript/React |
| v1.2 prototypes | 5 | HTML prototypes, not in code |
| v1.3 prototypes | 17 | HTML prototypes, not in code |
| v1.4 (roadmap) | 5 | Not yet designed |
| v1.5 (roadmap) | 3 | Not yet designed |
| v1.6 (roadmap) | 2 | Not yet designed |
| v1.7 (roadmap) | 3 | Not yet designed |
| v1.8 (roadmap) | 4 | Not yet designed |
| v1.9 (roadmap) | 4 | Not yet designed |
| v2.0 (roadmap) | 7 | Not yet designed |
| **Total** | **93** | |

### Screen Count by Status

| Status | Count |
|--------|-------|
| Implemented in codebase | 37 |
| Prototyped (HTML) | 19 |
| Roadmap only | 37 |
| **Total** | **93** |