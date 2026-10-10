'use strict';
// El menú de la app de escritorio (electron/menu.js), puro: etiquetas en castellano, aceleradores por plataforma, los roles
// estándar, los recientes como submenú, cada acción propia manda su nombre, y el texto del Diagnóstico con sus datos y sin
// el token. Lo que engancha a Electron (instalarMenu) se prueba con el Electron falso en electron-app.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const { plantillaMenu, textoDiagnostico, submenuRecientes, elemento, ATAJOS, NAVEGACION, RESERVADOS, CANAL, REPO, URL_COMO_SE_USA, URL_ATAJOS, URL_PLAN_VIVO } = require('../electron/menu');

// Recorre la plantilla y devuelve todos sus elementos (menús, submenús y hojas), en orden.
const todos = (plantilla, acc = []) => { for (const e of plantilla) { acc.push(e); if (Array.isArray(e.submenu)) todos(e.submenu, acc); } return acc; };
const etiquetas = plantilla => plantilla.map(e => e.label);
const roles = plantilla => todos(plantilla).map(e => e.role).filter(Boolean);
const recientes = [{ ruta: '/cuadernos/finanzas', nombre: 'Finanzas', abierto: '2026-10-10' }, { ruta: '/cuadernos/historia', nombre: 'Historia', abierto: '2026-10-01' }];
const anotador = () => { const l = []; const a = { lineas: l, acciones: { accion: n => l.push(`accion ${n}`), abrirCarpeta: r => l.push(`abrir ${r}`), atras: () => l.push('atras'), adelante: () => l.push('adelante'), comoSeUsa: () => l.push('uso'), atajos: () => l.push('atajos'), planVivo: () => l.push('plan'), mostrarRegistro: () => l.push('registro'), diagnostico: () => l.push('diagnostico'), acercaDe: () => l.push('acerca') } }; return a; };

test('en Windows y Linux: Archivo, Edición, Ver, Ventana y Ayuda, en castellano; Ajustes y Salir en Archivo; Acerca de en Ayuda', () => {
  for (const plataforma of ['win32', 'linux']) {
    const p = plantillaMenu({ plataforma, recientes, version: '0.1.0' });
    assert.deepEqual(etiquetas(p), ['Archivo', 'Edición', 'Ver', 'Ventana', 'Ayuda'], plataforma);
    assert.deepEqual(etiquetas(p[0].submenu).filter(Boolean), ['Nueva nota', 'Nueva tarea', 'Abrir nota…', 'Buscar…', 'Guardar', 'Abrir carpeta…', 'Cuadernos recientes', 'Ajustes…', 'Salir']);
    assert.equal(elemento(p, 'salir').role, 'quit');
    assert.deepEqual(etiquetas(elemento(p, 'ayuda').submenu).filter(Boolean), ['Cómo se usa Cuaderno', 'Atajos de teclado', 'Mostrar registro', 'Diagnóstico', 'Plan vivo (para quien desarrolla)', 'Acerca de Cuaderno'], 'por utilidad: uso y atajos, lo de cuando falla, el plan al final');
    assert.equal(elemento(p, 'ayuda').role, 'help');
    assert.equal(elemento(p, 'ventana').role, 'windowMenu');
  }
});

test('en Mac: el primero es el menú de la app (Acerca de, Ajustes, Servicios, ocultar, Salir de Cuaderno) y el segundo es Archivo (como en los demás sistemas), sin repetir Ajustes ni Salir', () => {
  const p = plantillaMenu({ plataforma: 'darwin', recientes, version: '0.1.0' });
  assert.deepEqual(etiquetas(p), ['Cuaderno', 'Archivo', 'Edición', 'Ver', 'Ventana', 'Ayuda']);
  assert.deepEqual(etiquetas(p[0].submenu).filter(Boolean), ['Acerca de Cuaderno', 'Ajustes…', 'Servicios', 'Ocultar Cuaderno', 'Ocultar otros', 'Mostrar todo', 'Salir de Cuaderno']);
  assert.deepEqual(roles([p[0]]), ['services', 'hide', 'hideOthers', 'unhide', 'quit']);
  assert.deepEqual(etiquetas(p[1].submenu).filter(Boolean), ['Nueva nota', 'Nueva tarea', 'Abrir nota…', 'Buscar…', 'Guardar', 'Abrir carpeta…', 'Cuadernos recientes']);
  assert.deepEqual(etiquetas(elemento(p, 'ayuda').submenu).filter(Boolean), ['Cómo se usa Cuaderno', 'Atajos de teclado', 'Mostrar registro', 'Diagnóstico', 'Plan vivo (para quien desarrolla)'], 'Acerca de va en el menú de la app');
  assert.equal(todos(p).filter(e => e.id === 'ajustes').length, 1, 'Ajustes una sola vez');
  assert.equal(todos(p).filter(e => e.id === 'salir').length, 1, 'Salir una sola vez');
});

