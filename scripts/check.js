#!/usr/bin/env node
'use strict';

/**
 * check.js — Valida los .md de contenido antes de compilar.
 *
 * 11ty no valida nada de esto: un .md con una clase CSS inexistente o un merge
 * tag del ESP viejo compila sin quejarse y el error sólo aparece inspeccionando
 * el HTML de salida (o cuando le llega al estudiante). Estas reglas nacieron de
 * errores reales encontrados en ese HTML compilado.
 *
 * Uso:
 *   node /ruta/a/la/skill/scripts/check.js --root /ruta/al/repo
 *   node /ruta/a/la/skill/scripts/check.js --root /ruta/al/repo --only masters
 *   node /ruta/a/la/skill/scripts/check.js --root /ruta/al/repo --rule css
 *   node /ruta/a/la/skill/scripts/check.js --root /ruta/al/repo --quiet
 *
 * Sale con código 1 si hay errores (los avisos no rompen).
 */

const fs = require('fs');
const path = require('path');
const { formatWithInstalledExtension } = require('./format');

function optionValue(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
}

const ROOT = path.resolve(optionValue(process.argv.slice(2), 'root') || process.cwd());
const SRC = path.join(ROOT, 'src');
const CONFIG_PATH = path.join(__dirname, 'prepare.config.json');

// Carpetas de src/ que no son contenido.
const NOT_CONTENT = new Set(['_includes', '_layouts', '_content', '_data']);

// Dominio canónico de assets. Todo lo demás se reporta.
const CANONICAL_ASSET_HOST = 'ap-university-storage.s3.us-east-1.amazonaws.com';

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

// ─── universo de clases CSS válidas ──────────────────────────────────────────

/**
 * La fuente de verdad son dos: el CSS que se inlinea (public/css/styles.css,
 * generado por el build) y las hojas que 11ty inyecta dentro de <style>.
 */
function loadValidClasses() {
  const files = [
    path.join(ROOT, 'public', 'css', 'styles.css'),
    path.join(SRC, '_includes', 'css', 'base', 'general.scss'),
    path.join(SRC, '_includes', 'css', 'base', 'responsive.scss'),
    path.join(SRC, '_includes', 'css', 'base', 'dark_mode.scss'),
  ];

  const classes = new Set();
  let stylesCssFound = false;

  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    if (f.endsWith('styles.css')) stylesCssFound = true;
    const css = fs.readFileSync(f, 'utf8');
    for (const m of css.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) classes.add(m[1]);
  }

  return { classes, stylesCssFound };
}

// ─── extracción de lo que usa un .md ─────────────────────────────────────────

/** Devuelve [{ cls, line }] con todas las clases que el .md aplica. */
function extractUsedClasses(text) {
  const out = [];
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    const n = i + 1;

    // 1) Bloques de markdown-it-attrs: {.fs-22 .ulatina-base-color .d-left}
    //    Sólo los que empiezan con punto — así no confundimos {$mergeTag}.
    for (const blk of line.matchAll(/\{\s*(\.[^}]*)\}/g)) {
      for (const m of blk[1].matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) {
        out.push({ cls: m[1], line: n });
      }
    }

    // 2) class: "white-bg-color"  (dentro del config de setBlock)
    for (const m of line.matchAll(/class:\s*"([^"]+)"/g)) {
      m[1].split(/\s+/).filter(Boolean).forEach((cls) => out.push({ cls, line: n }));
    }

    // 3) class: d-center  (argumento suelto de un item del DSL)
    for (const m of line.matchAll(/class:\s*([A-Za-z_][\w-]*)/g)) {
      out.push({ cls: m[1], line: n });
    }
  });

  return out;
}

// ─── comparación de texto: HTML origen vs .md convertido ─────────────────────

/**
 * El objetivo es cazar contenido perdido o inventado en la conversión. Ambos
 * lados se reducen a texto plano y se comparan por cobertura de palabras.
 */

/** Merge tags de cualquiera de los dos ESP: no son comparables entre sí. */
const MERGE_TAGS = /\$?\w*\{\$?[^}]*\}/g;

function stripHtml(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/gi, ' ');
}

/**
 * Ojo con el orden: los enlaces markdown deben resolverse ANTES de borrar las
 * URLs, porque al quitar la URL queda un "[texto](" sin cerrar cuyo paréntesis
 * se comería todo el texto hasta el siguiente ")".
 */
