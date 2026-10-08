'use strict';
// Lo que la app hace fuera del navegador, en el propio sistema: mostrar un fichero o una carpeta del cuaderno en el
// gestor de archivos (Finder, Explorador…) y mandar un fichero a la papelera. La terminal no: va dentro de la app (el
// cajón, con node-pty y xterm).
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');

function existeEnPath(nombre, env = process.env) {
  const ext = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  return (env.PATH || '').split(path.delimiter).some(d => d && ext.some(e => { try { return fs.statSync(path.join(d, nombre + e)).isFile(); } catch { return false; } }));
}

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

// Mandar un fichero a la papelera del sistema, de donde se recupera (Roberto, 2026-10-08: sin pedir confirmación). Sin
// dependencias: la orden de cada sistema. macOS `trash` (la trae el sistema desde macOS 15) o, si no está, el Finder por
// AppleScript; Windows, la papelera de reciclaje por PowerShell (la ruta va en una variable de entorno, sin comillas que
// escapar); Linux, `gio trash` o `trash-put`. La ruta siempre como argumento, nunca dentro de una línea de shell.
function comandoPapelera({ abs, plataforma = process.platform, env = process.env, existe = n => existeEnPath(n, env) }) {
  if (plataforma === 'darwin') return existe('trash') ? { cmd: 'trash', args: [abs] }
    : { cmd: 'osascript', args: ['-e', 'on run argv', '-e', 'tell application "Finder" to delete (POSIX file (item 1 of argv) as alias)', '-e', 'end run', abs] };
  if (plataforma === 'win32') return { cmd: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($env:CUADERNO_PAPELERA, 'OnlyErrorDialogs', 'SendToRecycleBin')"], env: { CUADERNO_PAPELERA: abs } };
  if (existe('gio')) return { cmd: 'gio', args: ['trash', abs] };
  if (existe('trash-put')) return { cmd: 'trash-put', args: [abs] };
  return null;
}
// Espera a que la orden acabe y comprueba que el fichero ya no está: si sigue ahí, lanza con lo que dijo la orden.
// `ejecutar` se inyecta en los tests.
function aPapelera({ abs, plataforma = process.platform, env = process.env, existe, ejecutar = ejecutarEsperando }) {
  const c = comandoPapelera({ abs, plataforma, env, ...(existe ? { existe } : {}) });
  if (!c) throw new Error('no he encontrado cómo mandar a la papelera en este sistema (gio o trash-put)');
  let detalle = '';
  try { ejecutar(c.cmd, c.args, { env: { ...env, ...(c.env || {}) } }); } catch (e) { detalle = String(e.stderr || e.message || '').trim(); }
  if (fs.existsSync(abs)) throw new Error(`no se ha podido mandar a la papelera${detalle ? `: ${detalle}` : ''}`);
}
function ejecutarEsperando(cmd, args, opciones) { execFileSync(cmd, args, { ...opciones, stdio: ['ignore', 'ignore', 'pipe'], timeout: 15000, windowsHide: true }); }

module.exports = { comandoMostrar, mostrar, existeEnPath, comandoPapelera, aPapelera };
