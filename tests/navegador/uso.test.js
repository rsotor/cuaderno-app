'use strict';
// Recorridos de uso: no una función cada uno, sino lo que pasa cuando alguien usa la app un rato con un repo
// debajo (primer uso de Roberto, 2026-10-08): leer sin que el scroll se mueva, cambiar un ajuste y verlo,
// abrir una carpeta del árbol y una nota dentro.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { arrancar, hasta, visible, oculto, conTexto, hashCumple } = require('./ayuda');

let e;
const git = (...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: e.c.raiz, stdio: 'pipe' });
test.before(async () => {
  e = await arrancar({ kit: false });
  // Una nota larga de verdad y un repo debajo, como cualquier cuaderno real: cada `git status` del servidor crea .git/index.lock.
  fs.writeFileSync(path.join(e.c.base, 'larga.md'), `# Larga\n\n${Array.from({ length: 120 }, (_, i) => `Párrafo ${i + 1} de una nota que no cabe en la pantalla.\n`).join('\n')}`);
  git('init', '-q'); git('add', '-A'); git('commit', '-q', '-m', 'base');
  // El vigilante de ficheros tarda en avisar (FSEvents en macOS, hasta 1 s). Se espera a que la recarga en vivo pinte
  // «Larga» en el árbol: así todos los avisos de estas escrituras ya han pasado y no se cuelan en el primer recorrido.
  await visible(e.pagina.locator('#arbol a.hoja', { hasText: 'Larga' }), 'arranque', 'la nota larga en el árbol por la recarga en vivo');
});
test.after(async () => { if (e) await e.cerrar(); });

test('leer con un repo debajo: ni git ni un cambio en otra nota mueven el scroll ni repintan en bucle', async () => {
  await e.ir('#/n/larga.md');
  await conTexto(e.pagina.locator('#nota h1'), /^Larga$/, 'nota larga', 'el título');
  await e.pagina.evaluate(() => { document.querySelector('#centro').scrollTop = 1500; });
  const repintados = []; e.pagina.on('request', r => { if (r.url().includes('/api/nota?')) repintados.push(r.url()); });
  // Lo que hace el servidor solo: git status (y su index.lock) al pedir /api/info.
  git('status', '--porcelain');
  await e.pagina.waitForTimeout(1200);
  assert.equal(repintados.length, 0, `nota larga: un git status ha repintado la nota ${repintados.length} veces; .git/ no es un cambio del cuaderno`);
  // Un cambio de verdad en otra nota: una recarga en vivo, y solo una, y el scroll donde estaba.
  fs.appendFileSync(path.join(e.c.base, 'tareas.md'), '- [ ] Otra tarea\n');
  await hasta(() => repintados.length >= 1, 'nota larga', 'la recarga en vivo no ha repintado la nota tras cambiar tareas.md');
  await e.pagina.waitForTimeout(1500);
  assert.equal(repintados.length, 1, `nota larga: la recarga en vivo ha repintado la nota ${repintados.length} veces por un solo cambio`);
  const scroll = await e.pagina.evaluate(() => document.querySelector('#centro').scrollTop);
  assert.equal(scroll, 1500, `nota larga: el scroll se ha movido a ${scroll} tras la recarga en vivo`);
});

test('ajustes: tema y fuente se aplican al momento, sin botón, y siguen tras recargar la página', async () => {
  await e.ir('#/n/larga.md');
  await e.pagina.click('#btn-ajustes');
  await visible(e.pagina.locator('#ajustes-tema'), 'ajustes', 'el selector de tema');
  await e.pagina.selectOption('#ajustes-tema', 'claro');
  await e.pagina.selectOption('#ajustes-fuente', 'serif');
  await hasta(() => e.pagina.evaluate(() => document.documentElement.dataset.tema === 'claro' && document.documentElement.dataset.fuente === 'serif'), 'ajustes', 'el tema claro y la fuente con serifa no se aplican al cambiar el selector');
  const fondo = await e.pagina.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.match(fondo, /rgb\(2\d\d, 2\d\d, 2\d\d\)/, `ajustes: con tema claro el fondo es ${fondo}`);
  await e.pagina.reload();
  await hasta(() => e.pagina.evaluate(() => document.documentElement.dataset.tema === 'claro' && document.documentElement.dataset.fuente === 'serif'), 'ajustes', 'tras recargar la página se pierden el tema y la fuente');
  await e.pagina.click('#btn-ajustes'); await e.pagina.selectOption('#ajustes-tema', 'auto'); await e.pagina.selectOption('#ajustes-fuente', 'sistema');
});

