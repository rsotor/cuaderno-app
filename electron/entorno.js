'use strict';
// El entorno que una app de escritorio no hereda: en Mac y Linux la sesión gráfica no lleva el PATH de la shell de
// login (Homebrew, nvm, ~/.local/bin), así que git, node o claude no se encuentran. Se le pide a la shell su entorno
// con `env -0` entre marcadores (plan §2, fila «Entorno de la shell»: `echo $PATH` a secas se mezcla con el MOTD, el
// prompt o los avisos de nvm, y `env -0` separa por \0, que no aparece en ningún valor; fish también exporta PATH con
// `:` así). Primero `-lc`; `-ilc` solo si con `-lc` no llega nada (hay quien pone el PATH en el .bashrc). Tope de
// 10 s; si la shell falla o tarda, quedan las rutas de respaldo, que se añaden siempre. Todo puro e inyectable: la
// shell es `env.SHELL` (en los tests, un script) y `ejecutar` lanza con spawn (asíncrono: el proceso principal sigue
// atendiendo eventos mientras espera; con spawnSync, en el Mac el menú no respondía esos segundos) salvo que se inyecte otro.
// Aquí viven también las funciones puras de la ventana (plan §2): esquemaPermitido (qué enlaces van fuera) y temaNativo.
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const MARCADOR = '__CUADERNO__';
const IMPORTAR = /^(PATH|LANG|LC_[A-Z_]+|SSH_AUTH_SOCK|GIT_[A-Z_]+)$/;   // lo que se toma de la shell; lo demás, no
const TOPE = 10_000;
const ORDEN = `printf ${MARCADOR}; env -0; printf ${MARCADOR}`;

// Rutas que se añaden siempre al final del PATH, por si la shell falla o no las lleva.
function respaldo(home) {
  const nvm = path.join(home, '.nvm', 'versions', 'node');
  let versiones = [];
  try { versiones = fs.readdirSync(nvm).sort().reverse().map(v => path.join(nvm, v, 'bin')); } catch { /* sin nvm */ }
  return ['/opt/homebrew/bin', '/usr/local/bin', path.join(home, '.local', 'bin'), ...versiones];
}

// Parsea la salida de `env -0` entre los dos marcadores: { NOMBRE: valor }, o null si no están los dos. Lo de fuera
// de los marcadores es ruido de la shell (MOTD, avisos) y se tira; dentro, cada `NOMBRE=valor` acaba en \0.
function parsear(salida) {
  const a = salida.indexOf(MARCADOR), b = salida.lastIndexOf(MARCADOR);
  if (a < 0 || b <= a) return null;
  const vars = {};
  for (const par of salida.slice(a + MARCADOR.length, b).split('\0')) {
    const i = par.indexOf('=');
    if (i > 0) vars[par.slice(0, i).trim()] = par.slice(i + 1);
  }
  return vars;
}

const MAX_SALIDA = 8 * 1024 * 1024;   // bytes de stdout que se aceptan de la shell: más es que algo va mal

