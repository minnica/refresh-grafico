#!/usr/bin/env node
'use strict';

/**
 * extract.js — Reduce un HTML viejo a un "brief" compacto.
 *
 * El 96 % de un HTML de email es markup: tablas anidadas, spacers y estilos
 * inline. Meterlo entero al contexto de la IA es caro y además ensucia: el
 * ruido es lo que hace que se mezcle el contenido entre piezas.
 *
 * Este script deja sólo lo que hace falta para reescribir el email con el DSL:
 * el texto por secciones, los assets ya mapeados al S3 del repo, los enlaces y
 * los merge tags traducidos con el diccionario de variables de la skill.
 *
 * Uso:
 *   node /ruta/a/la/skill/scripts/extract.js --root /ruta/al/repo src/001_XXX.html
 *   node /ruta/a/la/skill/scripts/extract.js --root /ruta/al/repo --all
 *   node /ruta/a/la/skill/scripts/extract.js --root /ruta/al/repo --all --out /ruta/externa
 */

const fs = require('fs');
const path = require('path');
const { ensureWorkspaceState, resolveWorkspaceState } = require('./runtime');
const { resolveUniversity } = require('./config');

function optionValue(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
}

const ARGV = process.argv.slice(2);
const ROOT = path.resolve(optionValue(ARGV, 'root') || process.cwd());
const SRC = path.join(ROOT, 'src');
const CONFIG_PATH = path.join(__dirname, 'prepare.config.json');
const ASSET_CATALOG_PATH = path.join(__dirname, '..', 'references', 'assets.json');
const VARIABLE_DICTIONARY_PATH = path.join(__dirname, '..', 'references', 'variables.md');
const STATE = resolveWorkspaceState(ROOT);

const { id: UNIVERSITY, config: cfg } = resolveUniversity(ROOT, optionValue(ARGV, 'university'));
const EX = cfg.extract;
const assetCatalog = JSON.parse(fs.readFileSync(ASSET_CATALOG_PATH, 'utf8'));
if (!Array.isArray(assetCatalog.files)) {
  throw new Error(`${ASSET_CATALOG_PATH} debe contener un arreglo "files".`);
}
const CURATED_ASSETS = assetCatalog.scope === EX.assetCatalogScope
  ? [...new Set(assetCatalog.files)]
  : [];

const deaccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// ─── diccionario de variables ───────────────────────────────────────────────

/** SOH es parte del token de emBlue. Nunca convertirlo a espacio o texto. */
const SOH = '\x01';

function normalizeVariableName(value) {
  return deaccent(String(value || '').toLowerCase()).replace(/[^a-z0-9]+/g, '');
}

/** Quita ids y separadores del ESP viejo: `32#Programa` → `Programa`. */
function legacyVariableName(value) {
  const raw = String(value || '').trim();
  const afterId = raw.includes('#') ? raw.slice(raw.lastIndexOf('#') + 1) : raw;
  return afterId.replace(/^[\s._:#-]+/, '').trim();
}

/**
 * Cada línea útil de variables.md contiene un token completo. El valor se
 * conserva byte por byte para no perder SOH (0x01).
 */
function loadVariableDictionary() {
  if (!fs.existsSync(VARIABLE_DICTIONARY_PATH)) {
    throw new Error(`No encuentro el diccionario ${VARIABLE_DICTIONARY_PATH}`);
  }

  const entries = [];
  const seen = new Set();
  for (const line of fs.readFileSync(VARIABLE_DICTIONARY_PATH, 'utf8').split(/\r?\n/)) {
    const match = line.match(/\{\$[^}\r\n]+\}/);
    if (!match || seen.has(match[0])) continue;
    seen.add(match[0]);

    const token = match[0];
    const inner = token.slice(2, -1);
    const parts = inner.split(SOH);
    const name = parts[parts.length - 1].trim();
    entries.push({
      token,
      name,
      nameKey: normalizeVariableName(name),
      fullKey: normalizeVariableName(inner),
    });
  }

  if (entries.length === 0) {
    throw new Error(`${VARIABLE_DICTIONARY_PATH} no contiene variables con formato {$...}`);
  }
  return entries;
}

const VARIABLE_DICTIONARY = loadVariableDictionary();

/** Extrae `$BF{...}` y `${BF...}` sin alterar su grafía original. */
function legacyVariables(text) {
  const found = new Map();
  for (const match of text.matchAll(/\$BF\{([^}]*)\}|\$\{BF([^}]*)\}/gi)) {
    if (!found.has(match[0])) {
      found.set(match[0], legacyVariableName(match[1] ?? match[2]));
    }
  }
  return [...found].map(([source, name]) => ({ source, name }));
}

