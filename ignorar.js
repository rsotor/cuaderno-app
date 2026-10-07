'use strict';
// Filtro de ficheros con la sintaxis de .gitignore (la misma que usa .obsidianignore): comodines, `!` para volver a
// incluir, `/` delante para anclar a la raíz del fichero de reglas, `/` detrás para solo carpetas. El último patrón
// que casa manda, como en git. Sin dependencias: lo que necesitan los dos ficheros, no todo git.
const fs = require('node:fs');
const path = require('node:path');

function compilar(linea) {
  let p = linea.replace(/\r$/, '');
  if (!p.trim() || p.startsWith('#')) return null;
  p = p.replace(/\s+$/, '');
  let negado = false, soloCarpeta = false, anclado = false;
  if (p.startsWith('!')) { negado = true; p = p.slice(1); }
  if (p.endsWith('/')) { soloCarpeta = true; p = p.slice(0, -1); }
  if (p.startsWith('/')) { anclado = true; p = p.slice(1); }
  else if (p.includes('/')) anclado = true;   // una barra en medio también ancla (regla de git)
  let re = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*') {
      if (p[i + 1] === '*') {
        if (p[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  const regex = new RegExp(`^${anclado ? '' : '(?:.*/)?'}${re}$`);
  return { negado, soloCarpeta, regex };
}

function leerReglas(fichero) {
  if (!fs.existsSync(fichero)) return [];
  return fs.readFileSync(fichero, 'utf8').split('\n').map(compilar).filter(Boolean);
}

// Devuelve ignorado(abs, esCarpeta) → true si alguna lista de reglas lo deja fuera. Cada fichero de reglas
// se aplica sobre las rutas relativas a su propia carpeta. `node_modules` y lo que empieza por punto se saltan
// siempre: nunca son notas y, en una bóveda grande, recorrerlos es lo que la hace lenta.
function crearFiltro(ficherosDeReglas) {
  const listas = ficherosDeReglas.map(f => ({ base: path.dirname(path.resolve(f)), reglas: leerReglas(f) })).filter(l => l.reglas.length);
  return (abs, esCarpeta) => {
    const nombre = path.basename(abs);
    if (nombre === 'node_modules' || nombre.startsWith('.')) return true;
    for (const { base, reglas } of listas) {
      const rel = path.relative(base, abs).split(path.sep).join('/');
      if (rel.startsWith('..')) continue;
      let ignorado = false;
      for (const r of reglas) {
        if (r.soloCarpeta && !esCarpeta) continue;
        if (r.regex.test(rel)) ignorado = !r.negado;
      }
      if (ignorado) return true;
    }
    return false;
  };
}

module.exports = { crearFiltro, compilar };
