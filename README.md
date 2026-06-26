# Markdown Viewer

Markdown Viewer is a desktop Markdown viewer for Linux and macOS. It focuses on reading Markdown files quickly, while still offering light editing when needed.

## Features

- Open Markdown files directly from the file manager
- Multiple tabs with split panes
- Reuse an existing tab when the same file is opened again
- Automatic refresh when files change on disk
- Simple edit mode with save/revert
- LaTeX math support through KaTeX
- Light/dark mode toggle
- Ctrl+scroll zoom
- Outline, recent files, search, print, and PDF export
- CSS overrides from `~/.config/mdviewer/user.css`

## 開発起動

```bash
npm install
npm run dev
```

## ビルドとダブルクリック登録

```bash
npm install
npm run register
```

`npm run register` はビルド後、以下をユーザー環境に登録します。

- `~/.local/bin/mdviewer`
- `~/.local/share/applications/mdviewer.desktop`
- `~/.local/share/mime/packages/mdviewer-markdown.xml`

解除する場合:

```bash
npm run unregister
```

## 配布パッケージ作成

Linux:

```bash
npm run dist:linux
```

macOS:

```bash
npm run dist:mac
```

macOS用の署名済みdmgを安定して作るにはmacOS上、またはGitHub ActionsのmacOS runnerでビルドしてください。Linux上からはLinux用パッケージの作成が主対象です。

GitHub Releasesで配布する場合は、`v0.1.0` のようなタグをpushすると `.github/workflows/release.yml` がLinux/macOS成果物を作成してReleaseに添付します。

## CSSカスタマイズ

起動時に `~/.config/mdviewer/user.css` があれば読み込みます。標準スタイルを上書きしたい場合はこのファイルを作成してください。
