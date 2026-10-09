'use strict';
// «Tareas que la mencionan»: a qué notas pertenece una tarea (enlace, etiqueta con el nombre de la nota, etiqueta con
// el nombre de una carpeta → su nota principal) y lo que devuelve tareasDe. La lógica vive en cuaderno.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Cuaderno } = require('../cuaderno');
const { crearCuaderno } = require('./ayuda');

function montar(ficheros, fn) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-menciones-'));
  try {
    for (const [rel, texto] of Object.entries(ficheros)) { const abs = path.join(raiz, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, texto); }
    return fn(new Cuaderno(raiz), raiz);
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
}
const de = (cu, rel, op) => cu.tareasDe(rel, op).map(i => i.texto);

test('por enlace [[nombre]], con alias, con ruta y con #sección; una tarea en la propia nota no se repite en ella', () => montar({
  'personas/ana.md': '# Ana\n\n- [ ] La mía propia [[ana]]\n',
  'agenda.md': '- [ ] Llamar a [[ana]]\n- [ ] Con alias [[personas/ana|ella]]\n- [ ] Con sección [[ana#fotos]]\n- [ ] Ninguna\n',
}, cu => {
  assert.deepEqual(de(cu, 'personas/ana.md'), ['Llamar a ana', 'Con alias ella', 'Con sección ana#fotos']);
}));

test('por etiqueta con el nombre del fichero: sin mayúsculas y con espacios, guiones y guiones bajos por igual', () => montar({
  'cms update.md': '# CMS\n',
  'otra_nota.md': '# Otra\n',
  'tareas.md': '- [ ] Uno #cms-update\n- [ ] Dos #CMS_Update\n- [ ] Tres #otra-nota\n- [ ] Cuatro #cms\n',
}, cu => {
  assert.deepEqual(de(cu, 'cms update.md'), ['Uno #cms-update', 'Dos #CMS_Update']);
  assert.deepEqual(de(cu, 'otra_nota.md'), ['Tres #otra-nota']);
}));

test('etiqueta con el nombre de una carpeta: sale en brief.md; si no, README.md; si no, index.md; sin ninguna, en ninguna parte', () => montar({
  'a/mudanza/brief.md': '# B\n', 'a/mudanza/README.md': '# R\n', 'a/mudanza/sub/brief.md': '# Sub\n',
  'b/viaje/Readme.md': '# R\n', 'b/viaje/index.md': '# I\n',
  'c/boda/INDEX.md': '# I\n',
  'd/obra/otra.md': '# O\n',
  'tareas.md': '- [ ] M #mudanza\n- [ ] V #viaje\n- [ ] B #boda\n- [ ] O #obra\n',
}, cu => {
  assert.deepEqual(de(cu, 'a/mudanza/brief.md'), ['M #mudanza']);
  assert.deepEqual(de(cu, 'a/mudanza/README.md'), []);
  assert.deepEqual(de(cu, 'a/mudanza/sub/brief.md'), []);
  assert.deepEqual(de(cu, 'b/viaje/Readme.md'), ['V #viaje']);
  assert.deepEqual(de(cu, 'b/viaje/index.md'), []);
  assert.deepEqual(de(cu, 'c/boda/INDEX.md'), ['B #boda']);
  assert.deepEqual(de(cu, 'd/obra/otra.md'), [], 'una carpeta sin nota principal no reparte sus tareas');
  assert.ok(!cu.tareas().flatMap(g => g.items).some(i => i.texto.includes('#obra') && i.notas.length));
}));

test('enlace y etiqueta a la misma nota no la repiten; pendientes primero, hechas después; cada item dice de qué nota viene', () => montar({
  'ana.md': '# Ana\n',
  'tareas.md': '- [x] Hecha [[ana]]\n- [ ] Doble [[ana]] #ana\n- [ ] Código `#ana` no es etiqueta\n',
}, cu => {
  const l = cu.tareasDe('ana.md');
  assert.deepEqual(l.map(i => [i.texto, i.hecha, i.ruta, i.linea]), [['Doble ana #ana', false, 'tareas.md', 1], ['Hecha ana', true, 'tareas.md', 0]]);
  assert.deepEqual(cu.tareas()[0].items[1].notas, ['ana.md']);
  assert.match(l[0].html, /etiqueta/);
}));

test('lo mismo que el panel: sin kit (soloPropias) solo tareas.md; exámenes y flashcards fuera; una ruta que no es nota, vacío', () => montar({
  'ana.md': '# Ana\n',
  'tareas.md': '- [ ] Propia [[ana]]\n',
  'otra.md': '- [ ] De otra nota [[ana]]\n',
  'ex.md': '---\ntipo: examen\n---\n- [ ] Pregunta [[ana]]\n',
}, cu => {
  assert.deepEqual(de(cu, 'ana.md', { soloPropias: true }), ['Propia ana']);
  assert.deepEqual(de(cu, 'ana.md'), ['Propia ana', 'De otra nota ana']);
  assert.deepEqual(cu.tareasDe('foto.png'), []);
  assert.deepEqual(cu.tareasDe(undefined), []);
}));

test('el cuaderno de ejemplo: ana.md y el brief de mudanza reciben las tareas de iniciativas/mudanza/pendientes.md', () => {
  const c = crearCuaderno({}), cu = new Cuaderno(c.raiz, c.base);
  try {
    assert.deepEqual(de(cu, 'personas/ana.md'), ['Llamar a ana por las llaves', 'Pedir la caja de herramientas #Ana']);
    assert.deepEqual(de(cu, 'iniciativas/mudanza/brief.md'), ['Embalar la cocina #mudanza', 'Reservar el camión #mudanza']);
    assert.deepEqual(de(cu, 'iniciativas/mudanza/pendientes.md'), []);
  } finally { c.borrar(); }
});
