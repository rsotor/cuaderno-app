'use strict';
// Lo del navegador que en la app cambia (plan §6, T2), con Electron inyectado para probarlo en Node con uno falso
// (tests/electron-ventana.test.js); electron/app.js lo llama en dos líneas al crear la ventana.
// - Enlaces fuera: lo que no sea nuestro http://localhost:<puerto> se intercepta (setWindowOpenHandler y will-navigate).
//   Si el esquema está permitido (http, https, mailto: entorno.esquemaPermitido) va a shell.openExternal; si no (file:,
//   javascript:, smb:…), se anota en el registro y no se hace nada. Lo propio (otra pestaña con un fichero del cuaderno)
//   navega o abre su ventana normal, y esa ventana hija recibe estos mismos tratos.
// - Cerrar con cambios: en Electron un beforeunload que cancela no pregunta, bloquea el cierre en silencio; con
//   `will-prevent-unload` se enseña «¿Descartar lo escrito?» y la pantalla no cambia. Vale también para Ver → Recargar.
// - Permisos: la sesión de la partición concede solo clipboard-sanitized-write (copiar la ruta) y deniega lo demás. Si
//   algún día se añade session.setPermissionCheckHandler, tiene que conceder lo mismo (permisoConcedido): el check por
//   defecto concede, y uno «deniega todo» rompería copiar ruta.
// - Tema: nativeTheme.themeSource = temaNativo(config.tema) y el fondo de la ventana coherente (con `auto`, el que diga el
//   sistema: nunca blanco sobre un escritorio oscuro); cuando cambia config.json (Ajustes, desde la pantalla o desde la
//   web), el padre lo ve con fs.watch sobre la carpeta de configuración y lo reaplica.
// Variables de prueba: CUADERNO_SIN_DIALOGO=descartar|seguir fija la respuesta del diálogo (cualquier otro valor: seguir
// editando, lo seguro); CUADERNO_SIN_NAVEGADOR anota el enlace en vez de abrir el navegador del sistema.
const fs = require('node:fs');
const { esquemaPermitido, temaNativo } = require('./entorno');

const PERMISOS = ['clipboard-sanitized-write'];   // lo único que la pantalla pide: navigator.clipboard.writeText
const FONDO = { claro: '#ffffff', oscuro: '#1e1e1e' };
const FICHERO_CONFIG = 'config.json';

const permisoConcedido = permiso => PERMISOS.includes(permiso);

// ¿Es una URL de nuestro servidor? Solo http en localhost o 127.0.0.1 con el puerto de ahora (puede cambiar tras un relanzado).
function esPropia(url, puerto) {
  try { const u = new URL(String(url)); return u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname) && u.port === String(puerto); } catch { return false; }
}
// Qué se hace con una URL a la que la pantalla quiere ir: 'propia' (se deja), 'fuera' (al navegador del sistema) o
// 'ignorado' (ni una cosa ni otra, queda en el registro).
function tratarEnlace(url, { puerto, abrirFuera, anotar }) {
  if (esPropia(url, puerto())) return 'propia';
  if (esquemaPermitido(url)) { anotar(`enlace al navegador del sistema: ${url}`); abrirFuera(url); return 'fuera'; }
  anotar(`enlace ignorado (esquema no permitido): ${url}`);
  return 'ignorado';
}

// El color del fondo de la ventana para un tema de config: con `auto`, el que use el sistema ahora.
function colorDeFondo(tema, nativeTheme) {
  const t = temaNativo(tema);
  return t === 'dark' || (t === 'system' && !!(nativeTheme && nativeTheme.shouldUseDarkColors)) ? FONDO.oscuro : FONDO.claro;
}
// Aplica el tema de la configuración a Electron (y, si se da la ventana, a su fondo). Devuelve { tema, fuente, color }.
function aplicarTema({ nativeTheme, config, ventana = null }) {
  const tema = config.leer().tema, fuente = temaNativo(tema), color = colorDeFondo(tema, nativeTheme);
  nativeTheme.themeSource = fuente;
  if (ventana && typeof ventana.setBackgroundColor === 'function') { try { ventana.setBackgroundColor(color); } catch { /* ventana ya cerrada */ } }
  return { tema, fuente, color };
}
// Vigila config.json (en realidad su carpeta: así vale aunque el fichero aún no exista) y reaplica el tema cuando cambia;
// `alCambiar()` se llama además en cada cambio del fichero (el menú reconstruye sus recientes con él: un solo fs.watch).
// Devuelve { cerrar }. Si no se puede vigilar (carpeta sin permiso), se anota y el tema queda el del arranque.
function vigilarTema({ nativeTheme, config, ventana = null, anotar, vigilar = fs.watch, carpeta = config.carpeta, alCambiar = null }) {
  let actual = temaNativo(config.leer().tema), vigilante = null;
  const revisar = (evento, nombre) => {
    if (nombre && nombre !== FICHERO_CONFIG) return;
    const { tema, fuente } = aplicarTema({ nativeTheme, config, ventana });
    if (fuente !== actual) { actual = fuente; anotar(`tema cambiado en config.json: ${tema} → themeSource ${fuente}`); }
    if (alCambiar) { try { alCambiar(); } catch (e) { anotar(`al cambiar config.json: ${e.message}`); } }
  };
  try {
    const dir = carpeta();
    fs.mkdirSync(dir, { recursive: true });
    vigilante = vigilar(dir, revisar);
    if (vigilante && typeof vigilante.on === 'function') vigilante.on('error', e => anotar(`el vigilante de config.json ha fallado: ${e.message}`));
  } catch (e) { anotar(`no se puede vigilar config.json (el tema solo se lee al arrancar): ${e.message}`); }
  return { cerrar: () => { if (vigilante) { try { vigilante.close(); } catch { /* ya cerrado */ } vigilante = null; } }, revisar };
}

