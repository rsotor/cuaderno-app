'use strict';
// La terminal es la del sistema: los botones la abren en la carpeta del cuaderno (sin abrir nada en los tests).
const test = require('node:test');
const assert = require('node:assert/strict');
const { arrancar, visible, hasta } = require('./ayuda');

let e;
test.before(async () => { e = await arrancar({ kit: 'kit' }); });
test.after(async () => { if (e) await e.cerrar(); });

test('Terminal abre la del sistema en la carpeta del cuaderno y lo dice; Profesor la abre con el comando del kit; Ctrl ` también', async () => {
  await e.ir('#/');
  await e.pagina.click('#btn-terminal');
  await visible(e.pagina.locator('.aviso-flotante', { hasText: /Terminal abierta en .+, en la carpeta del cuaderno/ }), 'terminal', 'el aviso de qué terminal se ha abierto');
  await hasta(() => e.lanzado.length === 1, 'terminal', 'el botón no lanza nada');
  assert.equal(e.lanzado[0].cwd, e.c.raiz, 'terminal: no se abre en la carpeta del cuaderno');
  await e.pagina.click('#btn-profesor');
  await hasta(() => e.lanzado.length === 2, 'terminal', 'Profesor no lanza nada');
  assert.match(JSON.stringify(e.lanzado[1].args), /claude/, 'terminal: Profesor no lleva el comando del adaptador');
  await e.pagina.keyboard.press('Control+Backquote');
  await hasta(() => e.lanzado.length === 3, 'terminal', 'Ctrl ` no abre la terminal');
});
