import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = os.homedir();
const localBinDir = path.join(home, '.local', 'bin');
const applicationsDir = path.join(home, '.local', 'share', 'applications');
const mimePackagesDir = path.join(home, '.local', 'share', 'mime', 'packages');
const wrapperPath = path.join(localBinDir, 'mdviewer');
const desktopPath = path.join(applicationsDir, 'mdviewer.desktop');
const mimePath = path.join(mimePackagesDir, 'mdviewer-markdown.xml');
const electronBinaryPath = path.join(root, 'node_modules', 'electron', 'dist', 'electron');

function runOptional(command, args) {
  try {
    execFileSync(command, args, { stdio: 'inherit' });
  } catch (error) {
    console.warn(`Skipped ${command}: ${error.message}`);
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

await fs.mkdir(localBinDir, { recursive: true });
await fs.mkdir(applicationsDir, { recursive: true });
await fs.mkdir(mimePackagesDir, { recursive: true });

const npmPrefix = JSON.stringify(root);
const electronCommand = JSON.stringify(electronBinaryPath);
const wrapper = `#!/usr/bin/env bash
set -euo pipefail
exec ${electronCommand} ${npmPrefix} "$@"
`;
await fs.writeFile(wrapperPath, wrapper, { mode: 0o755 });
await fs.chmod(wrapperPath, 0o755);

const desktop = `[Desktop Entry]
Type=Application
Name=Markdown Viewer
Comment=View Markdown files with tabs, split panes, and LaTeX support
Exec=${wrapperPath} %F
Icon=text-markdown
Terminal=false
Categories=Office;Viewer;
MimeType=text/markdown;text/x-markdown;
StartupNotify=true
`;
await fs.writeFile(desktopPath, desktop, 'utf8');

const mime = `<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="text/markdown">
    <comment>Markdown document</comment>
    <glob pattern="*.md"/>
    <glob pattern="*.markdown"/>
    <glob pattern="*.mdown"/>
    <glob pattern="*.mkd"/>
    <glob pattern="*.mkdn"/>
  </mime-type>
</mime-info>
`;
await fs.writeFile(mimePath, mime, 'utf8');

if (await exists('/usr/bin/update-mime-database')) {
  runOptional('/usr/bin/update-mime-database', [path.join(home, '.local', 'share', 'mime')]);
}
if (await exists('/usr/bin/update-desktop-database')) {
  runOptional('/usr/bin/update-desktop-database', [applicationsDir]);
}

runOptional('/usr/bin/xdg-mime', ['default', 'mdviewer.desktop', 'text/markdown']);
runOptional('/usr/bin/xdg-mime', ['default', 'mdviewer.desktop', 'text/x-markdown']);

console.log(`Registered ${desktopPath}`);
console.log(`Launcher: ${wrapperPath}`);