// Los permisos de la sesión de la partición: solo escribir en el portapapeles.
function permisos({ session, anotar }) {
  session.setPermissionRequestHandler((webContents, permiso, callback) => {
    const ok = permisoConcedido(permiso);
    if (!ok) anotar(`permiso denegado a la pantalla: ${permiso}`);
    callback(ok);
  });
}

// El diálogo de cerrar con el editor sucio: true si se descarta lo escrito (la página se descarga), false si se sigue editando.
function preguntarDescartar({ dialog, ventana, env, anotar }) {
  if (env.CUADERNO_SIN_DIALOGO) {
    const descartar = env.CUADERNO_SIN_DIALOGO === 'descartar';
    anotar(`diálogo saltado (CUADERNO_SIN_DIALOGO=${env.CUADERNO_SIN_DIALOGO}): ¿Descartar lo escrito? → ${descartar ? 'descartar' : 'seguir editando'}`);
    return descartar;
  }
  try {
    return dialog.showMessageBoxSync(ventana, { type: 'question', title: 'Cuaderno', message: '¿Descartar lo escrito?', detail: 'Hay cambios sin guardar en el editor. Si los descartas, se pierden.', buttons: ['Descartar', 'Seguir editando'], defaultId: 1, cancelId: 1, noLink: true }) === 0;
  } catch (e) { anotar(`no se ha podido enseñar el diálogo de cerrar: se sigue editando (${e.message})`); return false; }
}

// Deja una ventana (la principal o una hija abierta desde la pantalla) con los tratos de arriba: enlaces y cierre.
function prepararVentana({ ventana, electron, env, puerto, anotar, abrirFuera = null }) {
  const { shell, dialog } = electron;
  const abrir = abrirFuera || (env.CUADERNO_SIN_NAVEGADOR
    ? url => anotar(`navegador no abierto (CUADERNO_SIN_NAVEGADOR): ${url}`)
    : url => Promise.resolve(shell.openExternal(url)).catch(e => anotar(`no se ha podido abrir fuera ${url}: ${e.message}`)));
  const tratar = url => tratarEnlace(url, { puerto, abrirFuera: abrir, anotar });
  const wc = ventana.webContents;
  wc.setWindowOpenHandler(({ url }) => ({ action: tratar(url) === 'propia' ? 'allow' : 'deny' }));
  wc.on('will-navigate', (e, url) => { if (tratar(url) !== 'propia') e.preventDefault(); });
  wc.on('did-create-window', hija => prepararVentana({ ventana: hija, electron, env, puerto, anotar, abrirFuera }));
  wc.on('will-prevent-unload', e => { if (preguntarDescartar({ dialog, ventana, env, anotar })) e.preventDefault(); });
}

// Todo lo de la ventana principal de una vez: tratos de la ventana, permisos de la sesión y vigilancia del tema (y de lo
// demás de config.json, con `alCambiar`). Devuelve el vigilante (se cierra solo al salir).
function preparar({ ventana, electron, config, env, particion, puerto, anotar, vigilar, alCambiar = null }) {
  prepararVentana({ ventana, electron, env, puerto, anotar });
  permisos({ session: electron.session.fromPartition(particion), anotar });
  const vigilante = vigilarTema({ nativeTheme: electron.nativeTheme, config, ventana, anotar, alCambiar, ...(vigilar ? { vigilar } : {}) });
  electron.app.on('before-quit', vigilante.cerrar);
  return vigilante;
}

module.exports = { preparar, prepararVentana, aplicarTema, vigilarTema, colorDeFondo, permisos, permisoConcedido, preguntarDescartar, tratarEnlace, esPropia, PERMISOS, FONDO };
