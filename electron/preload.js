'use strict';
// Lo único que la pantalla ve de Electron (plan §2, fila «Pantalla»): window.cuadernoApp, con elegirCarpeta() (el
// diálogo del sistema, por el canal IPC `elegir-carpeta` de electron/carpeta.js), alAccion(cb) (los mensajes `accion`
// que manda el menú, electron/menu.js) y version (la de la app, que app.js pasa en additionalArguments). Corre en el sandbox del
// renderer: aquí solo se puede hacer require('electron'), nada de fs ni path (tests/electron-carpeta.test.js lo vigila),
// y la pantalla no ve ipcRenderer, solo estas tres cosas. Sin este fichero (la web), window.cuadernoApp no existe y la
// pantalla es la de siempre.
const { contextBridge, ipcRenderer } = require('electron');

const PREFIJO = '--cuaderno-version=';
const version = (process.argv.find(a => a.startsWith(PREFIJO)) || PREFIJO).slice(PREFIJO.length) || null;

// alAccion: un solo oyente de `accion` por ventana, puesto la primera vez; cada llamada sustituye el callback. La pantalla
// lo llama una vez (ACCIONES_APP, en public/app.js, despacha por nombre), pero así tampoco se acumulan oyentes si lo
// llamara más: la garantía está aquí, no en quien llama.
let alAccionCb = null;
contextBridge.exposeInMainWorld('cuadernoApp', {
  elegirCarpeta: () => ipcRenderer.invoke('elegir-carpeta'),
  alAccion: cb => { const primera = alAccionCb === null; alAccionCb = cb; if (primera) ipcRenderer.on('accion', (_evento, nombre) => { if (alAccionCb) alAccionCb(nombre); }); },
  version,
});
