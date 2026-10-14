'use strict';
// Imágenes en el editor de la nota (plan docs/planes/imagenes-editor.md, T5): el editor las pinta, también en
// «Markdown plano», y las pendientes (todavía sin copiar al cuaderno) se ven desde la memoria. Sin kit: es la base.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { arrancar, hasta, visible, oculto } = require('./ayuda');

let e;
test.before(async () => { e = await arrancar({ kit: false }); });
test.after(async () => { if (e) await e.cerrar(); });

const NOTA = 'insertar-imagen/con-attachments/nota.md';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';   // 1×1

const ajustarEditor = async (valor, ruta) => {
  await e.ir('#/');
  await e.pagina.evaluate(v => fetch('/api/configuracion', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ editor: v }) }), valor);
  await e.ir(`#/n/${ruta}`);
};
const lineaCm = n => e.pagina.locator('#edicion-cm .cm-line').nth(n);
const textoLinea = n => lineaCm(n).evaluate(l => l.textContent);
const abrirEditor = async () => { await e.pagina.locator('#btn-editar').click(); await visible(e.pagina.locator('#edicion-cm .cm-content'), 'editor', 'el editor de la nota'); };
const cargada = loc => loc.evaluate(i => i.complete && i.naturalWidth > 0);
const salir = async () => {
  await e.pagina.keyboard.press('Escape');
  if (await e.pagina.locator('#descartar').isVisible()) await e.pagina.locator('#descartar-ok').click();
  await oculto(e.pagina.locator('#edicion-cm'), 'editor', 'el editor tras salir');
};
// El texto con todo lo que hay que ver: el crudo, una línea en blanco y un enlace roto.
const NOTA_ROTA = '# Imágenes\n\nPrimera ![Mi captura](attachments/Mi%20captura.png) en línea.\n\n![Perdida](attachments/no-existe.png)\n\nÚltima línea.\n';

test('imágenes: el editor pinta la imagen fuera de la línea del cursor y enseña el crudo con ella en la del cursor', async () => {
  await ajustarEditor('vista', NOTA);
  await abrirEditor();
  // Con el cursor en otra línea (el editor abre en la primera): la imagen y ni rastro del enlace.
  await e.pagina.keyboard.press('ArrowUp'); await e.pagina.keyboard.press('ArrowUp');
  const img = e.pagina.locator('#edicion-cm .cm-content img.live-imagen');
  await visible(img, 'imágenes', 'la imagen del editor');
  await hasta(() => cargada(img.first()), 'imágenes', 'la imagen no carga (naturalWidth 0)');
  assert.equal(await e.pagina.locator('#edicion-cm .cm-content').evaluate(c => c.textContent.includes('](')), false, 'imágenes: fuera de su línea no debe verse el enlace');
  assert.match(await img.first().getAttribute('src'), /^\/fichero\/insertar-imagen\/con-attachments\/attachments\/Mi%20captura\.png$/);
  // Flecha hasta su línea: el crudo y, detrás, la imagen.
  await e.pagina.keyboard.press('ArrowDown'); await e.pagina.keyboard.press('ArrowDown');
  await hasta(async () => (await e.pagina.locator('#edicion-cm .cm-content').evaluate(c => c.textContent)).includes('![Mi captura](attachments/Mi%20captura.png)'), 'imágenes', 'en la línea del cursor no sale el crudo');
  assert.equal(await img.count(), 1, 'imágenes: en la línea del cursor la imagen debe seguir a la vista');
  await hasta(() => cargada(img.first()), 'imágenes', 'la imagen de la línea del cursor no carga');
  await salir();
});

test('imágenes: Markdown plano también enseña la imagen, con el crudo delante en todas las líneas y sin otros widgets', async () => {
  fs.writeFileSync(path.join(e.c.base, 'insertar-imagen/con-attachments/plana.md'), NOTA_ROTA + '\n- [ ] Una casilla\n\n**negrita**\n');
  await ajustarEditor('plano', 'insertar-imagen/con-attachments/plana.md');
  try {
    await abrirEditor();
    const img = e.pagina.locator('#edicion-cm .cm-content img.live-imagen');
    await visible(img, 'plano', 'la imagen en el modo plano');
    await hasta(() => cargada(img.first()), 'plano', 'la imagen no carga');
    const contenido = await e.pagina.locator('#edicion-cm .cm-content').evaluate(c => c.textContent);
    assert.ok(contenido.includes('![Mi captura](attachments/Mi%20captura.png)'), 'plano: falta el crudo de la imagen');
    assert.ok(contenido.includes('![Perdida](attachments/no-existe.png)'), 'plano: falta el crudo de la imagen perdida');
    for (const c of ['.live-activa', '.live-casilla', '.live-negrita', '.live-h1', '.live-vineta', '.live-bloque']) assert.equal(await e.pagina.locator(`#edicion-cm ${c}`).count(), 0, `plano: no debe haber ${c}`);
    await salir();
  } finally { await ajustarEditor('vista', 'insertar-imagen/con-attachments/plana.md'); }
});

