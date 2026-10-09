'use strict';
// Editar la nota entera (CodeMirror, public/live.js): entrar con el botón «Editar» o con E, salir con Aplicar o Esc,
// y que el fichero quede exactamente como se escribió. Sin kit: es la base de la app (AGENTS.md, principio 3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { arrancar, hasta, visible, oculto, conTexto, ficheroCumple } = require('./ayuda');

let e;
test.before(async () => { e = await arrancar({ kit: false }); });
test.after(async () => { if (e) await e.cerrar(); });

// Una nota larga (en la carpeta temporal del test, nunca en ejemplos/): para que haya scroll y un bloque visible.
const larga = () => '# Nota larga\n\n' + Array.from({ length: 60 }, (_, i) => `Párrafo ${i + 1}. ${'Texto de relleno para que ocupe espacio. '.repeat(3)}`).join('\n\n') + '\n';

test('editar la nota: Editar abre el editor en el bloque visible, Aplicar escribe el fichero tal cual y vuelve a lectura', async () => {
  const antes = larga();
  fs.writeFileSync(path.join(e.c.base, 'larga.md'), antes);
  await e.ir('#/n/larga.md');
  await visible(e.pagina.locator('#nota .bloque', { hasText: 'Párrafo 60.' }), 'nota larga', 'el último párrafo');
  // Se baja hasta el párrafo 30 y se anota qué bloques están a la vista (su primera línea en el fichero).
  await e.pagina.locator('#nota .bloque', { hasText: 'Párrafo 30.' }).scrollIntoViewIfNeeded();
  const aLaVista = await e.pagina.evaluate(() => {
    const tope = document.querySelector('.miga-barra').getBoundingClientRect().bottom;
    return [...document.querySelectorAll('#nota .bloque')].filter(b => { const r = b.getBoundingClientRect(); return r.bottom > tope && r.top < innerHeight; }).map(b => +b.dataset.desde);
  });
  assert.ok(aLaVista.length >= 2, 'nota larga: debería haber varios bloques a la vista');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'editor', 'el editor de la nota');
  await oculto(e.pagina.locator('#btn-editar'), 'editor', 'el botón «Editar» mientras se edita');
  assert.equal(await e.pagina.locator('#edicion-cm .cm-content').getAttribute('aria-label'), 'Editor de la nota');
  assert.equal(await e.pagina.locator('#edicion-cm .cm-lineNumbers').count(), 0, 'editor: no lleva números de línea');
  assert.equal(await e.pagina.evaluate(() => document.activeElement.closest('#edicion-cm') !== null), true, 'editor: el foco no está en el editor');
  // El cursor está en la primera línea de un bloque que se estaba leyendo, y esa línea se ve.
  await e.pagina.keyboard.type('ZZ');
  const cursor = await e.pagina.evaluate(() => { const r = document.querySelector('#edicion-cm .cm-cursor').getBoundingClientRect(); return { arriba: r.top, abajo: r.bottom, alto: innerHeight }; });
  assert.ok(cursor.abajo > 0 && cursor.arriba < cursor.alto, `editor: la línea del cursor no se ve (${JSON.stringify(cursor)})`);
  await e.pagina.locator('#edicion-aplicar').click();
  await visible(e.pagina.locator('.aviso-flotante', { hasText: 'Nota escrita' }), 'editor', 'el aviso «Nota escrita»');
  await oculto(e.pagina.locator('#edicion-cm'), 'editor', 'el editor tras aplicar');
  // El fichero: una sola línea distinta, la primera de un bloque que se leía, con ZZ delante; el resto, byte a byte.
  const despues = fs.readFileSync(path.join(e.c.base, 'larga.md'), 'utf8');
  const a = antes.split('\n'), d = despues.split('\n');
  assert.equal(d.length, a.length, 'fichero: cambia el número de líneas');
  const distintas = a.map((l, i) => (l === d[i] ? -1 : i)).filter(i => i >= 0);
  assert.equal(distintas.length, 1, `fichero: cambian ${distintas.length} líneas`);
  assert.equal(d[distintas[0]], 'ZZ' + a[distintas[0]]);
  assert.ok(aLaVista.includes(distintas[0]), `fichero: el cursor estaba en la línea ${distintas[0] + 1}, que no era el principio de un bloque a la vista (${aLaVista.join(', ')})`);
  // Vuelta a lectura: la nota repintada con el cambio, el foco en «Editar» y el mismo bloque a la vista.
  await conTexto(e.pagina.locator('#nota'), /ZZPárrafo/, 'nota larga', 'el cambio en la lectura');
  await hasta(() => e.pagina.evaluate(() => document.activeElement.id === 'btn-editar'), 'nota larga', 'el foco no vuelve al botón «Editar»');
  const bloqueVisible = await e.pagina.evaluate(() => { const b = [...document.querySelectorAll('#nota .bloque')].find(x => x.textContent.includes('ZZPárrafo')); const r = b.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
  assert.equal(bloqueVisible, true, 'lectura: el bloque editado no está a la vista al volver');
});

test('editar con el teclado: e entra, Esc sale sin escribir, Ctrl/⌘ Enter aplica y el foco vuelve a Editar', async () => {
  await e.ir('#/n/conceptos/capital.md');
  const fichero = () => fs.readFileSync(path.join(e.c.base, 'conceptos/capital.md'), 'utf8');
  const original = fichero();
  await e.pagina.locator('#nota .bloque').first().focus();
  await e.pagina.keyboard.press('e');
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'teclado', 'el editor con la tecla E');
  await e.pagina.keyboard.type('eee');   // dentro del editor, la «e» es una letra más, no entra ni sale
  await e.pagina.keyboard.press('Escape');
  await oculto(e.pagina.locator('#edicion-cm'), 'teclado', 'el editor tras Esc');
  assert.equal(await e.pagina.evaluate(() => document.activeElement.id), 'btn-editar', 'teclado: el foco no vuelve a «Editar»');
  assert.equal(fichero(), original, 'teclado: Esc ha escrito en el fichero');
  // Con el foco en «Editar», Enter entra también (es un botón) y Ctrl/⌘ Enter aplica.
  await e.pagina.keyboard.press('Enter');
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'teclado', 'el editor con Enter sobre el botón');
  await e.pagina.keyboard.type('Hola. ');
  await e.pagina.keyboard.press('ControlOrMeta+Enter');
  await ficheroCumple(e.c, 'conceptos/capital.md', /^Hola\. # Capital\n/, 'teclado');
  await oculto(e.pagina.locator('#edicion-cm'), 'teclado', 'el editor tras Ctrl Enter');
  assert.equal(await e.pagina.evaluate(() => document.activeElement.id), 'btn-editar', 'teclado: tras aplicar, el foco no vuelve a «Editar»');
  assert.equal((fichero().match(/\n\n/g) || []).length, (original.match(/\n\n/g) || []).length, 'teclado: Ctrl Enter ha metido una línea en blanco');
});

