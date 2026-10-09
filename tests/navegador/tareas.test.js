'use strict';
// Recorridos del panel Tareas: marcar una casilla, añadir con «+» desde el buscador (sin nota y con una abierta) y
// los filtros por nota, etiqueta y estado, que viven en el hash y sobreviven a recargar. En orden: cada paso
// cuenta con lo que escribió el anterior.
// Con kit: agrupar las casillas de todas las notas por nota es lo que añade el kit; sin kit el panel solo lee tareas.md
// (eso lo prueba casos.test.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { arrancar, hasta, visible, oculto, conTexto, ficheroCumple, hashCumple } = require('./ayuda');

let e;
test.before(async () => { e = await arrancar({ kit: true }); });
test.after(async () => { if (e) await e.cerrar(); });

const item = texto => e.pagina.locator('#panel .item', { hasText: texto });

test('panel Tareas: agrupa por nota y marcar una casilla escribe en tareas.md', async () => {
  await e.ir('#/tareas');
  await conTexto(e.pagina.locator('#panel h1'), /^Tareas$/, 'tareas', 'el título del panel');
  await conTexto(e.pagina.locator('#panel .resumen'), /^3 de 11 hechas\./, 'tareas', 'el recuento de hechas');
  await visible(e.pagina.locator('#panel .grupo h2 a', { hasText: 'Mis tareas' }), 'tareas', 'el grupo de tareas.md con su título');
  await visible(e.pagina.locator('#panel .grupo h2 a', { hasText: '1.1 La sesión' }), 'tareas', 'el grupo de la sesión');
  await visible(item('Repasar con capital').locator('.etiqueta', { hasText: '#repaso' }), 'tareas', 'la etiqueta #repaso pintada en su tarea');
  await visible(e.pagina.locator('.paginas a.activa', { hasText: 'Tareas' }), 'tareas', 'el enlace Tareas marcado como activo');
  await item('Comprar cuaderno').locator('input').check();
  await ficheroCumple(e.c, 'tareas.md', /\n- \[x\] Comprar cuaderno\n/, 'tareas');
  await visible(item('Comprar cuaderno').and(e.pagina.locator('.hecha')), 'tareas', 'la tarea tachada tras marcarla');
});

