'use strict';
// «Tareas que la mencionan» al final de una nota: las casillas de otras notas que la enlazan o la nombran con
// #etiqueta (o con el nombre de su carpeta, en el brief), marcables desde ahí, y el filtro por nota del panel Tareas.
// Con kit: agrupar las casillas de todas las notas es lo que añade el kit (iniciativas/mudanza/pendientes.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const { arrancar, visible, oculto, conTexto, ficheroCumple } = require('./ayuda');

let e;
test.before(async () => { e = await arrancar({ kit: true }); });
test.after(async () => { if (e) await e.cerrar(); });

const mencion = texto => e.pagina.locator('#nota .menciones .item', { hasText: texto });

test('una persona: ve las tareas que la enlazan o la etiquetan (#Ana), marca una y queda [x] en el fichero', async () => {
  await e.ir('#/n/personas/ana.md');
  await conTexto(e.pagina.locator('#nota h1'), /^Ana$/, 'ana', 'el título');
  await conTexto(e.pagina.locator('#nota .menciones h2'), /^Tareas que la mencionan$/, 'ana', 'la sección al final de la nota');
  await visible(mencion('Llamar a ana por las llaves'), 'ana', 'la tarea que enlaza [[ana]]');
  await visible(mencion('Pedir la caja de herramientas').locator('.etiqueta', { hasText: '#Ana' }), 'ana', 'la tarea con #Ana y su etiqueta pintada');
  await oculto(mencion('Embalar la cocina'), 'ana', 'una tarea de otra nota');
  await visible(mencion('Llamar').locator('a.origen', { hasText: 'Agenda de pendientes' }), 'ana', 'el enlace pequeño a la nota donde vive');
  assert.equal(await e.pagina.locator('#nota .menciones .item').count(), 2, 'ana: salen más tareas de las que la mencionan');
  await mencion('Llamar a ana').locator('input').check();
  await ficheroCumple(e.c, 'iniciativas/mudanza/pendientes.md', /\n- \[x\] Llamar a \[\[ana\]\] por las llaves\n/, 'ana');
  // Recarga en vivo: la nota se repinta con la tarea hecha, después de las pendientes.
  await hastaTexto('#nota .menciones .item:last-of-type', /Llamar a ana/);
  await visible(e.pagina.locator('#nota .menciones .item.hecha', { hasText: 'Llamar a ana' }), 'ana', 'la tarea tachada tras marcarla');
});

test('una carpeta: el brief recibe las de #mudanza, pendientes primero y hechas después; la propia nota no las repite', async () => {
  await e.ir('#/n/iniciativas/mudanza/brief.md');
  await conTexto(e.pagina.locator('#nota h1'), /^Mudanza$/, 'brief', 'el título');
  const t = await e.pagina.locator('#nota .menciones .item').allTextContents();
  assert.equal(t.length, 2, `brief: salen ${t.length} tareas`);
  assert.match(t[0], /Embalar la cocina/); assert.match(t[1], /Reservar el camión/);
  assert.equal(await e.pagina.locator('#nota .menciones .item').nth(1).evaluate(el => el.classList.contains('hecha')), true, 'brief: la hecha no va la última y tachada');
  await e.ir('#/n/iniciativas/mudanza/pendientes.md');
  await oculto(e.pagina.locator('#nota .menciones'), 'pendientes', 'la sección, sin tareas de otras notas (las suyas ya están en ella)');
});

test('el filtro por nota del panel Tareas cuenta también las que la mencionan por etiqueta', async () => {
  await e.ir('#/tareas?nota=ana');
  await visible(e.pagina.locator('#panel .item', { hasText: 'Pedir la caja de herramientas' }), 'tareas · nota', 'la tarea con #Ana');
  await visible(e.pagina.locator('#panel .item', { hasText: 'Llamar a ana' }), 'tareas · nota', 'la tarea que enlaza [[ana]]');
  await oculto(e.pagina.locator('#panel .item', { hasText: 'Embalar la cocina' }), 'tareas · nota', 'una tarea de otra nota');
});

async function hastaTexto(selector, re) { await conTexto(e.pagina.locator(selector), re, 'ana', 'la tarea marcada, ya al final de la sección'); }
