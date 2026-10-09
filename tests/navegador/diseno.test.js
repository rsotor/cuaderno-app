'use strict';
// Recorridos de la revisión de diseño del 2026-10-09 (docs/diseno/revision-2026-10-09.md), tanda 1: el nombre de «Guardar»,
// la señal de los filtros, el teclado (Tab, flechas, diálogos), el contraste en oscuro, las casillas de una nota y los errores.
// Sin kit: es la base de la app (AGENTS.md, principio 3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { arrancar, hasta, visible, oculto, conTexto, ficheroCumple, hashCumple } = require('./ayuda');

let e;
const git = (...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: e.c.raiz, stdio: 'pipe' });
test.before(async () => {
  e = await arrancar({ kit: false });
  fs.appendFileSync(path.join(e.c.base, 'tareas.md'), '- [ ] Llamar a Ana #Ana\n- [x] Pagar el recibo #Ana\n- [ ] Escribir a Luis #Luis\n');
  git('init', '-q'); git('add', '-A'); git('commit', '-q', '-m', 'base');
  await visible(e.pagina.locator('#arbol a.hoja', { hasText: 'Capital' }).or(e.pagina.locator('#arbol details summary').first()), 'arranque', 'el árbol');
  await e.pagina.waitForTimeout(1200);   // el vigilante de ficheros avisa tarde: que los avisos de estas escrituras ya hayan pasado
});
test.after(async () => { if (e) await e.cerrar(); });

