import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const home = os.homedir();
const wrapperPath = path.join(home, '.local', 'bin', 'mdviewer');
const applicationsDir = path.join(home, '.local', 'share', 'applications');
const desktopPath = path.join(applicationsDir, 'mdviewer.desktop');
const mimePath = path.join(home, '.local', 'share', 'mime', 'packages', 'mdviewer-markdown.xml');

function runOptional(command, args) {
  try {
    execFileSync(command, args, { stdio: 'inherit' });
  } catch (error) {
    console.warn(`Skipped ${command}: ${error.message}`);
  }
}

await fs.rm(wrapperPath, { force: true });
await fs.rm(desktopPath, { force: true });
await fs.rm(mimePath, { force: true });

runOptional('/usr/bin/update-mime-database', [path.join(home, '.local', 'share', 'mime')]);
runOptional('/usr/bin/update-desktop-database', [applicationsDir]);

console.log('Unregistered Markdown Viewer.');