test('imágenes: un enlace a una imagen que no está enseña el texto alternativo en una caja rota, con la ruta en el title', async () => {
  fs.writeFileSync(path.join(e.c.base, 'insertar-imagen/con-attachments/rota.md'), NOTA_ROTA);
  await ajustarEditor('vista', 'insertar-imagen/con-attachments/rota.md');
  await abrirEditor();
  await e.pagina.keyboard.press('ArrowDown'); await e.pagina.keyboard.press('ArrowDown'); await e.pagina.keyboard.press('ArrowDown'); await e.pagina.keyboard.press('ArrowDown'); await e.pagina.keyboard.press('ArrowDown');
  const rota = e.pagina.locator('#edicion-cm .live-imagen-rota');
  await visible(rota, 'imágenes', 'la caja de la imagen que no está');
  assert.equal((await rota.first().textContent()).trim(), 'Perdida');
  assert.equal(await rota.first().getAttribute('title'), 'No se encuentra: insertar-imagen/con-attachments/attachments/no-existe.png');
  await salir();
});

test('imágenes: una imagen pendiente se ve desde la memoria (blob:), sale en pendientes() mientras el texto la enlaza, y salir revoca la URL', async () => {
  await ajustarEditor('vista', 'insertar-imagen/sin-carpeta/nota.md');
  await abrirEditor();
  await e.pagina.evaluate(() => { window.__revocadas = []; const r = URL.revokeObjectURL; URL.revokeObjectURL = u => { window.__revocadas.push(u); r.call(URL, u); }; });
  const meter = png => e.pagina.evaluate(async b64 => {
    const live = await import('/public/live.js');
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    live.insertarImagenes([{ enlace: 'imagenes/Mi%20captura.png', alt: 'Mi captura', pendiente: { ruta: 'insertar-imagen/sin-carpeta/imagenes/Mi captura.png', blob: new Blob([bytes], { type: 'image/png' }) } }], live.texto().length);
    return live.texto();
  }, png);
  const texto = await meter(PNG);
  assert.ok(texto.endsWith('![Mi captura](imagenes/Mi%20captura.png)'), `insertar: el texto es «${texto}»`);
  const img = e.pagina.locator('#edicion-cm .cm-content img.live-imagen');
  await visible(img, 'imágenes', 'la imagen pendiente');
  assert.match(await img.first().getAttribute('src'), /^blob:/);
  await hasta(() => cargada(img.first()), 'imágenes', 'la imagen pendiente no carga');
  const pend = () => e.pagina.evaluate(async () => (await import('/public/live.js')).pendientes().map(p => ({ enlace: p.enlace, ruta: p.ruta })));
  assert.deepEqual(await pend(), [{ enlace: 'imagenes/Mi%20captura.png', ruta: 'insertar-imagen/sin-carpeta/imagenes/Mi captura.png' }]);
  // Quitar el enlace del texto: ya no está pendiente.
  await e.pagina.keyboard.press('ControlOrMeta+a'); await e.pagina.keyboard.type('nada');
  assert.deepEqual(await pend(), [], 'pendientes: sin enlace en el texto no debe salir');
  await e.pagina.keyboard.press('ControlOrMeta+a'); await e.pagina.keyboard.type('![x](imagenes/Mi%20captura.png "t")');
  assert.equal((await pend()).length, 1, 'pendientes: el enlace con título también cuenta');
  await salir();
  const revocadas = await e.pagina.evaluate(() => window.__revocadas);
  assert.equal(revocadas.length, 1, `destruir: debía revocar la URL; revocadas: ${revocadas}`);
  assert.match(revocadas[0], /^blob:/);
  assert.equal(fs.existsSync(path.join(e.c.base, 'insertar-imagen/sin-carpeta/imagenes')), false, 'descartar: no debe quedar la carpeta imagenes/');
});

