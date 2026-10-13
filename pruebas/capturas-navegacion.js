'use strict';
// Capturas reales de la modal de búsqueda para la ronda de crítica de diseño (AGENTS.md: por tanda, sobre capturas del
// después). Copia el cuaderno de ejemplo a una carpeta temporal (nunca se escribe en `ejemplos/` ni se toca un cuaderno
// real), arranca el servidor sobre ella y fotografía la pantalla con Chromium: claro y oscuro, a 1440 y a 390 px.
//   node pruebas/capturas-navegacion.js --pr 1      →  docs/capturas/navegacion/pr1-*.png   (la modal de búsqueda)
//   node pruebas/capturas-navegacion.js --pr 2      →  docs/capturas/navegacion/pr2-*.png   (la reorganización A2: lateral y barra superior)
// Sin cobertura: es una herramienta de diseño, no un test.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.CUADERNO_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-config-'));
const { chromium } = require('playwright');
const { Cuaderno } = require('../cuaderno');
const { detectar } = require('../kit');
const { crearServidor } = require('../servidor');

const pr = process.argv[process.argv.indexOf('--pr') + 1];
if (pr !== '1' && pr !== '2') { console.error('uso: node pruebas/capturas-navegacion.js --pr 1|2'); process.exit(1); }
const { execFileSync } = require('node:child_process');
const salida = path.join(__dirname, '..', 'docs', 'capturas', 'navegacion');

