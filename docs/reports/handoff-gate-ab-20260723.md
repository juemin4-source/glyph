# Handoff：Glyph 织梦机 Gates A+B

> **状态：已废止。** 本报告记录的是被拒绝的第一次 Gate A 原型，内容与完成度声明不再作为当前事实。请以 `gate-a-repair-20260723.md` 为准。

> **日時**: 2026-07-23 18:30
> **セッション**: 約7時間（PRD作成→Gate A実装→テスト→Gate B着手）
> **作成者**: 梨安 (instance=main)

---

## 目的

織夢機 v0.3.1（五畫板管線）から v0.4.1（自由創作底座+AI讀取）への製品再定義に基づき、Phase 1（Gate A: 本地寫作底座）を完了し、Gate B（AI 唯讀項目）に着手する。

---

## 完成項目

### PRD
- `docs/product/zhimengji-prd-v0.4.1.md` — 完整開發交付稿（含詳細功能方案、驗收標準、4 Gate 劃分）

### Gate A：本地寫作底座（5 Phase 全部完成）

**Rust 後端**
- `src-tauri/src/fs_models.rs` — FsProject, DirEntry, SessionState, FileChangeEvent 等類型
- `src-tauri/src/fs_commands.rs` — 19 個 Tauri IPC 命令：
  - 項目 CRUD（create/open/list/remove_fs_project）
  - 檔案操作（list_directory, read/write_file, create/rename/delete_file/directory）
  - 會話狀態（get/save_session_state）
  - 路徑安全（resolve_project_path 驗證，拒絕 ../ 逃逸）
  - 原子寫入（write .tmp → fs::rename）
  - 檔案監控（watch/unwatch_project）
  - 移行（export_to_fs_project）
- `src-tauri/src/fs_watcher.rs` — notify crate 整合，300ms 去抖合併，過濾 .glyph/ 和 .tmp
- `src-tauri/src/db.rs` — fs_projects 表 + CRUD（create/upsert/list/get/remove）
- `src-tauri/src/lib.rs` — モジュール註冊 + 全指令註冊
- `src-tauri/Cargo.toml` — notify, walkdir, tempfile 依賴追加
- `src-tauri/capabilities/default.json` — core:event 權限追加

**前端類型+Store**
- `types/fs.ts` — FsProject, DirEntry, SessionState, FileChangeEvent, FileTab 等
- `stores/fsStore.ts` — Zustand store（專案列表、檔案樹、檔案編輯、髒狀態、會話、載入/錯誤狀態）

**前端 UI**
- `components/FileTree.tsx` — 遞迴檔案樹（可折疊目錄、活性高亮、右鍵選單、懶加載子目錄）
- `components/FsCreateForm.tsx` — 新FS專案建立表單（名稱、路徑、題材）
- `components/FsFileView.tsx` — 純文字備用編輯器

**編譯器整合**
- `components/FsDocumentView.tsx` — Tiptap 編輯器（WYSIWYG/原始碼/預覽三模式、斜線指令、氣泡選單、自動儲存）
- `components/FsAiPanel.tsx` — AI 助手側欄（對話、檔案搜尋、提供者設定）

**外部變更檢測+會話恢復**
- `hooks/useExternalChangeDetector.ts` — fs:file-changed 事件監聽
- `hooks/useSessionPersistence.ts` — beforeunload 保存 + 啟動時恢復

**移行**
- `components/Bookshelf.tsx` — 統一書架（舊 SQLite 專案 + FS 專案合併顯示）
- `App.tsx` — 工作區統一（SQLite/FS 共用同一佈局、AI 面板常駐）
- 舊專案→FS 導出（書架選單"導出為本地項目"→export_to_fs_project 指令）

**CSS**
- `styles/fs.css` — 完整 UI 樣式（檔案樹、編輯器、AI 面板、設定、卡片、表單）

**テスト**
- `tests/unit/fsStore.test.ts` — 21 個測試（專案CRUD、檔案操作、會話、エラー処理）
- `src-tauri/src/fs_commands.rs` — 14 個 Rust テスト（パスセキュリティ、原子書き込み、相対パス）
- `tests/unit/App.test.tsx` — mock パス修正（../components/ → ../../components/）
- `src-tauri/src/db.rs` — WorldObject テスト初期化子修正（parent_id, sort_order 追加）
- **テスト結果: TS 58/58 通過、Rust 28/28 通過**

### Gate B：AI 讀取項目（着手中）

- `lib/fs-ai-bridge.ts` — FS 項目 AI 橋梁（コンテキスト収集、ファイル検索、LLM 呼び出し、認証情報解決）
- `components/FsAiPanel.tsx` — AI パネル（對話、檔案搜尋、API endpoint/key/model 設定、保存）
- `App.tsx` — AI パネル全プロジェクトモードで常駐表示

