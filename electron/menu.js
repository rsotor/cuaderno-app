'use strict';
// El menú de la app de escritorio, en castellano (plan §2, fila «Menú y atajos»; T5). `plantillaMenu` es pura: una tabla
// → la plantilla de Menu.buildFromTemplate, con etiquetas, aceleradores y acciones por plataforma; `instalarMenu` la
// engancha a Electron y la reconstruye cuando cambian los recientes. Los elementos propios no hacen nada por su cuenta:
// mandan un nombre a la pantalla (`webContents.send('accion', nombre)`), que lo atiende con cuadernoApp.alAccion(cb) y
// hace lo que ya sabe hacer (Guardar es el botón Guardar; Ajustes, el botón de Ajustes; Abrir carpeta…, el diálogo del
// sistema de T4). Los roles estándar son de Electron (sin los de Edición, en Mac no hay copiar y pegar). Lo de Ayuda es
// del proceso principal: el plan vivo en GitHub (shell.openExternal, el repo público), el registro (shell.openPath), el
// Diagnóstico (versiones, puerto, PATH resuelto y su origen, si node-pty cargó, carpeta de configuración; nunca el token)
// y Acerca de. Los atajos que decida Roberto (plan §8.1) se añaden a ATAJOS.
const path = require('node:path');

const REPO = 'https://github.com/rsotor/cuaderno-app';   // el repo público, sin token ni nada
const URL_PLAN_VIVO = `${REPO}/blob/main/docs/planes/plan-vivo.md`;
const CANAL = 'accion';   // el canal que escucha el preload (cuadernoApp.alAccion)
const NOMBRE = 'Cuaderno';

// Los atajos propios: etiqueta, acelerador (CmdOrCtrl: ⌘ en Mac, Ctrl en Windows y Linux) y el nombre que recibe la
// pantalla. Para añadir uno (§8.1): una fila aquí y su caso en el oyente de public/app.js.
const ATAJOS = [
  { id: 'abrir-carpeta', label: 'Abrir carpeta…', accelerator: 'CmdOrCtrl+O', accion: 'abrir-carpeta' },
  { id: 'guardar', label: 'Guardar', accelerator: 'CmdOrCtrl+S', accion: 'guardar' },
  { id: 'ajustes', label: 'Ajustes…', accelerator: 'CmdOrCtrl+,', accion: 'ajustes' },
];
const atajo = id => ATAJOS.find(a => a.id === id);
const sep = { type: 'separator' };

// El submenú de Cuadernos recientes: uno por reciente (el más nuevo primero, como los guarda config.js), con su ruta
// de pista; sin ninguno, «Sin recientes» deshabilitado.
function submenuRecientes(recientes, abrirCarpeta) {
  const lista = (Array.isArray(recientes) ? recientes : []).filter(r => r && typeof r.ruta === 'string' && r.ruta);
  if (!lista.length) return [{ id: 'sin-recientes', label: 'Sin recientes', enabled: false }];
  return lista.map(r => ({ id: `reciente:${r.ruta}`, label: r.nombre || path.basename(r.ruta), toolTip: r.ruta, click: () => abrirCarpeta(r.ruta) }));
}