test('los aceleradores: ⌘N nueva nota, ⌘T nueva tarea, ⌘O abrir nota, ⌘F buscar, ⌘S guardar, ⇧⌘O abrir carpeta (cambiar de cuaderno), ⌘, ajustes (Roberto, §8.1 y crítica 2026-10-10); en Ver, Ctrl \\ barra lateral y Ctrl ` terminal (Ctrl también en Mac) y ⌘[ / ⌘] atrás y adelante; la tabla ATAJOS es la fuente y ⌘K queda reservada', () => {
  assert.deepEqual(ATAJOS.map(a => [a.id, a.accelerator, a.accion, a.menu]), [
    ['nueva-nota', 'CmdOrCtrl+N', 'nueva-nota', 'archivo'], ['nueva-tarea', 'CmdOrCtrl+T', 'nueva-tarea', 'archivo'], ['abrir-nota', 'CmdOrCtrl+O', 'abrir-nota', 'archivo'], ['buscar', 'CmdOrCtrl+F', 'buscar', 'archivo'],
    ['guardar', 'CmdOrCtrl+S', 'guardar', 'archivo'], ['abrir-carpeta', 'CmdOrCtrl+Shift+O', 'abrir-carpeta', 'archivo'], ['ajustes', 'CmdOrCtrl+,', 'ajustes', 'archivo'],
    ['barra-lateral', 'Ctrl+\\', 'barra-lateral', 'ver'], ['terminal', 'Ctrl+`', 'terminal', 'ver'],
  ]);
  assert.deepEqual(NAVEGACION.map(n => [n.id, n.accelerator, n.hacer]), [['atras', 'CmdOrCtrl+[', 'atras'], ['adelante', 'CmdOrCtrl+]', 'adelante']]);
  for (const plataforma of ['darwin', 'win32', 'linux']) {
    const ver = elemento(plantillaMenu({ plataforma }), 'ver');
    assert.deepEqual(etiquetas(ver.submenu).filter(Boolean), ['Recargar', 'Atrás', 'Adelante', 'Barra lateral', 'Terminal', 'Acercar', 'Alejar', 'Tamaño real', 'Pantalla completa'], plataforma);
    for (const n of NAVEGACION) assert.equal(elemento([ver], n.id).accelerator, n.accelerator);
    assert.ok(!ATAJOS.filter(a => a.menu === 'ver').some(a => /CmdOrCtrl/.test(a.accelerator)), 'Barra lateral y Terminal llevan Ctrl explícito: ⌘` en Mac es «siguiente ventana»');
  }
  // ⌘K / Ctrl+K es de las acciones rápidas (un bloque posterior): ningún elemento del menú la lleva, en ninguna plataforma.
  assert.deepEqual(RESERVADOS, ['CmdOrCtrl+K']);
  for (const plataforma of ['darwin', 'win32', 'linux']) for (const e of todos(plantillaMenu({ plataforma, recientes }))) assert.ok(!e.accelerator || !RESERVADOS.includes(e.accelerator), `${e.label} usa ${e.accelerator}`);
  assert.ok(!ATAJOS.some(a => /\+P$/.test(a.accelerator)), 'sin «abrir página»: una nota se abre con el buscador');
  for (const plataforma of ['darwin', 'win32', 'linux']) {
    const p = plantillaMenu({ plataforma });
    for (const a of ATAJOS) { const e = elemento(p, a.id); assert.ok(e, `${a.id} en ${plataforma}`); assert.equal(e.accelerator, a.accelerator); assert.equal(e.label, a.label); }
  }
  // Ningún acelerador propio se repite ni pisa uno de los roles (Recargar, zoom, pantalla completa los pone Electron).
  const ac = ATAJOS.map(a => a.accelerator);
  assert.equal(new Set(ac).size, ac.length);
  assert.ok(!ac.some(a => /CmdOrCtrl\+(R|0|Plus|-|Z|X|C|V|A|Q|W|M|H)$/.test(a)));
});