const rgb = c => c.match(/[\d.]+/g).slice(0, 3).map(Number);
const luz = c => { const [r, g, b] = rgb(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contraste = (a, b) => { const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test('«Guardar» es solo del repositorio: el editor de un bloque dice «Aplicar» y avisa «Cambio escrito en la nota»; la línea de estado habla de cambios por guardar', async () => {
  await e.ir('#/n/conceptos/capital.md');
  const bloque = e.pagina.locator('#nota .bloque').nth(1);
  await bloque.hover();
  await bloque.locator('[data-accion="editar"]').click();
  await visible(e.pagina.locator('#editor'), 'editar', 'el editor del bloque');
  assert.equal((await e.pagina.locator('#editor-guardar').textContent()).trim(), 'Aplicar', 'editar: el botón del editor no se llama «Aplicar»');
  assert.match(await e.pagina.locator('#editor .pista').textContent(), /Ctrl Enter aplica/, 'editar: la pista sigue diciendo «guarda»');
  const texto = await e.pagina.locator('#editor-texto').inputValue();
  await e.pagina.locator('#editor-texto').fill(texto + ' Una frase más.');
  await e.pagina.locator('#editor-guardar').click();
  await visible(e.pagina.locator('.aviso-flotante', { hasText: 'Cambio escrito en la nota' }), 'editar', 'el aviso «Cambio escrito en la nota»');
  await ficheroCumple(e.c, 'conceptos/capital.md', /Una frase más\./, 'editar');
  await conTexto(e.pagina.locator('#estado-git'), /\d+ cambios? por guardar/, 'estado', 'la línea de estado del repositorio');
  assert.doesNotMatch(await e.pagina.locator('#estado-git').textContent(), /sin guardar/, 'estado: queda «sin guardar»');
  // Comentar usa el mismo editor con sus palabras.
  await bloque.hover();
  await bloque.locator('[data-accion="comentar"]').click();
  await visible(e.pagina.locator('#editor'), 'comentar', 'el editor del comentario');
  assert.equal((await e.pagina.locator('#editor-guardar').textContent()).trim(), 'Comentar', 'comentar: el botón no se llama «Comentar»');
  await e.pagina.keyboard.press('Escape');
  await oculto(e.pagina.locator('#editor'), 'comentar', 'el editor tras Escape');
});

test('Tareas con filtros: una línea dice «Filtrando: …» (también al volver, recordados) y con cero resultados hay un estado vacío con salida', async () => {
  await e.ir('#/tareas?etiqueta=Ana&estado=hechas');
  await conTexto(e.pagina.locator('#filtrando-texto'), /^Filtrando: #Ana · hechas$/, 'tareas filtradas', 'la señal de filtros');
  assert.equal(await e.pagina.locator('#filtro-vacio').isVisible(), false, 'tareas filtradas: sale el estado vacío con una tarea que cumple');
  // Recordados: salir y volver por la barra lateral.
  await e.ir('#/');
  await e.pagina.locator('.paginas a', { hasText: 'Tareas' }).click();
  await conTexto(e.pagina.locator('#filtrando-texto'), /^Filtrando: #Ana · hechas$/, 'tareas recordadas', 'la señal de filtros al volver');
  // Cero resultados: la etiqueta #Luis solo tiene una pendiente.
  await e.pagina.selectOption('#filtro-etiqueta', 'Luis');
  await conTexto(e.pagina.locator('#filtro-vacio-texto'), /^Ninguna tarea hecha con #Luis\.$/, 'tareas sin resultados', 'el estado vacío');
  await e.pagina.locator('#filtro-vacio [data-quitar-filtros]').click();
  await hashCumple(e.pagina, /^#\/tareas$/, 'tareas sin filtros');
  await oculto(e.pagina.locator('#filtrando'), 'tareas sin filtros', 'la señal de filtros');
  await oculto(e.pagina.locator('#filtro-vacio'), 'tareas sin filtros', 'el estado vacío');
});

test('teclado: «Saltar al contenido» lleva a la nota sin cambiar la ruta; los botones de las filas no son paradas de Tab; la flecha derecha llega a ellos', async () => {
  await e.ir('#/n/conceptos/capital.md');
  await e.pagina.evaluate(() => document.activeElement.blur());
  const paradas = [];
  for (let i = 0; i < 40; i++) {
    await e.pagina.keyboard.press('Tab');
    const dentro = await e.pagina.evaluate(() => { const a = document.activeElement; return { enNota: !!a.closest('#nota'), boton: a.matches('#arbol button'), saltar: a.matches('.saltar') }; });
    paradas.push(dentro);
    if (dentro.enNota) break;
  }
  assert.ok(paradas[0].saltar, 'teclado: la primera parada no es «Saltar al contenido»');
  assert.ok(!paradas.some(p => p.boton), 'teclado: un botón de fila del árbol es parada de Tab');
  assert.ok(paradas.at(-1).enNota && paradas.length <= 32, `teclado: ${paradas.length} Tab hasta la nota (hoy son 31 con el árbol plegado, antes 62 con carpetas abiertas; el techo vigila que no crezca; el atajo es «Saltar al contenido»)`);
  // El enlace: Enter va a la nota, y la ruta sigue siendo la misma.
  await e.pagina.locator('.saltar').focus();
  await e.pagina.keyboard.press('Enter');
  await hasta(() => e.pagina.evaluate(() => document.activeElement.id === 'nota'), 'teclado', 'Saltar al contenido no deja el foco en la nota');
  await hashCumple(e.pagina, /^#\/n\/conceptos\/capital\.md$/, 'teclado');
  // Una fila: flecha derecha entra en sus botones, izquierda vuelve.
  await e.pagina.locator('#arbol summary', { hasText: 'conceptos' }).focus();
  await e.pagina.keyboard.press('ArrowRight');
  assert.ok(await e.pagina.evaluate(() => document.activeElement.matches('#arbol button.ocultar')), 'teclado: la flecha derecha no llega al botón Ocultar');
  await e.pagina.keyboard.press('ArrowRight');
  assert.ok(await e.pagina.evaluate(() => document.activeElement.matches('#arbol button.mostrar')), 'teclado: la flecha derecha no pasa al botón Mostrar');
  await e.pagina.keyboard.press('ArrowLeft'); await e.pagina.keyboard.press('ArrowLeft');
  assert.ok(await e.pagina.evaluate(() => document.activeElement.matches('#arbol summary')), 'teclado: la flecha izquierda no vuelve a la carpeta');
});

test('teclado en la nota: un solo punto de Tab, flechas entre bloques, E edita y C comenta el bloque enfocado', async () => {
  await e.ir('#/n/sesiones/01-01-01-sesion.md');
  assert.equal(await e.pagina.locator('#nota .bloque[tabindex="0"]').count(), 1, 'nota: hay más de un bloque con tabindex 0');
  assert.equal(await e.pagina.locator('#nota .bloque .acciones button:not([tabindex="-1"])').count(), 0, 'nota: un botón de bloque es parada de Tab');
  const bloques = e.pagina.locator('#nota .bloque');
  await bloques.first().focus();
  await e.pagina.keyboard.press('ArrowDown');
  assert.ok(await e.pagina.evaluate(() => document.activeElement === document.querySelectorAll('#nota .bloque')[1]), 'nota: la flecha abajo no pasa al bloque siguiente');
  assert.equal(await e.pagina.locator('#nota .bloque[tabindex="0"]').count(), 1, 'nota: tras moverse, hay más de un bloque con tabindex 0');
  await e.pagina.keyboard.press('ArrowUp');
  assert.ok(await e.pagina.evaluate(() => document.activeElement === document.querySelectorAll('#nota .bloque')[0]), 'nota: la flecha arriba no vuelve al bloque anterior');
  await e.pagina.keyboard.press('e');
  await visible(e.pagina.locator('#editor'), 'nota', 'el editor con la tecla E');
  await e.pagina.keyboard.press('Escape');
  await oculto(e.pagina.locator('#editor'), 'nota', 'el editor tras Escape');
  assert.ok(await e.pagina.evaluate(() => document.activeElement.classList.contains('bloque')), 'nota: al cerrar el editor el foco no vuelve al bloque');
  await e.pagina.keyboard.press('c');
  await visible(e.pagina.locator('#editor'), 'nota', 'el editor del comentario con la tecla C');
  await e.pagina.keyboard.press('Escape');
});

test('diálogos: Ajustes, Nueva nota y el editor retienen el foco con Tab y Mayús Tab, dejan lo de detrás inerte y devuelven el foco al cerrar', async () => {
  const dentro = id => e.pagina.evaluate(i => !!document.activeElement.closest(i), id);
  const probar = async (abrir, id, cerrar) => {
    await abrir();
    await visible(e.pagina.locator(id), id, 'el diálogo');
    assert.equal(await e.pagina.evaluate(() => document.querySelector('#app').inert), true, `${id}: lo de detrás no está inerte`);
    for (let i = 0; i < 14; i++) { await e.pagina.keyboard.press('Tab'); assert.ok(await dentro(id), `${id}: el foco se escapó tras ${i + 1} Tab`); }
    for (let i = 0; i < 14; i++) { await e.pagina.keyboard.press('Shift+Tab'); assert.ok(await dentro(id), `${id}: el foco se escapó con Mayús Tab (${i + 1})`); }
    await cerrar();
    await oculto(e.pagina.locator(id), id, 'el diálogo tras cerrarlo');
    assert.equal(await e.pagina.evaluate(() => document.querySelector('#app').inert), false, `${id}: lo de detrás sigue inerte`);
  };
  await e.ir('#/n/conceptos/capital.md');
  await e.pagina.locator('#btn-ajustes').focus();
  await probar(() => e.pagina.click('#btn-ajustes'), '#ajustes', () => e.pagina.keyboard.press('Escape'));
  assert.ok(await e.pagina.evaluate(() => document.activeElement.id === 'btn-ajustes'), 'ajustes: al cerrar el foco no vuelve a su botón');
  await probar(() => e.pagina.click('#btn-nueva-nota'), '#nueva-nota', () => e.pagina.keyboard.press('Escape'));
  const bloque = e.pagina.locator('#nota .bloque').nth(1);
  await probar(async () => { await bloque.hover(); await bloque.locator('[data-accion="editar"]').click(); }, '#editor', () => e.pagina.keyboard.press('Escape'));
});

test('contraste en oscuro: el enlace del panel Tareas pasa de 4,5:1 y los controles nativos siguen el tema (color-scheme)', async () => {
  await e.ir('#/tareas');
  const medir = async tema => {
    await e.pagina.evaluate(t => { document.documentElement.dataset.tema = t; }, tema);
    return e.pagina.evaluate(() => ({ enlace: getComputedStyle(document.querySelector('#panel .resumen a')).color, fondo: getComputedStyle(document.body).backgroundColor, esquema: getComputedStyle(document.documentElement).colorScheme }));
  };
  const oscuro = await medir('oscuro'), claro = await medir('claro');
  assert.ok(contraste(oscuro.enlace, oscuro.fondo) >= 4.5, `oscuro: el enlace ${oscuro.enlace} sobre ${oscuro.fondo} da ${contraste(oscuro.enlace, oscuro.fondo).toFixed(2)}:1`);
  assert.ok(contraste(claro.enlace, claro.fondo) >= 4.5, `claro: el enlace ${claro.enlace} sobre ${claro.fondo} da ${contraste(claro.enlace, claro.fondo).toFixed(2)}:1`);
  assert.equal(oscuro.esquema, 'dark', 'oscuro: color-scheme no es dark'); assert.equal(claro.esquema, 'light', 'claro: color-scheme no es light');
});

test('casillas de una nota: toda la línea marca y la casilla tiene nombre accesible', async () => {
  await e.ir('#/n/sesiones/01-01-01-sesion.md');
  const casilla = e.pagina.getByRole('checkbox', { name: /Hecho ya/ });
  await visible(casilla, 'casillas', 'la casilla «Hecho ya» con su nombre accesible');
  assert.equal(await casilla.isChecked(), true);
  await e.pagina.locator('#nota label.casilla-linea', { hasText: 'Hecho ya' }).click({ position: { x: 90, y: 6 } });   // sobre el texto, lejos del cuadrado
  await ficheroCumple(e.c, 'sesiones/01-01-01-sesion.md', /- \[ \] Hecho ya/, 'casillas');
  assert.equal(await casilla.isChecked(), false, 'casillas: clicar el texto no ha desmarcado la casilla');
});

test('errores: el aviso se queda hasta cerrarlo, dice qué pasó y pliega el detalle técnico; el diálogo de resultado, igual', async () => {
  await e.ir('#/n/material/material.md');
  await e.pagina.route('**/api/papelera', r => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'EPERM: operation not permitted, trash /tmp/algo' }) }));
  const fila = e.pagina.locator('#arbol .fila', { has: e.pagina.locator('a.hoja', { hasText: 'gastos-octubre.json' }) });
  await fila.hover();
  await fila.locator('button.papelera').click();
  const aviso = await visible(e.pagina.locator('.aviso-flotante.error[role="alert"]'), 'errores', 'el aviso de error');
  assert.match(await aviso.locator('> span').textContent(), /^No se ha podido mandar a la papelera/);
  assert.equal(await aviso.locator('pre').isVisible(), false, 'errores: el detalle técnico está a la vista');
  await e.pagina.waitForTimeout(3000);   // un aviso informativo se habría ido a los 2,2 s
  assert.equal(await aviso.isVisible(), true, 'errores: el aviso de error ha desaparecido solo');
  await aviso.locator('summary').click();
  await conTexto(aviso.locator('pre'), /EPERM/, 'errores', 'el detalle técnico al desplegarlo');
  await aviso.locator('.cerrar-aviso').click();
  await oculto(e.pagina.locator('.aviso-flotante.error'), 'errores', 'el aviso tras cerrarlo');
  await e.pagina.unroute('**/api/papelera');
  // El diálogo de resultado de una herramienta que falla.
  await e.pagina.evaluate(() => mostrarResultado('Deshacer', { codigo: 1, salida: "Error: Cannot find module '/ruta/.kit/herramientas/deshacer.js'\n    at Module._resolveFilename (node:internal/modules/cjs/loader:1)" }));
  await conTexto(e.pagina.locator('#resultado-humano'), /^No se pudo deshacer: falta una herramienta del kit/, 'resultado', 'la frase que dice qué pasó');
  assert.equal(await e.pagina.locator('#resultado-texto').isVisible(), false, 'resultado: la traza está a la vista');
  await e.pagina.locator('#resultado-detalle summary').click();
  await visible(e.pagina.locator('#resultado-texto'), 'resultado', 'la salida de la herramienta al desplegar «Ver detalle»');
  await e.pagina.click('#resultado-cerrar');
  // Si todo va bien, la salida se lee entera, sin plegar.
  await e.pagina.evaluate(() => mostrarResultado('Guardar', { codigo: 0, salida: 'Guardado y subido.' }));
  await visible(e.pagina.locator('#resultado-texto'), 'resultado', 'la salida de un guardado correcto');
  assert.equal(await e.pagina.locator('#resultado-humano').isVisible(), false, 'resultado: sale la frase de fallo en un guardado correcto');
  await e.pagina.click('#resultado-cerrar');
});
