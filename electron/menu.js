'use strict';
// El menú de la app de escritorio, en castellano (plan §2, fila «Menú y atajos»; T5). `plantillaMenu` es pura: una tabla
// → la plantilla de Menu.buildFromTemplate, con etiquetas, aceleradores y acciones por plataforma; `instalarMenu` la
// engancha a Electron y la reconstruye cuando cambian los recientes. Los elementos propios no hacen nada por su cuenta:
// mandan un nombre a la pantalla (`webContents.send('accion', nombre)`), que lo atiende con cuadernoApp.alAccion(cb) y
// hace lo que ya sabe hacer (Guardar es el botón Guardar; Ajustes, el botón de Ajustes; Abrir nota… y Buscar…, el
// buscador; Nueva tarea, su casilla; Abrir carpeta…, el diálogo del sistema de T4). Los roles estándar son de Electron (sin los de Edición, en Mac no hay copiar y pegar). Lo de Ayuda es
// del proceso principal: el README y el plan vivo en GitHub (shell.openExternal, el repo público), el registro (shell.openPath), el
// Diagnóstico (si node-pty cargó, el entorno de la shell, PATH, puerto, carpeta de configuración, versiones; nunca el token)
// y Acerca de. Los atajos que decida Roberto (plan §8.1) se añaden a ATAJOS.
const path = require('node:path');

const REPO = 'https://github.com/rsotor/cuaderno-app';   // el repo público, sin token ni nada
const URL_COMO_SE_USA = `${REPO}#readme`;                 // Ayuda → Cómo se usa Cuaderno: el README
const URL_ATAJOS = `${REPO}#teclado`;                     // Ayuda → Atajos de teclado: la sección «Teclado» del README
const URL_PLAN_VIVO = `${REPO}/blob/main/docs/planes/plan-vivo.md`;   // Ayuda → Plan vivo (para quien desarrolla)
const CANAL = 'accion';   // el canal que escucha el preload (cuadernoApp.alAccion)
const NOMBRE = 'Cuaderno';