test('editar: el botón solo está en las notas; E no hace nada fuera de ellas ni dentro de un campo de texto', async () => {
  await e.ir('#/tareas');
  await oculto(e.pagina.locator('#btn-editar'), 'tareas', 'el botón «Editar» en el panel de Tareas');
  await e.pagina.keyboard.press('e');
  assert.equal(await e.pagina.locator('#edicion-cm').count(), 0, 'tareas: E ha abierto un editor');
  await e.ir('#/n/conceptos/capital.md');
  await visible(e.pagina.locator('#btn-editar'), 'nota', 'el botón «Editar» en una nota');
  await e.pagina.locator('#buscador').focus();
  await e.pagina.keyboard.type('e');
  assert.equal(await e.pagina.locator('#edicion-cm').count(), 0, 'buscador: teclear una «e» ha abierto el editor');
  assert.equal(await e.pagina.locator('#buscador').inputValue(), 'e');
});

test('ajuste «Editor»: con vista o Markdown plano se guarda con los demás ajustes y el editor abre igual', async () => {
  await e.ir('#/n/conceptos/capital.md');
  await e.pagina.click('#btn-ajustes');
  await e.pagina.selectOption('#ajustes-editor', 'plano');
  await hasta(() => e.pagina.evaluate(() => fetch('/api/info').then(r => r.json()).then(i => i.configuracion.editor === 'plano')), 'ajustes', 'el ajuste «Editor» no se guarda como «plano»');
  await e.pagina.keyboard.press('Escape');
  await e.pagina.reload();
  await e.pagina.click('#btn-ajustes');
  assert.equal(await e.pagina.locator('#ajustes-editor').inputValue(), 'plano', 'ajustes: el valor no sobrevive a recargar');
  await e.pagina.keyboard.press('Escape');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'editor', 'el editor en modo plano');
  await e.pagina.keyboard.press('Escape');
});
