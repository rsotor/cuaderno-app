'use strict';
// Ver cualquier fichero del cuaderno (fase 10): cada tipo se pinta bien al pulsarlo en el árbol, y un botón lo
// muestra en el Finder (o el Explorador). Ejemplos de cada tipo en ejemplos/cuaderno-ejemplo/material/.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { arrancar, hasta, visible, oculto, conTexto } = require('./ayuda');

let e;
// Hoja de lectura (texto) o sin ella (PDF, HTML, imagen, vídeo, audio y lo que no se sabe enseñar), Roberto, 2026-10-09.
const sinHoja = () => e.pagina.evaluate(() => getComputedStyle(document.querySelector('#nota')).backgroundColor === 'rgba(0, 0, 0, 0)' && document.querySelector('#nota').classList.contains('ancha'));
const conHoja = () => e.pagina.evaluate(() => getComputedStyle(document.querySelector('#nota')).backgroundColor !== 'rgba(0, 0, 0, 0)' && !document.querySelector('#nota').classList.contains('ancha'));
const hoja = nombre => e.pagina.locator('#arbol a.hoja', { hasText: nombre });
// Columna de lectura: centro de #nota y x del primer título (Roberto, 2026-10-09: sin hoja, la misma columna centrada que una nota).
// Las acciones de la nota abierta (antes botones de la miga) están en el menú «…» de la barra superior.
const accionNota = async texto => { await e.pagina.locator('#btn-mas-nota').click(); await (await visible(e.pagina.locator('#menu-nota [role="menuitem"]', { hasText: texto }), 'menú de la nota', `la acción «${texto}»`)).click(); };
const columna = () => e.pagina.evaluate(() => { const b = document.querySelector('#nota').getBoundingClientRect(), h = document.querySelector('#nota h1').getBoundingClientRect(), m = document.querySelector('#miga').getBoundingClientRect(); return { centro: b.x + b.width / 2, titulo: h.x, miga: m.x }; });
const referencia = async () => { await e.ir('#/n/material/material.md'); return columna(); };   // una nota con hoja: la medida de la columna buena
const abrirDelArbol = async nombre => {
  const carpeta = e.pagina.locator('#arbol details', { has: e.pagina.locator('summary', { hasText: 'material' }) });
  if (!(await carpeta.evaluate(d => d.open))) await carpeta.locator('summary .nombre').click();
  await (await visible(hoja(nombre), 'árbol', `«${nombre}» en la carpeta material`)).click();
};
test.before(async () => { e = await arrancar({ kit: false }); });
test.after(async () => { if (e) await e.cerrar(); });

test('HTML: la página corre con su script, ocupa el ancho y casi todo el alto, el árbol la nombra por su fichero y la miga, con su <title>', async () => {
  await e.ir('#/');
  await abrirDelArbol('calculadora-50-30-20.html');
  const marco = await visible(e.pagina.locator('#nota iframe.ejercicio'), 'html', 'el iframe de la página');
  const f = e.pagina.frameLocator('#nota iframe.ejercicio');
  await conTexto(f.locator('[data-parte="Ahorro"]'), /360,00/, 'html', 'el cálculo del script (20 % de 1800)');
  await f.locator('#ingresos').fill('2000');
  await conTexto(f.locator('[data-parte="Ahorro"]'), /400,00/, 'html', 'el cálculo tras cambiar los ingresos');
  const caja = await marco.boundingBox(), centro = await e.pagina.locator('#centro').boundingBox();
  assert.ok(caja.width > centro.width - 120, `html: la página mide ${caja.width} px de ancho en una columna de ${centro.width}; se queda encajada en la columna de lectura`);
  assert.ok(caja.height > 600, `html: la página mide ${caja.height} px de alto en una ventana de 800`);
  assert.equal(await e.pagina.locator('#miga strong').textContent(), 'Calculadora 50/30/20', 'html: la miga no usa el título de la página');
  const miga = await e.pagina.locator('#miga').boundingBox();
  assert.ok(Math.abs(miga.x - caja.x) < 4, `html: la miga empieza en x=${miga.x} y la página en x=${caja.x}`);
});

