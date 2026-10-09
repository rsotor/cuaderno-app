'use strict';
// Casos de uso que no tenían recorrido (plan del cuaderno de ejemplo, T4): comentar un bloque, Guardar / Traer /
// Deshacer desde la pantalla, la pantalla de Cuadernos y las notas de render/ y estructura/ del cuaderno de ejemplo.
// Todo sin kit: es la base de la app (AGENTS.md, principio 3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { arrancar, hasta, visible, oculto, conTexto, ficheroCumple, hashCumple } = require('./ayuda');
const { crearCuaderno } = require('../ayuda');

let e, remoto;
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, stdio: 'pipe', encoding: 'utf8' }).trim();
const abrirCarpeta = async nombre => { const s = e.pagina.locator('#arbol summary', { hasText: nombre }); if (!(await s.evaluate(x => x.parentElement.open))) await s.click(); };
const cerrarResultado = async () => { await e.pagina.click('#resultado-cerrar'); await oculto(e.pagina.locator('#resultado'), 'resultado', 'el modal de resultado'); };

test.before(async () => {
  e = await arrancar({ kit: false });
  // Un repo con remoto, como un cuaderno de verdad: Guardar sube, Traer baja, Deshacer revierte.
  remoto = fs.mkdtempSync(path.join(os.tmpdir(), 'remoto-'));
  git(remoto, 'init', '-q', '--bare', '-b', 'main');
  git(e.c.raiz, 'init', '-q', '-b', 'main'); git(e.c.raiz, 'config', 'user.email', 't@t'); git(e.c.raiz, 'config', 'user.name', 'Prueba'); git(e.c.raiz, 'add', '-A'); git(e.c.raiz, 'commit', '-q', '-m', 'base');
  git(e.c.raiz, 'remote', 'add', 'origin', remoto); git(e.c.raiz, 'push', '-q', '-u', 'origin', 'main');
  // El vigilante de ficheros avisa con retraso (hasta 1 s en macOS) de lo que acaba de escribir git: se espera a que
  // pase, o la recarga en vivo repinta la nota justo cuando el primer recorrido pulsa un botón (como en uso.test.js).
  await e.ir('#/n/conceptos/capital.md');
  await e.pagina.waitForTimeout(1500);
});
test.after(async () => { if (e) await e.cerrar(); if (remoto) fs.rmSync(remoto, { recursive: true, force: true }); });

test('comentar un bloque: queda como callout debajo del bloque y sale en el panel Comentarios', async () => {
  await e.ir('#/n/conceptos/capital.md');
  const bloque = e.pagina.locator('#nota .bloque').nth(1);
  await bloque.hover();
  await bloque.locator('[data-accion="comentar"]').click();
  await visible(e.pagina.locator('#editor-texto'), 'comentar', 'el editor del comentario');
  await e.pagina.fill('#editor-texto', 'No entiendo lo del capital inicial');
  await e.pagina.click('#editor-guardar');
  await ficheroCumple(e.c, 'conceptos/capital.md', /> \[!comment\][^\n]*\n> No entiendo lo del capital inicial/, 'comentar');
  await e.ir('#/comentarios');
  await conTexto(e.pagina.locator('#panel'), /No entiendo lo del capital inicial/, 'comentarios', 'el comentario en el panel');
});

test('Guardar, Traer y Deshacer desde la pantalla, sin kit: commit con el mensaje, subido; deshacer enseña antes y revierte', async () => {
  await e.ir('#/');
  fs.appendFileSync(path.join(e.c.base, 'tareas.md'), '- [ ] Desde la prueba de guardar\n');
  await e.pagina.click('#btn-guardar');
  await visible(e.pagina.locator('#guardar-mensaje'), 'guardar', 'el mensaje propuesto');
  await e.pagina.fill('#guardar-mensaje', 'Prueba de guardar');
  await e.pagina.click('#guardar-ok');
  await visible(e.pagina.locator('#resultado'), 'guardar', 'el resultado de guardar');
  await hasta(() => git(e.c.raiz, 'log', '-1', '--format=%s') === 'Prueba de guardar', 'guardar', 'no hay commit con el mensaje');
  assert.equal(git(remoto, 'log', '-1', '--format=%s', 'main'), 'Prueba de guardar', 'guardar: el commit no se ha subido al remoto');
  await cerrarResultado();
  await e.pagina.click('#btn-traer');
  await visible(e.pagina.locator('#resultado'), 'traer', 'el resultado de traer');
  await cerrarResultado();
  await e.pagina.click('#btn-deshacer');
  await visible(e.pagina.locator('#resultado-confirmar'), 'deshacer', 'el botón de confirmar tras enseñar qué se deshace');
  await conTexto(e.pagina.locator('#resultado-texto'), /Prueba de guardar|tareas\.md/, 'deshacer', 'lo que se va a deshacer');
  await e.pagina.click('#resultado-confirmar');
  await ficheroCumple(e.c, 'tareas.md', /^(?![\s\S]*Desde la prueba de guardar)/, 'deshacer');
});

