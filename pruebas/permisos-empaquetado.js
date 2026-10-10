'use strict';
// Hook `afterPack` de electron-builder (electron-builder.js): corre con la app ya montada y ANTES de firmarla. Vive en
// pruebas/ y no en la raíz porque ni el hook ni este fichero van en la app (`!pruebas/**` en `files`).
//
// Da permiso de ejecución (0o755) a todo `spawn-helper` de node-pty que haya dentro de la app empaquetada (prueba local
// en Mac, 2026-10-10). El ayudante se copia con el permiso que tenga en node_modules, y npm 11 instala node-pty sin
// ejecutar sus scripts: llega sin permiso de ejecución. En runtime sistema.js (repararAyudantePty) intenta ponérselo,
// pero una app en cuarentena abierta sin moverla a Aplicaciones corre «traslocada» (App Translocation) en un volumen de
// solo lectura y el chmod falla: terminal rota. Por eso el permiso tiene que ir ya en el .app. Cambiar el permiso de un
// fichero no rompe `codesign --verify --deep --strict` del .app firmado ad hoc (comprobado), y aquí además es antes de firmar.
// Si hay un ayudante y no se puede dar el permiso, lanza: el empaquetado falla (mejor eso que un .dmg con la terminal rota).
// En Windows y Linux no hay `spawn-helper` en el paquete (Windows usa ConPTY; en Linux node-pty se compila): no encuentra nada.
const fs = require('node:fs');
const path = require('node:path');

const AYUDANTE = /[\\/]node-pty[\\/]prebuilds[\\/][^\\/]+[\\/]spawn-helper$/;

// Rutas de todos los `node-pty/prebuilds/<sistema>/spawn-helper` bajo `carpeta`. Recorre sin depender del nombre del
// producto (<producto>.app/Contents/Resources/app/node_modules/...) y sin seguir enlaces simbólicos.
function buscarAyudantes(carpeta) {
  const encontrados = [];
  const pendientes = [carpeta];
  while (pendientes.length) {
    const actual = pendientes.pop();
    let entradas;
    try { entradas = fs.readdirSync(actual, { withFileTypes: true }); } catch { continue; }
    for (const e of entradas) {
      const ruta = path.join(actual, e.name);
      if (e.isDirectory()) pendientes.push(ruta);
      else if (e.isFile() && AYUDANTE.test(ruta)) encontrados.push(ruta);
    }
  }
  return encontrados.sort();
}

// Devuelve las rutas a las que ha dado permiso. Lanza si alguna no lo admite.
function darPermisoAyudantes(carpeta) {
  const ayudantes = buscarAyudantes(carpeta);
  for (const a of ayudantes) {
    try { fs.chmodSync(a, 0o755); } catch (e) { throw new Error(`no he podido dar permiso de ejecución a ${a}: ${e.message}`); }
  }
  return ayudantes;
}

// El hook que electron-builder llama con el contexto del empaquetado (`appOutDir` es la carpeta de salida de esa arquitectura).
async function afterPack(contexto) {
  darPermisoAyudantes(contexto.appOutDir);
}

module.exports = { afterPack, darPermisoAyudantes, buscarAyudantes };
