'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { detectar } = require('../kit');
const { crearCuaderno } = require('./ayuda');

test('una carpeta de notas cualquiera: sin kit, las notas en la raíz', () => {
  const c = crearCuaderno();
  const k = detectar(c.raiz);
  assert.equal(k.tipo, 'carpeta'); assert.equal(k.base, c.raiz); assert.equal(k.comando, null);
  c.borrar();
});

test('estudio/ y config/ sin .kit/: salida del kit sin motor', () => {
  const c = crearCuaderno({ kit: 'sin-motor' });
  const k = detectar(c.raiz);
  assert.equal(k.tipo, 'salida-sin-motor'); assert.equal(k.base, path.join(c.raiz, 'estudio')); assert.equal(k.comando, null);
  c.borrar();
});

test('con .kit/motor.json: kit, y el comando del profesor sale del adaptador', () => {
  const c = crearCuaderno({ kit: true });
  let k = detectar(c.raiz);
  assert.equal(k.tipo, 'kit'); assert.equal(k.comando, 'claude'); assert.equal(k.motor.repo, 'rsotor/profesor-kit');
  // El adaptador del curso manda si es del LLM elegido
  fs.writeFileSync(path.join(c.raiz, 'config', 'ajustes.json'), JSON.stringify({ llm: 'codex' }));
  fs.writeFileSync(path.join(c.raiz, 'config', 'adaptador-llm.json'), JSON.stringify({ id: 'codex', comando: 'codex --full-auto' }));
  k = detectar(c.raiz);
  assert.equal(k.comando, 'codex --full-auto');
  // Si el LLM elegido no tiene adaptador, no se inventa
  fs.writeFileSync(path.join(c.raiz, 'config', 'ajustes.json'), JSON.stringify({ llm: 'otro' }));
  assert.equal(detectar(c.raiz).comando, null);
  c.borrar();
});
