'use strict';
// La terminal es la del propio sistema, tal cual la tenga la persona (Roberto, 2026-10-08): la app no pinta ninguna,
// abre la suya en la carpeta del cuaderno, con el profesor ya lanzado o con un shell. Sin node-pty ni xterm.
//
// Qué terminal se abre:
//   macOS   no hay «terminal por defecto»: la que arrancó la app (TERM_PROGRAM: Ghostty, iTerm, WezTerm, Terminal…);
//           si la app arranca sin terminal detrás (servicio), Terminal.app. Para lanzar un comando se escribe un
//           fichero .command temporal (cd a la carpeta y exec), que es lo que estas apps saben abrir.
//   Windows Windows Terminal (wt) si está en el PATH; si no, la consola (cmd) con `start`.
//   Linux   xdg-terminal-exec si existe; si no, $TERMINAL, x-terminal-emulator o la primera conocida que haya.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const APPS_MAC = { ghostty: 'Ghostty', 'iTerm.app': 'iTerm', WezTerm: 'WezTerm', Apple_Terminal: 'Terminal' };
// Terminales de Linux y cómo se les pasa la carpeta y el comando (`-e` o `--` según cada una).
const LINUX = [
  ['xdg-terminal-exec', (carpeta, cmd) => cmd ? cmd : []],
  ['x-terminal-emulator', (carpeta, cmd) => cmd ? ['-e', ...cmd] : []],
  ['gnome-terminal', (carpeta, cmd) => [`--working-directory=${carpeta}`, ...(cmd ? ['--', ...cmd] : [])]],
  ['konsole', (carpeta, cmd) => ['--workdir', carpeta, ...(cmd ? ['-e', ...cmd] : [])]],
  ['xfce4-terminal', (carpeta, cmd) => [`--working-directory=${carpeta}`, ...(cmd ? ['-e', cmd.join(' ')] : [])]],
  ['alacritty', (carpeta, cmd) => ['--working-directory', carpeta, ...(cmd ? ['-e', ...cmd] : [])]],
  ['kitty', (carpeta, cmd) => ['--directory', carpeta, ...(cmd || [])]],
  ['xterm', (carpeta, cmd) => cmd ? ['-e', ...cmd] : []],
];

function existeEnPath(nombre, env = process.env) {
  const ext = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  return (env.PATH || '').split(path.delimiter).some(d => d && ext.some(e => { try { return fs.statSync(path.join(d, nombre + e)).isFile(); } catch { return false; } }));
}

// Qué terminal toca en este sistema. `existe` se inyecta en los tests.
function elegir({ plataforma = process.platform, env = process.env, existe = n => existeEnPath(n, env) } = {}) {
  if (plataforma === 'darwin') return { nombre: APPS_MAC[env.TERM_PROGRAM] || 'Terminal', tipo: 'mac' };
  if (plataforma === 'win32') return existe('wt') ? { nombre: 'Windows Terminal', tipo: 'wt' } : { nombre: 'la consola', tipo: 'cmd' };
  if (env.TERMINAL && existe(env.TERMINAL)) return { nombre: env.TERMINAL, tipo: 'linux', binario: env.TERMINAL, args: (carpeta, cmd) => cmd ? ['-e', ...cmd] : [] };
  const t = LINUX.find(([bin]) => existe(bin));
  if (!t) return null;
  return { nombre: t[0], tipo: 'linux', binario: t[0], args: t[1] };
}

// El fichero .command de macOS: entra en la carpeta y ejecuta el comando (o el shell de la persona si no hay comando).
const scriptMac = (carpeta, comando) => `#!/bin/sh\ncd ${comillas(carpeta)} || exit 1\nexec ${comando ? comando.map(comillas).join(' ') : '"${SHELL:-/bin/zsh}" -l'}\n`;
const comillas = s => `'${String(s).replace(/'/g, `'\\''`)}'`;

// Qué proceso lanzar: { cmd, args, cwd }. `comando` es una lista (ya partida) o null para un shell; `script` es la ruta
// del .command en macOS (quien llama lo escribe antes).
function comandoDe(eleccion, { carpeta, comando = null, script = null }) {
  if (eleccion.tipo === 'mac') return { cmd: 'open', args: ['-a', eleccion.nombre, script || carpeta], cwd: carpeta };
  if (eleccion.tipo === 'wt') return { cmd: 'wt', args: ['-d', carpeta, ...(comando ? ['cmd', '/k', ...comando] : [])], cwd: carpeta };
  if (eleccion.tipo === 'cmd') return { cmd: 'cmd', args: ['/c', 'start', '', '/d', carpeta, 'cmd', ...(comando ? ['/k', ...comando] : [])], cwd: carpeta };
  return { cmd: eleccion.binario, args: eleccion.args(carpeta, comando), cwd: carpeta };
}

// Abre la terminal del sistema en `carpeta`, con `comando` (texto, como lo da el kit) ya lanzado si lo hay.
// Devuelve el nombre de la terminal abierta; lanza si no hay ninguna conocida. `lanzar` se inyecta en los tests.
function abrir({ carpeta, comando = null, plataforma = process.platform, env = process.env, existe, lanzar = lanzarSuelto } = {}) {
  const eleccion = elegir({ plataforma, env, ...(existe ? { existe } : {}) });
  if (!eleccion) throw new Error('no he encontrado ninguna terminal en este sistema (xdg-terminal-exec, x-terminal-emulator, gnome-terminal, konsole, xfce4-terminal, alacritty, kitty o xterm)');
  const partes = comando ? comando.trim().split(/\s+/) : null;
  let script = null;
  if (eleccion.tipo === 'mac' && partes) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-terminal-'));
    script = path.join(dir, `${partes[0].replace(/[^\w.-]/g, '_')}.command`);
    fs.writeFileSync(script, scriptMac(carpeta, partes), { mode: 0o755 });
  }
  const { cmd, args, cwd } = comandoDe(eleccion, { carpeta, comando: partes, script });
  lanzar(cmd, args, { cwd, env });
  return eleccion.nombre;
}
// El proceso de la terminal vive por su cuenta: la app no lo espera ni lo mata al cerrarse.
function lanzarSuelto(cmd, args, opciones) {
  const p = spawn(cmd, args, { ...opciones, detached: true, stdio: 'ignore', windowsHide: false });
  p.on('error', () => { /* el error de arranque lo ve quien llama si el comando no existe; aquí no hay a quién avisar */ });
  p.unref();
}

// Mostrar una carpeta, o un fichero señalado dentro de su carpeta, en el gestor de archivos del sistema. No ejecuta el
// fichero: macOS `open -R` lo señala en el Finder, Windows `explorer /select,` en el Explorador, Linux abre su carpeta.
function comandoMostrar({ abs, carpeta, plataforma = process.platform }) {
  if (plataforma === 'darwin') return carpeta ? { cmd: 'open', args: [abs] } : { cmd: 'open', args: ['-R', abs] };
  if (plataforma === 'win32') return carpeta ? { cmd: 'explorer', args: [abs] } : { cmd: 'explorer', args: [`/select,${abs}`] };
  return { cmd: 'xdg-open', args: [carpeta ? abs : path.dirname(abs)] };
}
function mostrar({ abs, carpeta, plataforma = process.platform, lanzar = lanzarSuelto }) {
  const { cmd, args } = comandoMostrar({ abs, carpeta, plataforma });
  lanzar(cmd, args, { cwd: carpeta ? abs : path.dirname(abs), env: process.env });
}

module.exports = { elegir, comandoDe, abrir, scriptMac, existeEnPath, comandoMostrar, mostrar };