function stripMd(md) {
  return md
    .replace(/^---[\s\S]*?\n---/, ' ')
    .replace(/\{%[\s\S]*?%\}/g, ' ')
    .replace(/^-:\s*\w*\s*(@[^|\n]*)?\|/gm, ' ')
    .replace(/:-/g, ' ')
    .replace(/\[([^\]\n]*)\]\([^)\n]*\)/g, '$1')
    .replace(/\{\.[^}\n]*\}/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_#>|]/g, ' ');
}

function normalizeText(s) {
  return s
    .replace(MERGE_TAGS, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palabras significativas: descarta números sueltos (teléfonos, años). */
const words = (s) => normalizeText(s).split(' ').filter((w) => w && !/^\d+$/.test(w));

function sentences(plain, minWords) {
  return plain
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => ({ raw: s.trim(), w: words(s) }))
    .filter((s) => s.w.length >= minWords);
}

/** Fracción de palabras de la oración presentes en el otro documento. */
function coverage(sentenceWords, otherWordSet) {
  const hit = sentenceWords.filter((w) => otherWordSet.has(w)).length;
  return hit / sentenceWords.length;
}

function eachLine(text, re, fn) {
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(re)) fn(m, i + 1, line);
  });
}

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_][\w]*):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return fm;
}

/** Perfil esperado según la carpeta del archivo (hereda del ancestro más cercano). */
function profileFor(relDir, profiles) {
  const keys = Object.keys(profiles)
    .filter((p) => relDir === p || relDir.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length);
  return keys.length ? profiles[keys[0]] : null;
}

// ─── reglas ──────────────────────────────────────────────────────────────────

