import fs from 'node:fs';

const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/release-notes.mjs <version>');
  process.exit(1);
}

const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
const heading = new RegExp(`^##\\s+\\[?v?${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]?\\b.*$`, 'm');
const match = changelog.match(heading);

if (!match || match.index === undefined) {
  console.error(`No CHANGELOG.md section found for v${version}.`);
  process.exit(1);
}

const sectionStart = match.index + match[0].length;
const nextHeading = changelog.slice(sectionStart).match(/^##\s+/m);
const sectionEnd = nextHeading?.index === undefined ? changelog.length : sectionStart + nextHeading.index;
const notes = changelog.slice(sectionStart, sectionEnd).trim();

if (!notes) {
  console.error(`CHANGELOG.md section for v${version} is empty.`);
  process.exit(1);
}

process.stdout.write(`${notes}\n`);
