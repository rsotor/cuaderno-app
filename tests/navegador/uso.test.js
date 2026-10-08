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
  e = await arrancar({ kit: 'carpeta' });
  // Una nota larga de verdad y un repo debajo, como cualquier cuaderno real: cada `git status` del servidor crea .git/index.lock.
  fs.writeFileSync(path.join(e.c.base, 'larga.md'), `# Larga\n\n${Array.from({ length: 120 }, (_, i) => `Párrafo ${i + 1} de una nota que no cabe en la pantalla.\n`).join('\n')}`);
  git('init', '-q'); git('add', '-A'); git('commit', '-q', '-m', 'base');
  // El vigilante de ficheros tarda en avisar (FSEvents en macOS, hasta 1 s): se espera a que la nota nueva esté en el índice.
  await hasta(() => e.pagina.evaluate(() => fetch('/api/arbol').then(r => r.json()).then(a => JSON.stringify(a).includes('larga.md'))), 'arranque', 'larga.md no llega al índice');
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
  const abierta = await marca();
  assert.equal(abierta.ancho, '14px', `árbol: el chevron de la carpeta mide ${abierta.ancho}, no 14px`);
  await carpeta.click();   // abierta por defecto: el primer clic la pliega
  await hasta(async () => (await marca()).giro !== abierta.giro, 'árbol', 'el chevron no gira al plegar la carpeta');
  await oculto(e.pagina.locator('#arbol a.hoja', { hasText: 'Capital' }), 'árbol', 'la nota «Capital» con la carpeta plegada');
  await carpeta.click();
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

test('nota nueva desde el buscador: sin resultados, Enter propone crearla con ese título', async () => {
  await e.ir('#/n/larga.md');
  await e.pagina.keyboard.press('Control+k');
  await e.pagina.keyboard.type('Pendientes de hoy');
  await visible(e.pagina.locator('#arbol button.crear'), 'buscador', 'la propuesta de crear la nota cuando no hay resultados');
  await e.pagina.keyboard.press('Enter');
  await visible(e.pagina.locator('#nueva-nota-nombre'), 'buscador', 'el modal de nota nueva');
  assert.equal(await e.pagina.inputValue('#nueva-nota-nombre'), 'Pendientes de hoy');
  await e.pagina.selectOption('#nueva-nota-carpeta', '');
  await e.pagina.keyboard.press('Enter');
  await hashCumple(e.pagina, /^#\/n\/Pendientes%20de%20hoy\.md$/, 'buscador');
  await hasta(() => fs.existsSync(path.join(e.c.base, 'Pendientes de hoy.md')), 'buscador', 'el fichero no está en el cuaderno');
});