---

## 未完成項目

### Gate B 殘項
1. **AI 實際對話驗證** — 設定 UI は實裝済み、認証情報解決も修正済みだが、實際に Ollama/API と通信して結果が返るか未確認
2. **Agent 能力向上** — 現在は簡單な對話+ファイル名検索のみ。プロジェクト內の內容を理解した本格的な AI 支援（プロット分析、キャラクター整理など）は未実裝
3. **Gate B 專用テスト** — fs-ai-bridge と FsAiPanel のテスト未作成

### Gate C：AI 書込み（未着手）
- AI がファイルを作成・修正する機能
- 一時生成 → 正式提出の分離
- 單一ファイル制限

### Gate D：長期制御（未着手）
- アーカイブ（修正前スナップショット）
- アンドゥ（ワンクリック取り消し）
- 來源表示（AI 書込みブロックの識別）
- 異常復舊

---

## 既知リスク

1. **自動保存↔Watcher ループ** — 自身の保存が外部変更イベントを引き起こし、再読み込みループに入る可能性。未検証
2. **外部変更と未保存編集の競合** — ユーザー編集中に外部変更が來た場合の振る舞いが未実裝（現在は強制再読み込み）
3. **Session 復舊のエッジケース** — session.json 破損時やファイル削除時のフォールバックが完全ではない
4. **移行パス** — 舊 SQLite プロジェクト→FS プロジェクトの導出は実裝済みだが、自動移行は未実裝。移行後の舊プロジェクト削除も未対応
5. **AI パネルの LLM エラーハンドリング** — 通信エラー、タイムアウト、認証エラーの表示がまだ不十分

---

## ファイルインデックス

### Rust（src-tauri/src/）
| ファイル | 役割 | 狀態 |
|---------|------|------|
| `fs_models.rs` | FS 操作の Rust 型定義 | ✅ 完了 |
| `fs_commands.rs` | 19 の Tauri IPC 命令 + テスト | ✅ 完了 |
| `fs_watcher.rs` | notify ファイル監視 | ✅ 完了 |
| `db.rs` | fs_projects テーブル追加 | ✅ 完了 |
| `lib.rs` | モジュール登録 | ✅ 完了 |

### フロントエンド
| ファイル | 役割 | 狀態 |
|---------|------|------|
| `types/fs.ts` | FS 型定義 | ✅ 完了 |
| `stores/fsStore.ts` | Zustand 狀態管理 | ✅ 完了 |
| `components/FileTree.tsx` | ファイルツリーUI | ✅ 完了 |
| `components/FsDocumentView.tsx` | Tiptap 編輯器 | ✅ 完了 |
| `components/FsAiPanel.tsx` | AI 助手パネル | 🟡 要検証 |
| `components/FsCreateForm.tsx` | プロジェクト作成フォーム | ✅ 完了 |
| `components/FsFileView.tsx` | テキスト編輯予備 | ✅ 完了 |
| `components/Bookshelf.tsx` | 統一書架 | ✅ 完了 |
| `lib/fs-ai-bridge.ts` | FS-AI 橋梁 | 🟡 要検証 |
| `hooks/useExternalChangeDetector.ts` | 外部変更検出 | ✅ 完了 |
| `hooks/useSessionPersistence.ts` | セッション永続化 | ✅ 完了 |
| `styles/fs.css` | FS 全體スタイル | ✅ 完了 |

---

## 次回推奨手順

1. **Gate B の動作検証** — 実際の Ollama または API Key で AI パネルが機能するか確認
2. **Gate B テスト追加** — fs-ai-bridge のユニットテスト、FsAiPanel のコンポーネントテスト
3. **Watcher ループ問題の解決** — 自身の保存を外部変更と誤検出しないための抑制機構
4. **Gate C（AI 書き込み）の設計** — ファイル新規作成・修正のための安全な書き込みフロー
5. **自動移行パス** — 舊 SQLite プロジェクトを開くときに自動的に FS モードに移行する

---

## ファイル狀態

```
Glyph リポジトリ（G:\AI\Claude-Workspace\Projects\glyph）
ブランチ: main（クリーン）
未追跡ファイル: 13（新規 FS モジュール）
変更ファイル: 10（App.tsx, tauri-api.ts, Bookshelf.tsx, db.rs, lib.rs 等）
```

## 記録

以上の內容を梨安の記憶に記録する。次回起動時はこの handoff を基に Gate B の検証と Gate C の設計を継続する。
