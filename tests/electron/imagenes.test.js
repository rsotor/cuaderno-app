'use strict';
// Imágenes en el editor, en la app de escritorio (plan docs/planes/imagenes-editor.md, T8), con el Electron de verdad
// (Playwright _electron) y una copia del cuaderno de ejemplo. Lo que solo existe en la app: `rutaDeFichero`
// (`webUtils.getPathForFile`) da la ruta de un fichero elegido, así que una imagen que ya está dentro del cuaderno se
// enlaza sin copiarla; una de fuera se copia. Y P13: soltar ficheros con el editor sucio no navega la ventana.
// Va en `npm run test:electron` (paso propio, nunca a la vez que test:navegador). Configuración y userData temporales.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');
const { crearCuaderno } = require('../ayuda');

const RAIZ = path.join(__dirname, '..', '..');
const ESPERA = 20_000;
const SIN = 'insertar-imagen/sin-carpeta';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';   // 1×1

let c, app, pagina;
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-electron-img-'));
const enDisco = rel => path.join(c.raiz, rel);
const existe = rel => fs.existsSync(enDisco(rel));
const textoEditor = () => pagina.evaluate(async () => (await import('/public/live.js')).texto());
async function hasta(f, que) {
  const fin = Date.now() + ESPERA;
  while (Date.now() < fin) { if (await f()) return; await new Promise(r => setTimeout(r, 50)); }
  assert.fail(`imágenes (app): ${que}`);
}
async function abrirNota(rel) {
  await pagina.evaluate(r => { location.hash = `#/n/${r}`; }, rel);
  await pagina.locator('#btn-editar').waitFor({ state: 'visible' });
  await pagina.locator('#btn-editar').click();
  await pagina.locator('#edicion-cm .cm-content').waitFor({ state: 'visible' });
}
async function aplicar() {
  await pagina.locator('#edicion-aplicar').click();
  await pagina.locator('#edicion-cm').waitFor({ state: 'hidden' });
}

test.before(async () => {
  c = crearCuaderno({ kit: false });
  const configDir = path.join(base, 'config'), userData = path.join(base, 'userData');
  fs.mkdirSync(configDir); fs.mkdirSync(userData);
  fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ tema: 'claro', editor: 'vista' }));
  const tmp = process.platform !== 'win32' && os.tmpdir().length > 40 ? '/tmp' : os.tmpdir();
  const entorno = { ...process.env, TMPDIR: tmp, CUADERNO_CONFIG_DIR: configDir, CUADERNO_USERDATA: userData, CUADERNO_SIN_DIALOGO: '1', CUADERNO_OCULTA: '1' };
  app = await _electron.launch({ args: ['.', c.raiz], cwd: RAIZ, timeout: 60_000, env: entorno });
  pagina = await app.firstWindow();
  pagina.setDefaultTimeout(ESPERA);
  await pagina.locator('#nota h1', { hasText: 'Mi curso' }).waitFor({ state: 'visible' });
  await pagina.evaluate(() => fetch('/api/configuracion', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ editor: 'vista' }) }));
});
test.after(async () => {
  if (app) await app.close().catch(() => {});
  if (c) c.borrar();
  fs.rmSync(base, { recursive: true, force: true });
});

test('imágenes en la app: setInputFiles da a rutaDeFichero la ruta real del fichero elegido', async () => {
  const dir = fs.mkdtempSync(path.join(base, 'sonda-'));
  const png = path.join(dir, 'sonda.png');
  fs.writeFileSync(png, Buffer.from(PNG, 'base64'));
  await abrirNota(`${SIN}/nota.md`);
  try {
    // La app vacía el input al leer el fichero: la sonda mira el `File` en la fase de captura, antes que ella.
    await pagina.evaluate(() => {
      const i = document.querySelector('#imagen-fichero');
      i.addEventListener('change', () => { window.__ruta = window.cuadernoApp.rutaDeFichero(i.files[0]); }, true);
    });
    await pagina.locator('#imagen-fichero').setInputFiles(png);
    const ruta = await pagina.evaluate(() => window.__ruta);
    assert.equal(fs.realpathSync(ruta), fs.realpathSync(png), 'rutaDeFichero debe dar la ruta del fichero elegido');
  } finally {
    await pagina.keyboard.press('Escape');
    if (await pagina.locator('#descartar').isVisible()) await pagina.locator('#descartar-ok').click();
    await pagina.locator('#edicion-cm').waitFor({ state: 'hidden' });
  }
});

