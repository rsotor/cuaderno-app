'use strict';
// Abrir una carpeta en la app de escritorio (plan §2, filas «Abrir carpeta» y «Una instancia»; T4), por tres caminos:
// el diálogo del sistema (la pantalla llama a cuadernoApp.elegirCarpeta() y llega aquí por IPC, canal `elegir-carpeta`),
// la carpeta en los argumentos (`Cuaderno ~/cursos/finanzas`: Windows, Linux y la segunda instancia, que trae los suyos
// en `second-instance`) y `open-file` (Mac: arrastrar la carpeta al icono del Dock). La carpeta decidida sustituye al
// «último reciente» si llega antes de arrancar el servidor (va al hijo en CUADERNO_CARPETA); si llega con el servidor
// en marcha, el padre le hace la misma petición que haría la pantalla, POST /api/abrir con la cookie del código (el
// padre ya conoce puerto y token: nada nuevo en el servidor ni en el preload), y recarga la ventana por la URL de
// entrada. Todo inyectable (Electron, argv, la petición HTTP) para probarlo en Node: tests/electron-carpeta.test.js.
const http = require('node:http');
const path = require('node:path');

const CANAL = 'elegir-carpeta';
const COOKIE = 'cuaderno';   // el nombre de la cookie del código, el de servidor.js
const DIALOGO = { title: 'Elegir la carpeta del cuaderno', buttonLabel: 'Abrir', properties: ['openDirectory', 'createDirectory'] };

// La carpeta que viene en los argumentos: el primero que exista como carpeta, saltando el ejecutable (argv[0]), la
// ruta de la propia app cuando no está empaquetada (`electron .`: el primer argumento que no es un flag) y los flags
// (`--inspect=0`, `--no-sandbox`, `-psn_…` en Mac). Las rutas relativas se resuelven contra `cwd` (la segunda instancia
// dice el suyo). `existe(ruta)` dice si es una carpeta; si lanza, cuenta como que no.
function carpetaDeArgv(argv, { empaquetada = false, existe, cwd = process.cwd() } = {}) {
  const sinFlags = (Array.isArray(argv) ? argv.slice(1) : []).filter(a => typeof a === 'string' && a && !a.startsWith('-'));
  for (const a of sinFlags.slice(empaquetada ? 0 : 1)) {
    const r = path.resolve(cwd, a);
    let ok = false;
    try { ok = existe(r); } catch { /* no se puede mirar: no es una carpeta que abrir */ }
    if (ok) return r;
  }
  return null;
}

// El remitente de un mensaje IPC tiene que ser nuestra pantalla: la URL de su frame empieza por http://localhost:<puerto>/.
function remitenteValido(url, puerto) {
  return Number.isInteger(puerto) && puerto > 0 && typeof url === 'string' && url.startsWith(`http://localhost:${puerto}/`);
}

// Una petición HTTP al servidor hijo que resuelve con { status, cuerpo }. Inyectable en los tests.
function pedir(opciones, cuerpo) {
  return new Promise((resolver, rechazar) => {
    const r = http.request(opciones, res => {
      let datos = '';
      res.setEncoding('utf8');
      res.on('data', c => { datos += c; });
      res.on('end', () => resolver({ status: res.statusCode, cuerpo: datos }));
    });
    r.on('error', rechazar);
    r.end(cuerpo);
  });
}

// POST /api/abrir al servidor en marcha, como lo haría la pantalla, con la cookie del código (Host es localhost:<puerto>
// y sin Origin, que el servidor admite como navegación propia). Resuelve con la información del cuaderno abierto o
// rechaza con el error que diga el servidor («esa carpeta no tiene notas»).
async function abrirEnServidor({ puerto, token, carpeta, peticion = pedir }) {
  const cuerpo = JSON.stringify({ ruta: carpeta });
  const r = await peticion({ host: 'localhost', port: puerto, method: 'POST', path: '/api/abrir', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(cuerpo), cookie: `${COOKIE}=${token}` } }, cuerpo);
  let datos = {};
  try { datos = JSON.parse(r.cuerpo); } catch { /* sin JSON: el error de abajo */ }
  if (r.status !== 200) throw new Error(datos.error || `respuesta ${r.status}`);
  return datos;
}