function dictionaryExact(value) {
  const key = normalizeVariableName(value);
  return VARIABLE_DICTIONARY.find((entry) => entry.nameKey === key || entry.fullKey === key);
}

/**
 * Resuelve primero por nombre, luego por el alias histórico de config y por
 * último elige la entrada más cercana. Los empates respetan el orden del
 * diccionario para que el resultado sea estable y editable por el usuario.
 */
function mapVariable(name) {
  const sourceKey = normalizeVariableName(name);
  const exact = dictionaryExact(name);
  if (exact) return { ...exact, method: 'nombre exacto', score: 1 };

  const configured = (EX.mergeTags || {})[sourceKey];
  const alias = configured && dictionaryExact(configured);
  if (alias) return { ...alias, method: 'alias configurado', score: 1 };

  const ranked = VARIABLE_DICTIONARY
    .map((entry, index) => ({
      ...entry,
      index,
      score: Math.max(
        nameSimilarity(sourceKey, entry.nameKey),
        nameSimilarity(sourceKey, entry.fullKey)
      ),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return { ...ranked[0], method: 'nombre más cercano' };
}

function buildVariableMappings(html) {
  return legacyVariables(html).map(({ source, name }) => ({
    source,
    name,
    replacement: mapVariable(name),
  }));
}

function replaceLegacyVariables(text, mappings) {
  const replacements = new Map(mappings.map((item) => [item.source, item.replacement.token]));
  const translated = text.replace(
    /\$BF\{[^}]*\}|\$\{BF[^}]*\}/gi,
    (source) => replacements.get(source) || source
  );

  return translated.replace(/\{\$[^}\r\n]+\}/g, (token, offset, fullText) => {
    const alreadyBold =
      fullText.slice(Math.max(0, offset - 2), offset) === '**' &&
      fullText.slice(offset + token.length, offset + token.length + 2) === '**';
    return alreadyBold ? token : `**${token}**`;
  });
}

// ─── catálogo de assets ya usados en el repo, indexado por basename ──────────

function buildCatalog(dir, map = new Map()) {
  const canonicalHost = EX.assetBase.split('/')[2];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) buildCatalog(p, map);
    else if (/\.(md|njk)$/.test(e.name)) {
      const txt = fs.readFileSync(p, 'utf8');
      for (const m of txt.matchAll(/https?:\/\/[^\s")<>|]+\.(?:jpe?g|png|gif|webp)/gi)) {
        const url = m[0];
        if (!url.includes(canonicalHost)) continue; // sólo el S3 canónico
        map.set(path.basename(url), url);
      }
    }
  }
  return map;
}

// ─── secciones ───────────────────────────────────────────────────────────────

/** Texto que aporta el layout (header/footer) y por tanto no es contenido. */
function isBoilerplate(text) {
  const norm = deaccent(text.toLowerCase());
  const meaningful = norm
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^\d+$/.test(w));
  if (meaningful.length < 3) return true;
  return (cfg.textCheck.ignore || []).some((p) => norm.includes(deaccent(p.toLowerCase())));
}

/**
 * Trocea el HTML por cambios de color de fondo. Es aproximado —el bgcolor no
 * delimita secciones de forma fiable— pero da la pista de dónde empieza y
 * termina cada bloque visual. El UI-kit manda sobre estos colores.
 *
 * Hay que marcar los cortes ANTES de quitar los tags: si se parte el HTML por
 * la posición del atributo, los tags quedan a medias y ya no se pueden limpiar.
 */
function sections(html) {
  const MARK = '\x00';

  const h = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*bgcolor\s*=\s*"(#[0-9a-fA-F]{6})"[^>]*>/gi,
      (_, col) => MARK + col.toUpperCase() + MARK)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#?\w+;/g, ' ');

  // Queda: texto <MARK>color<MARK> texto … → los índices impares son colores.
  const parts = h.split(MARK);
  const out = [];
  let color = null;

  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      color = part;
      return;
    }
    const text = part.replace(/\s+/g, ' ').trim();
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.color === color) last.text += ' ' + text;
    else out.push({ color, text });
  });

  return out.filter((s) => !isBoilerplate(s.text));
}

// ─── mapeos ──────────────────────────────────────────────────────────────────

const ASSET_NOISE = new Set(['icon', 'img', 'image', 'logo', 'ulatina', 'unapec', 'white', 'wine', 'blue']);

