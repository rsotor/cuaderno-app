'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Cuaderno, ErrorConflicto, ErrorPeticion } = require('../cuaderno');
const { crearCuaderno, NOTAS } = require('./ayuda');

const con = (opciones, fn) => async () => { const c = crearCuaderno(opciones); try { await fn(c, new Cuaderno(c.raiz, c.base)); } finally { c.borrar(); } };

test('el índice salta node_modules y lo que empieza por punto', con({}, (c, cu) => {
  const l = cu.listar();
  assert.ok(l.includes('conceptos/interes.md') && l.includes('tareas.md'));
  assert.ok(!l.some(p => p.includes('node_modules') || p.includes('.secreto')));
}));

test('el índice respeta .gitignore y una lista blanca en .obsidianignore', con({ ignorar: 'examenes/\n', obsidianignore: '/*\n!/*.md\n!/conceptos/\n' }, (c, cu) => {
  const l = cu.listar();
  assert.deepEqual(l, ['conceptos/capital.md', 'conceptos/interes.md', 'inicio.md', 'tareas.md']);
}));

test('una ruta fuera del cuaderno no se abre', con({}, (c, cu) => {
  assert.throws(() => cu.dentro('../../etc/passwd'), ErrorPeticion);
  assert.throws(() => cu.dentro(''), ErrorPeticion);
}));

test('nota: frontmatter, html, backlinks, líneas desplazadas por el frontmatter', con({}, (c, cu) => {
  const n = cu.nota('conceptos/interes.md');
  assert.equal(n.frontmatter.tipo, 'concepto');
  assert.match(n.html, /data-desde="5" data-hasta="6"><h1>Interés/);
  assert.match(n.html, /class="wiki roto" href="#" title="no-existe"/);
  assert.deepEqual(n.backlinks, ['conceptos/capital.md', 'sesiones/01-01-01-sesion.md']);
  assert.deepEqual(cu.nota('conceptos/capital.md').backlinks, ['conceptos/interes.md']);
}));

test('portada: inicio.md si existe; si no, la primera nota de la raíz; si no, null', con({}, (c, cu) => {
  assert.equal(cu.portada(), 'inicio.md');
  fs.unlinkSync(path.join(c.base, 'inicio.md')); cu.invalidar();
  assert.equal(cu.portada(), 'tareas.md');
  fs.unlinkSync(path.join(c.base, 'tareas.md')); cu.invalidar();
  assert.equal(cu.portada(), null);
}));

test('buscar sin acentos, por nombre y por línea', con({}, (c, cu) => {
  const r = cu.buscar('interes');
  assert.ok(r.ficheros.includes('conceptos/interes.md'));
  assert.ok(r.lineas.some(l => l.ruta === 'conceptos/capital.md' && l.texto.includes('interés')));
  assert.deepEqual(cu.buscar('  '), { ficheros: [], lineas: [] });
}));

test('tareas: por nota, sin exámenes, tareas.md primero; sin kit solo las propias', con({}, (c, cu) => {
  const g = cu.tareas();
  assert.equal(g[0].ruta, 'tareas.md');
  assert.ok(!g.some(x => x.ruta.startsWith('examenes/')));
  assert.deepEqual(g.find(x => x.ruta === 'sesiones/01-01-01-sesion.md').items.map(i => [i.linea, i.hecha, i.texto]), [[6, false, 'estudiada'], [10, false, 'Leer interes'], [11, true, 'Hecho ya']]);
  assert.deepEqual(cu.tareas({ soloPropias: true }).map(x => x.ruta), ['tareas.md']);
}));

test('editar un bloque deja el fichero como a mano y rechaza si cambió debajo', con({}, (c, cu) => {
  cu.escribirBloque('conceptos/capital.md', 2, 3, 'Lo que pones tú.', 'Lo que pones. Enlaza con [[interes|el interés]].');
  assert.equal(c.leer('conceptos/capital.md'), '# Capital\n\nLo que pones tú.\n');
  assert.throws(() => cu.escribirBloque('conceptos/capital.md', 2, 3, 'otra', 'Lo que pones. Enlaza con [[interes|el interés]].'), ErrorConflicto);
  assert.throws(() => cu.escribirBloque('conceptos/capital.md', 5, 9, 'x', null), ErrorPeticion);
}));

