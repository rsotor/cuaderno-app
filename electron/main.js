'use strict';
// Punto de entrada de la app de escritorio (`npm run app`, campo `main` de package.json): inyecta lo real en
// electron/app.js, que es lo que se prueba con un Electron falso.
require('./app').arrancar({ electron: require('electron'), config: require('../config'), env: process.env });