test('imágenes en la app: una imagen que ya está en el cuaderno se enlaza por su ruta relativa y Aplicar no copia nada ni crea imagenes/', async () => {
  const antes = fs.readdirSync(enDisco(SIN)).sort();
  await abrirNota(`${SIN}/nota.md`);
  await pagina.locator('#imagen-fichero').setInputFiles(enDisco('material/reparto-50-30-20.png'));
  await hasta(async () => (await textoEditor()).includes('![reparto-50-30-20](../../material/reparto-50-30-20.png)'), 'el texto no lleva el enlace relativo a la imagen del cuaderno');
  await aplicar();
  assert.ok(fs.readFileSync(enDisco(`${SIN}/nota.md`), 'utf8').includes('![reparto-50-30-20](../../material/reparto-50-30-20.png)'), 'la nota no lleva el enlace');
  assert.equal(existe(`${SIN}/imagenes`), false, 'no debe crearse imagenes/');
  assert.deepEqual(fs.readdirSync(enDisco(SIN)).sort(), antes.concat('nota.md').filter((x, i, a) => a.indexOf(x) === i).sort(), 'junto a la nota no debe haber copia');
  assert.equal(fs.readdirSync(enDisco('material')).filter(f => /reparto-50-30-20/.test(f)).length, 1, 'la imagen del cuaderno no se duplica');
  fs.writeFileSync(enDisco(`${SIN}/nota.md`), fs.readFileSync(path.join(RAIZ, 'ejemplos', 'cuaderno-ejemplo', SIN, 'nota.md')));
});

test('imágenes en la app: una imagen de una carpeta de fuera se copia a imagenes/ al aplicar', async () => {
  const dir = fs.mkdtempSync(path.join(base, 'fuera-'));
  const png = path.join(dir, 'foto.png');
  fs.writeFileSync(png, Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.from('fuera')]));
  await abrirNota(`${SIN}/nota.md`);
  await pagina.locator('#imagen-fichero').setInputFiles(png);
  await hasta(async () => (await textoEditor()).includes('![foto](imagenes/foto.png)'), 'el texto no lleva el enlace a imagenes/');
  assert.equal(existe(`${SIN}/imagenes`), false, 'hasta Aplicar no hay imagenes/');
  await aplicar();
  assert.deepEqual(fs.readFileSync(enDisco(`${SIN}/imagenes/foto.png`)), fs.readFileSync(png), 'los bytes copiados');
  assert.ok(fs.readFileSync(enDisco(`${SIN}/nota.md`), 'utf8').includes('![foto](imagenes/foto.png)'));
  fs.rmSync(enDisco(`${SIN}/imagenes`), { recursive: true, force: true });
  fs.writeFileSync(enDisco(`${SIN}/nota.md`), fs.readFileSync(path.join(RAIZ, 'ejemplos', 'cuaderno-ejemplo', SIN, 'nota.md')));
});

test('imágenes en la app: con el editor sucio, dragover y drop de ficheros sobre document se cancelan y la ventana sigue en la nota', async () => {
  await abrirNota(`${SIN}/nota.md`);
  await pagina.keyboard.type('sucio');
  await hasta(async () => (await textoEditor()).includes('sucio'), 'el editor no se ensució');
  const url = pagina.url();
  const r = await pagina.evaluate(() => {
    const lanzar = tipo => {
      const dt = new DataTransfer(); dt.items.add(new File(['x'], 'a.png', { type: 'image/png' }));
      const ev = new DragEvent(tipo, { dataTransfer: dt, bubbles: true, cancelable: true });
      document.dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    return { dragover: lanzar('dragover'), drop: lanzar('drop') };
  });
  assert.deepEqual(r, { dragover: true, drop: true });
  assert.equal(pagina.url(), url, 'la ventana no navega');
  await pagina.locator('#edicion-cm .cm-content').waitFor({ state: 'visible' });
  assert.ok((await textoEditor()).includes('sucio'), 'el editor conserva lo escrito');
  await pagina.keyboard.press('Escape');
  if (await pagina.locator('#descartar').isVisible()) await pagina.locator('#descartar-ok').click();
});
