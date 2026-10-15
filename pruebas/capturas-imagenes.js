'use strict';
// Capturas del después de las imágenes en el editor para la ronda de crítica de diseño (AGENTS.md; plan
// docs/planes/imagenes-editor.md, T9). Copia el cuaderno de ejemplo a una carpeta temporal (nunca se escribe en
// `ejemplos/` ni se toca un cuaderno real) y fotografía con Chromium, claro y oscuro: el editor con imágenes en vista,
// en Markdown plano, con una pendiente de copiar, con una rota, la barra con «Imagen» y el aviso de un error al aplicar.
//   node pruebas/capturas-imagenes.js   →  docs/capturas/imagenes/despues-*-2026-10-14.png
// Sin cobertura: es una herramienta de diseño, no un test.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.CUADERNO_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-config-'));
const { chromium } = require('playwright');
const { Cuaderno } = require('../cuaderno');
const { detectar } = require('../kit');
const { crearServidor } = require('../servidor');

const FECHA = '2026-10-14';
const salida = path.join(__dirname, '..', 'docs', 'capturas', 'imagenes');

(async () => {
  fs.mkdirSync(salida, { recursive: true });
  const padre = fs.mkdtempSync(path.join(os.tmpdir(), 'capturas-'));
  const raiz = path.join(padre, 'cuaderno-ejemplo');
  fs.cpSync(path.join(__dirname, '..', 'ejemplos', 'cuaderno-ejemplo'), raiz, { recursive: true });
  const fuera = path.join(padre, 'Descargas'); fs.mkdirSync(fuera);
  fs.copyFileSync(path.join(raiz, 'material', 'reparto-50-30-20.png'), path.join(fuera, 'Gastos del mes.png'));
  fs.writeFileSync(path.join(raiz, 'insertar-imagen', 'con-attachments', 'rota.md'),
    '# Nota con captura\n\nEl reparto del mes:\n\n![Mi captura](attachments/Mi%20captura.png)\n\nUna imagen que se ha perdido:\n\n![Perdida](attachments/no-existe.png)\n\nÚltima línea.\n');
  const kit = detectar(raiz);
  const server = crearServidor({ cuaderno: new Cuaderno(raiz, kit.base), kit, lanzar: () => {}, plataforma: 'darwin' });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const navegador = await chromium.launch(process.env.CUADERNO_CHROMIUM ? { executablePath: process.env.CUADERNO_CHROMIUM } : {});
  try {
    for (const tema of ['claro', 'oscuro']) {
      const p = await navegador.newPage({ viewport: { width: 1100, height: 760 }, colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
      await p.goto(server.urlEntrada()); await p.locator('#miga strong').waitFor();
      const base = new URL(p.url()).origin;
      const foto = nombre => p.screenshot({ path: path.join(salida, `despues-${nombre}-${tema}-${FECHA}.png`) });
      const ajustar = async editor => {
        await p.evaluate(v => fetch('/api/configuracion', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ editor: v }) }), editor);
      };
      const abrir = async (ruta, editor) => {
        await ajustar(editor);
        await p.goto(`${base}/#/n/${ruta}`); await p.reload(); await p.locator('#miga strong').waitFor();
        await p.evaluate(t => { document.documentElement.dataset.tema = t; }, tema);
        await p.locator('#btn-editar:not([hidden])').waitFor(); await p.locator('#btn-editar').click();
        await p.locator('#edicion-cm .cm-content').waitFor(); await p.waitForTimeout(500);
      };
      const salir = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(300); if (await p.locator('#descartar').isVisible()) await p.locator('#descartar-ok').click(); await p.locator('#edicion-cm').waitFor({ state: 'hidden' }); };
      const nota = 'insertar-imagen/con-attachments/rota.md';
      // Vista y plano, con la imagen y la rota; el cursor al final para que ninguna esté en la línea del cursor.
      await abrir(nota, 'vista'); await p.keyboard.press('ControlOrMeta+End'); await p.waitForTimeout(300);
      await foto('editor-vista-rota'); await salir();
      await abrir(nota, 'plano'); await p.keyboard.press('ControlOrMeta+End'); await p.waitForTimeout(300);
      await foto('editor-plano'); await salir();
      // Barra con «Imagen» y una pendiente (elegida con el botón) en vista, con el cursor dentro del crudo y fuera.
      await abrir(nota, 'vista');
      await p.locator('#imagen-fichero').setInputFiles(path.join(fuera, 'Gastos del mes.png'));
      await p.locator('#edicion-cm img.live-imagen[src^="blob:"]').waitFor(); await p.waitForTimeout(400);
      await foto('editor-pendiente');
      await p.locator('.edicion-barra button[data-formato="imagen"]').focus(); await foto('barra-imagen');
      // El error al aplicar: la subida de la pendiente falla.
      await p.route(/\/api\/imagen\?/, r => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'No hay espacio en el disco' }) }));
      await p.locator('#edicion-aplicar').click();
      await p.locator('.aviso-flotante', { hasText: 'No se ha podido copiar la imagen' }).waitFor(); await p.waitForTimeout(300);
      await foto('aviso-error');
      await p.unroute(/\/api\/imagen\?/); await p.evaluate(() => document.querySelectorAll('.aviso-flotante').forEach(a => a.remove()));
      await p.close();
    }
  } finally {
    await navegador.close();
    await new Promise(r => server.close(r));
    fs.rmSync(padre, { recursive: true, force: true });
    fs.rmSync(process.env.CUADERNO_CONFIG_DIR, { recursive: true, force: true });
  }
  console.log(`capturas en ${path.relative(process.cwd(), salida)}`);
})().catch(e => { console.error(e); process.exit(1); });
