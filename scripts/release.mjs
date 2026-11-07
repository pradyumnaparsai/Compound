#!/usr/bin/env node
// Usage: npm run release [-- --dry-run]
// Publishes the current package.json version: pushes main, tags v<version>, and creates a GitHub release whose
// notes are the `## v<version>` section of CHANGELOG.md (only the changes since the previous release).
// Run after: bump -> OTA update -> add the CHANGELOG section -> commit.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dryRun = process.argv.includes('--dry-run');
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const attempt = (cmd, args) => {
  try {
    return run(cmd, args);
  } catch {
    return null;
  }
};
const fail = (msg) => {
  console.error(`release: ${msg}`);
  process.exit(1);
};

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const tag = `v${version}`;

const origin = run('git', ['remote', 'get-url', 'origin']);
const m = origin.match(/github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/);
if (!m) fail(`origin (${origin}) is not a github.com repository`);
const repo = `github.com/${m[1]}`;

if (run('git', ['status', '--porcelain'])) fail('working tree is not clean; commit everything first');
if (attempt('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`])) fail(`tag ${tag} already exists`);
if (run('git', ['ls-remote', '--tags', 'origin', tag])) fail(`tag ${tag} already exists on origin`);
if (attempt('gh', ['auth', 'status', '--hostname', 'github.com']) === null) {
  fail('gh is not logged in to github.com; run `gh auth login --hostname github.com` with your personal account');
}

const prev = attempt('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*']);
if (!prev) fail('no previous v* tag to diff against; tag the last release first');

const changelog = readFileSync('CHANGELOG.md', 'utf8');
const section = changelog.split(/^## /m).find((s) => s.startsWith(`${tag} `) || s.startsWith(`${tag}\n`));
if (!section) {
  const log = run('git', ['log', '--oneline', `${prev}..HEAD`]);
  fail(`CHANGELOG.md has no "## ${tag}" section. Commits since ${prev}:\n${log}`);
}
const body = `${section.split('\n').slice(1).join('\n').trim()}\n\n**Full changelog:** https://${repo}/compare/${prev}...${tag}\n`;

console.log(`Releasing ${tag} (previous release: ${prev}) to ${repo}\n\n${body}`);
if (dryRun) process.exit(0);

const notesFile = join(mkdtempSync(join(tmpdir(), 'release-')), 'notes.md');
writeFileSync(notesFile, body);
run('git', ['push', 'origin', 'main']);
run('git', ['tag', '-a', tag, '-m', tag]);
run('git', ['push', 'origin', tag]);
console.log(run('gh', ['release', 'create', tag, '--repo', repo, '--title', tag, '--notes-file', notesFile, '--verify-tag']));
