'use strict';
// Capturas reales de la modal de búsqueda para la ronda de crítica de diseño (AGENTS.md: por tanda, sobre capturas del
// después). Copia el cuaderno de ejemplo a una carpeta temporal (nunca se escribe en `ejemplos/` ni se toca un cuaderno
// real), arranca el servidor sobre ella y fotografía la pantalla con Chromium: claro y oscuro, a 1440 y a 390 px.
//   node pruebas/capturas-navegacion.js --pr 1      →  docs/capturas/navegacion/pr1-*.png
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
if (pr !== '1') { console.error('uso: node pruebas/capturas-navegacion.js --pr 1'); process.exit(1); }
const salida = path.join(__dirname, '..', 'docs', 'capturas', 'navegacion');

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