test('imágenes: soltar ficheros sobre el editor llama a alSoltarFicheros; arrastrar texto no', async () => {
  await ajustarEditor('vista', 'insertar-imagen/sin-carpeta/nota.md');
  await abrirEditor();
  const r = await e.pagina.evaluate(async () => {
    const live = await import('/public/live.js');
    const cm = document.querySelector('#edicion-cm .cm-content');
    live.montar(document.querySelector('#edicion-cm'), 'uno\n', { alSoltarFicheros: (ficheros, pos) => { window.__soltados = { nombres: ficheros.map(f => f.name), pos }; } });
    const montado = document.querySelector('#edicion-cm .cm-content');
    const evento = (tipo, ficheros) => {
      const dt = new DataTransfer();
      for (const f of ficheros) dt.items.add(f);
      if (!ficheros.length) dt.setData('text/plain', 'texto');
      const ev = new DragEvent(tipo, { dataTransfer: dt, bubbles: true, cancelable: true, clientX: 5, clientY: 5 });
      montado.dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    const f = new File(['x'], 'a.png', { type: 'image/png' });
    return { cm: !!cm, dragoverFicheros: evento('dragover', [f]), dropFicheros: evento('drop', [f]), soltados: window.__soltados || null, dragoverTexto: evento('dragover', []) };
  });
  assert.equal(r.dragoverFicheros, true, 'dragover con ficheros debe hacer preventDefault');
  assert.equal(r.dropFicheros, true, 'drop con ficheros debe hacer preventDefault');
  assert.deepEqual(r.soltados.nombres, ['a.png']);
  assert.equal(typeof r.soltados.pos, 'number');
  assert.equal(r.dragoverTexto, false, 'dragover con solo texto no debe tocarse');
  await salir();
});

// ---------- T6: meter una imagen (botón «Imagen» y arrastrar)
// Una PNG en una carpeta temporal FUERA del cuaderno (como Descargas); `borrar` la quita tras el test.
const fuera = [];
const pngFuera = (nombre, relleno = '') => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-img-'));
  fuera.push(dir);
  const ruta = path.join(dir, nombre);
  fs.writeFileSync(ruta, Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.from(relleno)]));
  return ruta;
};
test.after(() => { for (const d of fuera) fs.rmSync(d, { recursive: true, force: true }); });
const listar = rel => { try { return fs.readdirSync(path.join(e.c.base, rel)).sort(); } catch { return null; } };
const textoEditor = () => e.pagina.evaluate(async () => (await import('/public/live.js')).texto());
const aviso = texto => visible(e.pagina.locator('.aviso-flotante', { hasText: texto }), 'imágenes', `el aviso «${texto}»`);
const cerrarAvisos = () => e.pagina.evaluate(() => document.querySelectorAll('.aviso-flotante').forEach(a => a.remove()));
// Suelta ficheros sintéticos sobre el editor. `ficheros`: [{ nombre, b64?, tam? }]; el punto, el inicio de la línea `linea`.
const soltar = (ficheros, linea) => e.pagina.evaluate(async ({ ficheros, linea, PNG }) => {
  const dt = new DataTransfer();
  for (const f of ficheros) {
    const bytes = f.tam ? new Uint8Array(f.tam) : Uint8Array.from(atob(f.b64 || PNG), c => c.charCodeAt(0));
    dt.items.add(new File([bytes], f.nombre, { type: 'image/png', lastModified: f.modificado || 1 }));
  }
  const l = document.querySelectorAll('#edicion-cm .cm-line')[linea].getBoundingClientRect();
  document.querySelector('#edicion-cm .cm-content').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: l.left + 1, clientY: l.top + l.height / 2 }));
}, { ficheros, linea, PNG });

test('imágenes: el botón Imagen mete la imagen de fuera con el enlace definitivo, la ve y no toca el disco hasta aplicar', async () => {
  const antes = listar('insertar-imagen/con-attachments/attachments');
  await ajustarEditor('vista', NOTA);
  await abrirEditor();
  const b = e.pagina.locator('.edicion-barra button[data-formato="imagen"]');
  await visible(b, 'imágenes', 'el botón Imagen');
  assert.equal(await b.getAttribute('aria-label'), 'Imagen');
  assert.equal(await b.getAttribute('aria-pressed'), null, 'el botón Imagen no es de formato: sin aria-pressed');
  assert.match(await b.getAttribute('title'), /arrástrala/);
  const png = pngFuera('Mi captura.png');
  await e.pagina.locator('#imagen-fichero').setInputFiles(png);
  await hasta(async () => (await textoEditor()).includes('![Mi captura](attachments/Mi%20captura-2.png)'), 'imágenes', 'el texto no lleva el enlace definitivo (-2: el del ejemplo ocupa el nombre)');
  // (3) borrar la PNG de fuera: la imagen sigue a la vista (viene de la memoria)
  fs.rmSync(png);
  await e.pagina.keyboard.press('ControlOrMeta+End');
  const img = e.pagina.locator('#edicion-cm .cm-content img.live-imagen[src^="blob:"]');
  await visible(img, 'imágenes', 'la imagen pendiente');
  await hasta(() => cargada(img.first()), 'imágenes', 'la imagen pendiente no carga');
  assert.deepEqual(listar('insertar-imagen/con-attachments/attachments'), antes, 'el disco no debe cambiar hasta aplicar');
  // aparte: el botón no se marca como pulsado tras el clic en el editor
  assert.equal(await b.getAttribute('aria-pressed'), null);
  await salir();
});

