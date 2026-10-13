'use strict';
// Recorridos de la dirección «Hoja» y del índice de la nota (revisión de diseño 2026-10-09, direcciones A y C; decisiones de
// Roberto del mismo día): la hoja sobre un fondo más hundido en claro y oscuro, la barra lateral apagada sin perder el
// contraste y el índice (h2/h3) en el margen derecho, que solo sale si cabe sin encoger la hoja. Sin kit: es la base.
const test = require('node:test');
const assert = require('node:assert/strict');
const { arrancar, ptyFalso, hasta, visible, oculto } = require('./ayuda');

let e;
test.before(async () => { e = await arrancar({ kit: false, pty: ptyFalso() }); });
test.after(async () => { if (e) await e.cerrar(); });

const rgb = c => c.match(/[\d.]+/g).slice(0, 3).map(Number);
const luz = c => { const [r, g, b] = rgb(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contraste = (a, b) => { const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const NOTA_LARGA = '#/n/lectura/mercado-de-la-plaza.md';
const abrirLarga = async (ancho, alto = 900) => {
  await e.pagina.setViewportSize({ width: ancho, height: alto });
  await e.ir(NOTA_LARGA);
  await visible(e.pagina.locator('#nota h2').first(), 'nota larga', 'sus títulos');
};
const indiceVisible = () => e.pagina.locator('#indice').isVisible();
const anchoHoja = () => e.pagina.evaluate(() => Math.round(document.querySelector('#nota').getBoundingClientRect().width));
const abrirCajon = async pos => {
  await e.pagina.click('#btn-ajustes'); await visible(e.pagina.locator('#ajustes-panel'), 'ajustes', 'el selector del panel');
  await e.pagina.selectOption('#ajustes-panel', pos); await e.pagina.click('#ajustes-cerrar');
  await e.pagina.click('#btn-terminal'); await visible(e.pagina.locator('#cajon'), 'cajón', 'el cajón de la terminal');
};
const cerrarCajon = async () => { await e.pagina.click('#btn-cerrar-terminal'); await oculto(e.pagina.locator('#cajon'), 'cajón', 'el cajón tras cerrarlo'); };

test('índice: con la nota larga y la ventana ancha sale a la derecha de la hoja, sin encogerla, con sus títulos', async () => {
  await abrirLarga(1700);
  await visible(e.pagina.locator('#indice'), 'índice', 'el índice de la nota');
  const textos = await e.pagina.locator('#indice button').allTextContents();
  const h = await e.pagina.locator('#nota .bloque > h2, #nota .bloque > h3').allTextContents();
  assert.deepEqual(textos.map(t => t.trim()), h.map(t => t.trim()), 'índice: no lista los títulos de la nota en orden');
  assert.ok(textos.length >= 3, `índice: solo ${textos.length} entradas`);
  const c = await e.pagina.evaluate(() => { const i = document.querySelector('#indice').getBoundingClientRect(), n = document.querySelector('#nota').getBoundingClientRect(), v = document.querySelector('#centro').getBoundingClientRect();
    return { izq: i.left, der: i.right, notaDer: n.right, notaIzq: n.left, centroDer: v.right, ancho: n.width }; });
  assert.ok(c.izq >= c.notaDer + 8, `índice: se pisa con la hoja (índice desde ${c.izq}, hoja hasta ${c.notaDer})`);
  assert.ok(c.der <= c.centroDer, `índice: se sale de la ventana (hasta ${c.der} de ${c.centroDer})`);
  assert.equal(Math.round(c.ancho), 912, `índice: la hoja mide ${c.ancho} px con el índice, no su ancho entero (912 = 800 de texto + 2 × 56)`);
});

test('índice: una nota con menos de 3 títulos, los paneles, el examen y las tarjetas no lo llevan', async () => {
  await abrirLarga(1700);
  await visible(e.pagina.locator('#indice'), 'índice', 'el índice antes de salir');
  await e.ir('#/n/conceptos/capital.md');
  const titulos = await e.pagina.locator('#nota .bloque > h2, #nota .bloque > h3').count();
  assert.ok(titulos < 3, `índice: el ejemplo ya tiene ${titulos} títulos, la prueba no mide lo que dice`);
  assert.equal(await indiceVisible(), false, 'índice: sale con menos de 3 títulos');
  await e.ir('#/tareas');
  assert.equal(await indiceVisible(), false, 'índice: sale en el panel Tareas');
  await e.ir('#/comentarios');
  assert.equal(await indiceVisible(), false, 'índice: sale en el panel Comentarios');
  for (const [ruta, que] of [['#/n/examenes/01-examen.md', 'el examen'], ['#/n/flashcards/01-tarjetas.md', 'las tarjetas']]) {
    await e.ir(ruta).catch(() => {});
    assert.equal(await indiceVisible(), false, `índice: sale en ${que}`);
  }
});

test('índice: desaparece con el cajón a la derecha en una ventana mediana y vuelve al cerrarlo; con el cajón abajo se queda', async () => {
  await abrirLarga(1500);
  await visible(e.pagina.locator('#indice'), 'índice', 'el índice a 1500 px');
  const ancho = await anchoHoja();
  await abrirCajon('derecha');
  await oculto(e.pagina.locator('#indice'), 'índice', 'el índice con el cajón a la derecha');
  assert.equal(await e.pagina.evaluate(() => document.querySelector('#centro').classList.contains('con-indice')), false, 'índice: la hoja sigue desplazada sin índice');
  await cerrarCajon();
  await visible(e.pagina.locator('#indice'), 'índice', 'el índice tras cerrar el cajón');
  assert.equal(await anchoHoja(), ancho, 'índice: la hoja cambia de ancho al abrir y cerrar el cajón');
  await abrirCajon('abajo');
  await visible(e.pagina.locator('#indice'), 'índice', 'el índice con el cajón abajo');
  await cerrarCajon();
  await e.pagina.click('#btn-ajustes'); await e.pagina.selectOption('#ajustes-panel', 'derecha'); await e.pagina.click('#ajustes-cerrar');
});

test('índice: se oculta al estrechar la ventana, también a 760 px, y reaparece al ensancharla', async () => {
  await abrirLarga(1700);
  await visible(e.pagina.locator('#indice'), 'índice', 'el índice a 1700 px');
  await e.pagina.setViewportSize({ width: 1300, height: 900 });
  await oculto(e.pagina.locator('#indice'), 'índice', 'el índice a 1300 px (la hoja y el índice no caben junto a la barra lateral)');
  await e.pagina.setViewportSize({ width: 760, height: 900 });
  await oculto(e.pagina.locator('#indice'), 'índice', 'el índice a 760 px');
  await e.pagina.setViewportSize({ width: 1700, height: 900 });
  await visible(e.pagina.locator('#indice'), 'índice', 'el índice al volver a 1700 px');
});

test('índice: clic lleva a la sección y marca la actual al hacer scroll', async () => {
  await abrirLarga(1700, 700);
  await visible(e.pagina.locator('#indice'), 'índice', 'el índice');
  const actual = () => e.pagina.evaluate(() => document.querySelector('#indice [aria-current="location"]')?.textContent.trim() || null);
  const titulos = (await e.pagina.locator('#indice button').allTextContents()).map(t => t.trim());
  assert.equal(await actual(), titulos[0], 'índice: arriba del todo no marca la primera sección');
  const destino = 2;
  await e.pagina.locator('#indice button').nth(destino).click();
  const sitio = () => e.pagina.evaluate(i => { const h = [...document.querySelectorAll('#nota .bloque > h2, #nota .bloque > h3')][i]; return Math.round(h.getBoundingClientRect().top - document.querySelector('#centro').getBoundingClientRect().top); }, destino);
  await hasta(async () => { const s = await sitio(); return s >= 0 && s < 120; }, 'índice', `el clic en «${titulos[destino]}» no deja el título arriba (está a ${await sitio()} px del borde)`);
  assert.equal(await actual(), titulos[destino], 'índice: tras el clic no marca la sección elegida');
  // Scroll a mano: arriba del todo marca la primera; abajo del todo, una de las últimas.
  await e.pagina.evaluate(() => { document.querySelector('#centro').scrollTop = 0; });
  await hasta(async () => (await actual()) === titulos[0], 'índice', 'al volver arriba no vuelve a marcar la primera sección');
  await e.pagina.evaluate(() => { const c = document.querySelector('#centro'); c.scrollTop = c.scrollHeight; });
  await hasta(async () => (await actual()) === titulos[titulos.length - 1], 'índice', `al llegar al final no marca la última sección (marca ${await actual()})`);
  await e.pagina.evaluate(() => { const c = document.querySelector('#centro'); const h = document.querySelectorAll('#nota .bloque > h2')[1]; c.scrollTop += h.getBoundingClientRect().top - c.getBoundingClientRect().top - 60; });
  const segundo = await e.pagina.evaluate(() => document.querySelectorAll('#nota .bloque > h2')[1].textContent.trim());
  await hasta(async () => (await actual()) === segundo, 'índice', `con «${segundo}» bajo la barra marca «${await actual()}»`);
});

for (const tema of ['claro', 'oscuro']) {
  test(`hoja en ${tema}: más clara que la mesa, texto ≥ 4,5:1 sobre ella y barra lateral apagada que mantiene ≥ 4,5:1`, async () => {
    await abrirLarga(1500);
    await e.pagina.evaluate(t => { document.documentElement.dataset.tema = t; }, tema);
    const m = await e.pagina.evaluate(() => { const css = s => getComputedStyle(document.querySelector(s));
      const nav = [...document.querySelectorAll('.paginas a:not(.activa), #arbol a:not(.activa), #arbol summary')].map(x => css === null ? null : getComputedStyle(x).color);
      return { hoja: css('#nota').backgroundColor, mesa: css('#centro').backgroundColor, texto: css('#nota p').color, lateral: css('#lateral').backgroundColor, enlaces: [...new Set(nav)],
        activo: getComputedStyle(document.querySelector('.paginas a.activa, #arbol a.activa') || document.querySelector('.paginas a')).color,
        pequeno: css('#estado-git').color, miga: css('#miga').color, mesaMiga: css('.miga-barra').backgroundColor }; });
    assert.notEqual(m.hoja, m.mesa, `${tema}: la hoja y la mesa son del mismo color (${m.hoja})`);
    assert.ok(luz(m.hoja) > luz(m.mesa), `${tema}: la hoja (${m.hoja}) no es más clara que la mesa (${m.mesa})`);
    assert.ok(contraste(m.texto, m.hoja) >= 4.5, `${tema}: el texto ${m.texto} sobre la hoja ${m.hoja} da ${contraste(m.texto, m.hoja).toFixed(2)}:1`);
    for (const c of m.enlaces) assert.ok(contraste(c, m.lateral) >= 4.5, `${tema}: el texto de la barra lateral ${c} sobre ${m.lateral} da ${contraste(c, m.lateral).toFixed(2)}:1`);
    assert.ok(contraste(m.pequeno, m.lateral) >= 4.5, `${tema}: el texto pequeño de la barra (${m.pequeno}) sobre ${m.lateral} da ${contraste(m.pequeno, m.lateral).toFixed(2)}:1`);
    assert.ok(contraste(m.miga, m.mesaMiga) >= 4.5, `${tema}: la miga ${m.miga} sobre ${m.mesaMiga} da ${contraste(m.miga, m.mesaMiga).toFixed(2)}:1`);
    // El texto del índice, sobre la mesa.
    await e.pagina.setViewportSize({ width: 1700, height: 900 });
    await visible(e.pagina.locator('#indice'), 'índice', 'el índice para medir su contraste');
    const i = await e.pagina.evaluate(() => ({ c: getComputedStyle(document.querySelector('#indice button:not([aria-current])')).color, a: getComputedStyle(document.querySelector('#indice button[aria-current]')).color, f: getComputedStyle(document.querySelector('#centro')).backgroundColor }));
    assert.ok(contraste(i.c, i.f) >= 4.5, `${tema}: el índice ${i.c} sobre la mesa ${i.f} da ${contraste(i.c, i.f).toFixed(2)}:1`);
    assert.ok(contraste(i.a, i.f) >= 4.5, `${tema}: la sección actual ${i.a} sobre la mesa ${i.f} da ${contraste(i.a, i.f).toFixed(2)}:1`);
    await e.pagina.evaluate(() => { delete document.documentElement.dataset.tema; });
  });
}

test('hoja: a 760 px y en móvil se funde con el fondo y no roba sitio con márgenes; los paneles también llevan hoja en ancho', async () => {
  await abrirLarga(1200);
  const ancha = await e.pagina.evaluate(() => { const n = getComputedStyle(document.querySelector('#nota')); return { fondo: n.backgroundColor, borde: n.borderTopWidth }; });
  assert.notEqual(ancha.fondo, 'rgba(0, 0, 0, 0)', 'hoja: a 1200 px no tiene fondo de hoja');
  await e.ir('#/tareas');
  const panel = await e.pagina.evaluate(() => getComputedStyle(document.querySelector('#panel')).backgroundColor);
  assert.equal(panel, ancha.fondo, 'hoja: el panel Tareas no lleva la misma hoja que la nota');
  for (const w of [760, 390]) {
    await e.pagina.setViewportSize({ width: w, height: 800 });
    await e.ir(NOTA_LARGA);
    const m = await e.pagina.evaluate(() => { const n = document.querySelector('#nota'), s = getComputedStyle(n), r = n.getBoundingClientRect();
      return { fondo: s.backgroundColor, borde: s.borderTopWidth, izq: parseFloat(s.paddingLeft), ancho: Math.round(r.width), ventana: document.documentElement.clientWidth, scrollH: document.documentElement.scrollWidth }; });
    assert.equal(m.fondo, 'rgba(0, 0, 0, 0)', `${w} px: la hoja no se funde con el fondo (${m.fondo})`);
    assert.equal(m.borde, '0px', `${w} px: la hoja conserva borde`);
    assert.ok(m.izq <= 16, `${w} px: la hoja roba ${m.izq} px de margen interior`);
    assert.ok(m.ancho >= m.ventana - 16, `${w} px: la hoja mide ${m.ancho} de ${m.ventana}`);
    assert.ok(m.scrollH <= m.ventana, `${w} px: hay scroll horizontal`);
  }
});

test('recarga en vivo que llega durante la navegación: `await abrirNota()` vuelve con la nota pintada y el índice sale igual', async () => {
  await e.ir('#/n/inicio.md');
  await visible(e.pagina.locator('#nota .bloque').first(), 'navegación', 'la portada');
  // Dos peticiones seguidas de la misma nota (la navegación y la recarga en vivo): la primera queda superada y, aun así, no vuelve hasta que la nota se ve.
  const r = await e.pagina.evaluate(async () => {
    const a = abrirNota('lectura/mercado-de-la-plaza.md'); abrirNota('lectura/mercado-de-la-plaza.md', null, { desdeCambios: true });
    await a;
    return { titulo: (document.querySelector('#nota h1') || {}).textContent, vista: document.querySelector('#nota').dataset.vista };
  });
  assert.match(r.titulo, /mercado de la plaza/i, 'abrirNota ha vuelto antes de pintar la nota');
  assert.equal(r.vista, 'nota');
});
