'use strict';
// Recorridos de lectura: la portada, buscar con Ctrl K y editar un bloque. Comparten cuaderno y navegador, en orden.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { arrancar, hasta, visible, oculto, conTexto, ficheroCumple, hashCumple } = require('./ayuda');

let e;
test.before(async () => { e = await arrancar({ kit: 'kit' }); });
test.after(async () => { if (e) await e.cerrar(); });

test('portada: se ve el título de inicio.md, el nombre del cuaderno y el árbol con títulos', async () => {
  await e.ir('#/');
  await conTexto(e.pagina.locator('#nota h1'), /^Mi curso$/, 'portada', 'el título de la nota');
  await hashCumple(e.pagina, /^#\/n\/inicio\.md$/, 'portada');
  const nombre = path.basename(e.c.raiz);
  await hasta(async () => (await e.pagina.title()) === `${nombre} · Cuaderno`, 'portada', `el título de la ventana no es «${nombre} · Cuaderno»`);
  await conTexto(e.pagina.locator('#nombre-curso'), new RegExp(nombre), 'portada', 'el nombre del cuaderno en la barra lateral');
  await visible(e.pagina.locator('#arbol a.hoja', { hasText: 'Interés' }), 'portada', 'la nota «Interés» en el árbol (con su título, no el nombre de fichero)');
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

test('editar una lista: el bloque es solo la lista y guardar no da conflicto (bug del 2026-10-08)', async () => {
  await e.ir('#/n/conceptos/interes.md');
  const bloque = await visible(e.pagina.locator('#nota .bloque', { hasText: 'Repasar con' }), 'nota Interés', 'la lista de casillas');
  await bloque.hover();
  await (await visible(bloque.locator('button[data-accion="editar"]'), 'nota Interés', 'el botón «editar» en la lista')).click();
  await visible(e.pagina.locator('#editor'), 'editor', 'el diálogo de edición');
  const texto = await e.pagina.locator('#editor-texto').inputValue();
  assert.ok(!texto.endsWith('\n'), 'editor: el bloque de la lista no debería traer la línea en blanco que la sigue');
  await e.pagina.locator('#editor-texto').fill(texto + '\n- [ ] Una casilla más');
  await e.pagina.locator('#editor-guardar').click();
  await ficheroCumple(e.c, 'conceptos/interes.md', /- \[ \] Una casilla más\n/, 'editor');
  await oculto(e.pagina.locator('#editor'), 'editor', 'el diálogo de edición tras guardar');
  await conTexto(e.pagina.locator('#nota'), /Una casilla más/, 'nota Interés', 'la casilla nueva tras guardar');
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
  await visible(e.pagina.locator('#arbol a.hoja', { hasText: 'Interés' }), 'buscador', 'el árbol de vuelta al vaciar');
  void nota;
});

test('editar un bloque: el editor trae el Markdown del tramo y guardar cambia el fichero y la pantalla', async () => {
  await e.ir('#/n/conceptos/capital.md');
  const bloque = await visible(e.pagina.locator('#nota .bloque', { hasText: 'Lo que pones' }), 'nota Capital', 'el párrafo «Lo que pones»');
  await bloque.hover();
  await (await visible(bloque.locator('button[data-accion="editar"]'), 'nota Capital', 'el botón «editar» al pasar por el bloque')).click();
  await visible(e.pagina.locator('#editor'), 'editor', 'el diálogo de edición');
  await conTexto(e.pagina.locator('#editor-lineas'), /líneas 3–3/, 'editor', 'las líneas del tramo');
  assert.equal(await e.pagina.locator('#editor-texto').inputValue(), 'Lo que pones. Enlaza con [[interes|el interés]].', 'editor: el texto no es el Markdown original del bloque');
  await e.pagina.locator('#editor-texto').fill('Lo que pones tú.');
  await e.pagina.locator('#editor-guardar').click();
  await ficheroCumple(e.c, 'conceptos/capital.md', /^# Capital\n\nLo que pones tú\.\n$/, 'editor');
  await conTexto(e.pagina.locator('#nota'), /Lo que pones tú\./, 'nota Capital', 'el texto nuevo tras guardar');
  await oculto(e.pagina.locator('#editor'), 'editor', 'el diálogo de edición tras guardar');
});