function runRules(file, text, ctx) {
  const findings = [];
  const add = (rule, sev, line, msg, hint) =>
    findings.push({ rule, sev, line, msg, hint });

  const rel = path.relative(ROOT, file);
  const relDir = path.dirname(path.relative(ROOT, file)).replace(/\\/g, '/');
  const base = path.basename(file, '.md');

  // R1 — clases CSS que no existen en ninguna hoja.
  if (ctx.wants('css') && ctx.stylesCssFound) {
    const seen = new Set();
    for (const { cls, line } of extractUsedClasses(text)) {
      if (ctx.validClasses.has(cls)) continue;
      const key = `${cls}@${line}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Sugerencia: el olvido típico es el sufijo -color.
      let hint;
      if (ctx.validClasses.has(cls + '-color')) hint = `¿querías .${cls}-color?`;
      else {
        const near = [...ctx.validClasses].find(
          (v) => v.replace(/-/g, '') === cls.replace(/-/g, '')
        );
        if (near) hint = `¿querías .${near}?`;
      }
      add('css', 'error', line, `clase inexistente .${cls} — no aplica ningún estilo`, hint);
    }
  }

  // R2 — merge tags del ESP viejo. markdown-it-attrs se come el {...} y deja
  //      el prefijo suelto como texto visible en el correo.
  if (ctx.wants('mergetag')) {
    eachLine(text, /\$[A-Za-z]{1,6}\{[^}]*\}|\$\{BF[^}]*\}/gi, (m, line) => {
      add('mergetag', 'error', line, `merge tag del ESP viejo: ${m[0]}`,
        'markdown-it-attrs se comerá las llaves y dejará el prefijo como texto visible');
    });

    eachLine(text, /\{\$[^}\n]+\}/g, (m, line, sourceLine) => {
      const start = m.index;
      const end = start + m[0].length;
      const isBold = sourceLine.slice(Math.max(0, start - 2), start) === '**' &&
        sourceLine.slice(end, end + 2) === '**';
      if (!isBold) {
        add('mergetag', 'error', line, `variable sin negrita: ${m[0]}`,
          `usa **${m[0]}** y conserva intactos todos sus caracteres`);
      }
    });
  }

  // R3 — assets fuera del dominio canónico.
  if (ctx.wants('assets')) {
    eachLine(text, /https?:\/\/([^/\s")<>|]+)\/[^\s")<>|]+\.(?:jpe?g|png|gif|webp)/gi, (m, line) => {
      if (m[1] === CANONICAL_ASSET_HOST) return;
      add('assets', 'warn', line, `imagen fuera del S3 canónico: ${m[1]}`,
        'debería migrarse a ap-university-storage');
    });
  }

  const fm = parseFrontmatter(text);

  // R4 — el permalink debe apuntar al mismo nombre de archivo.
  if (ctx.wants('permalink') && fm && fm.permalink) {
    const plBase = path.basename(fm.permalink, '.html');
    if (plBase !== base) {
      add('permalink', 'warn', 1, `el permalink no coincide con el nombre del archivo`,
        `archivo "${base}" · permalink "${plBase}"`);
    }
  }

  // R5 — frontmatter contra el perfil de la carpeta.
  if (ctx.wants('frontmatter') && fm) {
    const prof = profileFor(relDir, ctx.profiles);
    if (prof) {
      for (const key of ['layout', 'headerConfig', 'footerConfig']) {
        if (fm[key] !== undefined && String(fm[key]) !== String(prof[key])) {
          add('frontmatter', 'error', 1, `${key}: "${fm[key]}" — se esperaba "${prof[key]}"`,
            `según el perfil de ${relDir}`);
        }
      }
      for (const key of ['layout', 'headerConfig', 'footerConfig', 'permalink']) {
        if (fm[key] === undefined) {
          add('frontmatter', 'error', 1, `falta "${key}" en el frontmatter`);
        }
      }
    }
  }

  // R6 — informativo: .md preparado pero sin convertir todavía.
  if (ctx.wants('vacio') && !/setBlock/.test(text)) {
    add('vacio', 'info', 1, 'sin bloques de contenido — preparado pero sin convertir');
  }

  // R7 — formato exacto de la extensión VT Email DSL instalada.
  if (ctx.wants('format')) {
    try {
      const formatted = formatWithInstalledExtension(text, ctx.formatOptions);
      if (formatted !== text) {
        add('format', 'error', 1, 'el archivo no tiene el formato de VT Email DSL',
          'ejecuta scripts/format.js sobre el manifest antes de validar');
      }
    } catch (error) {
      add('format', 'error', 1, `no se pudo ejecutar VT Email DSL: ${error.message}`);
    }
  }

  // R8 — contenido perdido o inventado, comparando contra el HTML de origen.
  //      Sólo corre si el .html sigue en src/; al borrarlo, la regla se apaga.
  const srcHtml = ctx.sourceHtml.get(base);
  if (ctx.wants('texto') && srcHtml) {
    const origPlain = stripHtml(fs.readFileSync(srcHtml, 'utf8'));
    const mdPlain = stripMd(text);

    const origWords = new Set(words(origPlain));
    const mdWords = new Set(words(mdPlain));

    const skip = (s) => ctx.textIgnore.some((p) => s.includes(p));

    // Contenido del origen que no llegó al .md.
    for (const s of sentences(origPlain, ctx.minWords)) {
      const norm = normalizeText(s.raw);
      if (skip(norm)) continue;
      const cov = coverage(s.w, mdWords);
      if (cov < ctx.threshold) {
        add('texto', 'warn', 1,
          `posible contenido PERDIDO (${Math.round(cov * 100)}% presente): "${s.raw.slice(0, 90)}${s.raw.length > 90 ? '…' : ''}"`,
          `origen: ${path.relative(ROOT, srcHtml)}`);
      }
    }

    // Texto en el .md que no existe en el origen.
    for (const s of sentences(mdPlain, ctx.minWords)) {
      const norm = normalizeText(s.raw);
      if (skip(norm)) continue;
      const cov = coverage(s.w, origWords);
      if (cov < ctx.threshold) {
        add('texto', 'warn', 1,
          `posible contenido AGREGADO (${Math.round(cov * 100)}% en el origen): "${s.raw.slice(0, 90)}${s.raw.length > 90 ? '…' : ''}"`,
          'verifica que sea un cambio intencional');
      }
    }
  }

  return { rel, findings };
}

// ─── recorrido ───────────────────────────────────────────────────────────────

function collectMd(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (dir === SRC && NOT_CONTENT.has(e.name)) continue;
      collectMd(path.join(dir, e.name), acc);
    } else if (e.isFile() && e.name.endsWith('.md')) {
      acc.push(path.join(dir, e.name));
    }
  }
  return acc;
}

// ─── main ────────────────────────────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2);
  const opt = (name) => optionValue(argv, name);
  const has = (name) => argv.includes(`--${name}`);

  if (has('help')) {
    console.log(`
check.js — valida los .md de contenido

  --root <ruta>    Raíz del repositorio que se procesará.
                   (default: directorio de trabajo actual)
  --only <texto>   Sólo los archivos cuya ruta contenga <texto>
  --rule <id>      Sólo una regla: css | mergetag | assets | permalink |
                   frontmatter | vacio | format | texto
  --threshold <n>  Umbral de la regla "texto" (0–1, por defecto 0.6).
                   Más alto = más estricto = más ruido.
  --tab-size <n>   Indentación de VT Email DSL (default: 2).
  --tabs           Valida indentación con tabs en vez de espacios.
  --quiet          Omite los archivos sin hallazgos y los informativos
  --help           Esta ayuda

La regla "texto" compara cada .md contra src/<mismo-nombre>.html y avisa de
contenido perdido o inventado. Si el .html de origen ya no está, no corre.
`);
    process.exit(0);
  }

  const onlyRule = opt('rule');
  const quiet = has('quiet');
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const textCfg = cfg.textCheck || {};

  const ctx = {
    wants: (r) => !onlyRule || onlyRule === r,
    profiles: cfg.profiles,
    threshold: Number(opt('threshold') || textCfg.threshold || 0.6),
    minWords: Number(textCfg.minWords || 5),
    textIgnore: (textCfg.ignore || []).map((s) => normalizeText(s)),
    formatOptions: {
      tabSize: Number(opt('tab-size') || 2),
      insertSpaces: !has('tabs'),
    },
    // HTML de origen indexado por basename: src/<nombre>.html
    sourceHtml: new Map(
      fs
        .readdirSync(SRC, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.html'))
        .map((e) => [e.name.replace(/\.html$/i, ''), path.join(SRC, e.name)])
    ),
  };

  const { classes, stylesCssFound } = loadValidClasses();
  ctx.validClasses = classes;
  ctx.stylesCssFound = stylesCssFound;

  if (!stylesCssFound) {
    console.log(c.yellow('\n  ⚠ No existe public/css/styles.css — la regla de clases CSS queda desactivada.'));
    console.log(c.dim('    Corre `npm run build` para generarlo.\n'));
  }

  let files = collectMd(SRC);
  const filter = opt('only');
  if (filter) files = files.filter((f) => f.toLowerCase().includes(filter.toLowerCase()));
  files.sort((a, b) => a.localeCompare(b, 'es'));

  if (files.length === 0) {
    console.log(c.yellow(`\n  No hay .md que coincidan${filter ? ` con "${filter}"` : ''}.\n`));
    process.exit(0);
  }

  const results = files.map((f) => runRules(f, fs.readFileSync(f, 'utf8'), ctx));

  let errors = 0;
  let warns = 0;
  let infos = 0;
  let filesWith = 0;

  console.log('');
  for (const { rel, findings } of results) {
    const shown = quiet ? findings.filter((f) => f.sev !== 'info') : findings;
    if (shown.length === 0) continue;
    filesWith++;

    console.log(`  ${c.bold(rel)}`);
    for (const f of shown.sort((a, b) => a.line - b.line)) {
      const tag =
        f.sev === 'error' ? c.red('error') : f.sev === 'warn' ? c.yellow('aviso') : c.cyan('info ');
      console.log(`    ${tag} ${c.dim(`L${f.line}`)}  ${f.msg}`);
      if (f.hint) console.log(`          ${c.dim(f.hint)}`);
    }
    console.log('');

    for (const f of findings) {
      if (f.sev === 'error') errors++;
      else if (f.sev === 'warn') warns++;
      else infos++;
    }
  }

  // ── resumen ──
  const parts = [];
  if (errors) parts.push(c.red(`${errors} errores`));
  if (warns) parts.push(c.yellow(`${warns} avisos`));
  if (infos && !quiet) parts.push(c.cyan(`${infos} informativos`));

  console.log(`  ${c.dim('─'.repeat(58))}`);
  if (parts.length === 0) {
    console.log(`  ${c.green('✔')} ${files.length} archivos revisados, sin hallazgos.`);
  } else {
    console.log(`  ${parts.join('  ·  ')}   ${c.dim(`en ${filesWith} de ${files.length} archivos`)}`);
  }
  console.log('');

  process.exit(errors > 0 ? 1 : 0);
}

main();
