'use strict';
// El entorno que una app de escritorio no hereda: en Mac y Linux la sesión gráfica no lleva el PATH de la shell de
// login (Homebrew, nvm, ~/.local/bin), así que git, node o claude no se encuentran. Se le pide a la shell su entorno
// con `env -0` entre marcadores (plan §2, fila «Entorno de la shell»: `echo $PATH` a secas se mezcla con el MOTD, el
// prompt o los avisos de nvm, y `env -0` separa por \0, que no aparece en ningún valor; fish también exporta PATH con
// `:` así). Primero `-lc`; `-ilc` solo si con `-lc` no llega nada (hay quien pone el PATH en el .bashrc). Tope de
// 10 s; si la shell falla o tarda, quedan las rutas de respaldo, que se añaden siempre. Todo puro e inyectable: la
// shell es `env.SHELL` (en los tests, un script) y `ejecutar` es spawnSync salvo que se inyecte otro.
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

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

function ejecutarShell(shell, args, { timeout, env }) {
  const r = spawnSync(shell, args, { encoding: 'utf8', timeout, env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 });
  return { stdout: r.stdout || '', status: r.status, error: r.error };
}

// Devuelve { env, origen, ms, shell, error? }: `env` es el de partida con PATH, LANG, LC_*, SSH_AUTH_SOCK y GIT_*
// de la shell de login y las rutas de respaldo añadidas al PATH. origen: 'shell -lc' | 'shell -ilc' | 'respaldo'
// (la shell no contestó: `error` dice por qué) | 'sistema' (Windows: no se ejecuta nada ni se añade nada).
function entornoDeLaShell({ env = process.env, plataforma = process.platform, ejecutar = ejecutarShell, tope = TOPE, home = os.homedir(), shell = env.SHELL || '/bin/sh' } = {}) {
  const t0 = Date.now();
  const resultado = { env: { ...env }, origen: 'sistema', ms: 0, shell: null };
  if (plataforma === 'win32') return resultado;
  resultado.origen = 'respaldo';
  resultado.shell = shell;
  for (const flags of ['-lc', '-ilc']) {
    const r = ejecutar(shell, [flags, ORDEN], { timeout: tope, env: { ...env } });   // copia: spawnSync escribe en el env que recibe (NODE_V8_COVERAGE)
    if (r.error) { resultado.error = `${shell} ${flags}: ${r.error.code === 'ETIMEDOUT' ? `no ha contestado en ${tope / 1000} s` : r.error.message}`; break; }
    const vars = parsear(r.stdout);
    if (vars && vars.PATH) {
      for (const [k, v] of Object.entries(vars)) if (IMPORTAR.test(k)) resultado.env[k] = v;
      resultado.origen = `shell ${flags}`;
      delete resultado.error;
      break;
    }
    resultado.error = `${shell} ${flags}: sin marcadores en la salida (código ${r.status})`;
  }
  const partes = (resultado.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const d of respaldo(home)) if (!partes.includes(d)) partes.push(d);
  resultado.env.PATH = partes.join(path.delimiter);
  resultado.ms = Date.now() - t0;
  return resultado;
}

// El Node con el que se lanzan las herramientas del kit y el corrector desde la app: el binario de Electron del
// padre (CUADERNO_NODE; en macOS el execPath del hijo sería el helper) comportándose como node (plan §2, R1).
function nodeDelKit(env = process.env) {
  return { cmd: env.CUADERNO_NODE || process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' } };
}

module.exports = { entornoDeLaShell, nodeDelKit, parsear, respaldo, MARCADOR, IMPORTAR, TOPE };
