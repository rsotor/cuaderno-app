// SPIKE 2026-10-10: se reescribe en la tarea T1 con sus tests (docs/planes/electron.md §6)
'use strict';
// El entorno que una app de escritorio no hereda: en Mac y Linux la sesión gráfica no lleva el PATH de la shell de
// login (Homebrew, nvm, ~/.local/bin), así que git, node o claude no se encuentran. Se le pide a la shell su entorno
// con `env -0` entre marcadores (plan §2: `echo $PATH` a secas se mezcla con el MOTD, p10k o los avisos de nvm).
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const MARCADOR = '__CUADERNO__';
const IMPORTAR = /^(PATH|LANG|LC_[A-Z_]+|SSH_AUTH_SOCK|GIT_[A-Z_]+)$/;
// Rutas que se añaden siempre al PATH, por si la shell falla o no las lleva.
const RESPALDO = home => ['/opt/homebrew/bin', '/usr/local/bin', path.join(home, '.local', 'bin'), ...nvm(home)];
function nvm(home) {
  const d = path.join(home, '.nvm', 'versions', 'node');
  try { return fs.readdirSync(d).map(v => path.join(d, v, 'bin')); } catch { return []; }
}

// Parsea la salida de `env -0` entre los dos marcadores: { NOMBRE: valor }. Lo de fuera de los marcadores es ruido.
function parsear(salida) {
  const a = salida.indexOf(MARCADOR), b = salida.lastIndexOf(MARCADOR);
  if (a < 0 || b <= a) return null;
  const dentro = salida.slice(a + MARCADOR.length, b);
  const vars = {};
  for (const par of dentro.split('\0')) { const i = par.indexOf('='); if (i > 0) vars[par.slice(0, i).replace(/^\n/, '')] = par.slice(i + 1); }
  return vars;
}

// Devuelve { env, origen: 'shell' | 'respaldo', ms, shell, error? }: `env` es el de partida con PATH, LANG, LC_*,
// SSH_AUTH_SOCK y GIT_* de la shell de login, y con las rutas de respaldo añadidas al PATH.
function entornoDeLaShell({ env = process.env, plataforma = process.platform, tope = 10_000, home = os.homedir() } = {}) {
  const t0 = Date.now();
  const resultado = { env: { ...env }, origen: 'respaldo', ms: 0, shell: null };
  if (plataforma !== 'win32') {
    const shell = env.SHELL || '/bin/sh';
    resultado.shell = shell;
    // `env -0` separa por \0 y es un ejecutable (vale en bash, zsh y fish). El marcador va antes y después para
    // tirar el ruido que la shell escriba al arrancar. Primero `-lc`; `-ilc` solo si falta algo (plan §2).
    const orden = `printf ${MARCADOR}; env -0; printf ${MARCADOR}`;
    for (const flags of ['-lc', '-ilc']) {
      const r = spawnSync(shell, [flags, orden], { encoding: 'utf8', timeout: tope, env, stdio: ['ignore', 'pipe', 'pipe'] });
      if (r.error) { resultado.error = `${shell} ${flags}: ${r.error.message}`; break; }
      const vars = parsear(r.stdout || '');
      if (vars && vars.PATH) {
        for (const [k, v] of Object.entries(vars)) if (IMPORTAR.test(k)) resultado.env[k] = v;
        resultado.origen = `shell ${flags}`;
        break;
      }
      resultado.error = `${shell} ${flags}: sin marcadores (código ${r.status})`;
    }
  }
  const partes = (resultado.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const d of RESPALDO(home)) if (!partes.includes(d)) partes.push(d);
  resultado.env.PATH = partes.join(path.delimiter);
  resultado.ms = Date.now() - t0;
  return resultado;
}

// El Node con el que se lanzan las herramientas del kit y el corrector: el binario de Electron del padre
// (CUADERNO_NODE; en macOS el execPath del hijo sería el helper) comportándose como node (plan §2, R1).
function nodeDelKit(env = process.env) {
  return { cmd: env.CUADERNO_NODE || process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' } };
}

module.exports = { entornoDeLaShell, nodeDelKit, parsear, MARCADOR };
