'use strict';
// Lo común de los recorridos de navegador: un servidor sobre un cuaderno temporal (el de tests/ayuda.js), Chromium
// headless con Playwright como biblioteca y esperas que, si fallan, dicen qué pantalla y qué faltaba. Un fichero de
// recorridos arranca un cuaderno y un navegador una vez, y los cierra al final borrando el cuaderno.
//
// Chromium: el que Playwright instala (`npx playwright install chromium`, una vez por ordenador). Si hay otro, la
// variable CUADERNO_CHROMIUM con la ruta del ejecutable manda sobre el instalado.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.CUADERNO_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-config-'));
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { Cuaderno } = require('../../cuaderno');
const { detectar } = require('../../kit');
const { crearServidor } = require('../../servidor');
const { crearCuaderno } = require('../ayuda');

const ESPERA = 8000;   // ms: lo que se espera como mucho a que la pantalla o el fichero cambien

// Una pty de mentira para los recorridos (sin node-pty): cada proceso guarda el comando, hace eco de lo que recibe,
// anota cada `resize` y cada `kill`, y `salir()` dispara su `onExit` como si el programa hubiera terminado.
function ptyFalso() {
  const procesos = [];
  return {
    procesos,
    spawn(cmd, args, opciones) {
      const p = { cmd, args, opciones, escrito: '', redimensiones: [], muerto: false, salida: null, datos: null,
        onData(f) { p.datos = f; }, onExit(f) { p.salida = f; },
        write(s) { p.escrito += s; if (p.datos) p.datos(s); },
        resize(cols, rows) { p.redimensiones.push({ cols, rows }); },
        kill() { if (p.muerto) return; p.muerto = true; if (p.salida) p.salida({ exitCode: 0 }); },
        salir() { if (p.salida) p.salida({ exitCode: 0 }); } };
      procesos.push(p);
      return p;
    },
  };
}

// Arranca servidor + navegador y abre la app con el código de la URL, como server.js (fija la cookie y redirige a /).
// `pty` (ptyFalso(), normalmente) da terminal a los recorridos que la necesitan; sin él, la pestaña dice que no hay.
async function arrancar({ pty = null, ...opciones } = { kit: false }) {   // por defecto, la base: sin kit (AGENTS.md, principio 3)
  const c = crearCuaderno(opciones);
  const kit = detectar(c.raiz);
  const lanzado = [], ejecutado = [];   // lo que la app habría lanzado en el sistema (el gestor de archivos); en los tests no se abre nada
  const server = crearServidor({ cuaderno: new Cuaderno(c.raiz, kit.base), kit, pty, lanzar: (cmd, args, o) => lanzado.push({ cmd, args, cwd: o.cwd }),
    ejecutar: (cmd, args) => { ejecutado.push({ cmd, args }); fs.rmSync(args.at(-1)); },   // la papelera, simulada: el fichero desaparece
    plataforma: 'darwin' });   // fija: el resultado no depende del sistema que corre los tests (cada uno, en sistema.test.js)
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://localhost:${server.address().port}`;   // la dirección de la app; la cookie es de este nombre
  let navegador;
  try { navegador = await chromium.launch(process.env.CUADERNO_CHROMIUM ? { executablePath: process.env.CUADERNO_CHROMIUM } : {}); } catch (e) {
    // Sin navegador no hay recorrido; se cierra lo abierto para que el proceso termine y el fallo se lea.
    await new Promise(r => server.close(r)); c.borrar(); throw e;
  }
  const pagina = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
  pagina.setDefaultTimeout(ESPERA);
  // Para reproducir lo que solo falla en una máquina lenta (la CI de macOS): CUADERNO_CPU_FRENADO=6 frena la CPU de la página 6 veces.
  if (process.env.CUADERNO_CPU_FRENADO) { const cdp = await pagina.context().newCDPSession(pagina); await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.env.CUADERNO_CPU_FRENADO }); }
  // Cobertura del código de la pantalla (public/app.js), solo si se pide (npm run cobertura:pantalla): V8 cuenta qué
  // funciones y bloques corren en los recorridos. Es un informe, no un suelo.
  const cobertura = process.env.CUADERNO_COBERTURA_PANTALLA;
  if (cobertura) await pagina.coverage.startJSCoverage({ resetOnNavigation: false });
  pagina.on('pageerror', e => { console.error('[error en la página]', e.message); });
  await pagina.goto(server.urlEntrada());
  // Va a una ruta de la app (#/tareas, #/n/…) con la página recién cargada: nada de la pantalla anterior se queda.
  // Pasa por about:blank para que la ruta se cargue como documento nuevo. Antes era goto(hash) + reload(): un goto que
  // solo cambia el hash no recarga, y si el reload salía con la URL anterior (visto en Windows, 2 de 2 en el PR #29)
  // la app abría la portada, la miga se rellenaba igual y el recorrido esperaba 8 s a una nota que no iba a llegar.
  const ir = async hash => {
    await pagina.goto('about:blank'); await pagina.goto(`${base}/${hash}`);
    await pagina.locator('#miga strong').waitFor();   // la miga se rellena al pintar cualquier pantalla
    // Solo se comprueba en las notas: la app reescribe a propósito «#/» (portada) y «#/tareas» (filtros recordados).
    const llegada = new URL(pagina.url()).hash;
    if (hash.startsWith('#/n/') && decodeURI(llegada) !== decodeURI(hash)) throw fallo('ir', `la app no se quedó en ${hash}`, `el hash es «${llegada}»`);
  };
  const cerrar = async () => {
    if (cobertura) { const c = (await pagina.coverage.stopJSCoverage()).filter(x => x.url.endsWith('/public/app.js')); fs.mkdirSync(cobertura, { recursive: true }); fs.writeFileSync(path.join(cobertura, `${process.pid}-${Date.now()}.json`), JSON.stringify(c)); }
    await navegador.close();
    await new Promise(r => server.close(r));
    c.borrar();
    fs.rmSync(process.env.CUADERNO_CONFIG_DIR, { recursive: true, force: true });
  };
  return { c, server, base, navegador, pagina, ir, cerrar, lanzado, ejecutado };
}

