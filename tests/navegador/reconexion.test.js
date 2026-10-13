'use strict';
// Recarga en vivo que sobrevive a un corte: si el socket de /cambios se cae (el Mac se duerme, el servidor de Electron
// se relanza), la pantalla lo reabre sola y, al volver, recoge lo que cambió en el disco mientras estaba caído.
// El corte se hace desde la página (cerrando el socket y haciendo fallar los intentos de reconexión a voluntad),
// que es determinista: no depende de tiempos del servidor ni de reiniciarlo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { arrancar, hasta, conTexto } = require('./ayuda');

let e;
test.before(async () => { e = await arrancar({ kit: false }); });
test.after(async () => { if (e) await e.cerrar(); });

test('reconexión: con el socket de cambios caído, un cambio en el disco aparece al reconectar', async () => {
  // Envuelve WebSocket para poder cortar /cambios y hacer que sus reconexiones fallen mientras `__cortado` sea true.
  await e.pagina.addInitScript(() => {
    const Original = window.WebSocket;
    window.__cortado = false; window.__intentosFallidos = 0; window.__sockets = [];
    window.WebSocket = class extends Original {
      constructor(url, ...resto) {
        const cambios = String(url).includes('/cambios');
        super(cambios && window.__cortado ? 'ws://127.0.0.1:1/' : url, ...resto);
        if (cambios) {
          window.__sockets.push(this);
          if (window.__cortado) this.addEventListener('close', () => { window.__intentosFallidos++; });
        }
      }
    };
  });
  const ruta = path.join(e.c.base, 'reconexion.md');
  fs.writeFileSync(ruta, '# Reconexión\n\nTexto de antes del corte.\n');
  await e.ir('#/n/reconexion.md');
  await conTexto(e.pagina.locator('#nota'), /antes del corte/, 'reconexión', 'la nota abierta');
  await hasta(async () => e.pagina.evaluate(() => window.__sockets.some(s => s.readyState === 1)), 'reconexión', 'el socket de cambios abierto');

  // Corte: se cierra el socket y los intentos siguientes fallan. El fichero cambia mientras está caído.
  await e.pagina.evaluate(() => { window.__cortado = true; window.__sockets.forEach(s => s.close()); });
  fs.writeFileSync(ruta, '# Reconexión\n\nTexto de después del corte.\n');
  await hasta(async () => (await e.pagina.evaluate(() => window.__intentosFallidos)) >= 1, 'reconexión', 'al menos un intento de reconexión fallido');
  assert.match(await e.pagina.locator('#nota').innerText(), /antes del corte/, 'reconexión: la nota cambió sin socket');

  // Vuelve la conexión: el siguiente intento abre y resincroniza sin que llegue ningún mensaje.
  await e.pagina.evaluate(() => { window.__cortado = false; });
  await conTexto(e.pagina.locator('#nota'), /después del corte/, 'reconexión', 'la nota con el texto nuevo tras reconectar');

  // Y sin acumular sockets: uno abierto, los demás cerrados.
  const abiertos = await e.pagina.evaluate(() => window.__sockets.filter(s => s.readyState <= 1).length);
  assert.equal(abiertos, 1, 'reconexión: queda más de un socket de cambios vivo');
});
