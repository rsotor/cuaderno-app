'use strict';
// El punto de entrada del utilityProcess que lanza electron/app.js: carga node-pty (y repara su ayudante), y arranca
// el servidor con lo real (electron/hijo.js tiene la lógica, probada en Node). Lo que falla queda en el registro.
const registro = require('./registro');
const sistema = require('../sistema');
const { crearServidor } = require('../servidor');
const config = require('../config');
const { arrancarHijo } = require('./hijo');

let pty = null;
try {
  pty = require('node-pty');
  const estado = sistema.repararAyudantePty();
  if (estado !== 'bien' && estado !== 'no-hay') registro.escribir(`[hijo] ayudante de node-pty: ${estado}`);
} catch (e) { registro.escribir(`[hijo] node-pty no está disponible: la app arranca sin terminal (${e.message})`); }

arrancarHijo({ crearServidor, config, parentPort: process.parentPort, registro, pty });
