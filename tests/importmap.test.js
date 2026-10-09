'use strict';
// El import map de public/index.html es la única "resolución de paquetes" de CodeMirror (sin bundler): si un ESM
// importa un paquete que el mapa no tiene, el editor no carga y solo se ve en el navegador. Aquí se recorre a mano.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const NODE_MODULES = path.join(RAIZ, 'node_modules');
const html = fs.readFileSync(path.join(RAIZ, 'public', 'index.html'), 'utf8');
const mapa = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
const aFichero = url => path.join(NODE_MODULES, url.replace(/^\/assets\//, ''));
// Los especificadores de «import … from 'x'», «export … from 'x'» e «import 'x'» al principio de línea.
const RE_IMPORT = /^(?:import|export)\b[^'";]*?from\s*['"]([^'"]+)['"]|^import\s*['"]([^'"]+)['"]/gm;

test('el import map apunta a ficheros que existen y vienen de /assets/', () => {
  assert.ok(Object.keys(mapa).length >= 6);
  for (const [nombre, url] of Object.entries(mapa)) {
    assert.match(url, /^\/assets\//, `${nombre} se sirve desde /assets/`);
    assert.ok(fs.existsSync(aFichero(url)), `${nombre}: no existe ${url}`);
  }
});

test('los seis paquetes directos están en el mapa', () => {
  for (const p of ['@codemirror/state', '@codemirror/view', '@codemirror/language', '@codemirror/lang-markdown', '@codemirror/commands', '@lezer/markdown']) assert.ok(mapa[p], p);
});

test('todo import de cada fichero mapeado (recursivo) y de public/live.js está en el mapa', () => {
  const vistos = new Set(), pendientes = [path.join(RAIZ, 'public', 'live.js'), ...Object.values(mapa).map(aFichero)];
  while (pendientes.length) {
    const f = pendientes.pop();
    if (vistos.has(f)) continue;
    vistos.add(f);
    for (const m of fs.readFileSync(f, 'utf8').matchAll(RE_IMPORT)) {
      const esp = m[1] || m[2];
      if (esp.startsWith('.')) { pendientes.push(path.resolve(path.dirname(f), esp)); continue; }
      assert.ok(mapa[esp], `${path.relative(RAIZ, f)} importa «${esp}» y no está en el import map`);
    }
  }
});

test('no hay copias anidadas de @codemirror ni @lezer (dos copias rompen instanceof entre paquetes)', () => {
  const anidadas = [], paquetes = [];
  for (const e of fs.readdirSync(NODE_MODULES, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('@')) fs.readdirSync(path.join(NODE_MODULES, e.name)).forEach(h => paquetes.push(path.join(NODE_MODULES, e.name, h)));
    else paquetes.push(path.join(NODE_MODULES, e.name));
  }
  for (const dir of paquetes) for (const ambito of ['@codemirror', '@lezer']) if (fs.existsSync(path.join(dir, 'node_modules', ambito))) anidadas.push(path.relative(RAIZ, path.join(dir, 'node_modules', ambito)));
  assert.deepEqual(anidadas, []);
});
