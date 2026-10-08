'use strict';
// La configuración del usuario: igual para todos sus cuadernos y fuera de los repos. Tema, letra, fuente, el panel
// (dónde va y cuánto mide), los cuadernos recientes y lo que es de esta máquina (comando del agente sin kit). Un JSON en la carpeta de
// configuración del sistema; CUADERNO_CONFIG_DIR la cambia (los tests la ponen en una carpeta temporal).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const POR_DEFECTO = { tema: 'auto', letra: 'media', fuente: 'sistema', comando_agente: '', panel: 'derecha', panel_ancho: 420, panel_alto: 320, recientes: [] };
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
const apariencia = c => ({ tema: c.tema, letra: c.letra, fuente: c.fuente, comando_agente: c.comando_agente, panel: c.panel, panel_ancho: c.panel_ancho, panel_alto: c.panel_alto });

module.exports = { leer, ajustar, registrarReciente, olvidarReciente, apariencia, carpeta, POR_DEFECTO };
