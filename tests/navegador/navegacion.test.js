'use strict';
// Recorridos de la reorganización A2 (docs/planes/navegacion.md, PR 2): la cabecera del lateral con su línea de estado, el
// selector de cuaderno, la fila de accesos, el pie, la barra superior y el menú «…» de la nota. La pantalla se prueba aquí,
// contra la web (mismo código que la app); lo que solo existe en la app (‹ ›, ratón, sin Ajustes) usa un `cuadernoApp` de
// mentira, y lo que depende del menú del sistema está en tests/electron/.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { arrancar, hasta, visible, oculto, conTexto } = require('./ayuda');

let e;
const git = (args, env = {}) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: e.c.raiz, stdio: 'pipe', env: { ...process.env, ...env } });
test.before(async () => {
  e = await arrancar({ kit: false });
  // El último guardado, de hace 21 días: «guardado · 21 días», el caso de «guardado hace 3 semanas».
  const antes = new Date(Date.now() - 21 * 864e5).toISOString();
  git(['init', '-q']); git(['add', '-A']); git(['commit', '-q', '-m', 'base'], { GIT_AUTHOR_DATE: antes, GIT_COMMITTER_DATE: antes });
  await visible(e.pagina.locator('#arbol details summary').first(), 'arranque', 'el árbol');
  await e.pagina.waitForTimeout(1200);   // el vigilante de ficheros avisa tarde: que los avisos de estas escrituras ya hayan pasado
});
test.after(async () => { if (e) await e.cerrar(); });

