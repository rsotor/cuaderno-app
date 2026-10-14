'use strict';
// Las piezas puras de las rutas de imagen: de un enlace Markdown a la ruta real dentro del cuaderno y a la URL con la
// que se sirve (/fichero/…). Sin DOM ni fs. Script clásico: deja `window.Imagenes` y, bajo Node, `module.exports`
// (markdown.js, tests/imagenes.test.js).
(() => {
  // Una URL (https:, data:…), una ruta absoluta o un ancla no son ficheros del cuaderno.
  const esExterna = src => /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(src);

  // El enlace → ruta dentro de la base, decodificada UNA vez (markdown-it ya la trae codificada) y normalizada desde la
  // carpeta de la nota. Un % suelto se deja tal cual. Externa → null.
  function resolver(rutaNota, src) {
    src = String(src || '');
    if (!src || esExterna(src)) return null;
    let ruta = src;
    try { ruta = decodeURIComponent(src); } catch { /* un % suelto: se queda como está */ }
    const carpeta = String(rutaNota || '').split('/').slice(0, -1);
    for (const tramo of ruta.split('/')) { if (tramo === '..') carpeta.pop(); else if (tramo && tramo !== '.') carpeta.push(tramo); }
    return carpeta.join('/');
  }

  // Ruta del cuaderno → URL con la que el servidor la sirve, con cada tramo codificado.
  const aUrl = rel => `/fichero/${String(rel).split('/').map(encodeURIComponent).join('/')}`;

  const Imagenes = { resolver, aUrl };
  if (typeof window !== 'undefined') window.Imagenes = Imagenes;
  if (typeof module !== 'undefined' && module.exports) module.exports = Imagenes;
})();
