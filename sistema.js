'use strict';
// Lo que la app abre fuera del navegador, en el propio sistema: hoy, mostrar un fichero o una carpeta del cuaderno en
// el gestor de archivos (Finder, Explorador…). La terminal no: va dentro de la app (el cajón, con node-pty y xterm).
const path = require('node:path');
const { spawn } = require('node:child_process');

// El proceso vive por su cuenta: la app no lo espera ni lo mata al cerrarse.
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

module.exports = { comandoMostrar, mostrar };