test('render: propiedades de cada tipo, enlaces de cada forma, callouts, imágenes, código y fórmulas', async () => {
  await e.ir('#/n/render/propiedades.md');
  for (const [k, v] of [['titulo', 'Presupuesto de octubre'], ['importe_total', '1800'], ['revisado', 'true'], ['fecha', '2026-10-01']]) {
    await conTexto(e.pagina.locator('#nota dl.propiedades'), new RegExp(`${k}\\s*${v}`), 'propiedades', `la propiedad ${k}`);
  }
  assert.equal(await e.pagina.locator('#nota dl.propiedades .etiqueta').count(), 2, 'propiedades: la lista no sale como dos etiquetas');
  await e.ir('#/n/render/enlaces.md');
  assert.equal(await e.pagina.locator('#nota a.wiki.roto').count(), 0, 'enlaces: hay enlaces rotos');
  for (const [texto, destino] of [['la primera sesión', '#/n/sesiones/01-01-01-sesion.md'], ['1.1', '#/n/sesiones/01-01-01-sesion.md'], ['gastos-octubre.csv', '#/n/material/gastos-octubre.csv'], ['las propiedades', '#/n/render/propiedades.md']]) {
    assert.equal(await e.pagina.locator('#nota a', { hasText: texto }).first().getAttribute('href'), destino, `enlaces: «${texto}» no lleva a ${destino}`);
  }
  assert.equal(await e.pagina.locator('#nota a', { hasText: 'la web del curso' }).getAttribute('href'), 'https://example.com');
  await e.ir('#/n/render/callouts-e-imagenes.md');
  for (const tipo of ['note', 'warning', 'tip']) await visible(e.pagina.locator(`#nota .callout-titulo[data-tipo="${tipo}"]`), 'callouts', `el callout ${tipo}`);
  await hasta(() => e.pagina.locator('#nota img').evaluateAll(imgs => imgs.length === 2 && imgs.every(i => i.complete && i.naturalWidth > 0)), 'imágenes', 'las dos imágenes (Markdown y ![[ ]]) no cargan');
  await conTexto(e.pagina.locator('#nota'), /@@ Una nota de revisión/, 'callouts', 'la línea @@ (hoy se pinta como texto; Inbox)');
  await e.ir('#/n/render/codigo-y-formulas.md');
  await visible(e.pagina.locator('#nota pre code'), 'código', 'el bloque de código');
  await hasta(async () => (await e.pagina.locator('#nota .katex').count()) >= 2, 'fórmulas', 'las dos fórmulas no salen con KaTeX');
});

test('estructura: un nombre con acentos y espacios se abre y se busca; dos notas con el mismo título se distinguen en el árbol por su fichero; «_» no sale', async () => {
  await e.ir('#/');
  await abrirCarpeta('estructura');
  await (await visible(e.pagina.locator('#arbol a.hoja', { hasText: 'Nota con acentos y espacios' }), 'estructura', 'la nota con acentos')).click();
  await conTexto(e.pagina.locator('#nota h1'), /^Nota con acentos y espacios$/, 'estructura', 'el título de la nota con acentos');
  await e.pagina.fill('#buscador', 'acentos y espacios');
  await visible(e.pagina.locator('#arbol a.resultado', { hasText: 'Nota con acentos y espacios' }), 'buscador', 'la nota con acentos en el buscador');
  await e.pagina.fill('#buscador', ''); await e.pagina.press('#buscador', 'Escape');
  await abrirCarpeta('estructura');
  // El árbol enseña el nombre del fichero, no el título (Roberto, 2026-10-09): dos notas con el mismo título no se confunden.
  const repetidas = e.pagina.locator('#arbol a.hoja', { hasText: 'repetida-' });
  await hasta(async () => (await repetidas.count()) === 2, 'estructura', 'las dos notas «Repetida»');
  assert.deepEqual(await repetidas.locator('.nombre').allTextContents(), ['repetida-a', 'repetida-b'], 'estructura: el árbol no las nombra por su fichero');
  assert.equal(await e.pagina.locator('#arbol summary', { hasText: '_archivo' }).count(), 0, 'estructura: la carpeta «_archivo» sale en el árbol');
});