// Lanza la shell y resuelve con { stdout, status, error? } (el contrato de spawnSync, que es lo que había): error con
// code ETIMEDOUT si pasa el tope (se mata la shell y se sueltan sus tuberías: un `sleep` nieto no la retiene), ENOENT
// si no existe. Nunca rechaza. Resuelve en `exit` en cuanto la salida ya trae los dos marcadores (`listo(stdout)`): un
// nieto que herede el stdout de la shell de login (un agente de claves, tmux, algo mal daemonizado en el perfil) mantiene
// la tubería abierta y `close` no llegaría hasta el tope entero aunque el `env -0` ya esté. Sin marcadores, se espera a
// `close` (lo que quede por leer). `listo` es inyectable para probarlo; por defecto, parsear() encuentra los marcadores.
function ejecutarShell(shell, args, { timeout, env, listo = salida => parsear(salida) !== null }) {
  return new Promise(resolver => {
    let stdout = '', hijo, acabado = false, temporizador, salida = null;   // `salida`: el código con el que la shell terminó, cuando lo haya hecho
    const acabar = r => { if (acabado) return; acabado = true; clearTimeout(temporizador); resolver(r); };
    const soltar = () => { for (const t of [hijo.stdout, hijo.stderr]) { try { t.destroy(); } catch { /* ya cerrada */ } } };
    const comprobar = () => { if (salida !== null && listo(stdout)) { soltar(); acabar({ stdout, status: salida.status }); } };
    try { hijo = spawn(shell, args, { env, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return acabar({ stdout: '', status: null, error: e }); }
    temporizador = setTimeout(() => { try { hijo.kill('SIGKILL'); } catch { /* ya muerta */ } soltar(); acabar({ stdout, status: null, error: Object.assign(new Error(`${shell}: no ha contestado en ${timeout} ms`), { code: 'ETIMEDOUT' }) }); }, timeout);
    hijo.stdout.setEncoding('utf8');
    hijo.stdout.on('data', d => {
      stdout += d;
      if (stdout.length > MAX_SALIDA) { try { hijo.kill('SIGKILL'); } catch { /* ya muerta */ } soltar(); return acabar({ stdout: '', status: null, error: Object.assign(new Error(`${shell}: demasiada salida`), { code: 'ENOBUFS' }) }); }
      comprobar();   // la shell ya salió y lo que faltaba por leer acaba de llegar
    });
    hijo.stderr.resume();   // el ruido de la shell se descarta, pero hay que leerlo para que no se atasque
    hijo.on('error', e => acabar({ stdout, status: null, error: e }));
    hijo.on('exit', status => { salida = { status }; comprobar(); });
    hijo.on('close', status => acabar({ stdout, status }));
  });
}

// Devuelve (promesa) { env, origen, ms, shell, error? }: `env` es el de partida con PATH, LANG, LC_*, SSH_AUTH_SOCK y GIT_*
// de la shell de login y las rutas de respaldo añadidas al PATH. origen: 'shell -lc' | 'shell -ilc' | 'respaldo'
// (la shell no contestó: `error` dice por qué) | 'sistema' (Windows: no se ejecuta nada ni se añade nada).
async function entornoDeLaShell({ env = process.env, plataforma = process.platform, ejecutar = ejecutarShell, tope = TOPE, home = os.homedir(), shell = env.SHELL || '/bin/sh' } = {}) {
  const t0 = Date.now();
  const resultado = { env: { ...env }, origen: 'sistema', ms: 0, shell: null };
  if (plataforma === 'win32') return resultado;
  resultado.origen = 'respaldo';
  resultado.shell = shell;
  for (const flags of ['-lc', '-ilc']) {
    const r = await ejecutar(shell, [flags, ORDEN], { timeout: tope, env: { ...env } });   // copia: lo que se lanza no debe escribir en el env de partida (NODE_V8_COVERAGE)
    if (r.error) { resultado.error = `${shell} ${flags}: ${r.error.code === 'ETIMEDOUT' ? `no ha contestado en ${tope / 1000} s` : r.error.message}`; break; }
    const vars = parsear(r.stdout);
    if (vars && vars.PATH) {
      for (const [k, v] of Object.entries(vars)) if (IMPORTAR.test(k)) resultado.env[k] = v;
      resultado.origen = `shell ${flags}`;
      delete resultado.error;
      break;
    }
    resultado.error = vars ? `${shell} ${flags}: la shell contestó pero su entorno no trae PATH (código ${r.status})` : `${shell} ${flags}: sin marcadores en la salida (código ${r.status})`;
  }
  // Mac y Linux separan el PATH con ':' (Windows, que usa ';', ya ha salido arriba): el de la plataforma que se pidió, no
  // el de la máquina en la que corre esto (los tests de Windows prueban Mac y Linux por inyección).
  const partes = (resultado.env.PATH || '').split(':').filter(Boolean);
  for (const d of respaldo(home)) if (!partes.includes(d)) partes.push(d);
  resultado.env.PATH = partes.join(':');
  resultado.ms = Date.now() - t0;
  return resultado;
}

// El Node con el que se lanzan las herramientas del kit y el corrector desde la app: el binario de Electron del
// padre (CUADERNO_NODE; en macOS el execPath del hijo sería el helper) comportándose como node (plan §2, R1).
function nodeDelKit(env = process.env) {
  return { cmd: env.CUADERNO_NODE || process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' } };
}

// Qué enlaces de una nota pueden ir al navegador del sistema (shell.openExternal): solo web y correo. Un `file:`,
// `smb:`, `vnc:` o `javascript:` no se pasa (lista de seguridad de Electron); la ventana lo anota y no hace nada.
const ESQUEMAS = ['http:', 'https:', 'mailto:'];
function esquemaPermitido(url) {
  try { return ESQUEMAS.includes(new URL(String(url)).protocol); } catch { return false; }
}

// El tema de config.json en palabras de nativeTheme.themeSource: auto → system, claro → light, oscuro → dark; cualquier
// otra cosa (un config.json viejo o roto) → system, que es lo que hace config.leer con un tema que no conoce.
const TEMAS_NATIVOS = { auto: 'system', claro: 'light', oscuro: 'dark' };
function temaNativo(tema) { return TEMAS_NATIVOS[tema] || 'system'; }

// Las variables de prueba de la app (sustituyen diálogos y el navegador por líneas del registro, mueven el lock de instancia
// única): solo valen sin empaquetar (`npm run app`, los recorridos). En la app empaquetada (`app.isPackaged`) se ignoran, para
// que nadie pueda, con una variable en su sesión, dejar la app sin diálogos o sin lock. CUADERNO_CONFIG_DIR NO está aquí:
// cambiar de carpeta de configuración es legítimo también empaquetada (y el hijo la necesita).
const VARIABLES_DE_PRUEBA = ['CUADERNO_SIN_DIALOGO', 'CUADERNO_SIN_NAVEGADOR', 'CUADERNO_DIALOGO_PRUEBA', 'CUADERNO_USERDATA', 'CUADERNO_OCULTA'];
function sinVariablesDePrueba(env) {
  const limpio = { ...env };
  for (const v of VARIABLES_DE_PRUEBA) delete limpio[v];
  return limpio;
}

module.exports = { entornoDeLaShell, ejecutarShell, nodeDelKit, esquemaPermitido, temaNativo, sinVariablesDePrueba, parsear, respaldo, MARCADOR, IMPORTAR, TOPE, ESQUEMAS, VARIABLES_DE_PRUEBA };
