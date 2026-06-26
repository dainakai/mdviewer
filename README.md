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

## Install

Download the latest installer from [GitHub Releases](https://github.com/dainakai/mdviewer/releases).

- Linux: use the `.deb` package or the `.AppImage`
- macOS: use the `.dmg` package

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

## CSSカスタマイズ

起動時に `~/.config/mdviewer/user.css` があれば読み込みます。標準スタイルを上書きしたい場合はこのファイルを作成してください。
