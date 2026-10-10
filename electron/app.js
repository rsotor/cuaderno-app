'use strict';
// El proceso principal de la app de escritorio, con Electron inyectado para probarlo en Node con uno falso
// (tests/electron-app.test.js). La secuencia (plan §3): userData → instancia única → la ventana ANTES que nada, con
// «Arrancando…» y el fondo del tema (la shell puede tardar hasta 10 s) → el entorno de la shell de login → el servidor
// en un utilityProcess con ese entorno, CUADERNO_NODE (el Node del kit) y el cuaderno que toca → esperar
// { puerto, token } compitiendo con exit/error y un tope de 15 s → la ventana entra por la URL de entrada (la cookie
// se fija igual que en la web). Si el hijo muere después, se relanza una vez y se recarga; si vuelve a morir en menos
// de un minuto, diálogo y salir. Cerrar la ventana mata al hijo (que cierra vigilante y pty) y sale; `before-quit`
// marca `cerrando` para que esa salida del hijo no cuente como caída (lo vio el spike).
const fs = require('node:fs');
const path = require('node:path');
const { entornoDeLaShell } = require('./entorno');
const registroPorDefecto = require('./registro');

const FONDO = { claro: '#ffffff', oscuro: '#1e1e1e', auto: '#ffffff' };   // el fondo hasta que carga la pantalla; T2 lo afina con nativeTheme
const TOPE_PUERTO = 15_000;   // ms que se espera el puerto del hijo
const TREGUA = 60_000;        // ms: dos muertes del hijo en menos de esto y la app se rinde
const PANTALLA = { width: 1280, height: 800, title: 'Cuaderno', webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, partition: 'cuaderno' } };   // sin preload hasta T4

