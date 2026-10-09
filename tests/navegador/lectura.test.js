'use strict';
// Recorridos de lectura: la portada, buscar con Ctrl K y editar un bloque. Comparten cuaderno y navegador, en orden.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { arrancar, hasta, visible, oculto, conTexto, ficheroCumple, hashCumple } = require('./ayuda');

let e;
test.before(async () => { e = await arrancar({ kit: false }); });
test.after(async () => { if (e) await e.cerrar(); });

test('portada: se ve el título de inicio.md, el nombre del cuaderno y el árbol con los nombres de fichero', async () => {
  await e.ir('#/');
  await conTexto(e.pagina.locator('#nota h1'), /^Mi curso$/, 'portada', 'el título de la nota');
  await hashCumple(e.pagina, /^#\/n\/inicio\.md$/, 'portada');
  const nombre = path.basename(e.c.raiz);
  await hasta(async () => (await e.pagina.title()) === `${nombre} · Cuaderno`, 'portada', `el título de la ventana no es «${nombre} · Cuaderno»`);
  await conTexto(e.pagina.locator('#nombre-curso'), new RegExp(nombre), 'portada', 'el nombre del cuaderno en la barra lateral');
  // Las carpetas salen plegadas (2026-10-09): se abre «conceptos» para ver la nota de dentro.
  await (await visible(e.pagina.locator('#arbol summary', { hasText: 'conceptos' }), 'portada', 'la carpeta «conceptos» en el árbol')).click();
  await conTexto(e.pagina.locator('#arbol a.hoja[data-ruta="conceptos/interes.md"] .nombre'), /^interes$/, 'portada', 'la nota «interes» en el árbol (por su fichero, sin .md: la carpeta ya se ve encima)');
  await visible(e.pagina.locator('#link-inicio.activa'), 'portada', 'el enlace Inicio marcado como activo');
});

test('buscar: Ctrl K enfoca el buscador, «interes» enseña resultados y el primero abre la nota', async () => {
  await e.ir('#/');
  await e.pagina.keyboard.press('Control+k');
  await hasta(() => e.pagina.evaluate(() => document.activeElement && document.activeElement.id === 'buscador'), 'buscador', 'Ctrl K no deja el foco en el buscador');
  await e.pagina.keyboard.type('interes');
  await conTexto(e.pagina.locator('#arbol [role="status"]'), /\d+ notas? y \d+ líneas?/, 'buscador', 'el recuento de resultados');
  await oculto(e.pagina.locator('.paginas'), 'buscador', 'Inicio/Tareas/Comentarios mientras se busca: los resultados necesitan el sitio');
  await conTexto(e.pagina.locator('#arbol h3.tramo').first(), /^\d+ notas?$/, 'buscador', 'el tramo «Notas» primero');
  await conTexto(e.pagina.locator('#arbol h3.tramo').nth(1), /^En el texto/, 'buscador', 'el tramo «En el texto» después');
  const nota = await visible(e.pagina.locator('#arbol a.resultado', { hasText: 'Interés' }), 'buscador', 'la nota «Interés» entre los resultados');
  await visible(e.pagina.locator('#arbol a.resultado mark'), 'buscador', 'el texto buscado resaltado');
  await visible(e.pagina.locator('#arbol a.resultado', { hasText: 'Capital' }), 'buscador', 'la línea de «Capital» que menciona el interés');
  await nota.click();
  await hashCumple(e.pagina, /^#\/n\/conceptos\/interes\.md/, 'buscador');
  await conTexto(e.pagina.locator('#nota h1'), /^Interés$/, 'nota', 'el título «Interés»');
  await visible(e.pagina.locator('#nota .propiedades .etiqueta', { hasText: 'rédito' }), 'nota', 'las propiedades del frontmatter (alias)');
  await visible(e.pagina.locator('#nota .backlinks a', { hasText: 'Capital' }), 'nota', 'quién enlaza aquí');
});

test('editar una lista desde el editor de la nota: la casilla nueva queda en el fichero y no da conflicto (bug del 2026-10-08)', async () => {
  await e.ir('#/n/conceptos/interes.md');
  await visible(e.pagina.locator('#nota .bloque', { hasText: 'Repasar con' }), 'nota Interés', 'la lista de casillas');
  await (await visible(e.pagina.locator('#btn-editar'), 'nota Interés', 'el botón «Editar» en la miga')).click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'editor', 'el editor de la nota');
  await e.pagina.keyboard.press('ControlOrMeta+End');
  await e.pagina.keyboard.type('- [ ] Una casilla más');
  await e.pagina.keyboard.press('Enter');
  await e.pagina.locator('#edicion-aplicar').click();
  await ficheroCumple(e.c, 'conceptos/interes.md', /- \[ \] Una casilla más\n/, 'editor');
  await oculto(e.pagina.locator('#edicion-cm'), 'editor', 'el editor tras aplicar');
  await conTexto(e.pagina.locator('#nota'), /Una casilla más/, 'nota Interés', 'la casilla nueva tras aplicar');
});

test('buscar con teclado: por título («módulo» abre el examen), flecha abajo y Enter; Escape vuelve al árbol', async () => {
  await e.ir('#/');
  await e.pagina.keyboard.press('Control+k');
  await e.pagina.keyboard.type('módulo');   // el fichero se llama 01-examen.md: solo coincide por el título
  const nota = await visible(e.pagina.locator('#arbol a.resultado', { hasText: 'Módulo 1' }), 'buscador', 'el examen encontrado por su título, no por el nombre de fichero');
  await e.pagina.keyboard.press('ArrowDown');
  await hasta(() => e.pagina.evaluate(() => document.activeElement && document.activeElement.classList.contains('resultado')), 'buscador', 'la flecha abajo no lleva el foco al primer resultado');
  await e.pagina.keyboard.press('ArrowUp');
  await hasta(() => e.pagina.evaluate(() => document.activeElement && document.activeElement.id === 'buscador'), 'buscador', 'la flecha arriba desde el primer resultado no vuelve al buscador');
  await e.pagina.keyboard.press('Enter');
  await hashCumple(e.pagina, /^#\/n\/examenes\/01-examen\.md/, 'buscador');
  await e.pagina.keyboard.press('Control+k'); await e.pagina.keyboard.press('Escape');
  await visible(e.pagina.locator('.paginas'), 'buscador', 'Inicio/Tareas/Comentarios al vaciar con Escape');
  await visible(e.pagina.locator('#arbol summary', { hasText: 'conceptos' }), 'buscador', 'el árbol de vuelta al vaciar');
  void nota;
});

test('editar un párrafo desde el editor de la nota: el editor trae el Markdown del fichero y aplicar cambia el fichero y la pantalla', async () => {
  await e.ir('#/n/conceptos/capital.md');
  await visible(e.pagina.locator('#nota .bloque', { hasText: 'Lo que pones' }), 'nota Capital', 'el párrafo «Lo que pones»');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'editor', 'el editor de la nota');
  // Con vista, el Markdown crudo se ve en la línea del cursor: se baja a ella y se comprueba tal cual está en el fichero.
  await e.pagina.keyboard.press('ArrowDown'); await e.pagina.keyboard.press('ArrowDown');
  assert.equal(await e.pagina.locator('#edicion-cm .cm-line').nth(2).textContent(), 'Lo que pones. Enlaza con [[interes|el interés]].', 'editor: la línea del cursor no es el Markdown del fichero');
  await e.pagina.locator('#edicion-cm .cm-content').press('ControlOrMeta+a');
  await e.pagina.keyboard.insertText('# Capital\n\nLo que pones tú.\n');
  await e.pagina.locator('#edicion-aplicar').click();
  await ficheroCumple(e.c, 'conceptos/capital.md', /^# Capital\n\nLo que pones tú\.\n$/, 'editor');
  await conTexto(e.pagina.locator('#nota'), /Lo que pones tú\./, 'nota Capital', 'el texto nuevo tras aplicar');
  await oculto(e.pagina.locator('#edicion-cm'), 'editor', 'el editor tras aplicar');
});

test('bloques: sin iconos en el margen, el fondo no cambia al pasar el ratón ni al clicar en el texto', async () => {
  await e.ir('#/n/conceptos/interes.md');
  const bloque = await visible(e.pagina.locator('#nota .bloque', { has: e.pagina.locator('ul') }), 'nota Interés', 'la lista');
  const fondo = b => b.evaluate(x => getComputedStyle(x).backgroundColor);
  const transparente = 'rgba(0, 0, 0, 0)';
  await bloque.hover();
  assert.equal(await fondo(bloque), transparente, 'el bloque cambia de fondo al pasar el ratón');
  // Comentar es seleccionar un texto (o C): ni editar ni comentar tienen ya un icono por bloque (tareas 2 y 8 del bloque de edición).
  assert.equal(await e.pagina.locator('#nota .bloque .acciones, #nota .bloque button[data-accion]').count(), 0, 'quedan iconos de acción por bloque');
  // Clicar en el texto y sacar el ratón: el fondo no se queda. Se clica un párrafo, no una casilla: marcar una
  // casilla escribe en el fichero y la recarga en vivo cambia el bloque por otro (esa línea se prueba en diseno.test.js).
  const parrafo = await visible(e.pagina.locator('#nota .bloque', { hasText: 'El precio del dinero' }), 'nota Interés', 'el párrafo de la introducción');
  await parrafo.click({ position: { x: 100, y: 5 } });
  await e.pagina.mouse.move(5, 5);
  assert.equal(await fondo(e.pagina.locator('#nota .bloque', { hasText: 'El precio del dinero' })), transparente, 'el bloque se queda marcado tras clicar en el texto');
});
