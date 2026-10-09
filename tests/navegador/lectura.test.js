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
  await visible(e.pagina.locator('#arbol summary', { hasText: 'conceptos' }), 'buscador', 'el árbol de vuelta al vaciar');
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

test('bloques: al pasar el ratón el fondo no cambia y editar y comentar salen en el margen, fuera del texto; clicar en el texto no deja nada marcado', async () => {
  await e.ir('#/n/conceptos/interes.md');
  const bloque = await visible(e.pagina.locator('#nota .bloque', { has: e.pagina.locator('ul') }), 'nota Interés', 'la lista');
  const acciones = bloque.locator('.acciones');
  const fondo = () => bloque.evaluate(b => getComputedStyle(b).backgroundColor);
  await e.pagina.mouse.move(5, 5);   // el ratón, fuera de la nota (el recorrido anterior lo dejó encima)
  await hasta(() => acciones.evaluate(a => getComputedStyle(a).opacity === '0'), 'nota Interés', 'las acciones se ven sin pasar el ratón');
  const transparente = 'rgba(0, 0, 0, 0)';
  await bloque.hover();
  await hasta(() => acciones.evaluate(a => getComputedStyle(a).opacity === '1'), 'nota Interés', 'las acciones no aparecen al pasar el ratón');
  assert.equal(await fondo(), transparente, 'el bloque cambia de fondo al pasar el ratón');
  const texto = await bloque.locator('ul').boundingBox(), caja = await acciones.boundingBox();
  assert.ok(caja.x + caja.width <= texto.x, `las acciones (x=${caja.x}, ${caja.width} px) pisan el texto (x=${texto.x})`);
  assert.equal(await acciones.locator('button').count(), 2);
  const lapiz = await acciones.locator('button').first().boundingBox(), linea = await bloque.locator('ul li').first().boundingBox();
  assert.ok(Math.abs((lapiz.y + lapiz.height / 2) - (linea.y + linea.height / 2)) < 6, `el lápiz (centro y=${lapiz.y + lapiz.height / 2}) no está a la altura de la primera línea (y=${linea.y + linea.height / 2})`);
  // Clicar en el texto y sacar el ratón: ni fondo ni acciones se quedan.
  await bloque.locator('ul li').first().click({ position: { x: 200, y: 5 } });
  await e.pagina.mouse.move(5, 5);
  await hasta(() => acciones.evaluate(a => getComputedStyle(a).opacity === '0'), 'nota Interés', 'las acciones se quedan tras clicar en el texto y salir');
  assert.equal(await fondo(), transparente, 'el bloque se queda marcado tras clicar en el texto');
});
