'use strict';
// El menú de la app de escritorio (electron/menu.js), puro: etiquetas en castellano, aceleradores por plataforma, los roles
// estándar, los recientes como submenú, cada acción propia manda su nombre, y el texto del Diagnóstico con sus datos y sin
// el token. Lo que engancha a Electron (instalarMenu) se prueba con el Electron falso en electron-app.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const { plantillaMenu, textoDiagnostico, submenuRecientes, elemento, ATAJOS, RESERVADOS, CANAL, REPO, URL_PLAN_VIVO } = require('../electron/menu');

// Recorre la plantilla y devuelve todos sus elementos (menús, submenús y hojas), en orden.
const todos = (plantilla, acc = []) => { for (const e of plantilla) { acc.push(e); if (Array.isArray(e.submenu)) todos(e.submenu, acc); } return acc; };
const etiquetas = plantilla => plantilla.map(e => e.label);
const roles = plantilla => todos(plantilla).map(e => e.role).filter(Boolean);
const recientes = [{ ruta: '/cuadernos/finanzas', nombre: 'Finanzas', abierto: '2026-10-10' }, { ruta: '/cuadernos/historia', nombre: 'Historia', abierto: '2026-10-01' }];
const anotador = () => { const l = []; const a = { lineas: l, acciones: { accion: n => l.push(`accion ${n}`), abrirCarpeta: r => l.push(`abrir ${r}`), planVivo: () => l.push('plan'), mostrarRegistro: () => l.push('registro'), diagnostico: () => l.push('diagnostico'), acercaDe: () => l.push('acerca') } }; return a; };

test('en Windows y Linux: Cuaderno, Edición, Ver, Ventana y Ayuda, en castellano; Ajustes y Salir en Cuaderno; Acerca de en Ayuda', () => {
  for (const plataforma of ['win32', 'linux']) {
    const p = plantillaMenu({ plataforma, recientes, version: '0.1.0' });
    assert.deepEqual(etiquetas(p), ['Cuaderno', 'Edición', 'Ver', 'Ventana', 'Ayuda'], plataforma);
    assert.deepEqual(etiquetas(p[0].submenu).filter(Boolean), ['Abrir nota…', 'Buscar…', 'Nueva tarea', 'Guardar', 'Abrir carpeta…', 'Cuadernos recientes', 'Ajustes…', 'Salir']);
    assert.equal(elemento(p, 'salir').role, 'quit');
    assert.deepEqual(etiquetas(elemento(p, 'ayuda').submenu).filter(Boolean), ['Plan vivo (en GitHub)', 'Mostrar registro', 'Diagnóstico', 'Acerca de Cuaderno']);
    assert.equal(elemento(p, 'ayuda').role, 'help');
    assert.equal(elemento(p, 'ventana').role, 'windowMenu');
  }
});

test('en Mac: el primero es el menú de la app (Acerca de, Ajustes, Servicios, ocultar, Salir de Cuaderno) y Cuaderno no repite Ajustes ni Salir', () => {
  const p = plantillaMenu({ plataforma: 'darwin', recientes, version: '0.1.0' });
  assert.deepEqual(etiquetas(p), ['Cuaderno', 'Cuaderno', 'Edición', 'Ver', 'Ventana', 'Ayuda']);
  assert.deepEqual(etiquetas(p[0].submenu).filter(Boolean), ['Acerca de Cuaderno', 'Ajustes…', 'Servicios', 'Ocultar Cuaderno', 'Ocultar otros', 'Mostrar todo', 'Salir de Cuaderno']);
  assert.deepEqual(roles([p[0]]), ['services', 'hide', 'hideOthers', 'unhide', 'quit']);
  assert.deepEqual(etiquetas(p[1].submenu).filter(Boolean), ['Abrir nota…', 'Buscar…', 'Nueva tarea', 'Guardar', 'Abrir carpeta…', 'Cuadernos recientes']);
  assert.deepEqual(etiquetas(elemento(p, 'ayuda').submenu).filter(Boolean), ['Plan vivo (en GitHub)', 'Mostrar registro', 'Diagnóstico'], 'Acerca de va en el menú de la app');
  assert.equal(todos(p).filter(e => e.id === 'ajustes').length, 1, 'Ajustes una sola vez');
  assert.equal(todos(p).filter(e => e.id === 'salir').length, 1, 'Salir una sola vez');
});

test('los aceleradores (Roberto, §8.1): ⌘O abrir nota, ⌘F buscar, ⌘T nueva tarea, ⌘S guardar, ⇧⌘O abrir carpeta (cambiar de cuaderno), ⌘, ajustes (CmdOrCtrl: Electron pone la tecla de cada plataforma); la tabla ATAJOS es la fuente y ⌘K queda reservada', () => {
  assert.deepEqual(ATAJOS.map(a => [a.id, a.accelerator, a.accion]), [['abrir-nota', 'CmdOrCtrl+O', 'abrir-nota'], ['buscar', 'CmdOrCtrl+F', 'buscar'], ['nueva-tarea', 'CmdOrCtrl+T', 'nueva-tarea'], ['guardar', 'CmdOrCtrl+S', 'guardar'], ['abrir-carpeta', 'CmdOrCtrl+Shift+O', 'abrir-carpeta'], ['ajustes', 'CmdOrCtrl+,', 'ajustes']]);
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
  for (const id of ['abrir-nota', 'buscar', 'nueva-tarea', 'guardar', 'abrir-carpeta', 'ajustes']) elemento(p, id).click();
  elemento(p, 'reciente:/cuadernos/historia').click();
  for (const id of ['plan-vivo', 'mostrar-registro', 'diagnostico', 'acerca-de']) elemento(p, id).click();
  assert.deepEqual(a.lineas, ['accion abrir-nota', 'accion buscar', 'accion nueva-tarea', 'accion guardar', 'accion abrir-carpeta', 'accion ajustes', 'abrir /cuadernos/historia', 'plan', 'registro', 'diagnostico', 'acerca']);
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
  assert.deepEqual(etiquetas(elemento(p, 'ver').submenu).filter(Boolean), ['Recargar', 'Acercar', 'Alejar', 'Tamaño real', 'Pantalla completa']);
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

test('el plan vivo se abre en el repo público, sin token ni nada más en la URL', () => {
  assert.equal(REPO, 'https://github.com/rsotor/cuaderno-app');
  assert.equal(URL_PLAN_VIVO, 'https://github.com/rsotor/cuaderno-app/blob/main/docs/planes/plan-vivo.md');
  assert.doesNotMatch(URL_PLAN_VIVO, /[?#]/);
});

test('elemento() busca por id en cualquier nivel y devuelve null si no está', () => {
  const p = plantillaMenu({ plataforma: 'linux', recientes });
  assert.equal(elemento(p, 'reciente:/cuadernos/finanzas').label, 'Finanzas');
  assert.equal(elemento(p, 'no-existe'), null);
});