test('cada acción propia manda su nombre por `accion`, los recientes abren su carpeta y los de Ayuda llaman a lo suyo', () => {
  const a = anotador();
  const p = plantillaMenu({ plataforma: 'linux', recientes, acciones: a.acciones });
  for (const id of ['nueva-nota', 'nueva-tarea', 'abrir-nota', 'buscar', 'guardar', 'abrir-carpeta', 'ajustes', 'barra-lateral', 'terminal']) elemento(p, id).click();
  for (const id of ['atras', 'adelante']) elemento(p, id).click();
  elemento(p, 'reciente:/cuadernos/historia').click();
  for (const id of ['como-se-usa', 'atajos', 'plan-vivo', 'mostrar-registro', 'diagnostico', 'acerca-de']) elemento(p, id).click();
  assert.deepEqual(a.lineas, ['accion nueva-nota', 'accion nueva-tarea', 'accion abrir-nota', 'accion buscar', 'accion guardar', 'accion abrir-carpeta', 'accion ajustes', 'accion barra-lateral', 'accion terminal', 'atras', 'adelante', 'abrir /cuadernos/historia', 'uso', 'atajos', 'plan', 'registro', 'diagnostico', 'acerca']);
  assert.equal(CANAL, 'accion', 'el canal que escucha el preload');
  // Sin acciones (pintar el menú sin app detrás), pulsar no falla.
  const sola = plantillaMenu({ plataforma: 'darwin', recientes });
  for (const e of todos(sola)) if (e.click) e.click();
});

test('Cuadernos recientes: un elemento por reciente, con su nombre (o el de la carpeta) y la ruta de pista, en el orden de config; sin recientes, «Sin recientes» deshabilitado; lo roto se salta', () => {
  const sub = elemento(plantillaMenu({ plataforma: 'win32', recientes }), 'recientes').submenu;
  assert.deepEqual(sub.map(e => [e.label, e.toolTip, e.enabled]), [['Finanzas', '/cuadernos/finanzas', undefined], ['Historia', '/cuadernos/historia', undefined]]);
  assert.deepEqual(submenuRecientes([]), [{ id: 'sin-recientes', label: 'Sin recientes', enabled: false }]);
  assert.deepEqual(submenuRecientes(undefined).map(e => e.label), ['Sin recientes']);
  assert.deepEqual(submenuRecientes([null, { nombre: 'sin ruta' }, { ruta: '/x/sin-nombre' }]).map(e => e.label), ['sin-nombre']);
  const abiertos = [];
  submenuRecientes([{ ruta: '/a' }], r => abiertos.push(r))[0].click();
  assert.deepEqual(abiertos, ['/a']);
});

