'use strict';
// Lo del navegador que en la app cambia (plan §6, T2), con Electron inyectado para probarlo en Node con uno falso
// (tests/electron-ventana.test.js); electron/app.js lo llama en dos líneas al crear la ventana.
// - Enlaces fuera: lo que no sea nuestro http://localhost:<puerto> se intercepta (setWindowOpenHandler y will-navigate).
//   Si el esquema está permitido (http, https, mailto: entorno.esquemaPermitido) va a shell.openExternal; si no (file:,
//   javascript:, smb:…), o si es localhost/127.0.0.1 con otro puerto (no es nuestro servidor), se anota y no se hace nada. Lo propio (otra pestaña con un fichero del cuaderno)
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
const FONDO = { claro: '#e6e8ec', oscuro: '#0e0f12' };   // la mesa de la pantalla (--mesa de public/estilo.css): «Arrancando…» y la pantalla comparten fondo, sin salto al cargar (crítica 2026-10-10, 1)
const FICHERO_CONFIG = 'config.json';
// La ventana por defecto (crítica 2026-10-10, 5): 1456 × 900, o el 90 % del área de trabajo si es menor; nunca menos de 760 × 480.
const VENTANA = { width: 1456, height: 900, minWidth: 760, minHeight: 480 };
const VISIBLE = 100;   // px de la ventana que tienen que caer en el área de trabajo para dar la posición guardada por buena

const permisoConcedido = permiso => PERMISOS.includes(permiso);

// ¿Es una URL de nuestro servidor? Solo http en localhost con el puerto de ahora (puede cambiar tras un relanzado): el mismo
// origen que valida carpeta.remitenteValido (la ventana entra por localhost; 127.0.0.1 redirige a él).
function esPropia(url, puerto) {
  try { const u = new URL(String(url)); return u.protocol === 'http:' && u.hostname === 'localhost' && u.port === String(puerto); } catch { return false; }
}
// ¿Apunta a este ordenador (localhost o 127.0.0.1) sin ser nuestra? Otro puerto (el de un servidor relanzado que ya no existe,
// una `npm start` aparte, cualquier otra cosa local): eso no va al navegador del sistema; se anota y nada.
function esLocalAjena(url) {
  try { const u = new URL(String(url)); return ['localhost', '127.0.0.1'].includes(u.hostname); } catch { return false; }
}
// Qué se hace con una URL a la que la pantalla quiere ir: 'propia' (se deja), 'fuera' (al navegador del sistema) o
// 'ignorado' (ni una cosa ni otra, queda en el registro).
function tratarEnlace(url, { puerto, abrirFuera, anotar }) {
  if (esPropia(url, puerto())) return 'propia';
  if (esLocalAjena(url)) { anotar(`enlace ignorado (local pero no es nuestro servidor): ${url}`); return 'ignorado'; }
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

// Dónde y cuánto de grande abre la ventana. Con límites guardados (config.json, `ventana`) que caen dentro de una pantalla
// (la que más los solapa, screen.getDisplayMatching: la barra de título a la vista y al menos VISIBLE px dentro del área de
// trabajo), ahí, recortados al área si la pantalla es ahora más pequeña; si no, el tamaño por defecto (o el 90 % del área de
// trabajo de la pantalla principal si es menor) y Electron la centra. Devuelve lo que se pasa a BrowserWindow más `origen`.
function limitesDeVentana({ screen, guardado = null }) {
  const area = d => (d && (d.workArea || d.bounds)) || null;
  if (guardado && Number.isInteger(guardado.x) && Number.isInteger(guardado.y) && Number.isInteger(guardado.width) && Number.isInteger(guardado.height)) {
    let wa = null;
    try { wa = area(screen.getDisplayMatching(guardado)); } catch { /* sin pantallas: por defecto */ }
    if (wa && dentroDelArea(guardado, wa)) {
      return { x: guardado.x, y: guardado.y, width: Math.max(VENTANA.minWidth, Math.min(guardado.width, wa.width)), height: Math.max(VENTANA.minHeight, Math.min(guardado.height, wa.height)), origen: 'guardado' };
    }
  }
  let wa = null;
  try { wa = area(screen.getPrimaryDisplay()); } catch { /* sin pantallas */ }
  if (!wa) return { width: VENTANA.width, height: VENTANA.height, origen: 'defecto' };
  const width = Math.max(VENTANA.minWidth, Math.min(VENTANA.width, Math.round(wa.width * 0.9))), height = Math.max(VENTANA.minHeight, Math.min(VENTANA.height, Math.round(wa.height * 0.9)));
  return { width, height, origen: width < VENTANA.width || height < VENTANA.height ? 'area' : 'defecto' };
}
// ¿Cae la ventana dentro del área de trabajo? Su borde de arriba (la barra de título) dentro del área, y al menos VISIBLE
// px de ancho y de alto a la vista: así una ventana de una pantalla desconectada no se abre fuera de la vista.
function dentroDelArea(v, wa) {
  return v.y >= wa.y && v.y <= wa.y + wa.height - VISIBLE && v.x + v.width >= wa.x + VISIBLE && v.x <= wa.x + wa.width - VISIBLE;
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

// El gesto de deslizar del trackpad (evento `swipe` de BrowserWindow, solo macOS): izquierda es Atrás y derecha Adelante (como el
// deltaX de NSEvent), y mandan la acción a la pantalla, que decide con su historial (irHistorial). Solo llega si en Preferencias del
// Sistema › Trackpad › Más gestos «Deslizar entre páginas» está en «con dos o tres dedos»; con la opción por defecto (con dos dedos
// en un desplazamiento horizontal) macOS no emite el evento y el gesto llega como rueda horizontal: eso no se atiende (distinguirlo
// del desplazamiento de una tabla exigiría una heurística que dispararía sin querer; plan de navegación, T2.7).
function gestoAtrasAdelante({ ventana, anotar }) {
  if (!ventana || typeof ventana.on !== 'function') return;
  ventana.on('swipe', (_evento, direccion) => {
    const accion = direccion === 'left' ? 'atras' : direccion === 'right' ? 'adelante' : null;
    if (!accion) return;
    anotar(`gesto del trackpad: ${direccion} → ${accion}`);
    ventana.webContents.send('accion', accion);
  });
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
// demás de config.json, con `alCambiar`). Devuelve el vigilante (se cierra solo al salir, en `will-quit`: un quit cancelado
// por «Seguir editando» no debe dejar la app sin vigilante).
function preparar({ ventana, electron, config, env, particion, puerto, anotar, vigilar, alCambiar = null }) {
  prepararVentana({ ventana, electron, env, puerto, anotar });
  gestoAtrasAdelante({ ventana, anotar });
  permisos({ session: electron.session.fromPartition(particion), anotar });
  const vigilante = vigilarTema({ nativeTheme: electron.nativeTheme, config, ventana, anotar, alCambiar, ...(vigilar ? { vigilar } : {}) });
  electron.app.on('will-quit', vigilante.cerrar);
  return vigilante;
}

module.exports = { preparar, prepararVentana, gestoAtrasAdelante, aplicarTema, vigilarTema, colorDeFondo, limitesDeVentana, dentroDelArea, permisos, permisoConcedido, preguntarDescartar, tratarEnlace, esPropia, esLocalAjena, PERMISOS, FONDO, VENTANA };