test('PDF: se ve en el visor del navegador, a todo el ancho', async () => {
  await e.ir('#/');
  await abrirDelArbol('extracto-octubre.pdf');
  const visor = await visible(e.pagina.locator('#nota iframe.visor-pdf'), 'pdf', 'el visor');
  assert.match(await visor.getAttribute('src'), /\/fichero\/material\/extracto-octubre\.pdf$/);
  const r = await e.pagina.evaluate(src => fetch(src).then(x => x.headers.get('content-type')), await visor.getAttribute('src'));
  assert.equal(r, 'application/pdf', 'pdf: no se sirve como PDF');
  assert.ok((await visor.boundingBox()).height > 600, 'pdf: el visor no ocupa la ventana');
  assert.ok(await sinHoja(), 'pdf: sale con la hoja de lectura');
  const ancho = await e.pagina.evaluate(() => ({ visor: document.querySelector('#nota iframe.visor-pdf').getBoundingClientRect().width, centro: document.querySelector('#centro').clientWidth }));
  // El visor ocupa #centro menos los 40 px de margen a cada lado (como la miga); lo que queda es todo el ancho disponible.
  assert.ok(ancho.visor >= ancho.centro - 84 && ancho.visor <= ancho.centro, `pdf: el visor mide ${ancho.visor} px en una columna de ${ancho.centro}; debe ocupar el ancho de #centro`);
});

test('JSON con sangría; un JSON roto sale tal cual; CSV y TXT como texto; ninguno es editable', async () => {
  await e.ir('#/');
  await abrirDelArbol('gastos-octubre.json');
  await conTexto(e.pagina.locator('#nota pre.fichero-texto'), /\n  "ingresos": 1800,\n/, 'json', 'el JSON con sangría de dos espacios');
  assert.ok(await conHoja(), 'json: el texto sale sin la hoja de lectura');
  fs.writeFileSync(path.join(e.c.base, 'material', 'roto.json'), '{"a": 1,,}');
  await visible(hoja('roto.json'), 'json', 'el JSON roto en el árbol (recarga en vivo)');
  await abrirDelArbol('roto.json');
  await conTexto(e.pagina.locator('#nota pre.fichero-texto'), /^\{"a": 1,,\}$/, 'json roto', 'el texto tal cual');
  await abrirDelArbol('gastos-octubre.csv');
  await conTexto(e.pagina.locator('#nota .tabla-csv thead'), /concepto\s*categoria\s*importe/, 'csv', 'la cabecera de la tabla');
  assert.equal(await e.pagina.locator('#nota .tabla-csv tbody tr').count(), 4, 'csv: no salen las cuatro filas');
  assert.equal(await e.pagina.locator('#nota .tabla-csv td.cifra').first().textContent(), '650', 'csv: el importe no va como cifra');
  await e.pagina.locator('#nota .como-texto summary').click();
  await conTexto(e.pagina.locator('#nota .como-texto pre'), /^concepto,categoria,importe\nAlquiler/, 'csv', 'el texto tal cual tras «Ver como texto»');
  await abrirDelArbol('apuntes-de-clase.txt');
  await conTexto(e.pagina.locator('#nota pre.fichero-texto'), /fondo de emergencia/, 'txt', 'el texto');
  assert.ok(await conHoja(), 'txt: el texto sale sin la hoja de lectura');
  assert.equal(await e.pagina.locator('#nota .bloque, #nota [data-accion="editar"]').count(), 0, 'txt: un fichero de texto sale con acciones de editar');
});