// Devuelve el estado (ventana, hijo, puerto, entorno, muertes, cerrando) y `listo`, la promesa del arranque (true si
// la ventana cargó la app). Variables de prueba: CUADERNO_USERDATA (dónde va el lock de instancia única) y
// CUADERNO_SIN_DIALOGO (el diálogo de error se anota y se da por cerrado).
function arrancar({ electron, config, env = process.env, entorno = entornoDeLaShell, registro = registroPorDefecto, topePuerto = TOPE_PUERTO, tregua = TREGUA, ahora = Date.now, execPath = process.execPath, existe = r => fs.statSync(r).isDirectory() }) {
  const { app, BrowserWindow, utilityProcess, dialog } = electron;
  const anotar = linea => registro.escribir(`[app] ${linea}`);
  const estado = { ventana: null, hijo: null, puerto: null, token: null, entorno: null, muertes: [], cerrando: false, listo: null };

  // userData solo para lo de Electron (el lock de instancia única va ahí); tiene que fijarse antes de `ready`.
  if (env.CUADERNO_USERDATA) app.setPath('userData', env.CUADERNO_USERDATA);
  if (!app.requestSingleInstanceLock()) { anotar('ya hay otra instancia abierta: esta sale y aquella pasa al frente'); app.quit(); estado.listo = Promise.resolve(false); return estado; }
  app.on('second-instance', () => { const v = estado.ventana; if (!v) return; if (v.isMinimized()) v.restore(); v.focus(); });

  const urlEntrada = () => `http://localhost:${estado.puerto}/?t=${estado.token}`;
  const matarHijo = () => { if (estado.hijo) { try { estado.hijo.kill(); } catch { /* ya muerto */ } } };
  const avisar = (mensaje, detalle) => {
    if (env.CUADERNO_SIN_DIALOGO) return anotar(`diálogo saltado (CUADERNO_SIN_DIALOGO): ${mensaje}`);
    try { dialog.showMessageBoxSync({ type: 'error', title: 'Cuaderno', message: mensaje, detail: detalle }); } catch (e) { anotar(`no se ha podido enseñar el diálogo: ${e.message}`); }
  };
  // Sin servidor no hay app: se anota, se avisa y se sale con 1.
  const fallo = motivo => {
    anotar(`FALLO: ${motivo}`);
    estado.cerrando = true;
    matarHijo();
    avisar('El servidor del cuaderno ha fallado', `${motivo}\n\nEl registro está en ${registro.ruta()}.`);
    app.exit(1);
  };

  // Lanza servidor-hijo.js y resuelve con { puerto, token } cuando el hijo ya escucha; rechaza si antes sale, da
  // error o pasa el tope. Una salida posterior es una caída (salvo que se esté cerrando).
  const lanzarHijo = entornoHijo => new Promise((resolver, rechazar) => {
    const hijo = utilityProcess.fork(path.join(__dirname, 'servidor-hijo.js'), [], { env: entornoHijo, stdio: 'inherit', serviceName: 'servidor del cuaderno' });
    estado.hijo = hijo;
    let listo = false;
    const acabar = (fn, valor) => { if (listo) return; listo = true; clearTimeout(temporizador); fn(valor); };
    const temporizador = setTimeout(() => acabar(rechazar, new Error(`el servidor no ha dicho su puerto en ${topePuerto / 1000} s`)), topePuerto);
    hijo.once('spawn', () => anotar(`servidor lanzado (pid ${hijo.pid})`));
    hijo.on('message', m => { if (m && m.puerto) acabar(resolver, { puerto: m.puerto, token: m.token }); });
    hijo.on('error', e => { anotar(`error del servidor: ${e.message}`); acabar(rechazar, e); });
    hijo.on('exit', codigo => {
      anotar(`el servidor ha salido con código ${codigo}`);
      if (!listo) return acabar(rechazar, new Error(`el servidor ha salido con código ${codigo} antes de escuchar`));
      if (estado.cerrando || hijo !== estado.hijo) return;
      caida(codigo, entornoHijo);
    });
  });
  const caida = (codigo, entornoHijo) => {
    const t = ahora();
    const reciente = estado.muertes.some(m => t - m < tregua);
    estado.muertes.push(t);
    if (reciente) return fallo(`El servidor se ha caído dos veces en menos de un minuto (código ${codigo}).`);
    anotar('se relanza el servidor con el mismo entorno');
    lanzarHijo(entornoHijo)
      .then(({ puerto, token }) => { estado.puerto = puerto; estado.token = token; anotar(`servidor relanzado en el puerto ${puerto}: se recarga la ventana`); return estado.ventana && estado.ventana.loadURL(urlEntrada()); })
      .catch(e => fallo(`El servidor no ha vuelto a arrancar: ${e.message}`));
  };

  estado.listo = app.whenReady().then(async () => {
    const tema = config.leer().tema;
    const ventana = new BrowserWindow({ ...PANTALLA, backgroundColor: FONDO[tema] || FONDO.auto });
    estado.ventana = ventana;
    await ventana.loadFile(path.join(__dirname, 'arrancando.html'));
    const r = entorno({ env });
    estado.entorno = { origen: r.origen, ms: r.ms, shell: r.shell, error: r.error, PATH: r.env.PATH };
    anotar(`entorno de la shell: ${r.origen}, ${r.ms} ms${r.error ? ` (${r.error})` : ''}`);
    // El cuaderno lo decide el padre como server.js (sin argumentos: el último); el hijo lo abre antes de escuchar.
    const { carpeta, origen } = config.cuadernoAlArrancar(null, config.leer().recientes, existe);
    const entornoHijo = { ...r.env, CUADERNO_NODE: execPath, ...(carpeta ? { CUADERNO_CARPETA: carpeta } : {}) };
    try {
      const { puerto, token } = await lanzarHijo(entornoHijo);
      estado.puerto = puerto; estado.token = token;
      anotar(`servidor en el puerto ${puerto}; ${carpeta ? `${origen === 'reciente' ? 'el último cuaderno' : 'la carpeta'}: ${carpeta}` : 'sin cuaderno: pantalla de cuadernos'}`);
      await ventana.loadURL(urlEntrada());
      return true;
    } catch (e) { fallo(e.message); return false; }
  });

  // Salir (Cuaderno → Salir, app.quit() desde Playwright) o cerrar la ventana: el hijo se mata y su salida no es caída.
  app.on('before-quit', () => { estado.cerrando = true; matarHijo(); });
  app.on('window-all-closed', () => { estado.cerrando = true; matarHijo(); app.quit(); });
  return estado;
}

module.exports = { arrancar, FONDO, TOPE_PUERTO, TREGUA };
