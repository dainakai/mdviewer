# Changelog

## v0.1.3 - 2026-06-26

### Added

- Mermaid diagram rendering for fenced `mermaid` code blocks.
- README screenshot showing a real document with tabs, outline entries, LaTeX math, and a Mermaid diagram.
- Sample Markdown files used to capture the README screenshot.

### Changed

- Expanded install instructions for `.deb`, `.AppImage`, and `.dmg` packages, including what does and does not register OS file associations automatically.

## v0.1.2 - 2026-06-26

Initial public release of Markdown Viewer.

### Added

- Desktop Markdown viewer for Linux and macOS.
- File manager integration for Markdown files on Linux.
- Multiple tabs with optional split panes.
- Reuse of an existing tab when the same file is opened again.
- Automatic file refresh when open Markdown files change on disk.
- Light editing mode with save and revert actions.
- LaTeX math rendering through KaTeX.
- Light and dark mode toggle.
- Ctrl+scroll zoom and toolbar zoom controls.
- Outline, recent files, in-page search, print, and PDF export.
- CSS overrides from `~/.config/mdviewer/user.css`.

### Packaging

- Linux `.deb` and `.AppImage` packages.
- macOS `.dmg` and `.zip` packages.
- GitHub Releases publishing for installable artifacts.