test('los enlaces de una nota abren el visor del fichero; el buscador encuentra el PDF por su nombre', async () => {
  await e.ir('#/n/material/material.md');
  await e.pagina.locator('#nota a', { hasText: 'gastos de octubre' }).click();
  await conTexto(e.pagina.locator('#nota pre.fichero-texto'), /"mes": "2026-10"/, 'enlace', 'el JSON tras pulsar el enlace relativo');
  await e.ir('#/n/material/material.md');
  await e.pagina.locator('#nota a.wiki', { hasText: 'extracto-octubre.pdf' }).click();
  await visible(e.pagina.locator('#nota iframe.visor-pdf'), 'enlace', 'el visor tras pulsar [[extracto-octubre.pdf]]');
  await e.pagina.keyboard.press('Control+k');
  await e.pagina.fill('#buscador', 'extracto');
  await (await visible(e.pagina.locator('#busqueda-lista [role="option"]', { hasText: 'extracto-octubre.pdf' }), 'buscador', 'el PDF entre los resultados')).click();
  await visible(e.pagina.locator('#nota iframe.visor-pdf'), 'buscador', 'el visor tras abrir el resultado');
  await oculto(e.pagina.locator('#busqueda'), 'buscador', 'la modal tras abrir el resultado');
});

test('mostrar en el Finder: el botón aparece al pasar el ratón por una fila y lanza el gestor de archivos; el de la miga, también', async () => {
  await e.ir('#/n/material/material.md');
  const fila = e.pagina.locator('#arbol .fila', { has: e.pagina.locator('a.hoja', { hasText: 'extracto-octubre.pdf' }) });
  const boton = fila.locator('button.mostrar');
  assert.equal(await boton.evaluate(b => getComputedStyle(b).opacity), '0', 'el botón se ve sin pasar el ratón');
  await fila.hover();
  await hasta(() => boton.evaluate(b => getComputedStyle(b).opacity === '1'), 'árbol', 'el botón no aparece al pasar el ratón');
  assert.match(await boton.getAttribute('aria-label'), /^Mostrar extracto-octubre\.pdf en /);
  const antes = e.lanzado.length;
  await boton.click();
  await hasta(() => e.lanzado.length === antes + 1, 'árbol', 'el botón no lanza el gestor de archivos');
  assert.ok(e.lanzado.at(-1).args.some(a => a.endsWith('extracto-octubre.pdf')), 'no señala el PDF');
  assert.equal(await e.pagina.locator('#nota iframe.visor-pdf').count(), 0, 'pulsar el botón ha abierto el PDF en vez de mostrarlo en la carpeta');
  // Sobre una carpeta: la muestra y no la pliega.
  const carpeta = e.pagina.locator('#arbol details', { has: e.pagina.locator('summary', { hasText: 'material' }) });
  await carpeta.locator('summary').hover();
  await carpeta.locator('summary button.mostrar').click();
  await hasta(() => e.lanzado.length === antes + 2, 'árbol', 'el botón de la carpeta no lanza nada');
  assert.ok(await carpeta.evaluate(d => d.open), 'el botón ha plegado la carpeta');
  // En el menú «…» de la barra superior, para la nota abierta.
  await accionNota('Mostrar en');
  await hasta(() => e.lanzado.length === antes + 3, 'miga', 'el botón de la miga no lanza nada');
  assert.ok(e.lanzado.at(-1).args.some(a => a.endsWith('material.md')), 'la miga no señala la nota abierta');
});