function assetUrl(base) {
  const sub = /logo|icon/i.test(base) ? EX.iconsPath + '/' : '';
  return `${EX.assetBase}/${sub}${base}`;
}

function assetKey(file) {
  let decoded = String(file || '');
  try {
    decoded = decodeURIComponent(decoded);
  } catch (_) {
    // Conservar el nombre original si trae un escape incompleto.
  }
  const stem = path.basename(decoded.split('?')[0], path.extname(decoded.split('?')[0]));
  return deaccent(stem)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part && !ASSET_NOISE.has(part))
    .join('');
}

/** Coeficiente Dice por bigramas: tolera prefijos, guiones y nombres cercanos. */
function nameSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const counts = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const pair = a.slice(i, i + 2);
    counts.set(pair, (counts.get(pair) || 0) + 1);
  }
  let overlap = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const pair = b.slice(i, i + 2);
    const available = counts.get(pair) || 0;
    if (!available) continue;
    overlap++;
    counts.set(pair, available - 1);
  }
  return (2 * overlap) / (a.length + b.length - 2);
}

function similarAssets(base) {
  const sourceKey = assetKey(base);
  return CURATED_ASSETS
    .filter((file) => !EX.frameworkAssets.includes(file))
    .map((file) => ({
      file,
      url: assetUrl(file),
      score: nameSimilarity(sourceKey, assetKey(file)),
    }))
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file, 'es'));
}

function mapAsset(url, catalog) {
  const base = path.basename(url.split('?')[0]);

  if (EX.frameworkAssets.includes(base)) {
    return { base, action: 'omitir', note: 'lo provee el header/footer/preset del framework' };
  }
  if (catalog.has(base)) {
    return { base, action: 'usar', url: catalog.get(base), note: 'ya está en el repo' };
  }

  const exact = CURATED_ASSETS.find((file) => file.toLowerCase() === base.toLowerCase());
  if (exact) {
    return { base, action: 'usar', url: assetUrl(exact), note: 'coincidencia exacta en el catálogo de la skill' };
  }

  const ranked = similarAssets(base);
  const best = ranked[0];
  const second = ranked[1];
  if (best && best.score >= 0.72 && best.score - (second ? second.score : 0) >= 0.08) {
    return {
      base,
      action: 'sugerir',
      url: best.url,
      note: `nombre similar a ${best.file} (${Math.round(best.score * 100)}%); usar sólo si coincide con el contexto`,
    };
  }

  if (best && best.score >= 0.45) {
    const floor = Math.max(0.45, best.score - 0.12);
    return {
      base,
      action: 'elegir',
      candidates: ranked.filter((item) => item.score >= floor).slice(0, 3),
      note: 'coincidencia ambigua; decidir por el contenido de la sección',
    };
  }

  return {
    base,
    action: 'verificar',
    url: assetUrl(base),
    note: 'no está en el repo — confirmar que exista en S3',
  };
}

function mapLink(href) {
  if (/^mailto:|^tel:/i.test(href)) {
    return { href, action: 'omitir', note: 'el footer ya trae los datos de contacto' };
  }
  if (/api\.whatsapp\.com/i.test(href)) {
    const num = (href.match(/phone=(\d+)/) || [])[1];
    const stale = num && num !== EX.canonicalWhatsapp;
    return {
      href,
      action: stale ? 'sustituir' : 'usar',
      note: stale
        ? `número caduco (${num}) → usar ${EX.canonicalWhatsapp} con el preset buttonWA`
        : 'número vigente; usar el preset buttonWA',
    };
  }
  return { href, action: 'usar', note: '' };
}

// ─── brief ───────────────────────────────────────────────────────────────────

