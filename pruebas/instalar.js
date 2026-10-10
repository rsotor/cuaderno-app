'use strict';
// `npm run instalar`: deja instalada en ESTA máquina la última versión de `main` de la app de escritorio, en Mac y en
// Windows. No hay actualización automática (Squirrel.Mac exige firma Developer ID y el repo es privado; Roberto,
// 2026-10-10): este comando la sustituye. Lo lanza Claude al cerrar una sesión que ha mergeado algo que cambia la app.
//   npm run instalar                       → trae main, construye, cierra la app, la sustituye y la abre
//   npm run instalar -- --simular          → enseña los pasos que daría, sin ejecutar ninguno
//   npm run instalar -- --rama <nombre>    → lo mismo desde otra rama, a sabiendas (para probar)
// Vive en pruebas/ y no en la raíz porque ni el script ni este fichero van en la app (`!pruebas/**` en `files`).
//
// Reglas que no se saltan:
//  - Solo arranca con el árbol de trabajo limpio y en la rama pedida (main por defecto); trae con `pull --ff-only`.
//  - Cierra la app instalada con buenas maneras (AppleScript `quit` en Mac, `taskkill` sin /F en Windows) y espera un
//    tope. Si sigue abierta (p. ej. el diálogo «¿Descartar lo escrito?»), PARA sin instalar: nunca se pierde lo escrito.
//  - En Mac la app vieja va a la Papelera con un nombre único; nunca se borra.
//
// Diseño testeable: `planificar(estado)` es una función pura (plataforma, arquitectura y estado → lista de pasos) y
// `ejecutar`/`fs`/`dormir`/`log` se inyectan en `instalar()`. Los pasos son datos: `orden` (programa y argumentos) o
// `accion` (algo que hace este script con el sistema de ficheros). tests/instalar.test.js los prueba sin tocar nada.
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const RAIZ = path.join(__dirname, '..');
const PRODUCTO = 'Cuaderno';                 // electron-builder.js: productName (nombre del .app y del .exe)
const RAMA_POR_DEFECTO = 'main';
const ARQUITECTURAS = ['arm64', 'x64'];
const TOPE_CIERRE_MS = 20000;                // lo que se espera a que la app salga tras pedirle que se cierre
const INTERVALO_CIERRE_MS = 500;
const MARCA_LOCK = path.join('node_modules', '.cuaderno-lock');   // hash del package-lock.json con el que se hizo `npm ci`

// ── Argumentos ─────────────────────────────────────────────────────────────────────────────────────────────────────

// → { simular, rama } o { error }.
function leerArgumentos(argv) {
  const r = { simular: false, rama: RAMA_POR_DEFECTO };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--simular') r.simular = true;
    else if (a === '--rama') {
      const valor = argv[++i];
      if (!valor || valor.startsWith('--')) return { error: '--rama necesita el nombre de la rama (--rama <nombre>)' };
      r.rama = valor;
    } else return { error: `argumento desconocido: ${a} (valen --simular y --rama <nombre>)` };
  }
  return r;
}

// ── El plan (puro) ─────────────────────────────────────────────────────────────────────────────────────────────────

// Rutas del sistema en el que se instala, aunque el test corra en otro (path.win32 / path.posix).
function rutasDe(estado) {
  const p = estado.plataforma === 'win32' ? path.win32 : path.posix;
  const salida = p.join(estado.raiz, 'dist-app');
  const ruta = { p, salida, electronBuilder: p.join(estado.raiz, 'node_modules', 'electron-builder', 'cli.js'),
    instaladorElectron: p.join(estado.raiz, 'node_modules', 'electron', 'install.js') };
  if (estado.plataforma === 'darwin') {
    ruta.construida = p.join(salida, estado.arch === 'arm64' ? 'mac-arm64' : 'mac', `${PRODUCTO}.app`);   // electron-builder --dir
    ruta.instalada = p.join('/Applications', `${PRODUCTO}.app`);
    ruta.papelera = p.join(estado.home || '', '.Trash');
  } else if (estado.plataforma === 'win32') {
    ruta.instalada = p.join(estado.localAppData || '', 'Programs', PRODUCTO, `${PRODUCTO}.exe`);   // NSIS por usuario, sin asistente
  }
  return ruta;
}