test('imagen: sale en el árbol y se ve a su tamaño, sin pasarse de la columna', async () => {
  await e.ir('#/');
  await abrirDelArbol('reparto-50-30-20.png');
  const img = await visible(e.pagina.locator('#nota img.visor-imagen'), 'imagen', 'la imagen');
  await hasta(() => img.evaluate(i => i.complete && i.naturalWidth === 300), 'imagen', 'la imagen no carga');
  assert.equal(await img.evaluate(i => i.clientWidth), 300, 'la imagen no sale a su tamaño (sin contar el borde)');
  assert.ok(await sinHoja(), 'imagen: sale con la hoja de lectura');
  assert.ok(await img.evaluate(i => i.getBoundingClientRect().width <= document.querySelector('#centro').clientWidth), 'imagen: se pasa del ancho de #centro');
  const col = await columna(), caja = await img.boundingBox();
  const ref = await referencia();
  assert.ok(Math.abs(col.centro - ref.centro) <= 4, `imagen: la columna está en x=${col.centro} y una nota con hoja en ${ref.centro}`);
  assert.ok(Math.abs(col.titulo - ref.titulo) <= 4, `imagen: el título empieza en x=${col.titulo}; en una nota, en ${ref.titulo}`);
  assert.ok(Math.abs(col.miga - ref.titulo) <= 4, `imagen: la miga empieza en x=${col.miga}; el título, en ${ref.titulo}`);
  assert.ok(Math.abs(caja.x + caja.width / 2 - col.centro) <= 4, `imagen: sale en x=${caja.x + caja.width / 2}, no centrada en la columna (${col.centro})`);
  await e.ir('#/n/material/material.md');
  await e.pagina.locator('#nota a.wiki', { hasText: 'reparto-50-30-20.png' }).click();
  await visible(e.pagina.locator('#nota img.visor-imagen'), 'enlace', 'la imagen tras pulsar [[reparto-50-30-20.png]]');
});

test('papelera: el botón de la fila manda el fichero a la papelera sin preguntar y desaparece del árbol; el de la miga, con la nota abierta, vuelve a la portada', async () => {
  await e.ir('#/n/material/material.md');
  const fila = e.pagina.locator('#arbol .fila', { has: e.pagina.locator('a.hoja', { hasText: 'gastos-octubre.json' }) });
  const boton = fila.locator('button.papelera');
  assert.equal(await boton.evaluate(b => getComputedStyle(b).opacity), '0', 'el botón se ve sin pasar el ratón');
  await fila.hover();
  assert.match(await boton.getAttribute('aria-label'), /^Mandar gastos-octubre\.json a la papelera/);
  const antes = e.ejecutado.length;
  await boton.click();
  await hasta(() => e.ejecutado.length === antes + 1, 'árbol', 'el botón no manda nada a la papelera');
  assert.ok(e.ejecutado.at(-1).args.at(-1).endsWith('gastos-octubre.json'));
  await hasta(async () => (await hoja('gastos-octubre.json').count()) === 0, 'árbol', 'el fichero sigue en el árbol');
  await conTexto(e.pagina.locator('.aviso-flotante'), /gastos-octubre\.json.*papelera/, 'árbol', 'el aviso');
  assert.equal(await e.pagina.locator('#arbol details', { has: e.pagina.locator('summary', { hasText: 'material' }) }).locator('summary button.papelera').count(), 0, 'una carpeta lleva botón de papelera');
  // Desde la miga: la nota abierta va a la papelera y la app vuelve a la portada.
  await e.ir('#/n/material/apuntes-de-clase.txt');
  await accionNota('Mover a la papelera');
  await hasta(() => e.ejecutado.length === antes + 2, 'miga', 'el botón de la miga no manda nada a la papelera');
  await hasta(async () => !(await e.pagina.evaluate(() => location.hash)).includes('apuntes-de-clase'), 'miga', 'la app se queda en el fichero borrado');
});

test('copiar la ruta: el botón de la miga copia la ruta completa del fichero abierto y lo dice', async () => {
  await e.pagina.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await e.ir('#/n/material/extracto-octubre.pdf');
  await accionNota('Copiar la ruta');
  await visible(e.pagina.locator('.aviso-flotante', { hasText: 'Ruta copiada' }), 'miga', 'el aviso de ruta copiada');
  const copiado = await e.pagina.evaluate(() => navigator.clipboard.readText());
  assert.equal(copiado, path.join(e.c.base, 'material', 'extracto-octubre.pdf'), 'miga: no copia la ruta completa del fichero');
});