// Los atajos propios: etiqueta, acelerador (CmdOrCtrl: ⌘ en Mac, Ctrl en Windows y Linux) y el nombre que recibe la
// pantalla. Para añadir uno: una fila aquí y su caso en ACCIONES_APP de public/app.js. Son los que decidió Roberto (plan
// §8.1, 2026-10-10: «los típicos: buscar, abrir, la T para la tarea; la K con dudas», y «el de abrir que me abra la carpeta
// o nota dentro del cuaderno porque no tenemos un importar»):
//   · Abrir nota… (⌘O) y Buscar… (⌘F) hoy hacen lo mismo en la pantalla (abrir la modal de búsqueda, que busca por nombre de
//     nota y de carpeta y por el texto; Enter abre). Son dos acciones con nombre distinto a propósito: divergirán (abrir por
//     nombre irá a la paleta de acciones rápidas; buscar seguirá siendo buscar texto).
//   · Abrir carpeta… (⇧⌘O) es cambiar de cuaderno con el diálogo del sistema: lo que Roberto ve como un «importar».
//   · **CmdOrCtrl+K queda RESERVADA y sin acción**: será la paleta de «acciones rápidas», un bloque posterior del plan vivo
//     (hoy, Ctrl K abre la modal de búsqueda desde la propia pantalla, en la web y en la app; el menú no la toca). Tampoco hay CmdOrCtrl+P.
//   · Los de la crítica de diseño del 2026-10-10 (8; aprobados por el director, Roberto puede vetarlos): Nueva nota (⌘N) en
//     Archivo; en Ver, Barra lateral y Terminal con los aceleradores de la propia página, explícitos y con Ctrl también en
//     Mac (`Ctrl+\` y `Ctrl+\``: ⌘` en Mac es «siguiente ventana»), y Atrás / Adelante (⌘[ / ⌘]), que mandan su
//     acción a la pantalla (NAVEGACION).
const ATAJOS = [
  { id: 'nueva-nota', label: 'Nueva nota', accelerator: 'CmdOrCtrl+N', accion: 'nueva-nota', menu: 'archivo' },
  { id: 'nueva-tarea', label: 'Nueva tarea', accelerator: 'CmdOrCtrl+T', accion: 'nueva-tarea', menu: 'archivo' },
  { id: 'abrir-nota', label: 'Abrir nota…', accelerator: 'CmdOrCtrl+O', accion: 'abrir-nota', menu: 'archivo' },
  { id: 'buscar', label: 'Buscar…', accelerator: 'CmdOrCtrl+F', accion: 'buscar', menu: 'archivo' },
  { id: 'guardar', label: 'Guardar', accelerator: 'CmdOrCtrl+S', accion: 'guardar', menu: 'archivo' },
  { id: 'abrir-carpeta', label: 'Abrir carpeta…', accelerator: 'CmdOrCtrl+Shift+O', accion: 'abrir-carpeta', menu: 'archivo' },
  { id: 'ajustes', label: 'Ajustes…', accelerator: 'CmdOrCtrl+,', accion: 'ajustes', menu: 'archivo' },
  { id: 'barra-lateral', label: 'Barra lateral', accelerator: 'Ctrl+\\', accion: 'barra-lateral', menu: 'ver' },
  { id: 'terminal', label: 'Terminal', accelerator: 'Ctrl+`', accion: 'terminal', menu: 'ver' },
];
// Atrás y Adelante mandan su acción a la pantalla, como los demás: es ella la que decide con su historial (public/app.js, irHistorial:
// solo la entrada vecina de esta app y de este cuaderno), y los botones ‹ ›, los del ratón y el gesto del trackpad dicen lo mismo.
// Desde el principal (navigationHistory) volvería a «Arrancando…» o a una nota del cuaderno anterior.
const NAVEGACION = [
  { id: 'atras', label: 'Atrás', accelerator: 'CmdOrCtrl+[', accion: 'atras' },
  { id: 'adelante', label: 'Adelante', accelerator: 'CmdOrCtrl+]', accion: 'adelante' },
];
const RESERVADOS = ['CmdOrCtrl+K'];   // sin asignar a propósito (acciones rápidas); el test vigila que ningún atajo lo use
const atajo = id => ATAJOS.find(a => a.id === id);
const sep = { type: 'separator' };

// El submenú de Cuadernos recientes: uno por reciente (el más nuevo primero, como los guarda config.js), con su ruta
// de pista; sin ninguno, «Sin recientes» deshabilitado.
function submenuRecientes(recientes, abrirCarpeta) {
  const lista = (Array.isArray(recientes) ? recientes : []).filter(r => r && typeof r.ruta === 'string' && r.ruta);
  if (!lista.length) return [{ id: 'sin-recientes', label: 'Sin recientes', enabled: false }];
  return lista.map(r => ({ id: `reciente:${r.ruta}`, label: r.nombre || path.basename(r.ruta), toolTip: r.ruta, click: () => abrirCarpeta(r.ruta) }));
}

