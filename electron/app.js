// SPIKE 2026-10-10: se reescribe en la tarea T1 con sus tests (docs/planes/electron.md §6)
'use strict';
// El proceso principal de la app: ventana primero (fondo del tema, «Arrancando…»), después el entorno de la shell,
// después el servidor en un utilityProcess; cuando llega el puerto, la ventana entra por urlEntrada (la cookie se
// fija igual que en la web). Si el hijo muere, se relanza una vez; a la segunda, diálogo y salir (plan §2 y §3).
const path = require('node:path');
const { entornoDeLaShell } = require('./entorno');

const FONDO = { claro: '#ffffff', oscuro: '#1e1e1e', auto: '#ffffff' };
const TOPE_PUERTO = 15_000;
const log = (...a) => console.error(`[app ${(Date.now() % 100000)}]`, ...a);

function arrancar({ electron, config, env }) {
  const { app, BrowserWindow, utilityProcess, dialog } = electron;
  // userData solo para lo de Electron (el lock de instancia única: en Linux es un enlace SingletonLock dentro de
  // userData). Los tests le dan uno temporal para no chocar con la app abierta. Tiene que fijarse antes de ready.
  if (env.CUADERNO_USERDATA) app.setPath('userData', env.CUADERNO_USERDATA);
  if (!app.requestSingleInstanceLock()) { log('ya hay otra instancia: salgo'); app.quit(); return; }
  const t0 = Date.now();
  const estado = { hijo: null, relanzado: false, cerrando: false, puerto: null, entorno: null, muertes: [] };
  global.spikeEstado = estado;   // para que el script de medida pueda mirar y matar al hijo

  const token = config.token();
  const urlEntrada = () => `http://localhost:${estado.puerto}/?t=${token}`;

  // Lanza el servidor-hijo y devuelve una promesa con el puerto, compitiendo con exit/error y un tope de 15 s.
  const lanzarHijo = entorno => new Promise((ok, mal) => {
    const hijo = utilityProcess.fork(path.join(__dirname, 'servidor-hijo.js'), [], {
      env: { ...entorno, CUADERNO_NODE: process.execPath }, stdio: 'inherit', serviceName: 'servidor del cuaderno',
    });
    estado.hijo = hijo;
    let listo = false;
    const temporizador = setTimeout(() => { if (!listo) mal(new Error('el servidor no ha mandado el puerto en 15 s')); }, TOPE_PUERTO);
    hijo.on('message', m => { if (m && m.puerto && !listo) { listo = true; clearTimeout(temporizador); ok({ hijo, puerto: m.puerto }); } });
    hijo.once('spawn', () => log(`hijo lanzado pid=${hijo.pid}`));
    hijo.on('error', e => { log(`error del hijo: ${e && e.message}`); if (!listo) { clearTimeout(temporizador); mal(e); } });
    hijo.on('exit', codigo => {
      log(`el hijo ha salido con ${codigo}`);
      estado.muertes.push(Date.now());
      if (!listo) { clearTimeout(temporizador); return mal(new Error(`el servidor ha salido con ${codigo} antes de escuchar`)); }
      if (estado.cerrando) return;
      // Muere después de arrancar: una vez se relanza y se recarga; a la segunda, diálogo y salir.
      if (estado.relanzado) { fallo(`El servidor se ha caído dos veces (código ${codigo}).`); return; }
      estado.relanzado = true;
      log('relanzando el hijo…');
      lanzarHijo(entorno).then(({ puerto }) => { estado.puerto = puerto; log(`hijo relanzado; recargo la ventana en ${puerto}`); const w = BrowserWindow.getAllWindows()[0]; if (w) w.loadURL(urlEntrada()); })
        .catch(e => fallo(`El servidor no ha vuelto a arrancar: ${e.message}`));
    });
  });

  const fallo = motivo => {
    log(`FALLO: ${motivo}`);
    estado.cerrando = true;
    // En el script de medida no hay nadie que cierre el diálogo: CUADERNO_SPIKE_SIN_DIALOGO lo salta.
    if (!env.CUADERNO_SPIKE_SIN_DIALOGO) { try { dialog.showMessageBoxSync({ type: 'error', title: 'Cuaderno', message: 'El servidor no ha arrancado', detail: motivo }); } catch { /* sin pantalla */ } }
    app.exit(1);
  };

  app.whenReady().then(async () => {
    const tema = config.leer().tema;
    const win = new BrowserWindow({
      width: 1280, height: 800, backgroundColor: FONDO[tema] || FONDO.auto, title: 'Cuaderno',
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, partition: 'cuaderno' },   // sin preload por ahora (T4)
    });
    await win.loadFile(path.join(__dirname, 'arrancando.html'));
    log(`ventana con «Arrancando…» a los ${Date.now() - t0} ms`);
    // El entorno de la shell de login (Mac y Linux): hasta 10 s, por eso la ventana ya está.
    const r = entornoDeLaShell({ env });
    estado.entorno = { origen: r.origen, ms: r.ms, shell: r.shell, error: r.error, PATH: r.env.PATH };
    log(`entorno de la shell (${r.origen}, ${r.ms} ms${r.error ? `, ${r.error}` : ''}) a los ${Date.now() - t0} ms`);
    try {
      const { puerto } = await lanzarHijo(r.env);
      estado.puerto = puerto;
      log(`puerto ${puerto} recibido a los ${Date.now() - t0} ms`);
      await win.loadURL(urlEntrada());
      log(`ventana cargada a los ${Date.now() - t0} ms`);
    } catch (e) { fallo(e.message); }
  });

  // Al salir (Cuaderno → Salir, o app.quit() desde Playwright) Electron mata al hijo: no es una caída, no se relanza.
  app.on('before-quit', () => { estado.cerrando = true; });
  app.on('window-all-closed', () => {
    estado.cerrando = true;
    if (estado.hijo) { try { estado.hijo.kill(); } catch { /* ya muerto */ } }
    app.quit();
  });
}

module.exports = { arrancar };
