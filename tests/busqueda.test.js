'use strict';
// Las piezas puras de la búsqueda en modal (public/busqueda.js): sin DOM, se prueban en Node.
const test = require('node:test');
const assert = require('node:assert/strict');
const Busqueda = require('../public/busqueda');

test('filas: una por nota, primero las que coinciden por nombre y después las de solo contenido', () => {
  const r = { ficheros: ['conceptos/capital.md'], lineas: [{ ruta: 'inicio.md', linea: 3, texto: 'El capital inicial' }, { ruta: 'conceptos/capital.md', linea: 1, texto: 'El capital es dinero' }] };
  const { filas, hayMas } = Busqueda.filas(r, 'capital', {});
  assert.equal(filas.length, 2);
  assert.equal(hayMas, false);
  assert.deepEqual(filas[0], { ruta: 'conceptos/capital.md', nombre: 'capital', carpeta: 'conceptos', fragmento: 'El capital es dinero', linea: 1, porNombre: true });
  assert.equal(filas[1].ruta, 'inicio.md');
  assert.equal(filas[1].porNombre, false);
  assert.equal(filas[1].carpeta, '');
  assert.equal(filas[1].linea, 3);
});

test('limpiarFragmento: sin sintaxis de Markdown', () => {
  const l = Busqueda.limpiarFragmento;
  assert.equal(l('> [!comment] Alumno (2026-10-02) · «capital inicial»'), 'Alumno (2026-10-02) · «capital inicial»');
  assert.equal(l('- [ ] Repasar [[capital|el capital]]'), 'Repasar el capital');
  assert.equal(l('- [x] Hecho [[conceptos/interes]]'), 'Hecho conceptos/interes');
  assert.equal(l('**negrita** y _cursiva_ y `código`'), 'negrita y cursiva y código');
  assert.equal(l('un_nombre_con_guiones y [texto](http://x.y)'), 'un_nombre_con_guiones y texto');
  assert.equal(l('## Un título'), 'Un título');
});

test('filas: solo por título, el título hace de fragmento; solo por carpeta, «en la carpeta …»', () => {
  const { filas } = Busqueda.filas({ ficheros: ['examenes/01-examen.md', 'conceptos/otra.md'], lineas: [] }, 'módulo', { 'examenes/01-examen.md': 'Examen del módulo 1' });
  assert.equal(filas[0].fragmento, 'Examen del módulo 1');
  assert.equal(filas[0].porNombre, true);
  const c = Busqueda.filas({ ficheros: ['conceptos/otra.md'], lineas: [] }, 'concep', {}).filas[0];
  assert.equal(c.fragmento, 'en la carpeta conceptos');
  assert.equal(c.porNombre, true);
});

test('filas: cortado pasa a hayMas', () => {
  assert.equal(Busqueda.filas({ ficheros: [], lineas: [], cortado: true }, 'x', {}).hayMas, true);
});

test('resaltar: marca sin distinguir acentos ni mayúsculas, y escapa el HTML', () => {
  assert.equal(Busqueda.resaltar('Interés compuesto', 'interes'), '<mark>Interés</mark> compuesto');
  assert.equal(Busqueda.resaltar('a < b', 'zzz'), 'a &lt; b');
});

test('un <script> sale escapado', () => {
  const h = Busqueda.resaltar('<script>alert(1)</script> x', 'x');
  assert.ok(!h.includes('<script>'));
  assert.match(h, /&lt;script&gt;/);
  assert.match(h, /<mark>x<\/mark>/);
});