// La plantilla entera. `acciones`: { accion(nombre), abrirCarpeta(ruta), planVivo(), mostrarRegistro(), diagnostico(),
// acercaDe() }; las que falten no hacen nada (vale para pintar el menú sin app detrás).
function plantillaMenu({ plataforma = process.platform, recientes = [], version = '', acciones = {} } = {}) {
  const nada = () => {};
  const a = { accion: nada, abrirCarpeta: nada, planVivo: nada, mostrarRegistro: nada, diagnostico: nada, acercaDe: nada, ...acciones };
  const mac = plataforma === 'darwin';
  const propio = id => { const t = atajo(id); return { id: t.id, label: t.label, accelerator: t.accelerator, click: () => a.accion(t.accion) }; };
  const acercaDe = { id: 'acerca-de', label: `Acerca de ${NOMBRE}`, click: () => a.acercaDe() };
  const salir = { id: 'salir', role: 'quit', label: mac ? `Salir de ${NOMBRE}` : 'Salir' };

  const cuaderno = {
    id: 'cuaderno', label: NOMBRE,
    submenu: [
      propio('abrir-carpeta'),
      { id: 'recientes', label: 'Cuadernos recientes', submenu: submenuRecientes(recientes, a.abrirCarpeta) },
      sep,
      propio('guardar'),
      // En Mac, Ajustes y Salir van en el menú de la app, como manda la plataforma; en los demás, aquí.
      ...(mac ? [] : [sep, propio('ajustes'), sep, salir]),
    ],
  };
  const edicion = { id: 'edicion', label: 'Edición', submenu: [
    { role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' }, sep,
    { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' },
  ] };
  const ver = { id: 'ver', label: 'Ver', submenu: [
    { role: 'reload', label: 'Recargar' }, sep,
    { role: 'zoomIn', label: 'Acercar' }, { role: 'zoomOut', label: 'Alejar' }, { role: 'resetZoom', label: 'Tamaño real' }, sep,
    { role: 'togglefullscreen', label: 'Pantalla completa' },
  ] };
  const ventana = { id: 'ventana', label: 'Ventana', role: 'windowMenu' };
  const ayuda = { id: 'ayuda', label: 'Ayuda', role: 'help', submenu: [
    { id: 'plan-vivo', label: 'Plan vivo (en GitHub)', click: () => a.planVivo() }, sep,
    { id: 'mostrar-registro', label: 'Mostrar registro', click: () => a.mostrarRegistro() },
    { id: 'diagnostico', label: 'Diagnóstico', click: () => a.diagnostico() },
    ...(mac ? [] : [sep, acercaDe]),
  ] };
  // El menú de la app en Mac: Acerca de, Ajustes, los roles de ocultar y Salir (lo que Electron pone con appMenu, en castellano).
  const app = { id: 'app', label: NOMBRE, submenu: [
    acercaDe, sep, propio('ajustes'), sep,
    { role: 'services', label: 'Servicios' }, sep,
    { role: 'hide', label: `Ocultar ${NOMBRE}` }, { role: 'hideOthers', label: 'Ocultar otros' }, { role: 'unhide', label: 'Mostrar todo' }, sep,
    salir,
  ] };
  return [...(mac ? [app] : []), cuaderno, edicion, ver, ventana, ayuda];
}

// Recorre la plantilla (y sus submenús) y devuelve el primer elemento con ese id; para los tests y para `click` en pruebas.
function elemento(plantilla, id) {
  for (const e of plantilla) {
    if (e.id === id) return e;
    if (Array.isArray(e.submenu)) { const h = elemento(e.submenu, id); if (h) return h; }
  }
  return null;
}

// El texto de Ayuda → Diagnóstico, con lo que hace falta para entender un «git: not found» o una terminal muda a distancia.
// Nunca lleva el token. `estado` es el de app.js (puerto, entorno, pty); `versiones`, process.versions.
function textoDiagnostico({ version = '', versiones = process.versions, estado = {}, carpetaConfig = '', rutaRegistro = '', plataforma = process.platform, arquitectura = process.arch, execPath = process.execPath } = {}) {
  const e = estado.entorno || {};
  const pty = estado.pty === true ? 'sí' : estado.pty === false ? 'no (la app arranca sin terminal)' : 'sin saber aún';
  return [
    `${NOMBRE} ${version || '(sin versión)'}`,
    `Electron ${versiones.electron || '(fuera de Electron)'} · Node ${versiones.node || '?'} · Chromium ${versiones.chrome || '?'}`,
    `Sistema: ${plataforma} ${arquitectura}`,
    `Ejecutable: ${execPath}`,
    `Puerto del servidor: ${estado.puerto || '(el servidor aún no escucha)'}`,
    `node-pty cargado: ${pty}`,
    `Entorno de la shell: ${e.origen || 'sin resolver'}${e.shell ? ` (${e.shell}` : ''}${e.ms !== undefined && e.shell ? `, ${e.ms} ms)` : e.shell ? ')' : ''}${e.error ? ` — ${e.error}` : ''}`,
    `PATH: ${e.PATH || '(sin resolver)'}`,
    `Carpeta de configuración: ${carpetaConfig}`,
    `Registro: ${rutaRegistro}`,
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
  const acciones = {
    accion: nombre => { anotar(`menú: ${nombre}`); mandar(nombre); },
    abrirCarpeta: ruta => { anotar(`menú: cuaderno reciente ${ruta}`); return abrirCarpeta(ruta); },
    planVivo: () => {
      if (sinNavegador) return anotar(`navegador no abierto (CUADERNO_SIN_NAVEGADOR): ${URL_PLAN_VIVO}`);
      return Promise.resolve(shell.openExternal(URL_PLAN_VIVO)).catch(e => anotar(`no se ha podido abrir el plan vivo: ${e.message}`));
    },
    mostrarRegistro: () => {
      const f = registro.ruta();
      if (sinNavegador) return anotar(`registro no abierto (CUADERNO_SIN_NAVEGADOR): ${f}`);
      return Promise.resolve(shell.openPath(f)).then(error => { if (error) anotar(`no se ha podido abrir el registro ${f}: ${error}`); }, e => anotar(`no se ha podido abrir el registro ${f}: ${e.message}`));
    },
    diagnostico: async () => {
      const texto = textoDiagnostico({ version, versiones, estado, carpetaConfig: config.carpeta(), rutaRegistro: registro.ruta(), plataforma, execPath });
      anotar(`diagnóstico:\n${texto}`);
      const r = await dialogo('Diagnóstico', `Diagnóstico de ${NOMBRE}`, texto, ['Copiar', 'Cerrar']);
      if (r && r.response === 0 && clipboard) { try { clipboard.writeText(texto); } catch (e) { anotar(`no se ha podido copiar el diagnóstico: ${e.message}`); } }
    },
    acercaDe: () => dialogo(`Acerca de ${NOMBRE}`, NOMBRE, `Versión ${version || '(sin versión)'}\nUn cuaderno de estudio: la ventana sobre tus notas Markdown.\n${REPO}`),
  };
  const rutasDe = recientes => JSON.stringify((Array.isArray(recientes) ? recientes : []).map(r => r && r.ruta));
  let actuales = null;
  const menu = { acciones, plantilla: null };
  // Construye e instala el menú con los recientes de ahora. Devuelve true si se ha reconstruido (los recientes cambiaron
  // o es la primera vez); si no, no toca nada (config.json cambia también por el tema o los ajustes).
  menu.reconstruir = () => {
    const recientes = config.leer().recientes;
    const rutas = rutasDe(recientes);
    if (rutas === actuales) return false;
    const primera = actuales === null;
    actuales = rutas;
    menu.plantilla = plantillaMenu({ plataforma, recientes, version, acciones });
    try { Menu.setApplicationMenu(Menu.buildFromTemplate(menu.plantilla)); } catch (e) { anotar(`no se ha podido instalar el menú: ${e.message}`); return false; }
    if (!primera) anotar(`menú reconstruido: ${recientes.length} reciente${recientes.length === 1 ? '' : 's'}`);
    return true;
  };
  menu.reconstruir();
  return menu;
}

module.exports = { plantillaMenu, instalarMenu, textoDiagnostico, submenuRecientes, elemento, ATAJOS, CANAL, REPO, URL_PLAN_VIVO, NOMBRE };