const rgb = c => c.match(/[\d.]+/g).slice(0, 3).map(Number);
const luz = c => { const [r, g, b] = rgb(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contraste = (a, b) => { const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

// ---------- la línea del estado (T2.1)

// Lo que mide la cabecera del lateral: la línea, el texto y los tres botones.
const medirEstado = () => e.pagina.evaluate(() => {
  const r = s => { const x = document.querySelector(s).getBoundingClientRect(); return { x: x.x, y: x.y, w: x.width, h: x.height, derecha: x.right }; };
  const t = document.querySelector('#estado-git');
  return { lateral: r('#lateral'), linea: r('.estado-linea'), texto: r('#estado-git'), guardar: r('#btn-guardar'), traer: r('#btn-traer'), deshacer: r('#btn-deshacer'),
    cortado: t.scrollWidth > t.clientWidth, elipsis: getComputedStyle(t).textOverflow, unaLinea: getComputedStyle(t).whiteSpace, titulo: t.title, texto_: t.textContent,
    clase: document.querySelector('#btn-guardar').className, paginaAncha: document.documentElement.scrollWidth > document.documentElement.clientWidth };
});
const abrirCajon = async () => { await e.pagina.locator('#btn-menu').click(); await hasta(async () => (await e.pagina.locator('#lateral').boundingBox()).x >= -0.5, 'lateral', 'el cajón del menú no termina de abrirse'); };

const MONTAJES = [
  { nombre: '1280×800', ancho: 1280, alto: 800, cajon: false, letra: false, esperado: 280 },
  { nombre: 'lateral al mínimo (pantalla de 320 px, cajón de 260)', ancho: 320, alto: 700, cajon: true, letra: false, esperado: 260 },
  { nombre: 'letra al 200 %', ancho: 1280, alto: 800, cajon: false, letra: true, esperado: 280 },
  { nombre: 'lateral al mínimo y letra al 200 %', ancho: 320, alto: 700, cajon: true, letra: true, esperado: 260 },
];
// Las tres frases: la corta de siempre y las dos literales de Roberto (2026-10-13), puestas a mano en #estado-git.
const FRASES = ['1 cambio', '128 cambios por guardar', 'guardado hace 3 semanas'];

for (const m of MONTAJES) {
  test(`línea del estado, ${m.nombre}: el texto largo encoge con «…», una sola línea, los botones no encogen y nada se sale del lateral`, async () => {
    await e.pagina.setViewportSize({ width: m.ancho, height: m.alto });
    await e.ir('#/n/conceptos/capital.md');
    await e.pagina.evaluate(() => { for (const id of ['#guardar', '#resultado']) document.querySelector(id).hidden = true; });
    const estilo = m.letra ? await e.pagina.addStyleTag({ content: 'body { font-size: 200%; }' }) : null;
    try {
      if (m.cajon) await abrirCajon();
      let base = null;
      for (const frase of FRASES) {
        await e.pagina.evaluate(f => { const t = document.querySelector('#estado-git'); t.textContent = f; t.title = f; }, frase);
        const d = await medirEstado();
        if (!base) base = d;
        const donde = `${m.nombre}, «${frase}»`;
        assert.ok(Math.abs(d.lateral.w - m.esperado) <= 0.5, `${donde}: el lateral mide ${d.lateral.w} px y debería medir ${m.esperado}`);
        assert.equal(d.unaLinea, 'nowrap', `${donde}: el texto puede partirse en dos líneas`);
        assert.equal(d.elipsis, 'ellipsis', `${donde}: el texto no se corta con «…»`);
        assert.ok(Math.abs(d.linea.h - base.linea.h) <= 0.5, `${donde}: la línea mide ${d.linea.h} px y con «${FRASES[0]}» mide ${base.linea.h}`);
        for (const b of ['guardar', 'traer', 'deshacer']) {
          assert.ok(Math.abs(d[b].w - base[b].w) <= 0.5, `${donde}: el botón ${b} encoge o crece (${d[b].w} px, con el texto corto ${base[b].w})`);
          assert.ok(d[b].derecha <= d.lateral.derecha + 0.5 && d[b].x >= d.lateral.x - 0.5, `${donde}: el botón ${b} se sale del lateral`);
        }
        assert.ok(d.texto.derecha <= d.guardar.x + 0.5, `${donde}: el texto pisa a Guardar`);
        assert.equal(d.paginaAncha, false, `${donde}: la página tiene scroll horizontal`);
        if (frase !== FRASES[0] && m.cajon && m.letra) assert.ok(d.cortado, `${donde}: con tan poco sitio el texto debería desbordar y cortarse`);
      }
    } finally { if (estilo) await estilo.evaluate(el => el.remove()); await e.pagina.setViewportSize({ width: 1280, height: 800 }); }
  });
}

test('línea del estado: «guardado · 21 días» a 0 cambios con Guardar neutro; «128 cambios» con Guardar destacado; el texto entero, en el title; la regex de siempre, en el title', async () => {
  await e.ir('#/n/conceptos/capital.md');
  await e.pagina.locator('#btn-guardar').waitFor();
  const quieto = await medirEstado();
  assert.equal(quieto.texto_, 'guardado · 21 días', 'estado: el texto corto de «último guardado hace 21 días»');
  assert.match(quieto.titulo, /^guardado hace 21 días$/, 'estado: el title no lleva la frase entera');
  assert.equal(await e.pagina.getAttribute('#estado-git', 'aria-label'), quieto.titulo, 'estado: el aria-label no es la frase entera');
  assert.ok(/\bsecundario\b/.test(quieto.clase) && !/\bprimario\b/.test(quieto.clase), `estado: con 0 cambios Guardar debería ser secundario y es «${quieto.clase}»`);
  // 128 ficheros nuevos (untracked, cada uno cuenta en `git status`).
  for (let i = 1; i <= 128; i++) fs.writeFileSync(path.join(e.c.base, `lote-${String(i).padStart(3, '0')}.md`), `# Lote ${i}\n`);
  try {
    await conTexto(e.pagina.locator('#estado-git'), /^128 cambios$/, 'estado', 'el texto corto con 128 cambios (la recarga en vivo)');
    const d = await medirEstado();
    assert.match(d.titulo, /^guardado hace 21 días, 128 cambios por guardar$/, 'estado: el title con 128 cambios no lleva la frase entera');
    assert.ok(/\bprimario\b/.test(d.clase), `estado: con cambios Guardar debería ser primario y es «${d.clase}»`);
    assert.ok(Math.abs(d.linea.h - quieto.linea.h) <= 0.5, `estado: la línea cambia de altura con 128 cambios (${d.linea.h} y antes ${quieto.linea.h})`);
  } finally {
    for (let i = 1; i <= 128; i++) fs.rmSync(path.join(e.c.base, `lote-${String(i).padStart(3, '0')}.md`), { force: true });
  }
  await conTexto(e.pagina.locator('#estado-git'), /^guardado · 21 días$/, 'estado', 'de vuelta a 0 cambios');
});

for (const tema of ['claro', 'oscuro']) {
  test(`línea del estado en ${tema}: el texto ≥ 4,5:1, Guardar ≥ 4,5:1 e iconos de Traer y Deshacer ≥ 3:1`, async () => {
    await e.ir('#/n/conceptos/capital.md');
    await e.pagina.evaluate(t => { document.documentElement.dataset.tema = t; }, tema);
    try {
      const c = await e.pagina.evaluate(() => {
        const css = s => getComputedStyle(document.querySelector(s));
        return { lateral: css('#lateral').backgroundColor, texto: css('#estado-git').color, guardar: css('#btn-guardar').color, guardarFondo: css('#btn-guardar').backgroundColor,
          traer: css('#btn-traer').color, traerFondo: css('#btn-traer').backgroundColor, deshacer: css('#btn-deshacer').color, deshacerFondo: css('#btn-deshacer').backgroundColor };
      });
      assert.ok(contraste(c.texto, c.lateral) >= 4.5, `${tema}: el texto de estado ${c.texto} sobre ${c.lateral} da ${contraste(c.texto, c.lateral).toFixed(2)}:1`);
      assert.ok(contraste(c.guardar, c.guardarFondo) >= 4.5, `${tema}: «Guardar» ${c.guardar} sobre ${c.guardarFondo} da ${contraste(c.guardar, c.guardarFondo).toFixed(2)}:1`);
      for (const b of ['traer', 'deshacer']) assert.ok(contraste(c[b], c[`${b}Fondo`]) >= 3, `${tema}: el icono de ${b} ${c[b]} sobre ${c[`${b}Fondo`]} da ${contraste(c[b], c[`${b}Fondo`]).toFixed(2)}:1`);
    } finally { await e.pagina.evaluate(() => { delete document.documentElement.dataset.tema; }); }
  });
}

// ---------- el selector de cuaderno (T2.2)

const { crearCuaderno } = require('../ayuda');
const pedirAbrir = (ruta, pagina = e.pagina) => pagina.request.post(`${e.base}/api/abrir`, { data: { ruta }, headers: { origin: e.base } });
const nombreDe = ruta => path.basename(ruta);
const enfocado = (pagina = e.pagina) => pagina.evaluate(() => document.activeElement && (document.activeElement.id || `${document.activeElement.tagName}.${document.activeElement.textContent.trim().slice(0, 30)}`));
// Deja en recientes: el de las pruebas (abierto), otro y un tercero que ya no existe.
async function prepararRecientes() {
  const otro = crearCuaderno({ kit: false }), tercero = crearCuaderno({ kit: false });
  await pedirAbrir(tercero.raiz); await pedirAbrir(otro.raiz); await pedirAbrir(e.c.raiz);
  tercero.borrar();
  await e.ir('#/n/conceptos/capital.md');
  await e.pagina.waitForTimeout(500);   // el aviso de «otro cuaderno» de las llamadas de arriba, si llegara, ya ha pasado
  const olvidar = ruta => e.pagina.request.post(`${e.base}/api/olvidar`, { data: { ruta }, headers: { origin: e.base } });
  return { otro, tercero, limpiar: async () => { await olvidar(tercero.raiz); await olvidar(otro.raiz); otro.borrar(); } };
}

test('selector: el nombre abre un menú con los recientes (el abierto marcado, el que ya no existe deshabilitado); ↓ y Enter abren el otro sin el aviso de «otra pestaña», y si otra pestaña cambia después, sí sale', async () => {
  const r = await prepararRecientes();
  try {
    const boton = e.pagina.locator('#btn-cuaderno');
    assert.equal(await boton.getAttribute('aria-haspopup'), 'menu', 'selector: el nombre no anuncia un menú');
    assert.equal(await boton.getAttribute('aria-expanded'), 'false');
    await boton.click();
    await visible(e.pagina.locator('#menu-cuaderno'), 'selector', 'el menú de cuadernos');
    assert.equal(await boton.getAttribute('aria-expanded'), 'true');
    assert.equal(await e.pagina.getAttribute('#menu-cuaderno', 'role'), 'menu');
    const radios = e.pagina.locator('#menu-cuaderno [role="menuitemradio"]');
    await hasta(async () => (await radios.count()) === 3, 'selector', 'el menú no lista los tres recientes');
    const filas = await radios.evaluateAll(l => l.map(x => ({ texto: x.textContent.trim(), marcado: x.getAttribute('aria-checked'), deshabilitado: x.getAttribute('aria-disabled'), titulo: x.title })));
    assert.deepEqual(filas.map(f => f.marcado), ['true', 'false', 'false'], 'selector: el cuaderno abierto debe ser el único marcado');
    assert.equal(filas[0].texto, nombreDe(e.c.raiz)); assert.equal(filas[1].texto, nombreDe(r.otro.raiz));
    assert.deepEqual(filas.map(f => f.deshabilitado), [null, null, 'true'], 'selector: solo el que no existe va deshabilitado');
    assert.equal(filas[2].titulo, 'No está en esta ruta', 'selector: el reciente ausente no dice por qué');
    assert.match(await e.pagina.locator('#menu-cuaderno').textContent(), /Recientes/);
    assert.match(await e.pagina.locator('#menu-cuaderno [role="menuitem"]').last().textContent(), /Abrir carpeta…/, 'selector: «Abrir carpeta…» no es el último');
    // Teclado: el foco entra en el cuaderno marcado; ↓ baja, ↑ vuelve, con vuelta; Fin y Inicio.
    assert.equal(await e.pagina.evaluate(() => document.activeElement.getAttribute('aria-checked')), 'true', 'selector: el foco no entra en el cuaderno abierto');
    await e.pagina.keyboard.press('ArrowUp');
    assert.match(await enfocado(), /Abrir carpeta/, 'selector: ↑ desde el primero no da la vuelta al último');
    await e.pagina.keyboard.press('ArrowDown');
    assert.equal(await e.pagina.evaluate(() => document.activeElement.getAttribute('aria-checked')), 'true', 'selector: ↓ desde el último no da la vuelta al primero');
    await e.pagina.keyboard.press('End'); assert.match(await enfocado(), /Abrir carpeta/);
    await e.pagina.keyboard.press('Home'); assert.equal(await e.pagina.evaluate(() => document.activeElement.getAttribute('aria-checked')), 'true');
    await e.pagina.keyboard.press('ArrowDown');
    assert.match(await enfocado(), new RegExp(nombreDe(r.otro.raiz)), 'selector: ↓ no llega al segundo reciente');
    await e.pagina.keyboard.press('Enter');
    await conTexto(e.pagina.locator('#nombre-curso'), new RegExp(nombreDe(r.otro.raiz)), 'selector', 'el nombre del cuaderno elegido en la barra');
    await oculto(e.pagina.locator('#menu-cuaderno'), 'selector', 'el menú tras elegir');
    await e.pagina.waitForTimeout(900);   // la recarga en vivo de la propia apertura llega después
    assert.equal(await e.pagina.locator('.aviso-flotante', { hasText: 'ha abierto otro cuaderno' }).count(), 0, 'selector: elegir un reciente enseña el aviso de «otra pestaña», que no lo es');
    // Otra pestaña cambia de cuaderno después: ese aviso sí sale.
    await pedirAbrir(e.c.raiz);
    await visible(e.pagina.locator('.aviso-flotante', { hasText: 'ha abierto otro cuaderno' }), 'selector', 'el aviso cuando OTRA pestaña cambia de cuaderno');
    await conTexto(e.pagina.locator('#nombre-curso'), new RegExp(nombreDe(e.c.raiz)), 'selector', 'de vuelta al cuaderno de las pruebas');
    // Un reciente ausente no hace nada al pulsarlo.
    await boton.click(); await visible(e.pagina.locator('#menu-cuaderno'), 'selector', 'el menú otra vez');
    await e.pagina.locator('#menu-cuaderno [role="menuitemradio"][aria-disabled="true"]').click({ force: true });
    await e.pagina.waitForTimeout(300);
    assert.equal((await e.pagina.locator('#nombre-curso').textContent()).trim(), nombreDe(e.c.raiz), 'selector: pulsar un reciente que no existe cambió el cuaderno');
    await e.pagina.keyboard.press('Escape');
  } finally { await r.limpiar(); }
});

test('selector: Esc cierra y devuelve el foco al nombre; Tab y un clic fuera lo cierran; en la web «Abrir carpeta…» lleva a Cuadernos', async () => {
  await e.ir('#/n/conceptos/capital.md');
  const boton = e.pagina.locator('#btn-cuaderno');
  await boton.click(); await visible(e.pagina.locator('#menu-cuaderno'), 'selector', 'el menú');
  await e.pagina.keyboard.press('Escape');
  await oculto(e.pagina.locator('#menu-cuaderno'), 'selector', 'el menú tras Esc');
  assert.equal(await enfocado(), 'btn-cuaderno', 'selector: Esc no devuelve el foco al nombre');
  assert.equal(await boton.getAttribute('aria-expanded'), 'false');
  await boton.click(); await visible(e.pagina.locator('#menu-cuaderno'), 'selector', 'el menú');
  await e.pagina.keyboard.press('Tab');
  await oculto(e.pagina.locator('#menu-cuaderno'), 'selector', 'el menú tras Tab');
  await boton.click(); await visible(e.pagina.locator('#menu-cuaderno'), 'selector', 'el menú');
  await e.pagina.locator('#nota').click({ position: { x: 20, y: 20 } });
  await oculto(e.pagina.locator('#menu-cuaderno'), 'selector', 'el menú tras un clic fuera');
  await boton.click();
  await e.pagina.locator('#menu-cuaderno [role="menuitem"]', { hasText: 'Abrir carpeta…' }).click();
  await hasta(() => e.pagina.evaluate(() => location.hash === '#/cuadernos'), 'selector', 'en la web «Abrir carpeta…» no lleva a #/cuadernos');
  await oculto(e.pagina.locator('#menu-cuaderno'), 'selector', 'el menú tras «Abrir carpeta…»');
});

test('selector: en la app, «Abrir carpeta…» llama al diálogo del sistema (elegirCarpeta)', async () => {
  const ctx = await e.navegador.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.__elegirCarpeta = 0; window.cuadernoApp = { plataforma: 'darwin', alAccion() {}, elegirCarpeta: async () => { window.__elegirCarpeta++; return null; } }; });
  const p = await ctx.newPage(); p.setDefaultTimeout(8000);
  try {
    await p.goto(e.server.urlEntrada());
    await p.goto(`${e.base}/#/n/conceptos/capital.md`); await p.reload(); await p.locator('#miga strong').waitFor();
    await p.locator('#btn-cuaderno').click();
    await p.locator('#menu-cuaderno [role="menuitem"]', { hasText: 'Abrir carpeta…' }).click();
    await hasta(async () => (await p.evaluate(() => window.__elegirCarpeta)) === 1, 'selector', 'en la app «Abrir carpeta…» no llama a elegirCarpeta');
    assert.equal(await p.evaluate(() => location.hash), '#/n/conceptos/capital.md', 'selector: en la app «Abrir carpeta…» cambió de pantalla');
  } finally { await ctx.close(); }
});

// ---------- la fila de accesos con la lupa, y el árbol sin rótulo (T2.3)

const ACCESOS = [['#link-inicio', 'Inicio'], ['#btn-buscar', 'Buscar'], ['a[href="#/tareas"]', 'Tareas'], ['a[href="#/comentarios"]', 'Comentarios'], ['#btn-nueva-nota', 'Nueva nota']];

test('accesos: casa, lupa, Tareas, Comentarios y «+» en una sola fila, cada uno con nombre accesible y title; la lupa abre la modal y el foco vuelve a ella', async () => {
  await e.ir('#/n/conceptos/capital.md');
  for (const [sel, nombre] of ACCESOS) {
    const el = e.pagina.locator(sel);
    const accesible = (await el.getAttribute('aria-label')) || (await el.textContent()).trim();
    assert.ok(accesible.startsWith(nombre), `accesos: ${sel} debería llamarse «${nombre}…» y se llama «${accesible}»`);
    assert.ok((await el.getAttribute('title')), `accesos: ${sel} no tiene title`);
  }
  assert.match(await e.pagina.getAttribute('#btn-buscar', 'title'), /^Buscar \((⌘|Ctrl )K\)$/, 'accesos: la lupa no dice su atajo');
  assert.equal(await e.pagina.getAttribute('#link-inicio', 'title'), 'Inicio');
  // Una sola fila, a 1280 y en el cajón de 260 px.
  for (const ancho of [1280, 320]) {
    await e.pagina.setViewportSize({ width: ancho, height: 700 });
    if (ancho === 320) await abrirCajon();
    const m = await e.pagina.evaluate(() => {
      const nav = document.querySelector('nav.paginas').getBoundingClientRect();
      return { nav: { x: nav.x, derecha: nav.right, h: nav.height }, hijos: [...document.querySelector('nav.paginas').children].map(h => { const r = h.getBoundingClientRect(); return { id: h.id || h.textContent.trim(), cy: r.y + r.height / 2, x: r.x, derecha: r.right, w: r.width }; }) };
    });
    assert.equal(m.hijos.length, 5, `accesos (${ancho} px): la fila no tiene cinco accesos`);
    for (const h of m.hijos) {
      assert.ok(Math.abs(h.cy - m.hijos[0].cy) <= 2, `accesos (${ancho} px): ${h.id} no está en la misma fila`);
      assert.ok(h.derecha <= m.nav.derecha + 0.5 && h.x >= m.nav.x - 0.5, `accesos (${ancho} px): ${h.id} se sale de la fila`);
    }
    await e.pagina.setViewportSize({ width: 1280, height: 800 });
  }
  await e.pagina.focus('#btn-buscar');
  await e.pagina.locator('#btn-buscar').click();
  await visible(e.pagina.locator('#busqueda'), 'accesos', 'la modal al pulsar la lupa');
  await e.pagina.keyboard.press('Escape');
  await oculto(e.pagina.locator('#busqueda'), 'accesos', 'la modal tras Esc');
  assert.equal(await enfocado(), 'btn-buscar', 'accesos: el foco no vuelve a la lupa');
});

test('accesos: los contadores van sin paréntesis y el nombre accesible los dice; «+» no usa el lápiz de Editar', async () => {
  await e.ir('#/');
  await hasta(async () => /^\d+$/.test((await e.pagina.locator('#n-tareas').textContent()).trim()), 'accesos', 'el contador de Tareas sin paréntesis');
  const t = (await e.pagina.locator('#n-tareas').textContent()).trim();
  assert.match(await e.pagina.getAttribute('a[href="#/tareas"]', 'aria-label'), new RegExp(`^Tareas, ${t} pendientes?$`), 'accesos: Tareas no dice cuántas pendientes');
  await hasta(async () => /^\d+$/.test((await e.pagina.locator('#n-comentarios').textContent()).trim()), 'accesos', 'el contador de Comentarios sin paréntesis');
  const c = (await e.pagina.locator('#n-comentarios').textContent()).trim();
  assert.equal(await e.pagina.getAttribute('a[href="#/comentarios"]', 'aria-label'), `Comentarios, ${c}`);
  assert.equal(await e.pagina.locator('#btn-nueva-nota use').getAttribute('href'), '#i-mas', 'accesos: «+» no usa el icono de más');
  assert.equal(await e.pagina.locator('#btn-nueva-nota use[href="#i-lapiz"]').count(), 0, 'accesos: «Nueva nota» sigue con el lápiz de Editar');
});

test('árbol: un borde superior de 2 px separa los accesos del árbol y no hay rótulo «Notas»', async () => {
  await e.ir('#/');
  const b = await e.pagina.evaluate(() => { const s = getComputedStyle(document.querySelector('#arbol')); return { ancho: s.borderTopWidth, estilo: s.borderTopStyle, color: s.borderTopColor }; });
  assert.equal(b.ancho, '2px', 'árbol: el borde superior no mide 2 px'); assert.equal(b.estilo, 'solid');
  const rotulos = await e.pagina.evaluate(() => [...document.querySelectorAll('#lateral *')].filter(x => !x.children.length && /^notas$/i.test(x.textContent.trim())).length);
  assert.equal(rotulos, 0, 'árbol: sigue el rótulo «Notas»');
});

for (const tema of ['claro', 'oscuro']) {
  test(`accesos en ${tema}: casa, lupa y «+» ≥ 3:1 y el texto de Tareas y Comentarios ≥ 4,5:1 sobre el lateral; el borde del árbol se ve`, async () => {
    await e.ir('#/n/conceptos/capital.md');
    await e.pagina.evaluate(t => { document.documentElement.dataset.tema = t; }, tema);
    try {
      const c = await e.pagina.evaluate(() => {
        const css = s => getComputedStyle(document.querySelector(s));
        return { lateral: css('#lateral').backgroundColor, casa: css('#link-inicio').color, lupa: css('#btn-buscar').color, mas: css('#btn-nueva-nota').color, tareas: css('a[href="#/tareas"]').color, comentarios: css('a[href="#/comentarios"]').color, borde: css('#arbol').borderTopColor };
      });
      for (const k of ['casa', 'lupa', 'mas']) assert.ok(contraste(c[k], c.lateral) >= 3, `${tema}: el icono ${k} ${c[k]} sobre ${c.lateral} da ${contraste(c[k], c.lateral).toFixed(2)}:1`);
      for (const k of ['tareas', 'comentarios']) assert.ok(contraste(c[k], c.lateral) >= 4.5, `${tema}: el texto de ${k} ${c[k]} sobre ${c.lateral} da ${contraste(c[k], c.lateral).toFixed(2)}:1`);
      // El borde lleva transparencia (rgba): se compone sobre el lateral antes de medir.
      const [r, g, b, a = 1] = c.borde.match(/[\d.]+/g).map(Number), [lr, lg, lb] = rgb(c.lateral);
      const compuesto = `rgb(${r * a + lr * (1 - a)}, ${g * a + lg * (1 - a)}, ${b * a + lb * (1 - a)})`;
      assert.ok(contraste(compuesto, c.lateral) >= 1.5, `${tema}: el borde del árbol ${c.borde} casi no se ve sobre ${c.lateral} (${contraste(compuesto, c.lateral).toFixed(2)}:1)`);
    } finally { await e.pagina.evaluate(() => { delete document.documentElement.dataset.tema; }); }
  });
}

// ---------- el pie del lateral: Terminal en icono y Ajustes solo en la web (T2.4)

// Una página con el `cuadernoApp` de mentira del preload de Electron: guarda el callback de las acciones del menú en window.__accion.
async function paginaConApp(opciones = {}) {
  const ctx = await e.navegador.newContext({ viewport: { width: 1280, height: 800 }, ...opciones });
  await ctx.addInitScript(() => { window.__elegirCarpeta = 0; window.cuadernoApp = { plataforma: 'darwin', alAccion(f) { window.__accion = f; }, elegirCarpeta: async () => { window.__elegirCarpeta++; return null; } }; });
  const p = await ctx.newPage(); p.setDefaultTimeout(8000);
  await p.goto(e.server.urlEntrada());
  await p.goto(`${e.base}/#/n/conceptos/capital.md`); await p.reload(); await p.locator('#miga strong').waitFor();
  return { p, ctx };
}

test('pie: en la web, Terminal y Ajustes son iconos con nombre y title; Terminal abre el cajón y al cerrarlo el foco vuelve a él', async () => {
  await e.ir('#/n/conceptos/capital.md');
  for (const [sel, nombre] of [['#btn-terminal', 'Terminal'], ['#btn-ajustes', 'Ajustes']]) {
    assert.equal(await e.pagina.getAttribute(sel, 'aria-label'), nombre, `pie: ${sel} no se llama «${nombre}»`);
    assert.ok(await e.pagina.getAttribute(sel, 'title'), `pie: ${sel} no tiene title`);
    const caja = await e.pagina.locator(sel).boundingBox();
    assert.ok(caja.width >= 29.5 && caja.width <= 30.5 && caja.height >= 29.5, `pie: ${sel} no es un icono de 30 px (${caja.width}×${caja.height})`);
    assert.equal((await e.pagina.locator(sel).textContent()).trim(), '', `pie: ${sel} lleva texto además del icono`);
  }
  await e.pagina.locator('#btn-terminal').click();
  await visible(e.pagina.locator('#cajon'), 'pie', 'el cajón de la terminal');
  await e.pagina.locator('#btn-cerrar-terminal').click();
  await oculto(e.pagina.locator('#cajon'), 'pie', 'el cajón tras cerrarlo');
  assert.equal(await enfocado(), 'btn-terminal', 'pie: el foco no vuelve a Terminal');
});

test('pie: en la app, Ajustes no se pinta en el lateral y la acción del menú (⌘,) abre Ajustes; Terminal sigue', async () => {
  const { p, ctx } = await paginaConApp();
  try {
    assert.equal(await p.locator('#btn-ajustes').isVisible(), false, 'pie: en la app, Ajustes sigue en el lateral');
    assert.equal(await p.locator('#btn-terminal').isVisible(), true, 'pie: en la app, Terminal ha desaparecido');
    await p.evaluate(() => window.__accion('ajustes'));
    await visible(p.locator('#ajustes'), 'pie', 'Ajustes tras la acción «ajustes» del menú');
    await p.locator('#ajustes-cerrar').click();
    await oculto(p.locator('#ajustes'), 'pie', 'Ajustes tras cerrarlos');
  } finally { await ctx.close(); }
});
