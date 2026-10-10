'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { leerExamen, marcar, validable, corregir } = require('../formulario');
const { NOTAS, otroNode, herramientasChivatas } = require('./ayuda');

const cuerpo = NOTAS['examenes/01-examen.md'].split('\n').slice(8).join('\n');   // sin frontmatter (8 líneas)

test('lee las preguntas, sus opciones y si admiten una sola respuesta', () => {
  const ex = leerExamen(cuerpo);
  assert.equal(ex.preguntas.length, 2);
  const [p1, p2] = ex.preguntas;
  assert.equal(p1.numero, 1); assert.equal(p1.unica, true); assert.match(p1.enunciado, /^\*\*1\.\*\* Tienes 100 €/); assert.match(p1.enunciado, /elige una/);
  assert.deepEqual(p1.opciones.map(o => [o.letra, o.texto, o.marcada]), [['a', 'Sube', false], ['b', 'Baja', false], ['c', 'Igual', false]]);
  assert.equal(p2.unica, false); assert.equal(p2.opciones.length, 3);
  assert.match(ex.cabecera, /^# Examen · Módulo 1\n\n2 preguntas/);
  assert.equal(ex.resto, '');
});

test('marcar escribe las casillas elegidas y deja en blanco el resto; CRLF se conserva', () => {
  const marcado = marcar(cuerpo, { 1: ['b'], 2: ['a', 'c'] });
  assert.match(marcado, /- \[ \] a\) Sube\n- \[x\] b\) Baja\n- \[ \] c\) Igual/);
  assert.match(marcado, /- \[x\] a\) Medio de cambio\n- \[ \] b\) Unidad de cuenta\n- \[x\] c\) Fuente de inflación/);
  const otraVez = marcar(marcado, { 1: ['a'] });
  assert.match(otraVez, /- \[x\] a\) Sube\n- \[ \] b\) Baja/); assert.doesNotMatch(otraVez, /\[x\] [abc]\) (Medio|Unidad|Fuente)/);
  const crlf = marcar(cuerpo.replace(/\n/g, '\r\n'), { 1: ['c'] });
  assert.ok(!/[^\r]\n/.test(crlf)); assert.match(crlf, /\[x\] c\) Igual\r\n/);
});

test('el histórico queda fuera del formulario', () => {
  const ex = leerExamen(cuerpo + '\n## Histórico de intentos\n\n| 1 | 2026-10-07 | 5,0 |\n');
  assert.equal(ex.preguntas.length, 2);
  assert.match(ex.resto, /^## Histórico de intentos/);
});

test('sin kit no se puede corregir, y se dice por qué (el curso sin motor lo prueba guardar.test.js)', () => {
  const v = validable('/x', { tipo: 'carpeta' }, 'e.md', {});
  assert.equal(v.ok, false); assert.match(v.motivo, /Sin kit no hay quien corrija/);
});

// Con qué Node corre examen.js (plan de Electron, T3): por defecto, el de este proceso; la app de escritorio inyecta
// ejecutarNode = { cmd, env }. El examen.js falso chiva lo que recibe.
test('con kit: corregir y la revisión lanzan examen.js con el Node de este proceso; con ejecutarNode, con ese Node y su entorno', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-examen-'));
  const leerLanzado = herramientasChivatas(d, ['examen.js']);
  const KIT = { tipo: 'kit' };
  try {
    const r = corregir(d, 'estudio/examenes/01-examen.md');
    assert.equal(r.codigo, 0, r.salida);
    const l = JSON.parse(r.salida);
    assert.deepEqual(l.args, ['--corregir', 'estudio/examenes/01-examen.md']); assert.equal(l.execPath, process.execPath); assert.equal(l.RUN_AS_NODE, undefined);
    const ejecutarNode = { cmd: otroNode(), env: { ELECTRON_RUN_AS_NODE: '1' } };
    const c = JSON.parse(corregir(d, 'e.md', { ejecutarNode }).salida);
    assert.deepEqual(c.args, ['--corregir', 'e.md']);
    assert.equal(path.basename(c.execPath), path.basename(ejecutarNode.cmd)); assert.notEqual(c.execPath, process.execPath);
    assert.equal(c.RUN_AS_NODE, '1'); assert.equal(c.PATH, process.env.PATH);   // su entorno sumado al de este proceso, no en su lugar
    // La revisión (examen de módulo sin intentos) pasa por la misma herramienta con el mismo Node; la falsa sale con 0: «revisada».
    assert.deepEqual(validable(d, KIT, 'e.md', { tipo_examen: 'modulo', intentos: 0 }, { ejecutarNode }), { ok: true, motivo: null });
    const v = leerLanzado();
    assert.deepEqual(v.args, ['--revision', 'e.md']); assert.equal(path.basename(v.execPath), path.basename(ejecutarNode.cmd)); assert.equal(v.RUN_AS_NODE, '1');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
