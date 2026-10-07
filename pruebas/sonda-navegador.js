'use strict';
// Sonda o captura de una pantalla de la app con Chrome headless por el protocolo de DevTools, con el viewport exacto.
// Sirve para las sondas de ux-ui-audit (probe-*.js), para extraer el texto visible o para capturar.
//   node pruebas/sonda-navegador.js <url-con-token> <hash|-> <sonda.js|texto|-> [--tab N] [--captura f.png]
//        [--ancho 1400] [--alto 900] [--tema claro|oscuro] [--accion buscar|editar|guardar|ajustes|terminal|resultado]
// Solo macOS con Google Chrome instalado (CHROME cambia la ruta). Las pulsaciones de Tab son reales: sirven para
// medir :focus-visible.
const { spawn } = require('node:child_process'); const fs = require('node:fs');
const WebSocket = require('ws');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2); const [url, hash, sonda] = args;
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const tabs = Number(opt('--tab', 0)), captura = opt('--captura', null), ancho = Number(opt('--ancho', 1400)), alto = Number(opt('--alto', 900)), tema = opt('--tema', null), accion = opt('--accion', null);
const perfil = `${process.env.TMPDIR || '/tmp'}/cdp-perfil-${process.pid}`;
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${perfil}`, `--window-size=${ancho},${alto + 100}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let err = '', listo = false;
chrome.stderr.on('data', d => { err += d; const m = err.match(/DevTools listening on (ws:\/\/\S+)/); if (m && !listo) { listo = true; arrancar(m[1]).catch(e => { console.error(e); salir(1); }); } });
const salir = c => { try { chrome.kill(); } catch { /* nada */ } try { fs.rmSync(perfil, { recursive: true, force: true, maxRetries: 3 }); } catch { /* nada */ } process.exit(c); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const ACCIONES = {
  buscar: `const b = document.querySelector('#buscador'); b.value = 'interes'; b.dispatchEvent(new Event('input', { bubbles: true }));`,
  editar: `document.querySelector('#nota .bloque button[data-accion="editar"]').click();`,
  guardar: `document.querySelector('#btn-guardar').click();`,
  ajustes: `document.querySelector('#btn-ajustes').click();`,
  terminal: `document.querySelector('#btn-terminal').click();`,
  resultado: `document.querySelector('#btn-deshacer').click();`,
};
async function arrancar(wsUrl) {
  const ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  await new Promise(r => ws.on('open', r));
  let id = 0; const pendientes = new Map();
  ws.on('message', m => { const d = JSON.parse(m); if (d.id && pendientes.has(d.id)) { pendientes.get(d.id)(d); pendientes.delete(d.id); } });
  const enviar = (method, params = {}, sessionId) => new Promise(r => { const i = ++id; pendientes.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const { result: { targetId } } = await enviar('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await enviar('Target.attachToTarget', { targetId, flatten: true });
  const ev = (expression) => enviar('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId).then(d => d.result && d.result.result ? d.result.result.value : d);
  await enviar('Page.enable', {}, sessionId);
  await enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: ancho < 700 }, sessionId);
  await enviar('Page.navigate', { url }, sessionId); await espera(1200);
  if (tema) await ev(`document.documentElement.dataset.tema = ${JSON.stringify(tema)}`);
  if (hash && hash !== '-') { await ev(`location.hash = ${JSON.stringify(hash)}`); await espera(1200); }
  if (accion) { await ev(ACCIONES[accion]); await espera(accion === 'terminal' ? 1500 : 700); }
  for (let i = 0; i < tabs; i++) { for (const type of ['keyDown', 'keyUp']) await enviar('Input.dispatchKeyEvent', { type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, sessionId); await espera(60); }
  if (sonda && sonda !== '-') { const src = sonda === 'texto' ? 'document.body.innerText' : fs.readFileSync(sonda, 'utf8'); const r = await ev(src); process.stdout.write((typeof r === 'string' ? r : JSON.stringify(r)) + '\n'); }
  if (captura) { const { result } = await enviar('Page.captureScreenshot', { format: 'png' }, sessionId); fs.writeFileSync(captura, Buffer.from(result.data, 'base64')); }
  await enviar('Browser.close'); salir(0);
}
setTimeout(() => { console.error('tiempo agotado'); salir(2); }, 60000);