function buildBrief(file, catalog) {
  const html = fs.readFileSync(file, 'utf8');
  const name = path.basename(file, '.html');

  const variableMappings = buildVariableMappings(html);
  const secs = sections(html).map((section) => ({
    ...section,
    text: replaceLegacyVariables(section.text, variableMappings),
  }));
  const imgs = [...new Set([...html.matchAll(/src\s*=\s*"([^"]+)"/gi)].map((m) => m[1]))];
  const links = [...new Set([...html.matchAll(/href\s*=\s*"([^"]+)"/gi)].map((m) => m[1]))];

  const L = [];
  L.push(`# Brief · ${name}`);
  L.push('');
  L.push(`Origen: \`${path.relative(ROOT, file)}\``);
  L.push('');

  L.push('## Contenido por sección');
  L.push('');
  L.push('> El texto va literal, sin reescribir. El color es sólo una pista del');
  L.push('> original: manda el UI-kit. El header y el footer ya no aparecen aquí.');
  L.push('');
  secs.forEach((s, i) => {
    L.push(`**${i + 1}.** ${s.color ? `fondo \`${s.color}\`` : '_(sin fondo declarado)_'}`);
    L.push('');
    L.push(s.text);
    L.push('');
  });

  L.push('## Imágenes');
  L.push('');
  L.push('| archivo | qué hacer | destino |');
  L.push('|---|---|---|');
  for (const u of imgs) {
    const a = mapAsset(u, catalog);
    const destination = a.url
      ? `\`${a.url}\``
      : a.candidates
        ? a.candidates.map((item) => `\`${item.url}\` (${Math.round(item.score * 100)}%)`).join('<br>')
        : '—';
    L.push(`| \`${a.base}\` | **${a.action}** — ${a.note} | ${destination} |`);
  }
  L.push('');

  L.push('## Enlaces');
  L.push('');
  L.push('| destino | qué hacer |');
  L.push('|---|---|');
  for (const h of links) {
    const l = mapLink(h);
    const short = h.length > 70 ? h.slice(0, 67) + '…' : h;
    L.push(`| \`${short}\` | **${l.action}**${l.note ? ` — ${l.note}` : ''} |`);
  }
  L.push('');

  if (variableMappings.length) {
    L.push('## Merge tags');
    L.push('');
    L.push('> Los reemplazos ya están aplicados en «Contenido por sección».');
    L.push('> Los tokens conservan exactamente el byte SOH (0x01) del diccionario.');
    L.push('');
    L.push('| origen | reemplazo | criterio |');
    L.push('|---|---|---|');
    for (const item of variableMappings) {
      const rep = item.replacement;
      const criterion = rep.method === 'nombre más cercano'
        ? `${rep.method} (${Math.round(rep.score * 100)}%)`
        : rep.method;
      L.push(`| \`${item.source}\` | \`${rep.token}\` | ${criterion} |`);
    }
    L.push('');
  }

  return L.join('\n');
}

// ─── main ────────────────────────────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2);
  const requestedOutDir = optionValue(argv, 'out');
  const all = argv.includes('--all');
  const outDir = requestedOutDir
    ? path.resolve(ROOT, requestedOutDir)
    : all
      ? STATE.briefsDir
      : null;
  const targets = argv.filter((a) => a.toLowerCase().endsWith('.html'));

  if (argv.includes('--help')) {
    console.log(`
extract.js — reduce HTML viejos a briefs compactos

  --root <ruta>  Raíz del repositorio que se procesará.
                 (default: directorio de trabajo actual)
  --university <id> Universidad; si se omite, se autodetecta.
  --all          Procesa todos los .html del nivel superior de src/ y guarda
                 los briefs en el estado privado de la skill.
  --out <ruta>   Sobrescribe la carpeta de salida (admite ruta absoluta).
  --help         Esta ayuda.

También puedes pasar uno o más archivos .html en lugar de --all.
`);
    process.exit(0);
  }

  if (!all && targets.length === 0) {
    console.error('\nUso: extract.js [--root <repo>] <archivo.html> | --all [--out <dir>]\n');
    process.exit(1);
  }

  const files = all
    ? fs
        .readdirSync(SRC, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.html'))
        .map((e) => path.join(SRC, e.name))
        .sort((a, b) => a.localeCompare(b, 'es'))
    : targets.map((t) => path.resolve(ROOT, t));

  if (files.length === 0) {
    console.error('\nNo hay .html en src/.\n');
    process.exit(1);
  }

  const catalog = buildCatalog(SRC);
  console.log(`  Universidad: ${UNIVERSITY}`);

  if (outDir && !requestedOutDir) {
    ensureWorkspaceState(STATE);
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error(`No existe: ${f}`);
      continue;
    }
    const brief = buildBrief(f, catalog);

    if (outDir) {
      fs.mkdirSync(outDir, { recursive: true });
      const dest = path.join(outDir, path.basename(f, '.html') + '.brief.md');
      fs.writeFileSync(dest, brief, 'utf8');
      const before = fs.statSync(f).size;
      const after = Buffer.byteLength(brief);
      console.log(
        `  ✓ ${path.basename(dest)}  ${(before / 1024).toFixed(1)}KB → ${(after / 1024).toFixed(1)}KB` +
          `  (-${Math.round((1 - after / before) * 100)}%)`
      );
    } else {
      console.log(brief);
    }
  }
}

main();