test('árbol: las carpetas se pliegan y despliegan, y una nota dentro cambia de nota y empieza arriba', async () => {
  await e.ir('#/n/larga.md');
  await e.pagina.evaluate(() => { document.querySelector('#centro').scrollTop = 1500; });
  const carpeta = await visible(e.pagina.locator('#arbol summary', { hasText: 'conceptos' }), 'árbol', 'la carpeta «conceptos»');
  // La marca de carpeta es un chevron de 14 px que gira al abrir: así se distingue de una página y se ve el estado.
  const marca = () => carpeta.evaluate(el => { const c = getComputedStyle(el, '::before'); return { ancho: c.width, giro: c.transform }; });
  const abierta = await marca();   // plegada: el chevron sin girar
  assert.equal(abierta.ancho, '14px', `árbol: el chevron de la carpeta mide ${abierta.ancho}, no 14px`);
  // Plegada por defecto (Roberto, 2026-10-09): la nota de dentro no se ve hasta abrirla.
  await oculto(e.pagina.locator('#arbol a.hoja', { hasText: 'Capital' }), 'árbol', 'la nota «Capital» con la carpeta plegada por defecto');
  await carpeta.click();
  await hasta(async () => (await marca()).giro !== abierta.giro, 'árbol', 'el chevron no gira al abrir la carpeta');
  const nota = await visible(e.pagina.locator('#arbol a.hoja', { hasText: 'Capital' }), 'árbol', 'la nota «Capital» dentro de la carpeta abierta');
  await nota.click();
  await hashCumple(e.pagina, /^#\/n\/conceptos\/capital\.md$/, 'árbol');
  await conTexto(e.pagina.locator('#nota h1'), /^Capital$/, 'nota', 'el título «Capital»');
  const scroll = await e.pagina.evaluate(() => document.querySelector('#centro').scrollTop);
  assert.equal(scroll, 0, `nota: una nota nueva debería empezar arriba y está en ${scroll}`);
});

test('nota nueva: el botón abre el modal, Enter la crea en la carpeta de la nota abierta y la abre; tareas.md no sale en el árbol', async () => {
  await e.ir('#/n/conceptos/capital.md');
  assert.equal(await e.pagina.locator('#arbol a.hoja[data-ruta="tareas.md"]').count(), 0, 'árbol: tareas.md se ve en el panel Tareas, no dos veces');
  await e.pagina.click('#btn-nueva-nota');
  await visible(e.pagina.locator('#nueva-nota-nombre'), 'nueva nota', 'el campo del título');
  assert.equal(await e.pagina.inputValue('#nueva-nota-carpeta'), 'conceptos', 'nueva nota: la carpeta por defecto es la de la nota abierta');
  await e.pagina.keyboard.type('Idea rápida');
  await e.pagina.keyboard.press('Enter');
  await hashCumple(e.pagina, /^#\/n\/conceptos\/Idea%20r%C3%A1pida\.md$/, 'nueva nota');
  await conTexto(e.pagina.locator('#nota h1'), /^Idea rápida$/, 'nueva nota', 'el título de la nota recién creada');
  await hasta(() => fs.existsSync(path.join(e.c.base, 'conceptos/Idea rápida.md')), 'nueva nota', 'el fichero no está en el cuaderno');
  await visible(e.pagina.locator('#arbol a.hoja', { hasText: 'Idea rápida' }), 'nueva nota', 'la nota nueva en el árbol');
});

test('buscador sin resultados: no crea nada con Enter (buscar, «+» tarea y nota nueva no se mezclan)', async () => {
  await e.ir('#/n/larga.md');
  await e.pagina.keyboard.press('Control+k');
  await e.pagina.keyboard.type('Pendientes de hoy');
  await conTexto(e.pagina.locator('#arbol .vacio'), /Nada con «Pendientes de hoy»/, 'buscador', 'el aviso de que no hay resultados');
  await e.pagina.keyboard.press('Enter');
  await e.pagina.waitForTimeout(500);
  assert.equal(await e.pagina.locator('#nueva-nota').isVisible(), false, 'buscador: Enter sin resultados no debe abrir «Nueva nota»');
  assert.ok(!fs.existsSync(path.join(e.c.base, 'Pendientes de hoy.md')), 'buscador: Enter sin resultados no debe crear una nota');
});

test('otra pestaña abre otro cuaderno: esta se entera, lo dice y pasa al nuevo (un servidor, un cuaderno)', async () => {
  const { crearCuaderno } = require('../ayuda');
  const otro = crearCuaderno({ kit: false });
  try {
    await e.ir('#/n/larga.md');
    await conTexto(e.pagina.locator('#nota h1'), /^Larga$/, 'nota larga', 'el título');
    // «Otra pestaña»: una petición con la misma cookie, fuera de la página; lo que se prueba es cómo reacciona esta.
    const abrir = ruta => e.pagina.request.post(`${e.base}/api/abrir`, { data: { ruta }, headers: { origin: e.base } });
    await abrir(otro.raiz);
    await conTexto(e.pagina.locator('.aviso-flotante'), /ha abierto otro cuaderno/, 'pestaña vieja', 'el aviso de que el servidor cambió de cuaderno');
    await hasta(() => e.pagina.evaluate(() => !location.hash.includes('larga.md')), 'pestaña vieja', 'sigue en la nota del cuaderno anterior');
    await conTexto(e.pagina.locator('#nombre-curso'), new RegExp(path.basename(otro.raiz)), 'pestaña vieja', 'el nombre del cuaderno nuevo en la barra');
    await abrir(e.c.raiz);
    await conTexto(e.pagina.locator('#nombre-curso'), new RegExp(path.basename(e.c.raiz)), 'pestaña vieja', 'de vuelta al cuaderno de las pruebas');
  } finally { otro.borrar(); }
});

test('árbol: las carpetas salen plegadas salvo la de la nota abierta, y la que abres sigue abierta tras una recarga en vivo', async () => {
  await e.ir('#/n/conceptos/capital.md');
  const abierta = nombre => e.pagina.locator('#arbol details', { has: e.pagina.locator('summary', { hasText: nombre }) }).first().evaluate(d => d.open);
  // El árbol se pinta después de la nota: se espera a que marque la nota abierta (en Windows tarda más que en un Mac).
  await visible(e.pagina.locator('#arbol a.hoja.activa', { hasText: 'Capital' }), 'árbol', 'la nota abierta marcada en el árbol');
  await hasta(() => abierta('conceptos'), 'árbol', 'la carpeta de la nota abierta sale plegada');
  assert.equal(await abierta('sesiones'), false, 'árbol: una carpeta sin la nota abierta sale desplegada');
  await e.pagina.locator('#arbol summary', { hasText: 'sesiones' }).click();
  await hasta(() => abierta('sesiones'), 'árbol', 'la carpeta «sesiones» no se abre al pulsarla');
  // Una recarga en vivo repinta el árbol: se espera a que llegue (la petición del árbol) antes de mirar.
  const repintado = e.pagina.waitForResponse(r => r.url().endsWith('/api/arbol'), { timeout: 8000 });
  fs.appendFileSync(path.join(e.c.base, 'tareas.md'), '- [ ] Una más\n');
  await repintado; await e.pagina.waitForTimeout(200);
  assert.equal(await abierta('sesiones'), true, 'árbol: la recarga en vivo ha plegado la carpeta que abrió la persona');
});
