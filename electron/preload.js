'use strict';
// Lo único que la pantalla ve de Electron (plan §2, fila «Pantalla»): window.cuadernoApp, con elegirCarpeta() (el
// diálogo del sistema, por el canal IPC `elegir-carpeta` de electron/carpeta.js), alAccion(cb) (los mensajes `accion`
// que mandará el menú: T5) y version (la de la app, que app.js pasa en additionalArguments). Corre en el sandbox del
// renderer: aquí solo se puede hacer require('electron'), nada de fs ni path (tests/electron-carpeta.test.js lo vigila),
// y la pantalla no ve ipcRenderer, solo estas tres cosas. Sin este fichero (la web), window.cuadernoApp no existe y la
// pantalla es la de siempre.
const { contextBridge, ipcRenderer } = require('electron');

const PREFIJO = '--cuaderno-version=';
const version = (process.argv.find(a => a.startsWith(PREFIJO)) || PREFIJO).slice(PREFIJO.length) || null;

contextBridge.exposeInMainWorld('cuadernoApp', {
  elegirCarpeta: () => ipcRenderer.invoke('elegir-carpeta'),
  alAccion: cb => { ipcRenderer.on('accion', (_evento, nombre) => cb(nombre)); },
  version,
});