// Monta los tres caminos sobre el `estado` de app.js (ventana, puerto, token) y devuelve el abridor:
//   pendiente   la carpeta que espera a que arranque el servidor (de argv, o de open-file antes del puerto)
//   tomar()     la devuelve y la olvida: app.js la pasa al hijo en CUADERNO_CARPETA en vez del último reciente
//   llegada()   una carpeta que llega: con servidor, se abre en él y se recarga la ventana; sin servidor, queda pendiente
//   despachar() lo que quedó pendiente entre el fork y el puerto: app.js lo llama cuando el servidor ya escucha
// `recargar()` es lo que app.js hace para volver a entrar por la URL de entrada; `anotar` escribe en el registro.
// Variable de pruebas CUADERNO_DIALOGO_PRUEBA=<ruta>: el diálogo no se abre y se devuelve esa ruta (vacía: cancelar).
function crearAbridor({ electron, estado, anotar, existe, recargar, env = process.env, argv = process.argv, cwd = process.cwd(), empaquetada = !!electron.app.isPackaged, peticion = pedir }) {
  const { app, ipcMain, dialog } = electron;
  const esCarpeta = r => { try { return !!existe(r); } catch { return false; } };
  const abridor = { pendiente: carpetaDeArgv(argv, { empaquetada, existe, cwd }) };
  if (abridor.pendiente) anotar(`carpeta en los argumentos: ${abridor.pendiente}`);

  abridor.tomar = () => { const c = abridor.pendiente; abridor.pendiente = null; return c; };
  abridor.llegada = async (carpeta, origen) => {
    if (!estado.puerto) { abridor.pendiente = carpeta; anotar(`carpeta por ${origen} antes de que arranque el servidor: ${carpeta} (se abrirá al arrancar)`); return false; }
    anotar(`carpeta por ${origen}: ${carpeta}`);
    try { await abrirEnServidor({ puerto: estado.puerto, token: estado.token, carpeta, peticion }); } catch (e) { anotar(`no se ha podido abrir ${carpeta}: ${e.message}`); return false; }
    anotar(`cuaderno abierto en el servidor: ${carpeta}; se recarga la ventana`);
    return recargar();
  };
  abridor.despachar = () => { const c = abridor.tomar(); return c ? abridor.llegada(c, 'espera') : Promise.resolve(false); };
  const alFrente = () => { const v = estado.ventana; if (!v) return; if (v.isMinimized()) v.restore(); v.focus(); };

  // Mac: arrastrar al icono del Dock o «Abrir con». Se registra antes de `ready` (si no, la primera carpeta se pierde).
  app.on('open-file', (evento, ruta) => {
    if (evento && evento.preventDefault) evento.preventDefault();
    if (!esCarpeta(ruta)) return anotar(`open-file con algo que no es una carpeta, se ignora: ${ruta}`);
    alFrente();
    abridor.llegada(ruta, 'open-file');
  });
  // La segunda instancia (`Cuaderno otra-carpeta` con la app abierta) le pasa sus argumentos a esta, que ya la trae al frente.
  app.on('second-instance', (evento, argvSegunda, directorio) => {
    const c = carpetaDeArgv(argvSegunda, { empaquetada, existe, cwd: directorio || cwd });
    if (c) abridor.llegada(c, 'segunda instancia');
  });
  // El diálogo del sistema, pedido por la pantalla. Solo atiende a nuestra pantalla: cualquier otro frame (un .html del
  // cuaderno en su iframe, con origen opaco) se rechaza y queda en el registro.
  ipcMain.handle(CANAL, async evento => {
    const url = evento && evento.senderFrame ? evento.senderFrame.url : null;
    if (!remitenteValido(url, estado.puerto)) { anotar(`petición de ${CANAL} de un remitente que no es la pantalla, rechazada: ${url || '(sin frame)'}`); throw new Error('remitente no permitido'); }
    if (env.CUADERNO_DIALOGO_PRUEBA !== undefined) { anotar(`diálogo de carpeta sustituido (CUADERNO_DIALOGO_PRUEBA): ${env.CUADERNO_DIALOGO_PRUEBA || 'cancelado'}`); return env.CUADERNO_DIALOGO_PRUEBA || null; }
    const r = await dialog.showOpenDialog(estado.ventana, DIALOGO);
    return r && !r.canceled && Array.isArray(r.filePaths) && r.filePaths.length ? r.filePaths[0] : null;
  });
  return abridor;
}

module.exports = { crearAbridor, carpetaDeArgv, remitenteValido, abrirEnServidor, pedir, CANAL, DIALOGO };
