'use strict';
// Recorrido por un cuaderno real: ni enlaces rotos ni notas sin pintar (§9 del plan). Solo corre si se le da una
// copia de un cuaderno en CUADERNO_PRUEBA (nunca el cuaderno real: los tests escriben en carpetas temporales,
// este no escribe, pero la regla es la misma). Las rutas de nadie van en el repo.
const test = require('node:test');
const assert = require('node:assert/strict');
const { recorrer } = require('../pruebas/recorrido');

const carpeta = process.env.CUADERNO_PRUEBA;
test('recorrido por el cuaderno de CUADERNO_PRUEBA', { skip: !carpeta && 'sin CUADERNO_PRUEBA' }, () => {
  const r = recorrer(carpeta);
  assert.ok(r.notas > 0, 'no hay notas');
  assert.deepEqual(r.fallos, []);
  assert.deepEqual(r.rotos, []);
});