// La plantilla entera. `acciones`: { accion(nombre), abrirCarpeta(ruta), comoSeUsa(), atajos(), planVivo(),
// mostrarRegistro(), diagnostico(), acercaDe() }; las que falten no hacen nada (vale para pintar el menú sin app detrás).
function plantillaMenu({ plataforma = process.platform, recientes = [], version = '', acciones = {} } = {}) {
  const nada = () => {};
  const a = { accion: nada, abrirCarpeta: nada, comoSeUsa: nada, atajos: nada, planVivo: nada, mostrarRegistro: nada, diagnostico: nada, acercaDe: nada, ...acciones };
  const mac = plataforma === 'darwin';
  const propio = id => { const t = atajo(id); return { id: t.id, label: t.label, accelerator: t.accelerator, click: () => a.accion(t.accion) }; };
  const acercaDe = { id: 'acerca-de', label: `Acerca de ${NOMBRE}`, click: () => a.acercaDe() };
  const salir = { id: 'salir', role: 'quit', label: mac ? `Salir de ${NOMBRE}` : 'Salir' };

  // «Archivo» en los tres sistemas, como las demás apps (crítica 2026-10-10, 3): en Mac, «Cuaderno» ya es el menú de la app.
  const archivo = {
    id: 'archivo', label: 'Archivo',
    submenu: [
      propio('nueva-nota'), propio('nueva-tarea'),
      sep,
      propio('abrir-nota'), propio('buscar'),
      sep,
      propio('guardar'),
      sep,
      propio('abrir-carpeta'),
      { id: 'recientes', label: 'Cuadernos recientes', submenu: submenuRecientes(recientes, a.abrirCarpeta) },
      // En Mac, Ajustes y Salir van en el menú de la app, como manda la plataforma; en los demás, aquí.
      ...(mac ? [] : [sep, propio('ajustes'), sep, salir]),
    ],
  };
  const edicion = { id: 'edicion', label: 'Edición', submenu: [
    { role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' }, sep,
    { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' },
  ] };
  const navegar = n => ({ id: n.id, label: n.label, accelerator: n.accelerator, click: () => a.accion(n.accion) });
  const ver = { id: 'ver', label: 'Ver', submenu: [
    { role: 'reload', label: 'Recargar' }, sep,
    ...NAVEGACION.map(navegar), sep,
    propio('barra-lateral'), propio('terminal'), sep,
    { role: 'zoomIn', label: 'Acercar' }, { role: 'zoomOut', label: 'Alejar' }, { role: 'resetZoom', label: 'Tamaño real' }, sep,
    { role: 'togglefullscreen', label: 'Pantalla completa' },
  ] };
  const ventana = { id: 'ventana', label: 'Ventana', role: 'windowMenu' };
  // Ayuda, por utilidad para quien usa la app (crítica 2026-10-10, 9): cómo se usa y los atajos primero; lo de cuando algo
  // falla en medio; el plan vivo, que es para quien desarrolla, al final.
  const ayuda = { id: 'ayuda', label: 'Ayuda', role: 'help', submenu: [
    { id: 'como-se-usa', label: `Cómo se usa ${NOMBRE}`, click: () => a.comoSeUsa() },
    { id: 'atajos', label: 'Atajos de teclado', click: () => a.atajos() }, sep,
    { id: 'mostrar-registro', label: 'Mostrar registro', click: () => a.mostrarRegistro() },
    { id: 'diagnostico', label: 'Diagnóstico', click: () => a.diagnostico() }, sep,
    { id: 'plan-vivo', label: 'Plan vivo (para quien desarrolla)', click: () => a.planVivo() },
    ...(mac ? [] : [sep, acercaDe]),
  ] };
  // El menú de la app en Mac: Acerca de, Ajustes, los roles de ocultar y Salir (lo que Electron pone con appMenu, en castellano).
  const app = { id: 'app', label: NOMBRE, submenu: [
    acercaDe, sep, propio('ajustes'), sep,
    { role: 'services', label: 'Servicios' }, sep,
    { role: 'hide', label: `Ocultar ${NOMBRE}` }, { role: 'hideOthers', label: 'Ocultar otros' }, { role: 'unhide', label: 'Mostrar todo' }, sep,
    salir,
  ] };
  return [...(mac ? [app] : []), archivo, edicion, ver, ventana, ayuda];
}

// Recorre la plantilla (y sus submenús) y devuelve el primer elemento con ese id; para los tests y para `click` en pruebas.
function elemento(plantilla, id) {
  for (const e of plantilla) {
    if (e.id === id) return e;
    if (Array.isArray(e.submenu)) { const h = elemento(e.submenu, id); if (h) return h; }
  }
  return null;
}

// El texto de Ayuda → Diagnóstico, con lo que hace falta para entender un «git: not found» o una terminal muda a distancia,
// por utilidad (crítica 2026-10-10, 7): primero si node-pty cargó y el entorno de la shell (lo que falla de verdad), después
// el PATH, el puerto y las carpetas, y las versiones al final. Nunca lleva el token. `estado` es el de app.js (puerto,
// entorno, pty); `versiones`, process.versions. Con `resumido`, el PATH va en una línea («7 rutas, empieza por …»): es lo
// que cabe en el diálogo; el texto que se copia y el del registro llevan el PATH entero.
function textoDiagnostico({ version = '', versiones = process.versions, estado = {}, carpetaConfig = '', rutaRegistro = '', plataforma = process.platform, arquitectura = process.arch, execPath = process.execPath, resumido = false } = {}) {
  const e = estado.entorno || {};
  const pty = estado.pty === true ? 'sí' : estado.pty === false ? 'no (la app arranca sin terminal)' : 'sin saber aún';
  // «shell -lc (/bin/zsh, 7 ms)», «respaldo (/bin/bash, 10002 ms) — no ha contestado», «sistema» (Windows: sin shell que leer).
  const detalleShell = e.shell ? ` (${e.shell}${e.ms !== undefined ? `, ${e.ms} ms` : ''})` : '';
  const rutas = e.PATH ? String(e.PATH).split(plataforma === 'win32' ? ';' : ':').filter(Boolean) : [];
  const path = !e.PATH ? '(sin resolver)' : resumido ? `${rutas.length} ruta${rutas.length === 1 ? '' : 's'}, empieza por ${rutas[0]}` : e.PATH;
  return [
    `node-pty cargado: ${pty}`,
    `Entorno de la shell: ${e.origen || 'sin resolver'}${detalleShell}${e.error ? ` — ${e.error}` : ''}`,
    `PATH: ${path}`,
    `Puerto del servidor: ${estado.puerto || '(el servidor aún no escucha)'}`,
    `Carpeta de configuración: ${carpetaConfig}`,
    `Registro: ${rutaRegistro}`,
    `Sistema: ${plataforma} ${arquitectura}`,
    `Ejecutable: ${execPath}`,
    `${NOMBRE} ${version || '(sin versión)'} · Electron ${versiones.electron || '(fuera de Electron)'} · Node ${versiones.node || '?'} · Chromium ${versiones.chrome || '?'}`,
  ].join('\n');
}

// Engancha el menú a Electron sobre el `estado` de app.js y lo deja listo para reconstruirlo cuando cambien los recientes.
// `abrirCarpeta(ruta)` es lo que app.js hace con una carpeta que llega (carpeta.js: POST /api/abrir y recargar). En
// pruebas, CUADERNO_SIN_NAVEGADOR anota en vez de abrir el navegador o el registro, y CUADERNO_SIN_DIALOGO anota el
// Diagnóstico y el Acerca de en vez de enseñar el diálogo (el texto del Diagnóstico va al registro siempre: así queda).
function instalarMenu({ electron, estado, config, registro, env = process.env, anotar, version = '', plataforma = process.platform, abrirCarpeta, versiones = process.versions, execPath = process.execPath }) {
  const { Menu, shell, dialog, clipboard } = electron;
  const sinNavegador = !!env.CUADERNO_SIN_NAVEGADOR, sinDialogo = !!env.CUADERNO_SIN_DIALOGO;
  const ventana = () => estado.ventana;
  const mandar = nombre => {
    const v = ventana();
    if (!v || !v.webContents) return anotar(`acción del menú sin ventana, se ignora: ${nombre}`);
    v.webContents.send(CANAL, nombre);
  };
  const dialogo = (titulo, mensaje, detalle, botones = ['Cerrar']) => {
    if (sinDialogo) { anotar(`diálogo saltado (CUADERNO_SIN_DIALOGO): ${titulo}`); return Promise.resolve({ response: -1 }); }
    return Promise.resolve(dialog.showMessageBox(ventana() || undefined, { type: 'info', title: titulo, message: mensaje, detail: detalle, buttons: botones, defaultId: botones.length - 1, cancelId: botones.length - 1, noLink: true }))
      .catch(e => { anotar(`no se ha podido enseñar «${titulo}»: ${e.message}`); return { response: -1 }; });
  };
  // Una página del repo público en el navegador del sistema (sin token ni nada en la URL); en pruebas, anotada.
  const fuera = (url, que) => {
    if (sinNavegador) return anotar(`navegador no abierto (CUADERNO_SIN_NAVEGADOR): ${url}`);
    return Promise.resolve(shell.openExternal(url)).catch(e => anotar(`no se ha podido abrir ${que}: ${e.message}`));
  };
  const acciones = {
    accion: nombre => { anotar(`menú: ${nombre}`); mandar(nombre); },
    abrirCarpeta: ruta => { anotar(`menú: cuaderno reciente ${ruta}`); return abrirCarpeta(ruta); },
    comoSeUsa: () => fuera(URL_COMO_SE_USA, 'cómo se usa'),
    atajos: () => fuera(URL_ATAJOS, 'los atajos de teclado'),
    planVivo: () => fuera(URL_PLAN_VIVO, 'el plan vivo'),
    mostrarRegistro: () => {
      const f = registro.ruta();
      if (sinNavegador) return anotar(`registro no abierto (CUADERNO_SIN_NAVEGADOR): ${f}`);
      return Promise.resolve(shell.openPath(f)).then(error => { if (error) anotar(`no se ha podido abrir el registro ${f}: ${error}`); }, e => anotar(`no se ha podido abrir el registro ${f}: ${e.message}`));
    },
    diagnostico: async () => {
      const datos = { version, versiones, estado, carpetaConfig: config.carpeta(), rutaRegistro: registro.ruta(), plataforma, execPath };
      const texto = textoDiagnostico(datos);   // entero: al registro y al portapapeles
      anotar(`diagnóstico:\n${texto}`);
      const r = await dialogo('Diagnóstico', `Diagnóstico de ${NOMBRE}`, textoDiagnostico({ ...datos, resumido: true }), ['Copiar y cerrar', 'Cerrar']);
      if (r && r.response === 0 && clipboard) { try { clipboard.writeText(texto); } catch (e) { anotar(`no se ha podido copiar el diagnóstico: ${e.message}`); } }
    },
    acercaDe: () => dialogo(`Acerca de ${NOMBRE}`, NOMBRE, `Versión ${version || '(sin versión)'}\nUn cuaderno de estudio: la ventana sobre tus notas Markdown.\n${REPO}`),
  };
  const rutasDe = recientes => JSON.stringify((Array.isArray(recientes) ? recientes : []).map(r => r && r.ruta));
  let actuales = null;
  const menu = { acciones, plantilla: null };
  // Construye e instala el menú con los recientes de ahora. Devuelve true si se ha reconstruido (los recientes cambiaron
  // o es la primera vez); si no, no toca nada (config.json cambia también por el tema o los ajustes). Si instalarlo falla,
  // se anota y se vuelve a intentar al siguiente cambio (no se da por puesto).
  menu.reconstruir = () => {
    const leidos = config.leer().recientes, recientes = Array.isArray(leidos) ? leidos : [];
    const rutas = rutasDe(recientes);
    if (rutas === actuales) return false;
    const primera = actuales === null;
    menu.plantilla = plantillaMenu({ plataforma, recientes, version, acciones });
    try { Menu.setApplicationMenu(Menu.buildFromTemplate(menu.plantilla)); } catch (e) { anotar(`no se ha podido instalar el menú: ${e.message}`); return false; }
    actuales = rutas;
    if (!primera) anotar(`menú reconstruido: ${recientes.length} reciente${recientes.length === 1 ? '' : 's'}`);
    return true;
  };
  menu.reconstruir();
  return menu;
}

module.exports = { plantillaMenu, instalarMenu, textoDiagnostico, submenuRecientes, elemento, ATAJOS, NAVEGACION, RESERVADOS, CANAL, REPO, URL_COMO_SE_USA, URL_ATAJOS, URL_PLAN_VIVO, NOMBRE };