test('«+» en el buscador: la pista, Enter añade a tareas.md y el panel se repinta con la etiqueta', async () => {
  await e.ir('#/tareas');
  await e.pagina.keyboard.press('Control+k');
  await e.pagina.keyboard.type('+');
  await conTexto(e.pagina.locator('#arbol [role="status"]'), /Escribe la tarea después del \+/, 'buscador', 'la pista con el «+» solo');
  await e.pagina.keyboard.type('Pedir apuntes #clase');
  await conTexto(e.pagina.locator('#arbol [role="status"]'), /Enter añade la tarea: Pedir apuntes #clase/, 'buscador', 'la pista de la tarea que se va a añadir');
  assert.equal(await e.pagina.locator('#arbol a.resultado').count(), 0, 'buscador: con «+» delante no debería buscar');
  await e.pagina.keyboard.press('Enter');
  await visible(e.pagina.locator('.aviso-flotante', { hasText: 'Tarea añadida' }), 'buscador', 'el aviso «Tarea añadida»');
  await ficheroCumple(e.c, 'tareas.md', /- \[x\] Comprar cuaderno\n- \[ \] Pedir apuntes #clase\n$/, 'buscador');
  await visible(e.pagina.locator('.paginas'), 'buscador', 'Inicio/Tareas/Comentarios de vuelta tras añadir la tarea (el buscador se vacía y sale del estado «buscando»)');
  await hasta(async () => (await e.pagina.locator('#buscador').inputValue()) === '', 'buscador', 'el buscador no se vació tras añadir');
  await visible(e.pagina.locator('#arbol > .fila a.hoja'), 'buscador', 'el árbol de notas de vuelta en el lateral');   // las de la raíz: las carpetas salen plegadas
  await visible(item('Pedir apuntes').locator('.etiqueta', { hasText: '#clase' }), 'tareas', 'la tarea nueva con su etiqueta en el panel');
  await conTexto(e.pagina.locator('#n-tareas'), /^\(8\)$/, 'lateral', 'el contador de pendientes');
});

test('«+» con una nota abierta: la tarea lleva [[la nota]] al final', async () => {
  await e.ir('#/n/conceptos/interes.md');
  await conTexto(e.pagina.locator('#nota h1'), /^Interés$/, 'nota', 'el título');
  await e.pagina.keyboard.press('Control+k');
  await e.pagina.keyboard.type('+Releer esto');
  await conTexto(e.pagina.locator('#arbol [role="status"]'), /enlazada a Interés/, 'buscador', 'la pista de que la tarea irá enlazada a la nota');
  await e.pagina.keyboard.press('Enter');
  await ficheroCumple(e.c, 'tareas.md', /- \[ \] Pedir apuntes #clase\n- \[ \] Releer esto \[\[conceptos\/interes\]\]\n$/, 'buscador');
  await conTexto(e.pagina.locator('#nota h1'), /^Interés$/, 'nota', 'la nota sigue abierta tras añadir');
});

test('filtros: por nota enlazada, por etiqueta y por estado; van en el hash y sobreviven a recargar', async () => {
  await e.ir('#/tareas');
  const nota = await visible(e.pagina.locator('#filtro-nota'), 'tareas', 'el filtro por nota (hay tareas con [[enlaces]])');
  await visible(e.pagina.locator('label[for="filtro-nota"]'), 'tareas', 'la etiqueta <label> del filtro por nota');
  assert.deepEqual(await nota.locator('option').allTextContents(), ['Todas', '1.1 La sesión', 'Ana', 'Capital', 'Interés'], 'tareas: las opciones del filtro por nota no son los títulos de las notas enlazadas');
  await nota.focus(); await nota.selectOption('interes');   // como con el teclado: el foco está en el control al cambiarlo
  await hashCumple(e.pagina, /^#\/tareas\?nota=interes$/, 'tareas');
  await visible(item('Releer esto'), 'tareas · filtro nota', 'la tarea enlazada a Interés');
  await oculto(item('Comprar cuaderno'), 'tareas · filtro nota', 'una tarea sin enlace');
  await visible(item('Leer interes'), 'tareas · filtro nota', 'la tarea de la sesión que enlaza a Interés');
  await oculto(e.pagina.locator('#panel .grupo:has(h2 a[title="conceptos/interes.md"])'), 'tareas · filtro nota', 'el grupo de Interés, sin tareas que cumplan');
  await conTexto(e.pagina.locator('#filtro-resumen'), /^2 de 13 tareas$/, 'tareas · filtro nota', 'el resumen del filtro');
  assert.equal(await e.pagina.evaluate(() => document.activeElement && document.activeElement.id), 'filtro-nota', 'tareas: el foco se fue del control al filtrar');

  await nota.selectOption('');
  const etiqueta = await visible(e.pagina.locator('#filtro-etiqueta'), 'tareas', 'el filtro por etiqueta');
  assert.deepEqual(await etiqueta.locator('option').allTextContents(), ['Todas', '#Ana', '#clase', '#mudanza', '#repaso', '#tema/dinero']);
  await etiqueta.selectOption('clase');
  await hashCumple(e.pagina, /^#\/tareas\?etiqueta=clase$/, 'tareas');
  await visible(item('Pedir apuntes'), 'tareas · filtro etiqueta', 'la tarea con #clase');
  await oculto(item('Releer esto'), 'tareas · filtro etiqueta', 'una tarea sin esa etiqueta');

  await etiqueta.selectOption('');
  await e.pagina.locator('#filtro-estado').selectOption('hechas');
  await hashCumple(e.pagina, /^#\/tareas\?estado=hechas$/, 'tareas');
  await visible(item('Comprar cuaderno'), 'tareas · hechas', 'la tarea marcada antes');
  await visible(item('Hecho ya'), 'tareas · hechas', 'la tarea hecha de la sesión');
  await oculto(item('Pedir apuntes'), 'tareas · hechas', 'una tarea pendiente');
  await conTexto(e.pagina.locator('#filtro-resumen'), /^4 de 13 tareas$/, 'tareas · hechas', 'el resumen');

  await e.pagina.reload();
  await visible(e.pagina.locator('#filtro-estado'), 'tareas tras recargar', 'los filtros');
  assert.equal(await e.pagina.locator('#filtro-estado').inputValue(), 'hechas', 'tareas tras recargar: el filtro de estado no se conservó');
  await oculto(item('Pedir apuntes'), 'tareas tras recargar', 'una tarea pendiente con el filtro «hechas»');
  await visible(e.pagina.locator('.paginas a.activa', { hasText: 'Tareas' }), 'tareas tras recargar', 'el enlace Tareas activo con filtros en el hash');

  // Recordados: salir a otra pantalla y volver por la barra lateral recupera el filtro.
  const volverATareas = async () => { await e.ir('#/'); await e.pagina.locator('.paginas a', { hasText: 'Tareas' }).click(); };
  await volverATareas();
  await hashCumple(e.pagina, /^#\/tareas\?estado=hechas$/, 'tareas recordadas');
  assert.equal(await e.pagina.locator('#filtro-estado').inputValue(), 'hechas', 'tareas recordadas: el select no recuperó «hechas»');

  await e.pagina.locator('#filtro-quitar').click();
  await hashCumple(e.pagina, /^#\/tareas$/, 'tareas');
  await visible(item('Pedir apuntes'), 'tareas sin filtros', 'todas las tareas de vuelta');
  await oculto(e.pagina.locator('#filtro-quitar'), 'tareas sin filtros', 'el botón «Quitar filtros»');

  await volverATareas();   // tras «Quitar filtros», nada que recordar
  await hashCumple(e.pagina, /^#\/tareas$/, 'tareas olvidadas');
  assert.equal(await e.pagina.locator('#filtro-estado').inputValue(), 'todas', 'tareas olvidadas: quedó un filtro de estado');
});

test('a 390 px el panel con filtros no desborda', async () => {
  await e.pagina.setViewportSize({ width: 390, height: 844 });
  try {
    await e.ir('#/tareas?etiqueta=clase');
    await visible(e.pagina.locator('#filtro-etiqueta'), 'tareas estrecho', 'los filtros');
    const ancho = await e.pagina.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth, document.querySelector('#centro').scrollWidth, document.querySelector('#centro').clientWidth]);
    assert.ok(ancho[0] <= ancho[1] && ancho[2] <= ancho[3], `tareas estrecho: hay desplazamiento horizontal (${ancho.join(' / ')})`);
  } finally { await e.pagina.setViewportSize({ width: 1280, height: 800 }); }
});