test('la miga de una nota que regenera el profesor (inicio.md) no ofrece la papelera; la de una nota normal, sí', async () => {
  await e.ir('#/n/inicio.md');
  await e.pagina.locator('#btn-mas-nota').click();
  await visible(e.pagina.locator('#menu-nota [role="menuitem"]', { hasText: 'Copiar la ruta' }), 'miga', 'copiar la ruta en inicio.md');
  assert.equal(await e.pagina.locator('#menu-nota [role="menuitem"]', { hasText: 'papelera' }).count(), 0, 'miga: inicio.md (lo genera el profesor) ofrece la papelera');
  await e.pagina.keyboard.press('Escape');
  await e.ir('#/n/material/material.md');
  await e.pagina.locator('#btn-mas-nota').click();
  await visible(e.pagina.locator('#menu-nota [role="menuitem"]', { hasText: 'Mover a la papelera' }), 'miga', 'la papelera en una nota normal');
});

test('adjuntos: audio y vídeo con su reproductor; lo que la app no sabe enseñar lleva al Finder; una carpeta con solo un .gitkeep sale y dice que está vacía', async () => {
  fs.writeFileSync(path.join(e.c.base, 'adjuntos', 'grabacion.mp4'), 'vídeo de mentira: basta para el reproductor');
  const ref = await referencia();   // antes de abrir nada: abrir un fichero sin hoja vuelve a enseñarlo en el Finder al cambiar de nota
  await e.ir('#/');
  const abrir = async nombre => {
    const carpeta = e.pagina.locator('#arbol details[data-carpeta="adjuntos"]');
    if (!(await carpeta.evaluate(d => d.open))) await carpeta.locator(':scope > summary .nombre').click();
    await (await visible(hoja(nombre), 'adjuntos', `«${nombre}» en la carpeta adjuntos`)).click();
  };
  await abrir('nota-de-voz.wav');
  assert.match(await (await visible(e.pagina.locator('#nota audio[controls]'), 'audio', 'el reproductor')).getAttribute('src'), /\/fichero\/adjuntos\/nota-de-voz\.wav$/);
  assert.ok(await sinHoja(), 'audio: sale con la hoja de lectura');
  const colAudio = await columna(), audioCaja = await e.pagina.locator('#nota audio').boundingBox();
  assert.ok(Math.abs(colAudio.centro - ref.centro) <= 4 && Math.abs(colAudio.titulo - ref.titulo) <= 4, `audio: la columna está en x=${colAudio.centro} y una nota con hoja en ${ref.centro}`);
  assert.ok(Math.abs(audioCaja.x + audioCaja.width / 2 - colAudio.centro) <= 4, 'audio: no sale centrado en la columna');
  await abrir('grabacion.mp4');
  await hasta(() => e.pagina.locator('#nota video[controls]').count(), 'vídeo', 'no aparece el reproductor');   // de mentira: no tiene tamaño que ver
  assert.ok(await sinHoja(), 'vídeo: sale con la hoja de lectura');
  const antes = e.lanzado.length;
  await abrir('presupuesto.xlsx');
  await conTexto(e.pagina.locator('#nota'), /no sabe enseñar/, 'xlsx', 'el aviso de que la app no lo enseña');
  assert.ok(await sinHoja(), 'xlsx: el aviso sale con la hoja de lectura');
  const colX = await columna();
  assert.ok(Math.abs(colX.centro - ref.centro) <= 4, `xlsx: la columna está en x=${colX.centro}; una nota con hoja, en ${ref.centro}`);
  assert.ok(Math.abs(colX.titulo - ref.titulo) <= 4, `xlsx: el título empieza en x=${colX.titulo}; en una nota, en ${ref.titulo}`);
  await hasta(() => e.lanzado.length === antes + 1, 'xlsx', 'no lo señala en el Finder al abrirlo');
  assert.deepEqual(e.lanzado.at(-1).args, ['-R', path.join(e.c.base, 'adjuntos', 'presupuesto.xlsx')]);
  await e.pagina.click('#nota button[data-mostrar]');
  await hasta(() => e.lanzado.length === antes + 2, 'xlsx', 'el botón no lo vuelve a señalar');
  const vacia = e.pagina.locator('#arbol details[data-carpeta="adjuntos/vacia"]');
  await vacia.locator('summary .nombre').click();
  await visible(vacia.locator('.carpeta-vacia'), 'adjuntos', 'la carpeta vacía dice que está vacía');
});
