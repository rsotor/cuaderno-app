'use strict';
// Guardar, traer y deshacer. Con kit, lo hacen sus herramientas (guardar.js, deshacer.js): la app solo las lanza
// y enseña lo que dicen. Sin kit, si la carpeta es un repositorio, commit y push (como un autosave). La app nunca
// resuelve un conflicto ni un error del kit: lo enseña y ofrece la terminal con el profesor.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// El entorno se arma al ejecutar, no al cargar: así lo que el proceso reciba después (la app de escritorio lo
// resuelve desde la shell de login) llega a git y al kit.
const entorno = (extra = {}) => ({ ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C.UTF-8', ...extra });
function ejecutar(cwd, cmd, args, timeout = 120_000, extra = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: entorno(extra), timeout });
  if (r.error) return { codigo: 1, salida: r.error.code === 'ETIMEDOUT' ? 'se ha agotado el tiempo de espera (¿pide una contraseña o no hay red?)' : r.error.message };
  return { codigo: r.status ?? 1, salida: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}
const git = (raiz, args) => ejecutar(raiz, 'git', args, 60_000);
const esRepo = raiz => git(raiz, ['rev-parse', '--is-inside-work-tree']).salida === 'true';
const tieneRemoto = raiz => git(raiz, ['rev-parse', '--abbrev-ref', '@{upstream}']).codigo === 0;
// Con qué Node se lanza una herramienta del kit: por defecto el de este proceso; la app de escritorio inyecta
// ejecutarNode = { cmd, env } (el binario de Electron con ELECTRON_RUN_AS_NODE=1).
const herramienta = (raiz, nombre, args, ejecutarNode = null) => ejecutar(raiz, ejecutarNode ? ejecutarNode.cmd : process.execPath, [path.join('.kit', 'herramientas', nombre), ...args], 120_000, ejecutarNode ? ejecutarNode.env : {});

// Lo que ha cambiado desde el último guardado, como lo ve git, con nombres de nota (sin ruta ni .md).
function cambios(raiz) {
  if (!esRepo(raiz)) return [];
  // -z: una entrada por \0, sin comillas ni escapes; un renombrado trae la ruta nueva y luego la vieja.
  const r = spawnSync('git', ['status', '--porcelain', '-z'], { cwd: raiz, encoding: 'utf8', env: entorno() });
  if (r.status !== 0) return [];
  const partes = r.stdout.split('\0').filter(Boolean), lista = [];
  for (let i = 0; i < partes.length; i++) { lista.push(partes[i].slice(3)); if (partes[i][0] === 'R' || partes[i][0] === 'C') i++; }
  return lista;
}
function proponerMensaje(raiz) {
  const lista = cambios(raiz);
  if (!lista.length) return '';
  const nombres = [...new Set(lista.map(f => path.basename(f).replace(/\.md$/, '')))];
  const cabeza = nombres.slice(0, 3).join(', ');
  return nombres.length > 3 ? `Cambios en ${cabeza} y ${nombres.length - 3} más` : `Cambios en ${cabeza}`;
}

function sinMotor() { return { codigo: 1, salida: 'Este cuaderno es una salida del kit sin motor: no se puede guardar desde aquí. Ábrelo con su kit completo.' }; }

function guardar(raiz, kit, mensaje, { ejecutarNode = null } = {}) {
  mensaje = String(mensaje || '').trim();
  if (!mensaje) return { codigo: 1, salida: 'Falta el mensaje de guardado.' };
  if (kit.tipo === 'kit') return herramienta(raiz, 'guardar.js', [mensaje], ejecutarNode);
  if (kit.tipo === 'salida-sin-motor') return sinMotor();
  if (!esRepo(raiz)) return { codigo: 1, salida: 'Esta carpeta no es un repositorio: no hay dónde guardar. Crea uno con git init (o abre el cuaderno con su kit).' };
  if (!cambios(raiz).length) return { codigo: 0, salida: 'No había nada nuevo que guardar.' };
  let r = git(raiz, ['add', '-A']);
  if (r.codigo) return r;
  r = git(raiz, ['commit', '-q', '-m', mensaje]);
  if (r.codigo) return { codigo: r.codigo, salida: /user\.(name|email)|Please tell me who you are/.test(r.salida) ? 'Git no sabe quién eres todavía: configura user.name y user.email.' : r.salida };
  if (!tieneRemoto(raiz)) return { codigo: 0, salida: 'Guardado en local. No se ha subido: este repositorio no tiene remoto.' };
  const push = git(raiz, ['push', '-q']);
  return push.codigo ? { codigo: 0, salida: `Guardado en local. No se ha podido subir:\n${push.salida}`, sinSubir: true } : { codigo: 0, salida: 'Guardado y subido.' };
}

function traer(raiz, kit, { ejecutarNode = null } = {}) {
  if (kit.tipo === 'kit') return herramienta(raiz, 'guardar.js', ['--traer'], ejecutarNode);
  if (kit.tipo === 'salida-sin-motor') return sinMotor();
  if (!esRepo(raiz)) return { codigo: 1, salida: 'Esta carpeta no es un repositorio.' };
  if (!tieneRemoto(raiz)) return { codigo: 1, salida: 'No se ha traído nada: este repositorio no tiene remoto.' };
  if (cambios(raiz).length) return { codigo: 1, salida: 'Hay cambios sin guardar: guarda primero y después trae.' };
  const r = git(raiz, ['pull', '--ff-only', '-q']);
  return r.codigo ? { codigo: 1, salida: `No se ha podido traer (los cambios de aquí y los de fuera chocan, o no hay red):\n${r.salida}` } : { codigo: 0, salida: 'Traído lo último.' };
}

// ver: solo enseña qué se desharía. Sin ver: lo deshace (con kit, deshacer.js decide si procede).
function deshacer(raiz, kit, { ver = true, ejecutarNode = null } = {}) {
  if (kit.tipo === 'kit') return herramienta(raiz, 'deshacer.js', ver ? ['--ver'] : [], ejecutarNode);
  if (kit.tipo === 'salida-sin-motor') return sinMotor();
  if (!esRepo(raiz)) return { codigo: 1, salida: 'Esta carpeta no es un repositorio.' };
  if (cambios(raiz).length) return { codigo: 1, salida: 'Hay cambios sin guardar: deshacer ahora los perdería. Guárdalos primero.' };
  const ultimo = git(raiz, ['log', '-1', '--format=%s']);
  if (ultimo.codigo) return { codigo: 1, salida: 'No hay nada guardado que deshacer.' };
  const ficheros = git(raiz, ['show', '--name-status', '--format=', 'HEAD']).salida.split('\n').filter(Boolean).map(l => { const [e, ...f] = l.split('\t'); return `- ${f.join('\t')} (${{ A: 'nuevo', M: 'cambiado', D: 'borrado' }[e[0]] || e})`; });
  if (ver) return { codigo: 0, salida: `Esto deshace: ${ultimo.salida}\nVolverían a como estaban:\n${ficheros.join('\n')}` };
  const r = git(raiz, ['revert', '--no-edit', 'HEAD']);
  if (r.codigo) { git(raiz, ['revert', '--abort']); return { codigo: 1, salida: `No se ha podido deshacer:\n${r.salida}` }; }
  return { codigo: 0, salida: `Deshecho: ${ultimo.salida}\nHan vuelto a como estaban:\n${ficheros.join('\n')}` };
}

module.exports = { guardar, traer, deshacer, proponerMensaje, cambios, esRepo };
