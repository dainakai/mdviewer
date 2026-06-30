# Changelog

## v0.1.7 - 2026-06-30

### Added

- Added drag-and-drop tab movement between split panes.
- Added tab context menu actions for **Split Left**, **Split Right**, moving to the other pane, and closing the tab.
- Added an in-app **Help** menu with **Check for Updates...** for environments where the native menu is hidden.
- Added update prompt support for skipping a specific available version during startup checks.
- Added Windows x64 NSIS installer packaging for GitHub Releases.

### Changed

- Manual and startup update installs now use a single confirmation before downloading, installing, and restarting.
- PDF export now defaults to the active Markdown document name, ensures a `.pdf` extension, and exports the active document content instead of the app chrome.
- Release publishing now builds Linux and Windows artifacts only; macOS is source-only until signed and notarized packages are available.

## v0.1.6 - 2026-06-30

### Fixed

- Refresh now reloads changed local images embedded in the open Markdown document, even when the Markdown text itself did not change.

## v0.1.5 - 2026-06-26

### Changed

- Re-enabled Electron hardware acceleration for smoother document scrolling.
- Removed GPU-disabling launch flags from local development and Linux desktop registration.
- Added `MDVIEWER_DISABLE_GPU=1` as an opt-out for environments with GPU driver issues.
- Reduced preview repaint work for heavy images, code blocks, and Mermaid diagrams.

## v0.1.4 - 2026-06-26

### Added

- Startup update checks for packaged builds using GitHub Releases.
- User confirmation before downloading an available update and before restarting to install it.
- Manual **Help > Check for Updates...** menu action.

### Changed

- Documented update behavior and the current macOS signing caveat.

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
