'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { leerTarjetas } = require('../tarjetas');
const { NOTAS } = require('./ayuda');

test('lee pregunta, respuesta, líneas de las dos casillas, estado y caja', () => {
  const t = leerTarjetas(NOTAS['flashcards/01-tarjetas.md']);
  assert.equal(t.length, 2);
  assert.equal(t[0].pregunta, '¿Qué es el interés? (en una frase)');
  assert.equal(t[0].respuesta, 'El precio del dinero.');
  assert.deepEqual([t[0].lineaSabia, t[0].lineaNoSabia, t[0].sabia, t[0].info], [10, 11, null, 'Caja 1 de 5 · te toca el 3/10']);
  assert.deepEqual([t[1].lineaSabia, t[1].lineaNoSabia, t[1].sabia], [18, 19, true]);
  assert.deepEqual(leerTarjetas('# Nada\n\nUn párrafo.\n'), []);
});
