'use strict';
// El registro de la app de escritorio: sin terminal, lo que hoy va a console.error desaparecería. Cada línea se
// escribe con su hora en <carpeta de configuración>/registro.log (la misma carpeta que config.json y token), rotado
// a 1 MB (el anterior queda en registro.log.1), y además por consola, que es lo que se ve en desarrollo (`npm run
// app`). `leer()` devuelve lo que hay (lo rotado y lo actual) para Ayuda → Mostrar registro (T5). Lo escriben el
// proceso principal y el hijo, cada uno con su etiqueta en la línea (plan §2, fila Registro).
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

const TOPE = 1024 * 1024;   // bytes: al pasar de aquí, el fichero actual pasa a .1 y se empieza otro

// carpeta: ruta o función que la devuelve (por defecto la de config.js, leída al escribir: CUADERNO_CONFIG_DIR manda).
function crearRegistro({ carpeta = config.carpeta, tope = TOPE, consola = l => console.error(l), ahora = () => new Date() } = {}) {
  const dir = () => (typeof carpeta === 'function' ? carpeta() : carpeta);
  const ruta = () => path.join(dir(), 'registro.log');
  const escribir = linea => {
    const texto = `${ahora().toISOString()} ${String(linea).replace(/\s+$/, '')}\n`;
    if (consola) consola(texto.slice(0, -1));
    try {
      const f = ruta();
      fs.mkdirSync(path.dirname(f), { recursive: true });
      let tamano = 0;
      try { tamano = fs.statSync(f).size; } catch { /* aún no hay */ }
      if (tamano && tamano + Buffer.byteLength(texto) > tope) fs.renameSync(f, `${f}.1`);
      fs.appendFileSync(f, texto);
    } catch { /* sin dónde escribir (disco lleno, carpeta sin permiso): la consola ya lo tiene */ }
  };
  const leer = () => {
    const f = ruta();
    let texto = '';
    for (const nombre of [`${f}.1`, f]) { try { texto += fs.readFileSync(nombre, 'utf8'); } catch { /* no hay */ } }
    return texto;
  };
  return { escribir, leer, ruta };
}

// El registro de la app: el que usan main.js, app.js y el hijo.
const registro = crearRegistro();

module.exports = { crearRegistro, escribir: registro.escribir, leer: registro.leer, ruta: registro.ruta, TOPE };
