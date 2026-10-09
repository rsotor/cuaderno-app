'use strict';
// La configuración del usuario: igual para todos sus cuadernos y fuera de los repos. Tema, letra, fuente, el panel
// (dónde va y cuánto mide), los cuadernos recientes y lo que es de esta máquina (comando del agente sin kit). Un JSON en la carpeta de
// configuración del sistema; CUADERNO_CONFIG_DIR la cambia (los tests la ponen en una carpeta temporal).
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const POR_DEFECTO = { tema: 'auto', letra: 'media', fuente: 'sistema', comando_agente: '', panel: 'derecha', panel_ancho: 420, panel_alto: 320, recientes: [], ocultas: {} };
const TEMAS = ['auto', 'claro', 'oscuro'], LETRAS = ['pequeña', 'media', 'grande'], FUENTES = ['sistema', 'serif'];
const PANELES = ['derecha', 'abajo'];
// Tamaños del panel en píxeles: enteros dentro de un tope amplio. El límite fino (que la nota conserve su sitio en
// esta ventana) lo aplica el navegador, que es quien sabe cuánto mide la pantalla.
const TAMANOS_PANEL = { panel_ancho: [320, 3000], panel_alto: [180, 3000] };
const tamanoValido = (campo, v) => Number.isInteger(v) && v >= TAMANOS_PANEL[campo][0] && v <= TAMANOS_PANEL[campo][1];
const MAX_RECIENTES = 20;

function carpeta() {
  if (process.env.CUADERNO_CONFIG_DIR) return process.env.CUADERNO_CONFIG_DIR;
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'cuaderno');
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'cuaderno');
}
const fichero = () => path.join(carpeta(), 'config.json');

function leer() {
  let guardado = {};
  try { guardado = JSON.parse(fs.readFileSync(fichero(), 'utf8')); } catch { /* sin fichero o roto: valores por defecto */ }
  const c = { ...POR_DEFECTO, ...guardado };
  if (!TEMAS.includes(c.tema)) c.tema = POR_DEFECTO.tema;
  if (!LETRAS.includes(c.letra)) c.letra = POR_DEFECTO.letra;
  if (!FUENTES.includes(c.fuente)) c.fuente = POR_DEFECTO.fuente;
  if (!PANELES.includes(c.panel)) c.panel = POR_DEFECTO.panel;
  for (const campo of Object.keys(TAMANOS_PANEL)) if (!tamanoValido(campo, c[campo])) c[campo] = POR_DEFECTO[campo];
  if (!Array.isArray(c.recientes)) c.recientes = [];
  if (!c.ocultas || typeof c.ocultas !== 'object' || Array.isArray(c.ocultas)) c.ocultas = {};
  if (typeof c.comando_agente !== 'string') c.comando_agente = '';
  return c;
}
function escribir(c) {
  fs.mkdirSync(carpeta(), { recursive: true });
  fs.writeFileSync(fichero(), JSON.stringify(c, null, 2) + '\n');
}
// Solo lo que es apariencia: tema, letra, fuente, panel (y el comando del agente). Lo demás no lo cambia el navegador.
function ajustar(cambios) {
  const c = leer();
  if (TEMAS.includes(cambios.tema)) c.tema = cambios.tema;
  if (LETRAS.includes(cambios.letra)) c.letra = cambios.letra;
  if (FUENTES.includes(cambios.fuente)) c.fuente = cambios.fuente;
  if (PANELES.includes(cambios.panel)) c.panel = cambios.panel;
  for (const campo of Object.keys(TAMANOS_PANEL)) if (tamanoValido(campo, cambios[campo])) c[campo] = cambios[campo];
  if (typeof cambios.comando_agente === 'string') c.comando_agente = cambios.comando_agente.trim();
  escribir(c);
  return c;
}
function registrarReciente(ruta, nombre) {
  const c = leer();
  c.recientes = [{ ruta, nombre, abierto: new Date().toISOString() }, ...c.recientes.filter(r => r.ruta !== ruta)].slice(0, MAX_RECIENTES);
  escribir(c);
  return c;
}
function olvidarReciente(ruta) {
  const c = leer();
  c.recientes = c.recientes.filter(r => r.ruta !== ruta);
  escribir(c);
  return c;
}
// Lo que la persona oculta del árbol de un cuaderno (carpetas o ficheros), por cuaderno. Solo en la app: no toca el
// cuaderno, ni su repo, ni Obsidian, ni al profesor. La clave es la ruta de la raíz del cuaderno.
function ocultas(raiz) {
  const l = leer().ocultas[raiz];
  return Array.isArray(l) ? l.filter(r => typeof r === 'string' && r) : [];
}
function ocultar(raiz, ruta, si) {
  const c = leer();
  const l = (Array.isArray(c.ocultas[raiz]) ? c.ocultas[raiz] : []).filter(r => r !== ruta);
  if (si) l.push(ruta);
  if (l.length) c.ocultas[raiz] = l.sort((a, b) => a.localeCompare(b, 'es')); else delete c.ocultas[raiz];
  escribir(c);
  return ocultas(raiz);
}
// El código de la URL de la app: uno por usuario, creado la primera vez y guardado en su carpeta de configuración,
// que solo él puede leer. Así la dirección no cambia al reiniciar y basta con recargar la pestaña (Roberto,
// 2026-10-09). Lo que protege de otras webs sigue siendo, además del código, la comprobación de Origin.
function token() {
  const f = path.join(carpeta(), 'token');
  try { const t = fs.readFileSync(f, 'utf8').trim(); if (/^[0-9a-f]{32}$/.test(t)) return t; } catch { /* aún no hay: se crea */ }
  fs.mkdirSync(carpeta(), { recursive: true });
  const t = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(f, t + '\n', { mode: 0o600 });
  try { fs.chmodSync(f, 0o600); } catch { /* Windows: los permisos los da la carpeta del usuario */ }
  return t;
}
// Qué cuaderno abre el arranque: la carpeta que se pasa; si no hay (y no se pidió elegir), el reciente más nuevo cuya
// carpeta aún existe; si no, ninguno (pantalla de cuadernos). Devuelve { carpeta, origen: 'argumento'|'reciente'|null }.
function cuadernoAlArrancar(argCarpeta, recientes, existe, elegir = false) {
  if (argCarpeta) return { carpeta: argCarpeta, origen: 'argumento' };
  if (elegir) return { carpeta: null, origen: null };
  const nuevos = (Array.isArray(recientes) ? recientes : []).filter(r => r && typeof r.ruta === 'string' && r.ruta)
    .sort((a, b) => String(b.abierto || '').localeCompare(String(a.abierto || '')));
  for (const r of nuevos) { let ok = false; try { ok = existe(r.ruta); } catch { /* cuenta como que no existe */ } if (ok) return { carpeta: r.ruta, origen: 'reciente' }; }
  return { carpeta: null, origen: null };
}
const apariencia = c => ({ tema: c.tema, letra: c.letra, fuente: c.fuente, comando_agente: c.comando_agente, panel: c.panel, panel_ancho: c.panel_ancho, panel_alto: c.panel_alto });

module.exports = { leer, ajustar, registrarReciente, olvidarReciente, apariencia, carpeta, ocultas, ocultar, token, cuadernoAlArrancar, POR_DEFECTO };
