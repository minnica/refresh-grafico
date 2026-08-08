#!/usr/bin/env node
'use strict';

/**
 * prepare.js — Prepara el lote de emails para el flujo REFRESH GRÁFICO.
 *
 * Toma los .html sueltos que dejaste en src/ y, por cada uno, crea el .md
 * destino con el frontmatter ya resuelto (layout, headerConfig, footerConfig,
 * permalink) y el import de configuración. El cuerpo queda vacío: eso es lo
 * único que le toca hacer a la IA después.
 *
 * También emite .prepare/manifest.json con los pares origen → destino, que es
 * lo que consume el paso de conversión.
 *
 * Uso:
 *   node /ruta/a/la/skill/scripts/prepare.js --root /ruta/al/repo --dest src/maestrias/retencion
 *   node /ruta/a/la/skill/scripts/prepare.js --root /ruta/al/repo --dest src/maestrias/ventas --dry
 *   node /ruta/a/la/skill/scripts/prepare.js --root /ruta/al/repo --dest src/maestrias/retencion --permalink maestrias/retencion/funnel
 *   node /ruta/a/la/skill/scripts/prepare.js --root /ruta/al/repo --dest src/maestrias/retencion --print
 *
 * Sin dependencias: corre con node puro, aunque node_modules no esté instalado.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(parseArgs(process.argv.slice(2)).opts.root || process.cwd());
const CONFIG_PATH = path.join(__dirname, 'prepare.config.json');
const MANIFEST_PATH = path.join(ROOT, '.prepare', 'manifest.json');

const HELP = `
prepare.js — prepara el lote de .md para el flujo REFRESH GRÁFICO

  --root <ruta>        Raíz del repositorio que se procesará.
                       (default: directorio de trabajo actual)
  --dest <ruta>        Carpeta src/ donde se crean los .md.   (obligatorio)
                       Ej: src/maestrias/retencion
  --from <ruta>        Carpeta donde están los .html sueltos. (default: src)
  --permalink <base>   Sobrescribe el permalinkBase del perfil.
                       Ej: maestrias/retencion/funnel
  --only <texto>       Procesa sólo los .html cuyo nombre contenga <texto>.
  --dry                No escribe nada; sólo muestra qué haría.
  --force              Sobrescribe los .md que ya existen.
                       ⚠️  Reemplaza el archivo COMPLETO: si ya tenía
                           contenido generado, se pierde.
  --print              Imprime las líneas "Con este X genera este Y"
                       (compatible con el flujo manual actual).
  --help               Esta ayuda.
`;

// ─── args ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { flags: new Set(), opts: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.opts[key] = next;
      i++;
    } else {
      args.flags.add(key);
    }
  }
  return args;
}

// ─── config ──────────────────────────────────────────────────────────────────

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fail(`No encuentro ${rel(CONFIG_PATH)}`);
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    fail(`${rel(CONFIG_PATH)} no es JSON válido: ${e.message}`);
  }
}

/**
 * Busca el perfil de `dest`. Si no hay match exacto, hereda del ancestro más
 * cercano: así una subcarpeta nueva (src/maestrias/retencion/enrolled) toma
 * el perfil de su padre sin tener que declararla.
 */
function resolveProfile(dest, config) {
  const norm = dest.replace(/\/+$/, '');
  if (config.profiles[norm]) {
    return { profile: config.profiles[norm], matchedOn: norm, inherited: false };
  }
  const candidates = Object.keys(config.profiles)
    .filter((p) => norm.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length);

  if (candidates.length === 0) {
    fail(
      `No hay perfil para "${norm}".\n` +
        `  Perfiles disponibles:\n` +
        Object.keys(config.profiles).map((p) => `    ${p}`).join('\n') +
        `\n  Agrega uno nuevo en ${rel(CONFIG_PATH)} o usa una subcarpeta de los anteriores.`
    );
  }
  return { profile: config.profiles[candidates[0]], matchedOn: candidates[0], inherited: true };
}

// ─── generación ──────────────────────────────────────────────────────────────

/** Replica exactamente el formato de frontmatter de los .md existentes. */
function buildSkeleton(profile, permalink, importLine) {
  return [
    '---',
    `layout: ${profile.layout}`,
    '# Header Config',
    `headerConfig: "${profile.headerConfig}"`,
    `permalink: "${permalink}"`,
    '# Footer Config',
    `footerConfig: "${profile.footerConfig}"`,
    `isResponsive: ${profile.isResponsive}`,
    '---',
    importLine,
    '',
    '', // línea en blanco: separa el import del primer {%- setBlock -%}
  ].join('\n');
}

