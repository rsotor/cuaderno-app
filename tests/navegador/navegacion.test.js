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
