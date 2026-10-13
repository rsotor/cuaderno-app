'use strict';
// Las piezas puras de la búsqueda en modal: convertir la respuesta de /api/buscar?por-nota=1 en filas, limpiar el
// fragmento de sintaxis y resaltar. Sin DOM. Script clásico: deja `window.Busqueda` y, bajo Node, `module.exports`
// (tests/busqueda.test.js). El DOM de la modal está en app.js.
(() => {
  const quitarAcentos = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nombreDe = ruta => ruta.split('/').pop().replace(/\.md$/, '');
  const carpetaDe = ruta => ruta.split('/').slice(0, -1).join('/');

  // De una línea del cuaderno al texto que se ve: sin `> [!tipo] `, casillas, títulos, wikilinks, enlaces ni énfasis.
  function limpiarFragmento(texto) {
    return String(texto)
      .replace(/^\s*(?:>\s*)+(?:\[![\w-]+\][+-]?\s*)?/, '')
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s+/, '')
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
      .replace(/^\s*#{1,6}\s+/, '')
      .replace(/!?\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
      .replace(/!?\[\[([^\]]*)\]\]/g, '$1')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\*\*|__/g, '')
      .replace(/(^|[^\w])\*([^*]+)\*(?=[^\w]|$)/g, '$1$2')
      .replace(/(^|[^\w])_([^_]+)_(?=[^\w]|$)/g, '$1$2')
      .replace(/`/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  // La respuesta del servidor → { filas, hayMas }. Una fila por nota: { ruta, nombre, carpeta, fragmento, linea, porNombre }.
  // `porNombre` es «coincide por nombre, título o carpeta» (las que van primero); `titulos` es ruta → título.
  function filas(respuesta, q, titulos = {}) {
    const nq = quitarAcentos(String(q || '').trim());
    const lineaDe = new Map();
    for (const l of respuesta.lineas || []) if (!lineaDe.has(l.ruta)) lineaDe.set(l.ruta, l);
    const fila = (ruta, porNombre) => {
      const l = lineaDe.get(ruta), nombre = nombreDe(ruta), carpeta = carpetaDe(ruta), titulo = titulos[ruta];
      const nombreCoincide = quitarAcentos(nombre).includes(nq);
      const tituloCoincide = !!titulo && quitarAcentos(titulo).includes(nq);
      let fragmento = '', linea = null;
      if (l) { fragmento = limpiarFragmento(l.texto); linea = l.linea; }
      // Coincide por título y no por nombre: el título es lo que explica por qué sale (la línea, si la hay, sería otra cosa, p. ej. el frontmatter).
      if (porNombre && !nombreCoincide && tituloCoincide) fragmento = titulo;
      else if (porNombre && !nombreCoincide && !tituloCoincide && !l) fragmento = `en la carpeta ${carpeta}`;
      return { ruta, nombre, carpeta, fragmento, linea, porNombre };
    };
    const hechas = new Map();
    for (const ruta of respuesta.ficheros || []) hechas.set(ruta, fila(ruta, true));
    for (const ruta of lineaDe.keys()) if (!hechas.has(ruta)) hechas.set(ruta, fila(ruta, false));
    return { filas: [...hechas.values()], hayMas: !!respuesta.cortado };
  }

  // HTML seguro: el texto escapado con las coincidencias de q en <mark>, sin distinguir acentos ni mayúsculas.
  function resaltar(texto, q) {
    const chars = [...String(texto)];
    const nq = quitarAcentos(String(q || '').trim());
    if (!nq) return esc(chars.join(''));
    // Texto normalizado y, para cada carácter suyo, el índice del original (la normalización puede cambiar el largo).
    let norm = ''; const mapa = [];
    chars.forEach((c, i) => { const n = quitarAcentos(c); for (let k = 0; k < n.length; k++) mapa.push(i); norm += n; });
    let salida = '', pos = 0;
    for (let desde = 0; ;) {
      const ini = norm.indexOf(nq, desde);
      if (ini < 0) break;
      const a = mapa[ini], b = mapa[ini + nq.length - 1] + 1;
      if (a < pos) { desde = ini + 1; continue; }
      salida += `${esc(chars.slice(pos, a).join(''))}<mark>${esc(chars.slice(a, b).join(''))}</mark>`;
      pos = b; desde = ini + nq.length;
    }
    return salida + esc(chars.slice(pos).join(''));
  }

  // Un fragmento largo, recortado alrededor de la primera coincidencia, con «…» donde falta texto.
  function recortar(texto, q, max = 90) {
    texto = String(texto);
    if (texto.length <= max) return texto;
    const i = quitarAcentos(texto).indexOf(quitarAcentos(String(q || '').trim()));
    const ini = Math.max(0, (i < 0 ? 0 : i) - 30);
    return `${ini > 0 ? '…' : ''}${texto.slice(ini, ini + max).trim()}${ini + max < texto.length ? '…' : ''}`;
  }

  const Busqueda = { filas, limpiarFragmento, resaltar, recortar, quitarAcentos };
  if (typeof window !== 'undefined') window.Busqueda = Busqueda;
  if (typeof module !== 'undefined' && module.exports) module.exports = Busqueda;
})();
