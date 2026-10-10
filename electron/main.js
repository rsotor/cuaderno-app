// SPIKE 2026-10-10: se reescribe en la tarea T1 con sus tests (docs/planes/electron.md §6)
'use strict';
// Punto de entrada de la app de escritorio: diez líneas que inyectan lo real en electron/app.js.
require('./app').arrancar({ electron: require('electron'), config: require('../config'), env: process.env });