// estado: { plataforma, arch, raiz, home, localAppData, node, rama, ramaPedida, limpio, lockCambiado, hayDist }.
// → { pasos } o { error }. `lockCambiado` es «el package-lock.json no es el de la última `npm ci`» (o no hay node_modules).
// El primer paso es siempre el pull: tras él, instalar() vuelve a leer el estado (el pull puede traer otro lock) y replanifica.
function planificar(estado) {
  if (estado.plataforma !== 'darwin' && estado.plataforma !== 'win32') {
    return { error: `no soportado en ${estado.plataforma}: solo Mac y Windows` };
  }
  if (!ARQUITECTURAS.includes(estado.arch)) return { error: `arquitectura no soportada: ${estado.arch}` };
  if (estado.rama !== estado.ramaPedida) {
    return { error: `estás en la rama «${estado.rama}» y se instala desde «${estado.ramaPedida}»: cambia de rama o usa --rama ${estado.rama} a sabiendas` };
  }
  if (!estado.limpio) return { error: 'hay cambios sin guardar en el árbol de trabajo (git status): confírmalos o descártalos antes de instalar' };

  const r = rutasDe(estado);
  const node = estado.node || 'node';
  const mac = estado.plataforma === 'darwin';
  const pasos = [];
  pasos.push({ id: 'pull', texto: 'Traer los cambios (solo avance rápido)', orden: ['git', 'pull', '--ff-only'] });

  const dependencias = estado.lockCambiado;
  if (dependencias) pasos.push({ id: 'npm-ci', texto: 'Instalar las dependencias (el package-lock.json no es el de la última vez, o falta node_modules)', orden: ['npm', 'ci'] });
  if (dependencias || !estado.hayDist) {   // `npm ci` borra node_modules, binario de Electron incluido
    pasos.push({ id: 'electron', texto: 'Bajar el binario de Electron (npm ci lo borra, o falta node_modules/electron/dist)', orden: [node, r.instaladorElectron] });
  }
  if (dependencias) pasos.push({ id: 'marcar-lock', texto: 'Anotar con qué package-lock.json quedan las dependencias', accion: 'marcar-lock' });

  if (mac) {
    pasos.push({ id: 'construir', texto: `Construir la app para esta máquina (mac ${estado.arch}, sin .dmg)`,
      orden: [node, r.electronBuilder, '--dir', '--mac', `--${estado.arch}`] });
    pasos.push({ id: 'cerrar', texto: `Pedir a ${PRODUCTO} que se cierre, si está abierta (sin forzar)`,
      orden: ['osascript', '-e', `quit app "${PRODUCTO}"`] });
  } else {
    pasos.push({ id: 'construir', texto: `Construir el instalador para esta máquina (win ${estado.arch}, NSIS)`,
      orden: [node, r.electronBuilder, '--win', 'nsis', `--${estado.arch}`] });
    pasos.push({ id: 'cerrar', texto: `Pedir a ${PRODUCTO} que se cierre, si está abierta (sin forzar)`,
      orden: ['taskkill', '/IM', `${PRODUCTO}.exe`] });
  }
  pasos.push({ id: 'esperar-cierre', texto: `Esperar hasta ${TOPE_CIERRE_MS / 1000} s a que salga; si sigue abierta, parar sin instalar`, accion: 'esperar-cierre' });

  if (mac) {
    pasos.push({ id: 'papelera', texto: `Mover ${r.instalada} a la Papelera (nombre único, nunca se borra), si existe`,
      accion: 'papelera', origen: r.instalada, carpeta: r.papelera });
    pasos.push({ id: 'copiar', texto: `Copiar la app nueva a ${r.instalada} (ditto: conserva permisos y firma)`,
      orden: ['ditto', r.construida, r.instalada] });
    pasos.push({ id: 'verificar', texto: 'Comprobar la firma ad hoc de la copia', orden: ['codesign', '--verify', '--deep', '--strict', r.instalada] });
    pasos.push({ id: 'abrir', texto: `Abrir ${PRODUCTO}`, orden: ['open', '-a', r.instalada] });
  } else {
    pasos.push({ id: 'instalar', texto: `Ejecutar el instalador de ${r.salida} con /S (por usuario, sin administrador)`, accion: 'instalador', carpeta: r.salida });
    pasos.push({ id: 'abrir', texto: `Abrir ${PRODUCTO} (${r.instalada})`, accion: 'abrir', ruta: r.instalada });
  }
  return { pasos, rutas: r };
}