test('Edición trae los roles estándar (sin ellos en Mac no hay copiar y pegar) y Ver recargar, zoom y pantalla completa, con etiqueta en castellano', () => {
  const p = plantillaMenu({ plataforma: 'darwin' });
  assert.deepEqual(roles([elemento(p, 'edicion')]), ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll']);
  assert.deepEqual(etiquetas(elemento(p, 'edicion').submenu).filter(Boolean), ['Deshacer', 'Rehacer', 'Cortar', 'Copiar', 'Pegar', 'Seleccionar todo']);
  assert.deepEqual(roles([elemento(p, 'ver')]), ['reload', 'zoomIn', 'zoomOut', 'resetZoom', 'togglefullscreen']);
  // Todo lo que tiene etiqueta está en castellano (sin palabras de los roles en inglés) y todo lo que no es separador tiene etiqueta o rol.
  for (const e of todos(p)) {
    if (e.type === 'separator') continue;
    assert.ok(e.label || e.role, JSON.stringify(e));
    if (e.label) assert.doesNotMatch(e.label, /\b(Edit|View|Window|Help|Quit|Undo|Redo|Cut|Copy|Paste|Reload|Zoom|Save|Open|Settings|About)\b/, e.label);
  }
});

test('el texto del Diagnóstico lleva versión, Electron, Node, Chromium, puerto, PATH y su origen, node-pty, carpeta de configuración y registro; nunca el token', () => {
  const estado = { puerto: 7331, token: 'f00d', pty: true, entorno: { origen: 'shell -lc', ms: 7, shell: '/bin/zsh', PATH: '/opt/homebrew/bin:/usr/bin' } };
  const t = textoDiagnostico({ version: '0.1.0', versiones: { electron: '44.7.0', node: '24.1.0', chrome: '140.0.0.0' }, estado, carpetaConfig: '/config/cuaderno', rutaRegistro: '/config/cuaderno/registro.log', plataforma: 'darwin', arquitectura: 'arm64', execPath: '/Applications/Cuaderno.app/Contents/MacOS/Cuaderno' });
  assert.deepEqual(t.split('\n'), [
    'Cuaderno 0.1.0',
    'Electron 44.7.0 · Node 24.1.0 · Chromium 140.0.0.0',
    'Sistema: darwin arm64',
    'Ejecutable: /Applications/Cuaderno.app/Contents/MacOS/Cuaderno',
    'Puerto del servidor: 7331',
    'node-pty cargado: sí',
    'Entorno de la shell: shell -lc (/bin/zsh, 7 ms)',
    'PATH: /opt/homebrew/bin:/usr/bin',
    'Carpeta de configuración: /config/cuaderno',
    'Registro: /config/cuaderno/registro.log',
  ]);
  assert.ok(!t.includes('f00d'));
  // Sin servidor aún, sin pty, con el respaldo porque la shell no contestó; y en Windows no hay shell que leer.
  const antes = textoDiagnostico({ versiones: {}, estado: { puerto: null, pty: null, entorno: { origen: 'respaldo', ms: 10_002, shell: '/bin/bash', error: '/bin/bash -lc: no ha contestado en 10 s', PATH: '/usr/bin' } }, plataforma: 'linux', arquitectura: 'x64', execPath: '/apps/cuaderno' });
  assert.match(antes, /^Cuaderno \(sin versión\)\nElectron \(fuera de Electron\) · Node \? · Chromium \?\n/);
  assert.match(antes, /Puerto del servidor: \(el servidor aún no escucha\)/);
  assert.match(antes, /node-pty cargado: sin saber aún/);
  assert.match(antes, /Entorno de la shell: respaldo \(\/bin\/bash, 10002 ms\) — \/bin\/bash -lc: no ha contestado en 10 s/);
  const sinPty = textoDiagnostico({ versiones: {}, estado: { pty: false, entorno: { origen: 'sistema', ms: 0, shell: null, PATH: 'C:\\Windows' } }, plataforma: 'win32', arquitectura: 'x64', execPath: 'C:\\Cuaderno.exe' });
  assert.match(sinPty, /node-pty cargado: no \(la app arranca sin terminal\)/);
  assert.match(sinPty, /Entorno de la shell: sistema\nPATH: C:\\Windows/);
  assert.match(textoDiagnostico({ versiones: {} }), /Entorno de la shell: sin resolver\nPATH: \(sin resolver\)/);
});

test('Ayuda abre páginas del repo público, sin token ni nada más en la URL: el README (cómo se usa), su sección Teclado (atajos) y el plan vivo', () => {
  assert.equal(REPO, 'https://github.com/rsotor/cuaderno-app');
  assert.equal(URL_COMO_SE_USA, 'https://github.com/rsotor/cuaderno-app#readme');
  assert.equal(URL_ATAJOS, 'https://github.com/rsotor/cuaderno-app#teclado');
  assert.equal(URL_PLAN_VIVO, 'https://github.com/rsotor/cuaderno-app/blob/main/docs/planes/plan-vivo.md');
  assert.doesNotMatch(URL_PLAN_VIVO, /[?#]/);
  for (const u of [URL_COMO_SE_USA, URL_ATAJOS, URL_PLAN_VIVO]) assert.doesNotMatch(u, /\?/);
  // La sección del README existe con ese ancla (GitHub hace el ancla del título «## Teclado»).
  assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'README.md'), 'utf8'), /^## Teclado$/m);
});

test('elemento() busca por id en cualquier nivel y devuelve null si no está', () => {
  const p = plantillaMenu({ plataforma: 'linux', recientes });
  assert.equal(elemento(p, 'reciente:/cuadernos/finanzas').label, 'Finanzas');
  assert.equal(elemento(p, 'no-existe'), null);
});