// PR 2: la reorganización A2. Con un repositorio debajo (último guardado hace 3 días y un cambio) para la línea del estado, y el
// `cuadernoApp` de mentira del preload de Electron (las flechas ‹ ›, el lateral sin Ajustes), como las maquetas.
async function capturasPr2({ navegador, server, raiz, padre }) {
  const antes = new Date(Date.now() - 3 * 864e5).toISOString();
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Captura', GIT_AUTHOR_EMAIL: 'captura@example.com', GIT_COMMITTER_NAME: 'Captura', GIT_COMMITTER_EMAIL: 'captura@example.com', GIT_AUTHOR_DATE: antes, GIT_COMMITTER_DATE: antes };
  const git = (...a) => execFileSync('git', a, { cwd: raiz, env, stdio: 'ignore' });
  git('init', '-q'); git('add', '-A'); git('commit', '-q', '-m', 'ejemplo');
  fs.appendFileSync(path.join(raiz, 'lectura', 'mercado-de-la-plaza.md'), '\n');
  // Otros cuadernos recientes para el selector: se abren y se vuelve al de las capturas.
  const otros = ['taller-de-escritura', 'historia-del-arte'].map(n => { const d = path.join(padre, n); fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'inicio.md'), '# Inicio\n'); return d; });
  const nueva = async (opciones = {}) => {
    const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, ...opciones });
    await ctx.addInitScript(() => { window.cuadernoApp = { plataforma: 'darwin', alAccion() {}, elegirCarpeta: async () => null }; });
    const p = await ctx.newPage();
    await p.goto(server.urlEntrada()); await p.locator('#miga strong').waitFor();
    return { p, ctx };
  };
  const base = new URL((await (async () => { const { p, ctx } = await nueva(); const u = p.url(); await ctx.close(); return u; })())).origin;
  { const { p, ctx } = await nueva(); for (const o of [...otros, raiz]) await p.request.post(`${base}/api/abrir`, { data: { ruta: o }, headers: { origin: base } }); await ctx.close(); }
  const foto = (p, nombre) => p.screenshot({ path: path.join(salida, `pr2-${nombre}.png`) });
  const abrirNota = async (p, ruta) => { await p.goto(`${base}/#/n/${ruta}`); await p.reload(); await p.locator('#miga strong').waitFor(); await p.locator('#btn-editar:not([hidden])').waitFor(); await p.waitForTimeout(500); };
  for (const tema of ['claro', 'oscuro']) {
    const { p, ctx } = await nueva({ colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
    await p.evaluate(t => { document.documentElement.dataset.tema = t; }, tema);
    await abrirNota(p, 'lectura/mercado-de-la-plaza.md');
    await p.evaluate(t => { document.documentElement.dataset.tema = t; }, tema);
    await p.locator('#btn-atras').waitFor();
    await foto(p, `lateral-${tema}`);
    await p.locator('#btn-mas-nota').click(); await p.waitForTimeout(150); await foto(p, `menu-nota-${tema}`); await p.keyboard.press('Escape');
    await p.locator('#btn-cuaderno').click(); await p.locator('#menu-cuaderno [role="menuitemradio"]').nth(2).waitFor(); await foto(p, `selector-${tema}`); await p.keyboard.press('Escape');
    await ctx.close();
  }
  // Estado largo: «128 cambios por guardar» con el lateral al mínimo (el cajón de 260 px a 320 px de pantalla), y con la letra al 200 %.
  for (const [nombre, ancho, letra] of [['estado-largo-260', 320, false], ['estado-largo-letra-200', 1440, true]]) {
    const { p, ctx } = await nueva({ viewport: { width: ancho, height: 700 } });
    await abrirNota(p, 'conceptos/capital.md');
    if (letra) await p.addStyleTag({ content: 'body { font-size: 200%; }' });
    if (ancho < 760) { await p.locator('#btn-menu').click(); await p.waitForTimeout(400); }
    await p.evaluate(() => { const t = document.querySelector('#estado-git'); t.textContent = '128 cambios por guardar'; t.title = '128 cambios por guardar'; document.querySelector('#btn-guardar').className = 'primario'; });
    await foto(p, nombre);
    await ctx.close();
  }
  // Estrecho: 760 y 390 px (el cajón del menú abierto, y la barra superior con la nota larga).
  for (const ancho of [760, 390]) {
    const { p, ctx } = await nueva({ viewport: { width: ancho, height: 800 } });
    await abrirNota(p, 'navegacion/una-nota-con-un-nombre-muy-largo-para-la-barra-superior.md');
    await foto(p, `barra-${ancho}`);
    await p.locator('#btn-menu').click(); await p.waitForTimeout(400); await foto(p, `cajon-${ancho}`);
    await ctx.close();
  }
  // La miga larguísima con el lateral abierto en una ventana de 900 px.
  { const { p, ctx } = await nueva({ viewport: { width: 900, height: 700 } }); await abrirNota(p, 'navegacion/una-nota-con-un-nombre-muy-largo-para-la-barra-superior.md'); await foto(p, 'miga-larga-900'); await ctx.close(); }
}

(async () => {
  fs.mkdirSync(salida, { recursive: true });
  const padre = fs.mkdtempSync(path.join(os.tmpdir(), 'capturas-'));
  const raiz = path.join(padre, 'cuaderno-ejemplo');   // el nombre que se ve en el lateral: sin rutas de nadie
  fs.cpSync(path.join(__dirname, '..', 'ejemplos', 'cuaderno-ejemplo'), raiz, { recursive: true });
  const kit = detectar(raiz);
  const server = crearServidor({ cuaderno: new Cuaderno(raiz, kit.base), kit, lanzar: () => {}, plataforma: 'darwin' });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const navegador = await chromium.launch(process.env.CUADERNO_CHROMIUM ? { executablePath: process.env.CUADERNO_CHROMIUM } : {});
  try {
    if (pr === '2') { await capturasPr2({ navegador, server, raiz, padre }); return; }
    for (const [ancho, alto] of [[1440, 900], [390, 800]]) {
      for (const tema of ['claro', 'oscuro']) {
        const pagina = await navegador.newPage({ viewport: { width: ancho, height: alto }, colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
        await pagina.goto(server.urlEntrada());
        await pagina.locator('#miga strong').waitFor();
        await pagina.evaluate(t => { document.documentElement.dataset.tema = t; }, tema);
        await pagina.goto(`${new URL(pagina.url()).origin}/#/n/lectura/mercado-de-la-plaza.md`);
        await pagina.reload(); await pagina.locator('#miga strong').waitFor();
        await pagina.evaluate(t => { document.documentElement.dataset.tema = t; }, tema);
        const foto = async estado => pagina.screenshot({ path: path.join(salida, `pr${pr}-modal-${estado}-${tema}-${ancho}.png`) });
        // Con resultados: una consulta con notas por nombre y por texto.
        await pagina.keyboard.press('Control+k');
        await pagina.keyboard.type('merc');
        await pagina.locator('#busqueda-lista [role="option"]').nth(1).waitFor();
        await foto('resultados');
        // Con la fila de tarea elegida (flecha arriba desde la primera: vuelta a la última).
        await pagina.keyboard.press('ArrowUp');
        await foto('tarea-elegida');
        // Sin resultados.
        await pagina.fill('#buscador', 'Pendientes de hoy');
        await pagina.locator('#busqueda-nada').waitFor({ state: 'visible' });
        await foto('sin-resultados');
        // Vacía (la modal recién abierta, con las pistas).
        await pagina.fill('#buscador', '');
        await pagina.waitForTimeout(150);
        await foto('vacia');
        // Un fragmento largo, centrado en la coincidencia.
        await pagina.fill('#buscador', 'zanahoria');
        await pagina.locator('#busqueda-lista [role="option"]').first().waitFor();
        await foto('fragmento');
        await pagina.close();
      }
    }
  } finally {
    await navegador.close();
    await new Promise(r => server.close(r));
    fs.rmSync(padre, { recursive: true, force: true });
    fs.rmSync(process.env.CUADERNO_CONFIG_DIR, { recursive: true, force: true });
  }
  console.log(`capturas en ${path.relative(process.cwd(), salida)}`);
})().catch(e => { console.error(e); process.exit(1); });
