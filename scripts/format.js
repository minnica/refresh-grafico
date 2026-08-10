#!/usr/bin/env node
'use strict';

/**
 * Formatea los .md del manifest con el formatter.js de la extensión instalada
 * "VT Email DSL". No replica sus reglas: carga la implementación real para que
 * una actualización de la extensión también actualice el formato del pipeline.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { assertInsideRepo, resolveWorkspaceState } = require('./runtime');

function optionValue(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
}

function versionParts(value) {
  return String(value || '').split(/[^0-9]+/).filter(Boolean).map(Number);
}

function compareVersions(a, b) {
  const left = versionParts(a);
  const right = versionParts(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff) return diff;
  }
  return 0;
}

function extensionRoots() {
  const roots = [];
  if (process.env.VSCODE_EXTENSIONS) {
    roots.push(...process.env.VSCODE_EXTENSIONS.split(path.delimiter).filter(Boolean));
  }
  const userDir = os.homedir();
  roots.push(
    path.join(userDir, '.vscode', 'extensions'),
    path.join(userDir, '.vscode-insiders', 'extensions')
  );
  return [...new Set(roots.map((root) => path.resolve(root)))];
}

function installedCandidates() {
  const candidates = [];
  for (const root of extensionRoots()) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^aplatam\.vt-email-dsl-/i.test(entry.name)) continue;
      const dir = path.join(root, entry.name);
      const manifestPath = path.join(dir, 'package.json');
      const formatterPath = path.join(dir, 'formatter.js');
      if (!fs.existsSync(manifestPath) || !fs.existsSync(formatterPath)) continue;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.name !== 'vt-email-dsl' || manifest.publisher !== 'aplatam') continue;
      candidates.push({ dir, formatterPath, version: manifest.version || '0' });
    }
  }
  return candidates.sort((a, b) => compareVersions(b.version, a.version));
}

const formatterCache = new Map();

function loadInstalledFormatter(explicitPath) {
  let formatterPath;
  let version = 'personalizada';

  if (explicitPath) {
    const candidate = path.resolve(explicitPath);
    formatterPath = fs.statSync(candidate).isDirectory()
      ? path.join(candidate, 'formatter.js')
      : candidate;
  } else {
    const installed = installedCandidates()[0];
    if (!installed) {
      throw new Error('No está instalada la extensión aplatam.vt-email-dsl de VS Code.');
    }
    formatterPath = installed.formatterPath;
    version = installed.version;
  }

  if (!fs.existsSync(formatterPath)) {
    throw new Error(`No existe el formateador VT Email DSL: ${formatterPath}`);
  }
  if (!formatterCache.has(formatterPath)) {
    const implementation = require(formatterPath);
    if (typeof implementation.formatVtEmailDsl !== 'function') {
      throw new Error(`${formatterPath} no exporta formatVtEmailDsl().`);
    }
    formatterCache.set(formatterPath, implementation.formatVtEmailDsl);
  }

  return { format: formatterCache.get(formatterPath), formatterPath, version };
}

function formatWithInstalledExtension(text, options = {}) {
  const formatter = loadInstalledFormatter(options.extensionPath);
  const tabSize = Number.isInteger(options.tabSize) && options.tabSize > 0
    ? options.tabSize
    : 2;
  return formatter.format(text, {
    tabSize,
    insertSpaces: options.insertSpaces !== false,
  });
}

function manifestFiles(root, only) {
  const state = resolveWorkspaceState(root);
  if (!fs.existsSync(state.manifestPath)) {
    throw new Error(`No existe el manifest del lote: ${state.manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(state.manifestPath, 'utf8'));
  let files = (manifest.pairs || []).map((pair) => assertInsideRepo(root, pair.md));
  if (only) {
    const needle = only.toLowerCase();
    files = files.filter((file) => path.relative(root, file).toLowerCase().includes(needle));
  }
  if (files.length === 0) {
    throw new Error(`No hay .md del manifest que coincidan${only ? ` con "${only}"` : ''}.`);
  }
  return files;
}

function writeAtomic(file, content) {
  const temp = `${file}.vt-format-${process.pid}`;
  try {
    fs.writeFileSync(temp, content, { encoding: 'utf8', mode: fs.statSync(file).mode });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) {
    console.log(`
format.js — formatea el manifest con la extensión VT Email DSL instalada

  --root <ruta>       Raíz del repositorio activo.
  --only <texto>      Sólo rutas del manifest que contengan el texto.
  --check             No escribe; falla si algún archivo cambiaría.
  --tab-size <n>      Tamaño de indentación (default del formatter: 2).
  --tabs              Indenta con tabs en lugar de espacios.
  --extension <ruta>  formatter.js o directorio de una versión específica.
  --version           Muestra la versión instalada que se utilizará.
  --help              Esta ayuda.
`);
    return;
  }

  if (argv.includes('--version')) {
    const formatter = loadInstalledFormatter(optionValue(argv, 'extension'));
    console.log(`VT Email DSL ${formatter.version}\n${formatter.formatterPath}`);
    return;
  }

  const root = path.resolve(optionValue(argv, 'root') || process.cwd());
  const extensionPath = optionValue(argv, 'extension');
  const formatter = loadInstalledFormatter(extensionPath);
  const options = {
    extensionPath: formatter.formatterPath,
    tabSize: Number(optionValue(argv, 'tab-size') || 2),
    insertSpaces: !argv.includes('--tabs'),
  };
  const check = argv.includes('--check');
  const files = manifestFiles(root, optionValue(argv, 'only'));
  let changed = 0;

  for (const file of files) {
    if (!fs.existsSync(file)) throw new Error(`Falta el .md del lote: ${path.relative(root, file)}`);
    const source = fs.readFileSync(file, 'utf8');
    const formatted = formatWithInstalledExtension(source, options);
    if (formatted === source) continue;
    changed += 1;
    if (!check) writeAtomic(file, formatted);
  }

  const action = check ? 'requieren formato' : 'formateados';
  console.log(`✓ VT Email DSL ${formatter.version}: ${changed} de ${files.length} archivo(s) ${action}.`);
  if (check && changed) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`\n✖ ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  compareVersions,
  formatWithInstalledExtension,
  installedCandidates,
  loadInstalledFormatter,
};
