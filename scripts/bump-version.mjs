#!/usr/bin/env node
// Usage: npm run bump -- <major|minor|patch>
// Bumps the version in app.json (shown in the app footer), package.json and package-lock.json together.
import { readFileSync, writeFileSync } from 'node:fs';

const kind = process.argv[2];
if (!['major', 'minor', 'patch'].includes(kind)) {
  console.error('usage: npm run bump -- <major|minor|patch>');
  process.exit(2);
}

const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const write = (f, d) => writeFileSync(f, JSON.stringify(d, null, 2) + '\n');

const app = read('app.json');
const [maj, min, pat] = app.expo.version.split('.').map(Number);
const next = kind === 'major' ? [maj + 1, 0, 0] : kind === 'minor' ? [maj, min + 1, 0] : [maj, min, pat + 1];
const version = next.join('.');

app.expo.version = version;
write('app.json', app);
const pkg = read('package.json');
pkg.version = version;
write('package.json', pkg);
const lock = read('package-lock.json');
lock.version = version;
if (lock.packages?.['']) lock.packages[''].version = version;
write('package-lock.json', lock);
console.log(`${maj}.${min}.${pat} -> ${version}`);
