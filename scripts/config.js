#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'prepare.config.json');

function loadRegistry() {
  const registry = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  if (!registry.universities || typeof registry.universities !== 'object') {
    throw new Error(`${CONFIG_PATH} no contiene "universities".`);
  }
  return registry;
}

function resolveUniversity(root, requested) {
  const registry = loadRegistry();
  const entries = Object.entries(registry.universities);
  let id = requested && requested.toLowerCase();
  if (id && !registry.universities[id]) {
    throw new Error(`Universidad desconocida "${requested}". Disponibles: ${entries.map(([key]) => key).join(', ')}`);
  }
  if (!id) {
    const detected = entries.filter(([, cfg]) => fs.existsSync(path.join(root, cfg.requiredConfig)));
    if (detected.length !== 1) {
      throw new Error(detected.length === 0
        ? `No se pudo detectar la universidad. Usa --university <${entries.map(([key]) => key).join('|')}>.`
        : `Hay más de una configuración compatible (${detected.map(([key]) => key).join(', ')}). Usa --university.`);
    }
    id = detected[0][0];
  }
  const config = registry.universities[id];
  if (!fs.existsSync(path.join(root, config.requiredConfig))) {
    throw new Error(`El perfil ${id} requiere ${config.requiredConfig}, pero no existe.`);
  }
  return { id, config, registry };
}

function resolveContentProfile(dest, config) {
  const norm = dest.replace(/\\/g, '/').replace(/\/+$/, '');
  if (config.profiles[norm]) return { profile: config.profiles[norm], matchedOn: norm, inherited: false };
  const candidates = Object.keys(config.profiles).filter((p) => norm.startsWith(p + '/')).sort((a, b) => b.length - a.length);
  if (!candidates.length) throw new Error(`No hay perfil de contenido para "${norm}" en la universidad seleccionada.`);
  return { profile: config.profiles[candidates[0]], matchedOn: candidates[0], inherited: true };
}

module.exports = { CONFIG_PATH, loadRegistry, resolveContentProfile, resolveUniversity };
