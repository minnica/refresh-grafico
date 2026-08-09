#!/usr/bin/env node
'use strict';

/**
 * review.js — Administra la referencia usada para aprender de correcciones.
 * Todo el estado vive en <skill-dir>/.state, nunca en el repositorio de emails.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  assertInsideRepo,
  ensureWorkspaceState,
  resolveWorkspaceState,
  writeJsonAtomic,
} = require('./runtime');

function optionValue(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
}

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function loadJson(file, label) {
  if (!fs.existsSync(file)) throw new Error(`No existe ${label}: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function relativeMd(root, md) {
  const file = assertInsideRepo(root, md);
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (!rel || rel.startsWith('../')) throw new Error(`Destino inválido en manifest: ${md}`);
  return { file, rel };
}

function snapshot(state) {
  ensureWorkspaceState(state);
  const manifest = loadJson(state.manifestPath, 'el manifest del lote');
  const temp = `${state.baselineDir}.tmp-${process.pid}`;
  fs.rmSync(temp, { recursive: true, force: true });
  fs.mkdirSync(path.join(temp, 'files'), { recursive: true });

  const files = [];
  for (const pair of manifest.pairs || []) {
    const { file, rel } = relativeMd(state.repoRoot, pair.md);
    if (!fs.existsSync(file)) throw new Error(`Falta el .md del lote: ${rel}`);
    const copy = path.join(temp, 'files', rel);
    fs.mkdirSync(path.dirname(copy), { recursive: true });
    fs.copyFileSync(file, copy);
    files.push({ path: rel, sha256: digest(file) });
  }

  writeJsonAtomic(path.join(temp, 'snapshot.json'), {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    repoRoot: state.repoRoot,
    branch: state.branch,
    files,
  });
  fs.rmSync(state.baselineDir, { recursive: true, force: true });
  fs.renameSync(temp, state.baselineDir);
  return files.length;
}

function changes(state) {
  const metadata = loadJson(path.join(state.baselineDir, 'snapshot.json'), 'la referencia del lote');
  const result = [];
  for (const item of metadata.files || []) {
    const current = assertInsideRepo(state.repoRoot, item.path);
    const baseline = path.join(state.baselineDir, 'files', item.path);
    if (!fs.existsSync(current)) {
      result.push({ status: 'deleted', path: item.path, baseline, current });
    } else if (digest(current) !== item.sha256) {
      result.push({ status: 'modified', path: item.path, baseline, current });
    }
  }
  return result;
}

function printHelp() {
  console.log(`
review.js — referencia y detección de correcciones manuales

  paths     Muestra las rutas de estado de este repositorio y rama.
  snapshot  Guarda una referencia de los .md del manifest actual.
  changes   Lista sólo los .md cambiados desde la referencia.
  accept    Sustituye la referencia por los .md actuales.

Opciones:
  --root <ruta>  Raíz del repositorio activo.
  --json         Salida JSON para paths o changes.
  --help         Esta ayuda.
`);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || !argv[0]) {
    printHelp();
    return;
  }

  const command = argv[0];
  const state = resolveWorkspaceState(optionValue(argv, 'root') || process.cwd());
  const json = argv.includes('--json');

  if (command === 'paths') {
    const output = {
      repoRoot: state.repoRoot,
      branch: state.branch,
      stateDir: state.dir,
      manifest: state.manifestPath,
      briefs: state.briefsDir,
      baseline: state.baselineDir,
    };
    console.log(json ? JSON.stringify(output, null, 2) : Object.entries(output).map(([k, v]) => `${k}: ${v}`).join('\n'));
    return;
  }

  if (command === 'snapshot' || command === 'accept') {
    const count = snapshot(state);
    console.log(`✓ Referencia ${command === 'accept' ? 'actualizada' : 'creada'}: ${count} archivo(s)`);
    console.log(`  ${state.baselineDir}`);
    return;
  }

  if (command === 'changes') {
    const found = changes(state);
    if (json) {
      console.log(JSON.stringify({ repoRoot: state.repoRoot, branch: state.branch, changes: found }, null, 2));
    } else if (found.length === 0) {
      console.log('✓ No hay correcciones manuales desde la referencia.');
    } else {
      console.log(`${found.length} corrección(es) manual(es) detectada(s):`);
      for (const item of found) {
        console.log(`  ${item.status === 'deleted' ? '−' : '•'} ${item.path}`);
        console.log(`    antes:  ${item.baseline}`);
        console.log(`    ahora:  ${item.current}`);
      }
    }
    return;
  }

  throw new Error(`Comando desconocido: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`\n✖ ${error.message}\n`);
  process.exit(1);
}