test('comentar deja el callout separado por líneas en blanco', con({}, (c, cu) => {
  cu.comentar('sesiones/01-01-01-sesion.md', 4, 5, 'No lo entiendo\nnada', '# 1.1 La sesión', '2026-10-07');
  assert.equal(c.leer('sesiones/01-01-01-sesion.md'), NOTAS['sesiones/01-01-01-sesion.md'].replace('# 1.1 La sesión\n', '# 1.1 La sesión\n\n> [!comment] Alumno (2026-10-07)\n> No lo entiendo\n> nada\n'));
  // si la línea siguiente no está en blanco, se añade una
  cu.comentar('conceptos/capital.md', 0, 1, 'ok', null, '2026-10-07');
  assert.equal(c.leer('conceptos/capital.md'), '# Capital\n\n> [!comment] Alumno (2026-10-07)\n> ok\n\n\nLo que pones. Enlaza con [[interes|el interés]].\n'.replace('> ok\n\n\nLo', '> ok\n\nLo'));
  assert.deepEqual(cu.comentarios().map(x => [x.ruta, x.linea, x.texto]), [['conceptos/capital.md', 2, 'ok'], ['sesiones/01-01-01-sesion.md', 6, 'No lo entiendo nada']]);
  assert.throws(() => cu.comentar('conceptos/capital.md', 0, 1, '   '), ErrorPeticion);
}));

test('marcar una casilla cambia solo esa línea y comprueba que sigue siendo ella', con({}, (c, cu) => {
  cu.marcarCasilla('sesiones/01-01-01-sesion.md', 10, true, '- [ ] Leer [[interes]]');
  assert.equal(c.leer('sesiones/01-01-01-sesion.md'), NOTAS['sesiones/01-01-01-sesion.md'].replace('- [ ] Leer', '- [x] Leer'));
  cu.marcarCasilla('sesiones/01-01-01-sesion.md', 11, false);
  assert.match(c.leer('sesiones/01-01-01-sesion.md'), /- \[ \] Hecho ya/);
  assert.throws(() => cu.marcarCasilla('sesiones/01-01-01-sesion.md', 7, true), ErrorConflicto);
  assert.throws(() => cu.marcarCasilla('sesiones/01-01-01-sesion.md', 10, true, '- [ ] Otra cosa'), ErrorConflicto);
}));

test('nueva tarea: se añade a tareas.md, o lo crea si no existe', con({}, (c, cu) => {
  cu.nuevaTarea('  Repasar  ');
  assert.equal(c.leer('tareas.md'), NOTAS['tareas.md'] + '- [ ] Repasar\n');
  fs.unlinkSync(path.join(c.base, 'tareas.md'));
  cu.nuevaTarea('Primera');
  assert.equal(c.leer('tareas.md'), '# Mis tareas\n\nLo que te apuntas tú. Tu profesor lo lee, pero no lo reescribe.\n\n- [ ] Primera\n');
  assert.throws(() => cu.nuevaTarea(''), ErrorPeticion);
}));

test('con CRLF: se lee igual y toda escritura conserva CRLF', con({ crlf: true }, (c, cu) => {
  const n = cu.nota('conceptos/interes.md');
  assert.equal(n.frontmatter.tipo, 'concepto');
  assert.match(n.html, /data-desde="5" data-hasta="6"><h1>Interés/);
  cu.escribirBloque('conceptos/capital.md', 2, 3, 'Nuevo\ntexto', 'Lo que pones. Enlaza con [[interes|el interés]].');
  assert.equal(c.leer('conceptos/capital.md'), '# Capital\r\n\r\nNuevo\r\ntexto\r\n');
  cu.comentar('conceptos/capital.md', 0, 1, 'duda', '# Capital', '2026-10-07');
  cu.marcarCasilla('tareas.md', 4, true);
  cu.nuevaTarea('Otra');
  for (const f of ['conceptos/capital.md', 'tareas.md']) assert.ok(!/[^\r]\n/.test(c.leer(f)), `${f} mezcla finales de línea`);
  assert.equal(c.leer('tareas.md'), NOTAS['tareas.md'].replace(/\n/g, '\r\n').replace('- [ ] Comprar', '- [x] Comprar') + '- [ ] Otra\r\n');
}));

test('nombre: cuaderno.json, luego nombre_curso del kit, luego la carpeta', con({ kit: 'kit' }, (c, cu) => {
  assert.equal(cu.nombre(), path.basename(c.raiz));
  fs.writeFileSync(path.join(c.raiz, 'config', 'ajustes.json'), JSON.stringify({ nombre_curso: 'Finanzas' }));
  assert.equal(new Cuaderno(c.raiz, c.base).nombre(), 'Finanzas');
  fs.writeFileSync(path.join(c.raiz, 'cuaderno.json'), JSON.stringify({ nombre: 'Mi cuaderno' }));
  assert.equal(new Cuaderno(c.raiz, c.base).nombre(), 'Mi cuaderno');
}));

test('recorrido: cuenta notas, enlaces rotos y fallos', con({}, (c, cu) => {
  const r = cu.recorrido();
  assert.equal(r.notas, 7);
  assert.deepEqual(r.rotos, [{ ruta: 'conceptos/interes.md', destino: 'no-existe' }]);
  assert.deepEqual(r.fallos, []);
}));
