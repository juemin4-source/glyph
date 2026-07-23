# 源码恢复说明

原始附件 `zhimengji-source.zip` 在 `v1.2/diagram/zhimengji-v1.2-interaction-flow@2x.png` 的压缩数据中途结束，缺少 ZIP 中央目录。当前基线从附件中顺序恢复出 416 个完整条目，损坏点之前的代码文件均可正常解压。

附件中的前端文件被压平在根目录，但配置仍引用 `src/`。本基线已重新建立标准 `src/`，生产构建以其中内容为准。根目录的同名文件暂时保留，便于与恢复内容对照。

Rust 源文件已经恢复，但附件中没有 `Cargo.toml`、`tauri.conf.json` 及完整 `src-tauri/` 工程结构。因此本次能够验证 TypeScript/Vite 构建，无法在这份附件上独立执行 `cargo check` 或打包 Tauri 应用。请从你本机原项目补回这些工程文件，再将本基线中的 Rust 改动合并回真实 `src-tauri/src/`：

- `byok_commands.rs`
- `byok/llm_client.rs`
- `ai/context_builder.rs`

不要把当前压缩包直接当作原仓库的完整替代品；它是一个经过止血、可编译的前端基线和可合并的 Rust 修复副本。