// Un argumento tal como se escribiría en una terminal (solo para enseñarlo): con comillas simples si lleva dobles.
function entrecomillar(a) {
  if (!/[\s"]/.test(a)) return a;
  return a.includes('"') ? `'${a}'` : `"${a}"`;
}

// El texto de un paso para `--simular`.
function describirPaso(paso, n) {
  const detalle = paso.orden ? `\n     $ ${paso.orden.map(entrecomillar).join(' ')}` : '';
  return `  ${n}. ${paso.texto}${detalle}`;
}

// ── El sistema (inyectable) ────────────────────────────────────────────────────────────────────────────────────────

// Ejecuta una orden y devuelve { status, stdout }. `captura`: no pintar su salida, devolverla. `tope`: milisegundos.
// En Windows `npm` es un .cmd y necesita shell; el resto (rutas con espacios incluidas) va sin ella.
function ejecutarReal(orden, opciones = {}) {
  const [programa, ...argumentos] = orden;
  const r = spawnSync(programa, argumentos, {
    cwd: opciones.cwd, encoding: 'utf8', timeout: opciones.tope,
    stdio: opciones.captura ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: process.platform === 'win32' && programa === 'npm',
  });
  return { status: r.status === null ? (r.error ? 1 : 0) : r.status, stdout: r.stdout || '', error: r.error };
}

function dormirReal(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

// Abre un programa de Windows sin esperar a que termine ni atarlo a esta terminal.
function abrirSeparado(ruta) { spawn(ruta, [], { detached: true, stdio: 'ignore' }).unref(); }

function dependenciasReales() {
  return { plataforma: process.platform, arch: process.arch, raiz: RAIZ, home: os.homedir(), localAppData: process.env.LOCALAPPDATA || '',
    node: process.execPath, ejecutar: ejecutarReal, fs, dormir: dormirReal, abrirSeparado, ahora: () => new Date(), log: console.log };
}

function hashDe(contenido) { return crypto.createHash('sha256').update(contenido).digest('hex'); }

// ¿Está abierta la app instalada? Mac: un proceso con el ejecutable del .app; Windows: tasklist con el nombre de imagen.
function estaAbierta(d, rutas) {
  if (d.plataforma === 'darwin') {
    return d.ejecutar(['pgrep', '-f', path.posix.join(rutas.instalada, 'Contents', 'MacOS', PRODUCTO)], { captura: true, cwd: d.raiz }).status === 0;
  }
  const r = d.ejecutar(['tasklist', '/FI', `IMAGENAME eq ${PRODUCTO}.exe`, '/NH', '/FO', 'CSV'], { captura: true, cwd: d.raiz });
  return r.status === 0 && r.stdout.includes(`${PRODUCTO}.exe`);
}

// Lee lo que el plan necesita saber de esta máquina (solo lee: no cambia nada, vale también para --simular).
function leerEstado(d, ramaPedida) {
  const capturar = orden => d.ejecutar(orden, { captura: true, cwd: d.raiz });
  const rama = capturar(['git', 'rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  const limpio = capturar(['git', 'status', '--porcelain']).stdout.trim() === '';
  let lockCambiado = true;
  try {
    const hash = hashDe(d.fs.readFileSync(path.join(d.raiz, 'package-lock.json')));
    const anotado = d.fs.existsSync(path.join(d.raiz, MARCA_LOCK)) ? String(d.fs.readFileSync(path.join(d.raiz, MARCA_LOCK), 'utf8')).trim() : '';
    lockCambiado = !d.fs.existsSync(path.join(d.raiz, 'node_modules')) || anotado !== hash;
  } catch { /* sin lock legible: se reinstala */ }
  const hayDist = d.fs.existsSync(path.join(d.raiz, 'node_modules', 'electron', 'dist'));
  return { plataforma: d.plataforma, arch: d.arch, raiz: d.raiz, home: d.home, localAppData: d.localAppData, node: d.node,
    rama, ramaPedida, limpio, lockCambiado, hayDist };
}

function versionDe(d) { return JSON.parse(d.fs.readFileSync(path.join(d.raiz, 'package.json'), 'utf8')).version; }

// Nombre libre en la Papelera: «Cuaderno 2026-10-10 21.54.03.app», y «… (2)» si ya existe.
function nombreEnPapelera(d, carpeta) {
  const t = d.ahora();
  const dos = n => String(n).padStart(2, '0');
  const sello = `${t.getFullYear()}-${dos(t.getMonth() + 1)}-${dos(t.getDate())} ${dos(t.getHours())}.${dos(t.getMinutes())}.${dos(t.getSeconds())}`;
  let destino = path.posix.join(carpeta, `${PRODUCTO} ${sello}.app`);   // la Papelera es de Mac
  for (let n = 2; d.fs.existsSync(destino); n++) destino = path.posix.join(carpeta, `${PRODUCTO} ${sello} (${n}).app`);
  return destino;
}

// El instalador NSIS más reciente de la versión actual en dist-app/ (no el desinstalador).
function buscarInstalador(d, carpeta, version) {
  const candidatos = d.fs.readdirSync(carpeta)
    .filter(n => n.toLowerCase().endsWith('.exe') && n.includes('Setup') && n.includes(version))
    .map(n => ({ n, t: d.fs.statSync(path.join(carpeta, n)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return candidatos.length ? path.join(carpeta, candidatos[0].n) : null;
}

// ── La ejecución ───────────────────────────────────────────────────────────────────────────────────────────────────

// Devuelve el código de salida (0 bien, 1 se ha parado o ha fallado). Todo lo que dice va por `d.log`.
function instalar(argv, inyectadas = {}) {
  const d = { ...dependenciasReales(), ...inyectadas };
  const args = leerArgumentos(argv);
  if (args.error) { d.log(`instalar: ${args.error}`); return 1; }

  let estado = leerEstado(d, args.rama);
  let plan = planificar(estado);
  if (plan.error) { d.log(`instalar: ${plan.error}`); return 1; }

  if (args.simular) {
    d.log(`Simulación (no se ejecuta nada): ${estado.plataforma} ${estado.arch}, rama ${estado.rama}`);
    plan.pasos.forEach((p, i) => d.log(describirPaso(p, i + 1)));
    d.log('  (el pull puede traer otro package-lock.json: entonces también habría npm ci y el binario de Electron)');
    d.log('  Al terminar diría la versión de package.json y el commit (git rev-parse --short HEAD).');
    return 0;
  }

  const ejecutarPaso = (paso, rutas) => {
    d.log(`> ${paso.texto}`);
    if (paso.id === 'cerrar' && !estaAbierta(d, rutas)) { d.log(`  (${PRODUCTO} no está abierta)`); return null; }   // osascript la arrancaría solo para cerrarla
    if (paso.orden) {
      const r = d.ejecutar(paso.orden, { cwd: d.raiz, tope: paso.id === 'cerrar' ? TOPE_CIERRE_MS : undefined });
      // Pedir el cierre puede devolver error si la app no estaba abierta o tarda: lo que manda es si sigue viva.
      if (r.status !== 0 && paso.id !== 'cerrar') return `«${paso.orden.join(' ')}» ha fallado (código ${r.status})`;
      return null;
    }
    if (paso.accion === 'marcar-lock') {
      d.fs.writeFileSync(path.join(d.raiz, MARCA_LOCK), hashDe(d.fs.readFileSync(path.join(d.raiz, 'package-lock.json'))));
    } else if (paso.accion === 'esperar-cierre') {
      const vueltas = Math.ceil(TOPE_CIERRE_MS / INTERVALO_CIERRE_MS);
      for (let i = 0; estaAbierta(d, rutas); i++) {
        if (i >= vueltas) return `${PRODUCTO} sigue abierta tras ${TOPE_CIERRE_MS / 1000} s (¿«¿Descartar lo escrito?» o cambios sin guardar?). No se ha instalado nada y no se fuerza: ciérrala tú y vuelve a lanzar npm run instalar`;
        d.dormir(INTERVALO_CIERRE_MS);
      }
    } else if (paso.accion === 'papelera') {
      if (!d.fs.existsSync(paso.origen)) { d.log(`  (no hay ${paso.origen}: primera instalación)`); return null; }
      const destino = nombreEnPapelera(d, paso.carpeta);
      try { d.fs.renameSync(paso.origen, destino); } catch (e) { return `no he podido mover ${paso.origen} a la Papelera (${e.message}); no se ha tocado nada más`; }
      d.log(`  la versión anterior queda en ${destino}`);
    } else if (paso.accion === 'instalador') {
      const exe = buscarInstalador(d, paso.carpeta, versionDe(d));
      if (!exe) return `no encuentro el instalador de la versión ${versionDe(d)} en ${paso.carpeta}`;
      const r = d.ejecutar([exe, '/S'], { cwd: d.raiz });
      if (r.status !== 0) return `el instalador ha fallado (código ${r.status})`;
    } else if (paso.accion === 'abrir') {
      d.abrirSeparado(paso.ruta);
    }
    return null;
  };
  const parar = mensaje => { d.log(`instalar: ${mensaje}`); return 1; };

  // 1. El pull; después el estado se lee otra vez (puede haber traído otro package-lock.json) y se sigue con el nuevo plan.
  let fallo = ejecutarPaso(plan.pasos[0], plan.rutas);
  if (fallo) return parar(fallo);
  estado = leerEstado(d, args.rama);
  plan = planificar(estado);
  if (plan.error) return parar(plan.error);
  // 2. El resto.
  for (const paso of plan.pasos.slice(1)) {
    fallo = ejecutarPaso(paso, plan.rutas);
    if (fallo) return parar(fallo);
  }
  const commit = d.ejecutar(['git', 'rev-parse', '--short', 'HEAD'], { captura: true, cwd: d.raiz }).stdout.trim();
  d.log(`Instalada ${PRODUCTO} ${versionDe(d)} (${commit}) en ${plan.rutas.instalada}`);
  return 0;
}

module.exports = { instalar, planificar, leerArgumentos, leerEstado, describirPaso, estaAbierta, nombreEnPapelera, buscarInstalador, hashDe, MARCA_LOCK };

if (require.main === module) process.exit(instalar(process.argv.slice(2)));
