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

  const EXTENSIONES = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'];
  // Carpetas de imágenes que se reutilizan si ya están junto a la nota, en este orden; si no hay ninguna, la primera por defecto
  // es imagenes (la del plan, P4).
  const CARPETAS = ['attachments', 'adjuntos', 'imagenes', 'images', 'assets'];
  const TOPE_IMAGEN = 25 * 1024 * 1024;

  // Ruta del cuaderno de la imagen → enlace Markdown relativo a la carpeta de la nota (con ../ si hace falta). Solo se
  // codifica lo que rompe un enlace o una URL; los acentos se quedan.
  const CODIGOS = { '%': '%25', ' ': '%20', '(': '%28', ')': '%29', '<': '%3C', '>': '%3E', '#': '%23', '?': '%3F' };
  function enlaceDe(rutaNota, rel) {
    const desde = String(rutaNota || '').split('/').slice(0, -1), a = String(rel).split('/');
    let i = 0;
    while (i < desde.length && i < a.length - 1 && desde[i] === a[i]) i++;
    const tramos = [...desde.slice(i).map(() => '..'), ...a.slice(i)];
    return tramos.map(t => t.replace(/[% ()<>#?]/g, c => CODIGOS[c])).join('/');
  }

  // Un nombre de fichero que vale en cualquier sistema: sin \ / : * ? " < > |, espacios colapsados, sin punto delante.
  function limpiarNombre(nombre) {
    const limpio = String(nombre || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
    if (!limpio) return 'imagen';
    if (limpio.startsWith('.')) return `imagen${(limpio.match(/\.[^.]*$/) || [''])[0]}`;
    return limpio;
  }

  // x.png, x-2.png, x-3.png… el primero que `existe` no da por ocupado.
  function libre(nombre, existe) {
    if (!existe(nombre)) return nombre;
    const punto = nombre.lastIndexOf('.'), base = punto > 0 ? nombre.slice(0, punto) : nombre, ext = punto > 0 ? nombre.slice(punto) : '';
    for (let n = 2; ; n++) if (!existe(`${base}-${n}${ext}`)) return `${base}-${n}${ext}`;
  }

  // Cambia en el texto cada enlace `](viejo)` o `](viejo "título")` por el suyo del mapa viejo → nuevo, en UNA sola pasada
  // (plan, P12): con captura.png → captura-2.png y captura-2.png → captura-3.png, dos reemplazos seguidos mandarían los dos
  // enlaces a captura-3.png. Las claves más largas primero, por si una es el principio de otra.
  function sustituirEnlaces(texto, mapa) {
    if (!mapa.size) return texto;
    const claves = [...mapa.keys()].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return texto.replace(new RegExp(`\\]\\((${claves.join('|')})(?=\\)| ")`, 'g'), (_, viejo) => `](${mapa.get(viejo)}`);
  }

  const Imagenes = { resolver, aUrl, enlaceDe, limpiarNombre, libre, sustituirEnlaces, EXTENSIONES, CARPETAS, TOPE_IMAGEN };
  if (typeof window !== 'undefined') window.Imagenes = Imagenes;
  if (typeof module !== 'undefined' && module.exports) module.exports = Imagenes;
})();
