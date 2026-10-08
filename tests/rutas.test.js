'use strict';
// Toda la funcionalidad, probada (Roberto, 2026-10-09): cada ruta de la API del servidor aparece en al menos un test
// de Node. Si se añade una ruta sin su test, esto falla y la CI lo para.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const rutas = [...new Set([...fs.readFileSync(path.join(raiz, 'servidor.js'), 'utf8').matchAll(/p === '(\/api\/[\w/.-]+)'/g)].map(m => m[1]))].sort();
const tests = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && f !== 'rutas.test.js').map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');

test('el servidor tiene rutas de API que comprobar', () => assert.ok(rutas.length >= 20, `solo ${rutas.length} rutas`));

test('cada ruta de la API sale en un test de Node', () => {
  const sin = rutas.filter(r => !new RegExp(`['\`]${r.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?=[?'\`])`).test(tests));
  assert.deepEqual(sin, [], `rutas sin test: ${sin.join(', ')}`);
});