/** Caracteres que obligan a citar rutas en shell (el repo está lleno de ellos). */
function nameWarnings(name) {
  const w = [];
  if (/\s/.test(name)) w.push('espacios');
  if (/[+&#?%]/.test(name)) w.push('caracteres especiales');
  if (/[áéíóúÁÉÍÓÚñÑüÜ]/.test(name)) w.push('acentos');
  return w;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Ruta relativa al repo; absoluta si el path vive fuera de él. */
const rel = (p) => {
  const r = path.relative(ROOT, p);
  return !r ? p : r.startsWith('..') ? p : r;
};
const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function fail(msg) {
  console.error(`\n${c.red('✖')} ${msg}\n`);
  process.exit(1);
}

// ─── main ────────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.flags.has('help') || process.argv.length === 2) {
    console.log(HELP);
    process.exit(0);
  }

  const dest = args.opts.dest;
  if (!dest) fail('Falta --dest. Usa --help para ver el uso.');

  const config = loadConfig();
  const { profile, matchedOn, inherited } = resolveProfile(dest, config);

  const fromDir = path.resolve(ROOT, args.opts.from || 'src');
  const destDir = path.resolve(ROOT, dest);
  const permalinkBase = (args.opts.permalink || profile.permalinkBase).replace(/\/+$/, '');
  const dry = args.flags.has('dry');
  const force = args.flags.has('force');

  if (!fs.existsSync(fromDir)) fail(`La carpeta origen no existe: ${rel(fromDir)}`);

  // Sólo el nivel superior de fromDir: son los .html que copiaste a mano.
  let htmlFiles = fs
    .readdirSync(fromDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.html'))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, 'es'));

  if (args.opts.only) {
    const needle = args.opts.only.toLowerCase();
    htmlFiles = htmlFiles.filter((n) => n.toLowerCase().includes(needle));
  }

  if (htmlFiles.length === 0) {
    fail(
      `No hay .html en ${rel(fromDir)}${args.opts.only ? ` que contengan "${args.opts.only}"` : ''}.\n` +
        `  Copia ahí los HTML viejos que te pasó Nurturing y vuelve a correr.`
    );
  }

  // ── cabecera del reporte ──
  console.log('');
  console.log(`  ${c.bold('Lote:')}      ${htmlFiles.length} html en ${c.bold(rel(fromDir))}`);
  console.log(`  ${c.bold('Destino:')}   ${rel(destDir)}`);
  console.log(`  ${c.bold('Permalink:')} ${permalinkBase}/`);
  console.log(
    `  ${c.bold('Perfil:')}    ${profile.layout} · ${profile.headerConfig} · ${profile.footerConfig}` +
      (inherited ? c.yellow(`  (heredado de ${matchedOn})`) : '')
  );
  if (inherited && !args.opts.permalink) {
    console.log(
      c.yellow(
        `             ⚠ Subcarpeta nueva: hereda el permalink del padre.\n` +
          `               Si debe apuntar a otra ruta, usa --permalink.`
      )
    );
  }
  if (dry) console.log(`  ${c.yellow('--dry: no se escribe nada')}`);
  console.log('');

  // ── generación ──
  const pairs = [];
  const warnings = [];
  let created = 0;
  let skipped = 0;
  let overwritten = 0;

  if (!dry) fs.mkdirSync(destDir, { recursive: true });

  for (const htmlName of htmlFiles) {
    const base = htmlName.replace(/\.html$/i, '');
    const mdPath = path.join(destDir, `${base}.md`);
    const permalink = `${permalinkBase}/${base}.html`;
    const exists = fs.existsSync(mdPath);

    let status;
    if (exists && !force) {
      status = 'skipped';
      skipped++;
    } else {
      status = exists ? 'overwritten' : 'created';
      if (exists) overwritten++;
      else created++;
      if (!dry) fs.writeFileSync(mdPath, buildSkeleton(profile, permalink, config.importLine), 'utf8');
    }

    const warns = nameWarnings(base);
    if (warns.length) warnings.push({ name: base, warns });

    pairs.push({
      html: rel(path.join(fromDir, htmlName)),
      md: rel(mdPath),
      permalink,
      status,
    });

    const mark =
      status === 'created' ? c.green('+') : status === 'overwritten' ? c.yellow('↻') : c.dim('·');
    const label = status === 'skipped' ? c.dim(`${base}.md  (ya existe, sin tocar)`) : `${base}.md`;
    console.log(`  ${mark} ${label}`);
  }

  // ── avisos de nombres ──
  if (warnings.length) {
    console.log('');
    console.log(c.yellow(`  ⚠ ${warnings.length} nombre(s) con caracteres que rompen el shell:`));
    for (const w of warnings) {
      console.log(c.yellow(`    ${w.name}  →  ${w.warns.join(', ')}`));
    }
    console.log(c.dim('    Se respetan tal cual (así lo hacen los .md existentes). Cita las rutas en bash.'));
  }

  // ── manifest ──
  const manifest = {
    generatedAt: new Date().toISOString(),
    from: rel(fromDir),
    dest: rel(destDir),
    permalinkBase,
    profile,
    pairs,
  };

  if (!dry) {
    fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  }

  // ── resumen ──
  console.log('');
  const parts = [];
  if (created) parts.push(c.green(`${created} creados`));
  if (overwritten) parts.push(c.yellow(`${overwritten} sobrescritos`));
  if (skipped) parts.push(c.dim(`${skipped} omitidos`));
  console.log(`  ${parts.join('  ·  ')}`);

  if (skipped && !force) {
    console.log(c.dim(`  Los omitidos ya existían. Usa --force para reemplazarlos (borra su contenido).`));
  }
  if (!dry) console.log(c.dim(`  Manifest: ${rel(MANIFEST_PATH)}`));
  console.log('');

  // ── listado en texto, para el flujo manual ──
  if (args.flags.has('print')) {
    console.log(c.dim('  ── pares origen → destino ──'));
    console.log('');
    for (const p of pairs) {
      console.log(`Con este ${p.html} genera este ${p.md}`);
    }
    console.log('');
  }
}

main();
