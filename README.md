# Markdown Viewer

Markdown Viewer is a desktop Markdown viewer for Linux and macOS. It focuses on reading Markdown files quickly, while still offering light editing when needed.

## Screenshot

![Markdown Viewer showing the empty start screen with no recent files](docs/screenshot.png)

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

Note: macOS builds are currently unsigned. You may need to allow the app manually in macOS security settings until signed and notarized packages are available.

## Development

```bash
npm install
npm run dev
```

## File Manager Integration

```bash
npm install
npm run register
```

`npm run register` builds the app and registers the local Linux desktop integration:

- `~/.local/bin/mdviewer`
- `~/.local/share/applications/mdviewer.desktop`
- `~/.local/share/mime/packages/mdviewer-markdown.xml`

This lets supported file managers open Markdown files with Markdown Viewer from the file context menu or by double-clicking after the association is selected.

To remove the local integration:

```bash
npm run unregister
```

## CSS Customization

Markdown Viewer loads `~/.config/mdviewer/user.css` on startup when the file exists. Create that file to override the default viewer styles.
