'use strict';
// Qué es la carpeta que se abre: un cuaderno con kit (tiene motor), una salida del kit sin motor, o una carpeta
// de notas cualquiera. La app no decide nada del curso: aquí solo mira qué hay y qué comando abre al profesor.
const fs = require('node:fs');
const path = require('node:path');

const CARPETA_ALUMNO = 'estudio';   // la carpeta que el alumno abre en Obsidian (lib/vault.js del kit)
const LLM_POR_DEFECTO = 'claude-code';

function leerJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }

// El comando que abre al profesor, como lo resuelve el kit: config/adaptador-llm.json si es del LLM elegido en
// config/ajustes.json; si no, .kit/adaptadores/<llm>.json. Sin ninguno, null (la app lo dice, no lo inventa).
function comandoDelProfesor(raiz) {
  const ajustes = leerJson(path.join(raiz, 'config', 'ajustes.json')) || {};
  const llm = ajustes.llm || LLM_POR_DEFECTO;
  const local = leerJson(path.join(raiz, 'config', 'adaptador-llm.json'));
  if (local && local.id === llm && local.comando) return local.comando;
  const delKit = leerJson(path.join(raiz, '.kit', 'adaptadores', `${llm}.json`));
  return (delKit && delKit.comando) || null;
}

// { tipo: 'kit' | 'salida-sin-motor' | 'carpeta', base: carpeta de las notas, comando, motor }
function detectar(raiz) {
  raiz = path.resolve(raiz);
  const motor = leerJson(path.join(raiz, '.kit', 'motor.json'));
  const hayEstudio = fs.existsSync(path.join(raiz, CARPETA_ALUMNO));
  const hayConfig = fs.existsSync(path.join(raiz, 'config'));
  if (motor) return { tipo: 'kit', base: path.join(raiz, CARPETA_ALUMNO), comando: comandoDelProfesor(raiz), motor };
  if (hayEstudio && hayConfig) return { tipo: 'salida-sin-motor', base: path.join(raiz, CARPETA_ALUMNO), comando: null, motor: null };
  return { tipo: 'carpeta', base: raiz, comando: null, motor: null };
}

module.exports = { detectar, comandoDelProfesor, CARPETA_ALUMNO };