const fallo = (pantalla, que, detalle) => new assert.AssertionError({ message: `${pantalla}: ${que}${detalle ? ` (${detalle})` : ''}` });

// Repite fn hasta que devuelva algo verdadero; si se agota el tiempo, el fallo dice la pantalla y qué faltaba.
async function hasta(fn, pantalla, que) {   // `que` puede ser una función: el texto del fallo se arma al fallar, con lo último que se vio
  const fin = Date.now() + ESPERA;
  let ultimo = null;
  while (Date.now() < fin) {
    try { const v = await fn(); if (v) return v; ultimo = null; } catch (e) { ultimo = e; }
    await new Promise(r => setTimeout(r, 60));
  }
  throw fallo(pantalla, typeof que === 'function' ? que() : que, ultimo && ultimo.message);
}
// El localizador tiene que verse (o dejar de verse); devuelve el primero.
async function visible(loc, pantalla, que) { try { await loc.first().waitFor({ state: 'visible' }); } catch (e) { throw fallo(pantalla, `no aparece ${que}`, e.message.split('\n')[0]); } return loc.first(); }
async function oculto(loc, pantalla, que) { try { await loc.first().waitFor({ state: 'hidden' }); } catch (e) { throw fallo(pantalla, `sigue a la vista ${que}`, e.message.split('\n')[0]); } }
// El texto del localizador tiene que cumplir la expresión (espera a que cambie).
async function conTexto(loc, re, pantalla, que) {
  let texto = '';
  await hasta(async () => { texto = (await loc.first().textContent()) || ''; return re.test(texto); }, pantalla, () => `${que}: se esperaba ${re}, hay «${texto.trim().slice(0, 120)}»`);
}
// El fichero del cuaderno tiene que cumplir la expresión (la app escribe en disco, el test espera a que llegue).
async function ficheroCumple(c, rel, re, pantalla) {
  let texto = '';
  await hasta(() => { texto = c.leer(rel); return re.test(texto); }, pantalla, () => `${rel} no contiene ${re}; el fichero dice:\n${texto}`);
}
// El hash de la página tiene que cumplir la expresión.
async function hashCumple(pagina, re, pantalla) { await hasta(() => re.test(new URL(pagina.url()).hash), pantalla, `el hash no cumple ${re}; es ${new URL(pagina.url()).hash}`); }

module.exports = { arrancar, ptyFalso, hasta, visible, oculto, conTexto, ficheroCumple, hashCumple, fallo, ESPERA };
