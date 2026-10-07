'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { leerExamen, marcar, validable } = require('../formulario');
const { NOTAS } = require('./ayuda');

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

test('sin motor no se puede validar, y se dice por qué', () => {
  assert.equal(validable('/x', { tipo: 'carpeta' }, 'e.md', {}).ok, false);
  assert.match(validable('/x', { tipo: 'salida-sin-motor' }, 'e.md', {}).motivo, /no trae el motor/);
});