test('imágenes: sin carpeta de imágenes, la imagen va a imagenes/ en el enlace y la carpeta no existe hasta aplicar; la misma imagen dos veces es el mismo enlace; descartar no deja nada', async () => {
  const dir = 'insertar-imagen/sin-carpeta';
  await ajustarEditor('vista', `${dir}/nota.md`);
  await abrirEditor();
  const png = pngFuera('foto.png');
  await e.pagina.locator('#imagen-fichero').setInputFiles(png);
  await hasta(async () => (await textoEditor()).includes('![foto](imagenes/foto.png)'), 'imágenes', 'falta ![foto](imagenes/foto.png)');
  assert.equal(listar(`${dir}/imagenes`), null, 'la carpeta imagenes/ no debe existir hasta aplicar');
  await e.pagina.locator('#imagen-fichero').setInputFiles(png);
  await hasta(async () => ((await textoEditor()).match(/\]\(imagenes\/foto\.png\)/g) || []).length === 2, 'imágenes', 'la misma imagen dos veces debe dar el mismo enlace (sin -2)');
  assert.ok(!(await textoEditor()).includes('foto-2'), 'la misma imagen no debe dar -2');
  await salir();
  assert.equal(listar(`${dir}/imagenes`), null, 'descartar: no debe quedar imagenes/');
  assert.deepEqual(listar(dir), ['nota.md'], 'descartar: ni ficheros nuevos');
});

test('imágenes: soltar ficheros sobre el editor los inserta donde se sueltan; lo que no es imagen o pasa del tope avisa y no inserta; dos con el mismo nombre no chocan', async () => {
  await ajustarEditor('vista', 'insertar-imagen/sin-carpeta/nota.md');
  await abrirEditor();
  await e.pagina.keyboard.press('ArrowDown'); await e.pagina.keyboard.press('ArrowDown');   // el cursor a la línea del párrafo
  const original = await textoEditor();
  // Un .txt: aviso y nada insertado.
  await e.pagina.evaluate(async () => {
    const dt = new DataTransfer(); dt.items.add(new File(['x'], 'notas.txt', { type: 'text/plain' }));
    document.querySelector('#edicion-cm .cm-content').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
  });
  await aviso('Solo imágenes');
  assert.equal(await textoEditor(), original, 'un .txt no debe insertar nada');
  await cerrarAvisos();
  // Pasa del tope: aviso y nada insertado.
  await soltar([{ nombre: 'grande.png', tam: 25 * 1024 * 1024 + 1 }], 0);
  await aviso('grande.png pasa de 25 MB');
  assert.equal(await textoEditor(), original, 'una imagen de más de 25 MB no debe insertarse');
  await cerrarAvisos();
  // Dos con el mismo nombre (contenidos distintos) soltadas juntas, al principio de la línea del párrafo (la 3.ª).
  await soltar([{ nombre: 'captura.png', modificado: 1 }, { nombre: 'captura.png', modificado: 2 }], 2);
  await hasta(async () => (await textoEditor()).includes('\n\n![captura](imagenes/captura.png)\n![captura](imagenes/captura-2.png)Una nota con solo texto'), 'imágenes', `dos captura.png soltadas juntas no dieron captura y captura-2; texto: ${await textoEditor()}`);
  assert.equal(listar('insertar-imagen/sin-carpeta/imagenes'), null);
  await salir();
});

test('imágenes: con el editor abierto, soltar ficheros fuera del editor no navega (preventDefault en document); un arrastre de texto no se toca', async () => {
  await ajustarEditor('vista', 'insertar-imagen/sin-carpeta/nota.md');
  await abrirEditor();
  const r = await e.pagina.evaluate(() => {
    const lanzar = (tipo, ficheros) => {
      const dt = new DataTransfer();
      if (ficheros) dt.items.add(new File(['x'], 'a.png', { type: 'image/png' })); else dt.setData('text/plain', 'texto');
      const ev = new DragEvent(tipo, { dataTransfer: dt, bubbles: true, cancelable: true });
      document.body.dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    return { dragover: lanzar('dragover', true), drop: lanzar('drop', true), dragoverTexto: lanzar('dragover', false), dropTexto: lanzar('drop', false) };
  });
  assert.deepEqual(r, { dragover: true, drop: true, dragoverTexto: false, dropTexto: false });
  await salir();
  // Sin editor abierto, la app no toca el arrastre.
  const fuera = await e.pagina.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(['x'], 'a.png')); const ev = new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }); document.body.dispatchEvent(ev); return ev.defaultPrevented; });
  assert.equal(fuera, false, 'sin editor abierto no se debe cancelar el arrastre');
});
