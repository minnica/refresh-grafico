#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { resolveContentProfile, resolveUniversity } = require('./config');
const { ensureWorkspaceState, resolveWorkspaceState, writeJsonAtomic } = require('./runtime');

function optionValue(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
}

function decodeXml(value) {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function paragraphs(docx) {
  const xml = execFileSync('unzip', ['-p', docx, 'word/document.xml'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((match) => {
    const p = match[0];
    const text = [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g)]
      .map((part) => part[1] !== undefined ? decodeXml(part[1]) : part[0].startsWith('<w:tab') ? '\t' : '\n').join('')
      .replace(/[\u2028\u2029]/g, '\n').trim();
    return /<w:numPr>/.test(p) && text ? `- ${text}` : text;
  }).filter(Boolean);
}

function safeName(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
}

function quoteYaml(value) {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function canonicalize(text, replacements) {
  let out = text;
  for (const [source, target] of Object.entries(replacements || {})) out = out.split(source).join(target);
  return out.replace(/\{\$[^}\r\n]+\}/g, (token, offset, all) => {
    const bold = all.slice(Math.max(0, offset - 2), offset) === '**' && all.slice(offset + token.length, offset + token.length + 2) === '**';
    return bold ? token : `**${token}**`;
  });
}

function splitEmails(lines) {
  const starts = lines.map((line, index) => /^Subject:\s*/i.test(line) ? index : -1).filter((index) => index >= 0);
  const groups = [];
  for (let i = 0; i < starts.length; i++) groups.push(lines.slice(starts[i], starts[i + 1] || lines.length));
  return groups;
}

function parseEmail(lines, replacements) {
  const subjects = lines.filter((line) => /^Subject(?:\s*2)?:/i.test(line)).map((line) => line.replace(/^Subject(?:\s*2)?:\s*(?:1:\s*)?/i, '').trim());
  const preheader = (lines.find((line) => /^Preencabezado:/i.test(line)) || '').replace(/^Preencabezado:\s*/i, '').trim();
  const copyIndex = lines.findIndex((line) => /^Copy\s*:/i.test(line));
  if (copyIndex < 0) throw new Error('Un bloque Subject no contiene línea Copy:.');
  const label = lines[copyIndex].replace(/^Copy\s*:\s*/i, '').trim();
  const body = [];
  for (const line of lines.slice(copyIndex + 1)) {
    if (/^FOOTER\b/i.test(line) || /^¿Tienes dudas\?/i.test(line)) break;
    if (/^LOGO(?:\s+UNAPEC)?$/i.test(line) || /^CTA:\s*/i.test(line)) continue;
    body.push(canonicalize(line, replacements));
  }
  return { label: safeName(label), subjects, preheader, body };
}

function skeleton(profile, permalink, importLine, email) {
  const lines = ['---', `layout: ${profile.layout}`, '# Header Config', `headerConfig: "${profile.headerConfig}"`, `permalink: "${permalink}"`, '# Footer Config', `footerConfig: "${profile.footerConfig}"`, `isResponsive: ${profile.isResponsive}`];
  email.subjects.forEach((subject, index) => lines.push(`subject${index + 1}: ${quoteYaml(subject)}`));
  if (email.preheader) lines.push(`preheader: ${quoteYaml(email.preheader)}`);
  lines.push('---', importLine, '', '');
  return lines.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const root = path.resolve(optionValue(argv, 'root') || process.cwd());
  const source = path.resolve(root, optionValue(argv, 'source') || '');
  const dest = optionValue(argv, 'dest');
  if (!source || !dest) throw new Error('Usa --source <archivo.docx> --dest <carpeta>.');
  if (!fs.existsSync(source)) throw new Error(`No existe ${source}`);
  const { id: university, config } = resolveUniversity(root, optionValue(argv, 'university'));
  const { profile } = resolveContentProfile(dest, config);
  const state = resolveWorkspaceState(root);
  const emails = splitEmails(paragraphs(source)).map((group) => parseEmail(group, (config.docx || {}).replacements));
  if (!emails.length) throw new Error('No se detectaron bloques que comiencen con Subject:.');
  fs.mkdirSync(path.resolve(root, dest), { recursive: true });
  ensureWorkspaceState(state);
  fs.rmSync(state.briefsDir, { recursive: true, force: true });
  fs.mkdirSync(state.briefsDir, { recursive: true });
  const pairs = [];
  for (const email of emails) {
    const md = path.posix.join(dest.replace(/\\/g, '/'), `${email.label}.md`);
    const permalink = `${profile.permalinkBase.replace(/\/+$/, '')}/${email.label}.html`;
    const file = path.resolve(root, md);
    if (fs.existsSync(file) && !argv.includes('--force')) throw new Error(`Ya existe ${md}; usa --force para reemplazarlo.`);
    fs.writeFileSync(file, skeleton(profile, permalink, config.importLine, email), 'utf8');
    const brief = path.join(state.briefsDir, `${email.label}.brief.md`);
    fs.writeFileSync(brief, `# Brief · ${email.label}\n\nOrigen: \`${path.relative(root, source)}\`\n\n## Metadatos\n\n${email.subjects.map((s, i) => `- Subject ${i + 1}: ${s}`).join('\n')}\n- Preencabezado: ${email.preheader}\n\n## Contenido literal\n\n${email.body.join('\n\n')}\n`, 'utf8');
    pairs.push({ source: path.relative(root, source), brief, md, permalink, status: 'created' });
  }
  writeJsonAtomic(state.manifestPath, { schemaVersion: 3, generatedAt: new Date().toISOString(), repoRoot: state.repoRoot, branch: state.branch, university, sourceType: 'docx', source: path.relative(root, source), dest, permalinkBase: profile.permalinkBase, profile, pairs });
  console.log(`✓ ${emails.length} emails preparados desde DOCX · universidad: ${university}`);
  console.log(`  Manifest: ${state.manifestPath}`);
}

try { main(); } catch (error) { console.error(`\n✖ ${error.message}\n`); process.exit(1); }