test('Tareas sin kit: el panel solo enseña tareas.md (no las casillas de otras notas) y «+» añade ahí', async () => {
  await e.ir('#/tareas');
  await visible(e.pagina.locator('#panel .grupo h2 a', { hasText: 'Mis tareas' }), 'tareas', 'el grupo de tareas.md');
  assert.equal(await e.pagina.locator('#panel .grupo').count(), 1, 'tareas: sin kit salen casillas de otras notas');
  await e.pagina.keyboard.press('Control+k');
  await e.pagina.keyboard.type('+ Una tarea sin kit');
  await e.pagina.keyboard.press('Enter');
  await ficheroCumple(e.c, 'tareas.md', /\r?\n- \[ \] Una tarea sin kit\r?\n/, 'tareas');   // CRLF en Windows: git lo convierte al deshacer en el recorrido de Guardar
  await hasta(async () => (await e.pagina.inputValue('#buscador')) === '', 'tareas', 'la tarea se queda escrita en el buscador tras añadirla');
  // Y desde el campo del panel: se vacía aunque el panel conserve su borrador al repintar.
  await e.pagina.fill('#tarea-nueva', 'Otra desde el panel'); await e.pagina.press('#tarea-nueva', 'Enter');
  await ficheroCumple(e.c, 'tareas.md', /- \[ \] Otra desde el panel/, 'tareas');
  await hasta(async () => (await e.pagina.inputValue('#tarea-nueva')) === '', 'tareas', 'la tarea se queda escrita en el campo del panel tras añadirla');
});

// Al final: cambia el cuaderno abierto en el servidor, y los recorridos de antes cuentan con el del principio.
test('pantalla de Cuadernos: el abierto sale en recientes; abrir otro por su ruta y quitarlo de la lista', async () => {
  const otro = crearCuaderno({ kit: false });
  // Abrir por la ruta y esperar a que el servidor conteste y la app llegue a la portada: así ningún salto pendiente se
  // lleva por delante la pantalla siguiente (en la CI, más lenta, pasaba).
  const abrirPorRuta = async ruta => {
    await e.ir('#/cuadernos');
    await e.pagina.fill('#ruta-carpeta', ruta);
    const [r] = await Promise.all([e.pagina.waitForResponse(x => x.url().endsWith('/api/abrir')), e.pagina.press('#ruta-carpeta', 'Enter')]);
    assert.equal(r.status(), 200, `cuadernos: abrir ${ruta} da ${r.status()}`);
    await conTexto(e.pagina.locator('#nombre-curso'), new RegExp(path.basename(ruta)), 'cuadernos', 'el nombre del cuaderno abierto');
    await hashCumple(e.pagina, /^#\/n\/inicio\.md$/, 'cuadernos');
  };
  // La lista que da el servidor y la que se pinta, para que un fallo diga cuál de las dos no lo tiene.
  const recientes = async () => {
    const lista = (await (await e.pagina.request.get(`${e.base}/api/cuadernos`, { headers: { origin: e.base } })).json()).map(c => c.ruta);
    await e.ir('#/cuadernos');
    return lista;
  };
  try {
    // El cuaderno de los recorridos se abre al arrancar, sin pasar por la lista: se abre una vez por su ruta para que entre.
    await abrirPorRuta(e.c.raiz);
    assert.ok((await recientes()).includes(e.c.raiz), 'cuadernos: el servidor no lo apunta en recientes');
    await visible(e.pagina.locator('#panel .cuaderno.abierto'), 'cuadernos', 'el cuaderno abierto en recientes');
    await abrirPorRuta(otro.raiz);
    const lista = await recientes();
    assert.deepEqual([...lista].sort(), [e.c.raiz, otro.raiz].sort(), 'cuadernos: el servidor no lista los dos');
    const fila = e.pagina.locator('#panel .cuaderno', { hasText: path.basename(e.c.raiz) });
    await (await visible(fila, 'cuadernos', `el cuaderno anterior en recientes (en pantalla: «${(await e.pagina.locator('#panel').textContent()).slice(0, 200)}»)`)).locator('button[data-olvidar]').click();
    await oculto(fila, 'cuadernos', 'el cuaderno quitado de la lista');
    assert.ok(fs.existsSync(e.c.raiz), 'quitar de la lista ha borrado la carpeta');
    // De vuelta al cuaderno del resto de recorridos.
    await abrirPorRuta(e.c.raiz);
  } finally { otro.borrar(); }
});
