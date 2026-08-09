#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SKILL_DIR = path.resolve(__dirname, '..');
const STATE_ROOT = path.join(SKILL_DIR, '.state');

function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    }).trim();
  } catch (_) {
    return '';
  }
}

function canonicalRoot(root) {
  const absolute = path.resolve(root || process.cwd());
  try {
    return fs.realpathSync.native(absolute);
  } catch (_) {
    return absolute;
  }
}

function slug(value, fallback) {
  const clean = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return clean || fallback;
}

function hash(value, length = 12) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, length);
}

function branchIdentity(root) {
  const branch = git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  if (branch) return branch;
  const commit = git(root, ['rev-parse', '--short', 'HEAD']);
  return commit ? `detached-${commit}` : 'sin-git';
}

function resolveWorkspaceState(root) {
  const repoRoot = canonicalRoot(root);
  const branch = branchIdentity(repoRoot);
  const repoName = slug(path.basename(repoRoot), 'repo');
  const branchName = slug(branch, 'rama');
  const repoDir = `${repoName}-${hash(repoRoot)}`;
  const branchDir = `${branchName}-${hash(branch)}`;
  const dir = path.join(STATE_ROOT, 'workspaces', repoDir, branchDir);

  return {
    skillDir: SKILL_DIR,
    stateRoot: STATE_ROOT,
    repoRoot,
    branch,
    dir,
    manifestPath: path.join(dir, 'manifest.json'),
    briefsDir: path.join(dir, 'briefs'),
    baselineDir: path.join(dir, 'baseline'),
    metadataPath: path.join(dir, 'workspace.json'),
  };
}

function ensureWorkspaceState(state) {
  fs.mkdirSync(state.dir, { recursive: true });
  writeJsonAtomic(state.metadataPath, {
    schemaVersion: 1,
    repoRoot: state.repoRoot,
    branch: state.branch,
    lastUsedAt: new Date().toISOString(),
  });
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, file);
}

function assertInsideRepo(root, relativePath) {
  const file = path.resolve(root, relativePath);
  const rel = path.relative(root, file);
  if (!rel || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel))) {
    return file;
  }
  throw new Error(`Ruta fuera del repositorio: ${relativePath}`);
}

module.exports = {
  assertInsideRepo,
  ensureWorkspaceState,
  resolveWorkspaceState,
  writeJsonAtomic,
};
