'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.CUADERNO_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-config-'));
const test = require('node:test');
const assert = require('node:assert/strict');
const { Cuaderno } = require('../cuaderno');
const { detectar } = require('../kit');
const { crearServidor } = require('../servidor');
const { crearCuaderno, otroNode, herramientasChivatas } = require('./ayuda');

// ejecutarNode: con qué Node corren las herramientas del kit (la app de escritorio lo inyecta; null, el de este proceso).
async function arrancar({ ejecutarNode = null, ...opciones } = {}) {
  const c = crearCuaderno(opciones);
  const kit = detectar(c.raiz);
  const lanzado = [], ejecutado = [];   // lo que la app habría lanzado en el sistema (el gestor de archivos); en los tests no se abre nada
  const server = crearServidor({ cuaderno: new Cuaderno(c.raiz, kit.base), kit, token: 'ab'.repeat(16), lanzar: (cmd, args, o) => lanzado.push({ cmd, args, cwd: o.cwd }),
    ejecutar: (cmd, args) => { ejecutado.push({ cmd, args }); fs.rmSync(args.at(-1)); },   // la papelera, simulada: el fichero desaparece
    ejecutarNode,
    plataforma: 'darwin' });   // fija: el resultado no depende del sistema que corre los tests (cada uno, en sistema.test.js)
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const puerto = server.address().port;
  const base = `http://localhost:${puerto}`;   // la dirección de la app (127.0.0.1 lleva a ella)
  const cookie = `cuaderno=${server.token}`;
  const pedir = (ruta, opts = {}) => fetch(base + ruta, { redirect: 'manual', ...opts, headers: { cookie, ...(opts.headers || {}) } });
  const cerrar = () => new Promise(r => server.close(() => { c.borrar(); r(); }));
  return { c, server, base, puerto, cookie, pedir, cerrar, lanzado, ejecutado };
}

test('el src de una imagen con %20 se sirve: ida y vuelta por /fichero/ con espacios', async () => {
  const s = await arrancar({ kit: false });
  try {
    const { html } = await (await s.pedir('/api/nota?p=insertar-imagen/con-attachments/nota.md')).json();
    const src = html.match(/<img src="([^"]+)"/)[1];
    assert.equal(src, '/fichero/insertar-imagen/con-attachments/attachments/Mi%20captura.png');
    const r = await s.pedir(src);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /image\/png/);
  } finally { await s.cerrar(); }
});

test('sin cookie no se entra; con el token de la URL se fija la cookie y se redirige', async () => {
  const s = await arrancar();
  try {
    assert.equal((await fetch(s.base + '/')).status, 403);
    assert.equal((await fetch(s.base + '/api/arbol')).status, 403);
    assert.equal((await fetch(s.base + '/?t=' + 'ff'.repeat(16), { redirect: 'manual' })).status, 403);
    const r = await fetch(s.server.urlEntrada(), { redirect: 'manual' });
    assert.equal(r.status, 302);
    assert.match(r.headers.get('set-cookie'), /^cuaderno=abab.*HttpOnly; SameSite=Strict; Path=\//);
    assert.equal(r.headers.get('location'), '/');
    assert.equal((await fetch(s.server.url(), { headers: { cookie: s.cookie } })).status, 200);
  } finally { await s.cerrar(); }
});

test('Host y Origin ajenos se rechazan; el cuerpo tiene que ser JSON', async () => {
  const s = await arrancar();
  try {
    // fetch no deja cambiar Host: se pide a pelo con http
    const conHost = host => new Promise(r => require('node:http').get({ host: '127.0.0.1', port: s.puerto, path: '/api/arbol', headers: { host, cookie: s.cookie } }, res => { res.resume(); r(res.statusCode); }));
    assert.equal(await conHost(`evil.example:${s.puerto}`), 403);
    assert.equal(await conHost(`localhost:${s.puerto}`), 200);
    assert.equal((await s.pedir('/api/arbol', { headers: { origin: 'http://evil.example' } })).status, 403);
    assert.equal((await s.pedir('/api/arbol', { headers: { origin: `http://localhost:${s.puerto}` } })).status, 200);
    const sinJson = await s.pedir('/api/tarea', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{"texto":"x"}' });
    assert.equal(sinJson.status, 415);
    assert.equal((await s.pedir('/api/tarea', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' })).status, 400);
  } finally { await s.cerrar(); }
});

test('la API: info, árbol, nota, escrituras y el 409 cuando la nota cambió', async () => {
  const s = await arrancar({ kit: true });
  try {
    const info = await (await s.pedir('/api/info')).json();
    assert.deepEqual(info.cuaderno, { nombre: path.basename(s.c.raiz), ruta: s.c.raiz, base: s.c.base, sep: path.sep, kit: 'kit', profesor: true, portada: 'inicio.md', git: null });
    assert.equal(info.configuracion.tema, 'auto');
    assert.ok((await (await s.pedir('/api/arbol')).json()).includes('conceptos/interes.md'));
    assert.equal((await s.pedir('/api/nota?p=no/existe.md')).status, 404);
    assert.equal((await s.pedir('/api/nota?p=../../x')).status, 400);
    const post = (ruta, body) => s.pedir(ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    let r = await post('/api/bloque', { ruta: 'conceptos/capital.md', desde: 2, hasta: 3, texto: 'Cambiado', original: 'Lo que pones. Enlaza con [[interes|el interés]].' });
    assert.equal(r.status, 200);
    r = await post('/api/bloque', { ruta: 'conceptos/capital.md', desde: 2, hasta: 3, texto: 'Otra vez', original: 'Lo que pones. Enlaza con [[interes|el interés]].' });
    assert.equal(r.status, 409);
    assert.match((await r.json()).error, /cambió/);
    r = await post('/api/nota/escribir', { ruta: 'conceptos/interes.md', texto: 'nuevo\n', original: 'no es el contenido' });
    assert.equal(r.status, 409);
    r = await post('/api/nota/escribir', { ruta: 'conceptos/interes.md', texto: 'nuevo\n', original: s.c.leer('conceptos/interes.md') });
    assert.equal(r.status, 200);
    assert.equal(s.c.leer('conceptos/interes.md'), 'nuevo\n');
    fs.writeFileSync(path.join(s.c.base, 'mezcla.md'), 'a\r\nb\nc\n');
    assert.equal((await post('/api/nota/escribir', { ruta: 'mezcla.md', texto: 'x', original: null })).status, 422);
    r = await post('/api/render', { texto: '# Hola\n\n![](img.png)', ruta: 'conceptos/x.md' });
    assert.equal(r.status, 200);
    const { html } = await r.json();
    assert.match(html, /<h1[^>]*>Hola/);
    assert.match(html, /\/fichero\/conceptos\/img\.png/);
    assert.equal((await post('/api/render', { texto: 'x' })).status, 200);
    assert.equal((await post('/api/casilla', { ruta: 'tareas.md', linea: 4, marcada: true })).status, 200);
    assert.match(s.c.leer('tareas.md'), /- \[x\] Comprar/);
    const delEjemplo = (await (await s.pedir('/api/comentarios')).json()).length;   // los de comentarios/nota-comentada.md
    assert.equal((await post('/api/comentario', { ruta: 'conceptos/capital.md', desde: 0, hasta: 1, texto: 'duda', original: '# Capital' })).status, 200);
    assert.equal((await (await s.pedir('/api/comentarios')).json()).length, delEjemplo + 1);
    const sinCita = (await (await s.pedir('/api/comentarios')).json()).find(x => x.texto === 'duda');
    assert.equal(sinCita.cita, null);
    assert.equal((await post('/api/comentario', { ruta: 'conceptos/capital.md', desde: 2, hasta: 3, texto: 'con cita', cita: ' «lo que»\n pones ' })).status, 200);
    const conCita = (await (await s.pedir('/api/comentarios')).json()).find(x => x.texto === 'con cita');
    assert.deepEqual([conCita.cita, conCita.autor], ['lo que pones', 'Alumno']);
    r = await post('/api/comentario/cerrar', { ruta: 'conceptos/capital.md', linea: conCita.linea, original: conCita.original + ' cambiado' });
    assert.equal(r.status, 409);
    assert.equal((await post('/api/comentario/cerrar', { ruta: 'conceptos/capital.md', linea: conCita.linea, original: conCita.original })).status, 200);
    r = await post('/api/comentario/cerrar', { ruta: 'conceptos/capital.md', linea: conCita.linea, original: conCita.original });
    assert.equal(r.status, 409);
    assert.equal((await (await s.pedir('/api/comentarios')).json()).length, delEjemplo + 1);
    assert.equal((await post('/api/tarea', { texto: 'Nueva' })).status, 200);
    assert.equal((await (await s.pedir('/api/tareas')).json())[0].items.length, 2);
    assert.equal((await post('/api/tarea', { texto: 'Releer [[conceptos/interes]] #repaso' })).status, 200);
    const ultima = (await (await s.pedir('/api/tareas')).json())[0].items.at(-1);
    assert.deepEqual([ultima.texto, ultima.enlaces, ultima.etiquetas], ['Releer interes #repaso', ['interes'], ['repaso']]);
    assert.equal((await s.pedir('/fichero/conceptos/capital.md')).status, 200);
    assert.equal((await s.pedir('/fichero/..%2F..%2Fx')).status, 400);
  } finally { await s.cerrar(); }
});

test('/api/tareas-de: las tareas de otras notas que la mencionan; sin kit, solo las de tareas.md', async () => {
  const s = await arrancar({ kit: true });
  try {
    const d = await (await s.pedir('/api/tareas-de?p=personas%2Fana.md')).json();
    assert.deepEqual(d.map(i => [i.texto, i.ruta, i.hecha]), [['Llamar a ana por las llaves', 'iniciativas/mudanza/pendientes.md', false], ['Pedir la caja de herramientas #Ana', 'iniciativas/mudanza/pendientes.md', false]]);
    const t = await (await s.pedir('/api/tareas')).json();
    assert.deepEqual(t.flatMap(g => g.items).find(i => i.texto.includes('#mudanza')).notas, ['iniciativas/mudanza/brief.md']);
    assert.deepEqual(await (await s.pedir('/api/tareas-de?p=iniciativas/mudanza/pendientes.md')).json(), []);
  } finally { await s.cerrar(); }
  const sin = await arrancar();
  try { assert.deepEqual(await (await sin.pedir('/api/tareas-de?p=personas%2Fana.md')).json(), [], 'sin kit solo cuenta tareas.md'); } finally { await sin.cerrar(); }
});

test('sin kit: sin profesor y las tareas son solo las propias', async () => {
  const s = await arrancar();
  try {
    const info = await (await s.pedir('/api/info')).json();
    assert.equal(info.cuaderno.kit, 'carpeta'); assert.equal(info.cuaderno.profesor, false);
    assert.deepEqual((await (await s.pedir('/api/tareas')).json()).map(g => g.ruta), ['tareas.md']);
  } finally { await s.cerrar(); }
});

test('WebSocket: sin cookie o con Origin ajeno no hay terminal ni recarga', async () => {
  const WebSocket = require('ws');
  const s = await arrancar();
  const intentar = (ruta, headers) => new Promise(r => { const ws = new WebSocket(`ws://127.0.0.1:${s.puerto}${ruta}`, { headers }); ws.on('open', () => { ws.close(); r('abierto'); }); ws.on('error', () => r('rechazado')); ws.on('unexpected-response', () => r('rechazado')); });
  try {
    assert.equal(await intentar('/cambios', { origin: `http://127.0.0.1:${s.puerto}` }), 'rechazado');
    assert.equal(await intentar('/cambios', { cookie: s.cookie, origin: 'http://evil.example' }), 'rechazado');
    assert.equal(await intentar('/cambios', { cookie: s.cookie }), 'rechazado');   // un WebSocket siempre trae Origin
    assert.equal(await intentar('/cambios', { cookie: s.cookie, origin: `http://127.0.0.1:${s.puerto}` }), 'abierto');
    assert.equal(await intentar('/pty', { cookie: s.cookie, origin: `http://127.0.0.1:${s.puerto}` }), 'abierto');   // sin pty: avisa y cierra
  } finally { await s.cerrar(); }
});

test('sin cuaderno abierto: la API lo dice; abrir una carpeta cambia el cuaderno y lo apunta en recientes', async () => {
  const otro = crearCuaderno({ kit: false });
  fs.writeFileSync(path.join(otro.raiz, 'cuaderno.json'), JSON.stringify({ nombre: 'Mi otro curso', portada: 'tareas.md' }));
  const server = crearServidor({ token: 'cd'.repeat(16) });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const puerto = server.address().port, cookie = `cuaderno=${server.token}`;
  const pedir = (ruta, opts = {}) => fetch(`http://127.0.0.1:${puerto}${ruta}`, { ...opts, headers: { cookie, ...(opts.headers || {}) } });
  const post = (ruta, body) => pedir(ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await (await pedir('/api/info')).json()).cuaderno, null);
    assert.equal((await pedir('/api/arbol')).status, 400);
    assert.equal((await post('/api/abrir', { ruta: '/no/existe/seguro' })).status, 400);
    const r = await post('/api/abrir', { ruta: otro.raiz });
    assert.equal(r.status, 200);
    const info = await r.json();
    assert.equal(info.cuaderno.nombre, 'Mi otro curso'); assert.equal(info.cuaderno.kit, 'carpeta'); assert.equal(info.cuaderno.portada, 'tareas.md');
    assert.ok((await (await pedir('/api/arbol')).json()).includes('inicio.md'));
    const lista = await (await pedir('/api/cuadernos')).json();
    assert.deepEqual(lista.map(c => [c.nombre, c.existe, c.abiertoAhora]), [['Mi otro curso', true, true]]);
    assert.ok('git' in lista[0], '/api/cuadernos sin parámetro: falta la clave git');
    // El selector de cuaderno pide la lista sin el estado de git (uno síncrono por reciente pararía el servidor): ?sin-git=1.
    const sinGit = await (await pedir('/api/cuadernos?sin-git=1')).json();
    assert.deepEqual(sinGit.map(c => [c.nombre, c.existe, c.abiertoAhora]), [['Mi otro curso', true, true]]);
    for (const k of ['ruta', 'nombre', 'existe', 'abiertoAhora']) assert.ok(k in sinGit[0], `?sin-git=1 no trae ${k}`);
    assert.ok(!('git' in sinGit[0]), '?sin-git=1 trae la clave git');
    // la configuración se guarda y vuelve en /api/info
    assert.deepEqual(await (await post('/api/configuracion', { tema: 'oscuro', letra: 'grande' })).json(), { tema: 'oscuro', letra: 'grande', fuente: 'sistema', comando_agente: '', editor: 'vista', panel: 'derecha', panel_ancho: 420, panel_alto: 320 });
    // el panel: un tamaño fuera de rango no da error ni se guarda; vuelve el valor que había
    assert.equal((await (await post('/api/configuracion', { panel: 'abajo', panel_ancho: 99999 })).json()).panel_ancho, 420);
    assert.equal((await (await pedir('/api/info')).json()).configuracion.panel, 'abajo');
    assert.equal((await (await pedir('/api/info')).json()).configuracion.tema, 'oscuro');
    await post('/api/olvidar', { ruta: otro.raiz });
    assert.deepEqual(await (await pedir('/api/cuadernos')).json(), []);
  } finally { await new Promise(r => server.close(r)); otro.borrar(); fs.rmSync(process.env.CUADERNO_CONFIG_DIR, { recursive: true, force: true }); }
});

test('examen: formulario, validar sin kit guarda las marcas; con kit lanza examen.js --corregir', async () => {
  const s = await arrancar({ kit: false });
  try {
    const post = (ruta, body) => s.pedir(ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const ex = await (await s.pedir('/api/examen?p=examenes/01-examen.md')).json();
    assert.equal(ex.validable, false); assert.match(ex.motivo, /Sin kit no hay quien corrija/);
    assert.equal(ex.preguntas.length, 2); assert.equal(ex.preguntas[0].unica, true); assert.match(ex.preguntas[0].enunciado, /Tienes 100 €/); assert.doesNotMatch(ex.preguntas[0].enunciado, /\*\*1\.\*\*/);
    assert.deepEqual(ex.preguntas[1].opciones.map(o => o.linea), [22, 23, 24]);   // líneas del fichero, con el frontmatter
    const r = await (await post('/api/examen/validar', { ruta: 'examenes/01-examen.md', respuestas: { 1: ['b'], 2: ['a', 'b'] } })).json();
    assert.equal(r.corregido, false); assert.match(r.salida, /Respuestas guardadas/);
    const texto = s.c.leer('examenes/01-examen.md');
    assert.match(texto, /^---\ntipo: examen\n/); assert.match(texto, /- \[x\] b\) Baja/); assert.match(texto, /- \[x\] b\) Unidad de cuenta\n- \[ \] c\)/);
    assert.equal((await (await s.pedir('/api/examen?p=examenes/01-examen.md')).json()).preguntas[0].opciones[1].marcada, true);
  } finally { await s.cerrar(); }
  // Con kit, y con el Node inyectado (ejecutarNode, como hace la app de escritorio): la revisión y la corrección tienen que
  // correr con ese Node y su entorno. El examen.js falso apunta con qué lo han lanzado en lanzado.json.
  const ejecutarNode = { cmd: otroNode(), env: { ELECTRON_RUN_AS_NODE: '1' } };
  const k = await arrancar({ kit: true, ejecutarNode });
  try {
    const falsa = `const a = process.argv.slice(2); require('fs').writeFileSync(require('path').join(__dirname, 'lanzado.json'), JSON.stringify({ execPath: process.execPath, args: a, RUN_AS_NODE: process.env.ELECTRON_RUN_AS_NODE }));
      if (a[0] === '--revision') { process.stdout.write('Revisión resuelta'); process.exit(0); } process.stdout.write('examen.js ' + JSON.stringify(a)); process.exit(0);`;
    fs.mkdirSync(path.join(k.c.raiz, '.kit', 'herramientas'), { recursive: true });
    fs.writeFileSync(path.join(k.c.raiz, '.kit', 'herramientas', 'examen.js'), falsa);
    const lanzado = () => { const l = JSON.parse(fs.readFileSync(path.join(k.c.raiz, '.kit', 'herramientas', 'lanzado.json'), 'utf8')); assert.equal(path.basename(l.execPath), path.basename(ejecutarNode.cmd)); assert.equal(l.RUN_AS_NODE, '1'); return l.args; };
    const ex = await (await k.pedir('/api/examen?p=examenes/01-examen.md')).json();
    assert.equal(ex.validable, true);
    assert.deepEqual(lanzado(), ['--revision', 'estudio/examenes/01-examen.md']);
    const post = (ruta, body) => k.pedir(ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const r = await (await post('/api/examen/validar', { ruta: 'examenes/01-examen.md', respuestas: { 1: ['a'] } })).json();
    assert.deepEqual(r, { codigo: 0, corregido: true, salida: 'examen.js ["--corregir","estudio/examenes/01-examen.md"]' });
    assert.deepEqual(lanzado(), ['--corregir', 'estudio/examenes/01-examen.md']);
    assert.match(k.c.leer('examenes/01-examen.md'), /- \[x\] a\) Sube/);
  } finally { await k.cerrar(); }
});

test('flashcards: las tarjetas con sus líneas, y marcar una casilla pasa por /api/casilla', async () => {
  const s = await arrancar();
  try {
    const t = await (await s.pedir('/api/flashcards?p=flashcards/01-tarjetas.md')).json();
    assert.equal(t.titulo, 'Flashcards · 01-01-01-sesion'); assert.equal(t.tarjetas.length, 2);
    assert.match(t.tarjetas[0].pregunta, /interés/); assert.match(t.tarjetas[0].respuesta, /<p>El precio del dinero\.<\/p>/);
    assert.deepEqual([t.tarjetas[0].lineaSabia, t.tarjetas[0].lineaNoSabia], [10, 11]);
    const post = (ruta, body) => s.pedir(ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post('/api/casilla', { ruta: 'flashcards/01-tarjetas.md', linea: 11, marcada: true, original: '- [ ] ❌ no la sabía' })).status, 200);
    assert.equal((await (await s.pedir('/api/flashcards?p=flashcards/01-tarjetas.md')).json()).tarjetas[0].sabia, false);
  } finally { await s.cerrar(); }
});

test('la pestaña lleva icono: index.html lo enlaza y /public/icono.svg se sirve como SVG', async () => {
  const s = await arrancar();
  try {
    const html = await (await s.pedir('/')).text();
    assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\/public\/icono\.svg">/);
    const r = await s.pedir('/public/icono.svg');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'image/svg+xml');
  } finally { await s.cerrar(); }
});


test('ficheros: /fichero sirve el PDF con su tipo y nosniff, aísla un .svg y un .html, y no sigue un enlace simbólico que sale del cuaderno', async () => {
  const s = await arrancar();
  try {
    const pdf = await s.pedir('/fichero/material/extracto-octubre.pdf');
    assert.equal(pdf.status, 200); assert.equal(pdf.headers.get('content-type'), 'application/pdf'); assert.equal(pdf.headers.get('x-content-type-options'), 'nosniff');
    fs.writeFileSync(path.join(s.c.base, 'material', 'dibujo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    assert.match((await s.pedir('/fichero/material/dibujo.svg')).headers.get('content-security-policy') || '', /^sandbox/, 'un .svg se sirve sin aislar');
    assert.match((await s.pedir('/fichero/material/calculadora-50-30-20.html')).headers.get('content-security-policy') || '', /^sandbox allow-scripts/);
    const fuera = fs.mkdtempSync(path.join(os.tmpdir(), 'fuera-'));
    fs.writeFileSync(path.join(fuera, 'secreto.txt'), 'no deberías verme');
    fs.symlinkSync(path.join(fuera, 'secreto.txt'), path.join(s.c.base, 'material', 'enlace.txt'));
    const r = await s.pedir('/fichero/material/enlace.txt');
    assert.equal(r.status, 400, 'un enlace simbólico saca un fichero de fuera del cuaderno');
    assert.doesNotMatch(await r.text(), /no deberías verme/);
    fs.rmSync(fuera, { recursive: true, force: true });
  } finally { await s.cerrar(); }
});

test('mostrar en carpeta: lanza el gestor de archivos con la ruta del fichero o de la carpeta; fuera del cuaderno, no', async () => {
  const s = await arrancar();
  const post = body => s.pedir('/api/mostrar-en-carpeta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await post({ ruta: 'material/extracto-octubre.pdf' })).status, 200);
    assert.equal(s.lanzado.at(-1).cwd, path.join(s.c.base, 'material'));
    assert.ok(s.lanzado.at(-1).args.some(a => a.includes('extracto-octubre.pdf')), 'no señala el fichero');
    assert.equal((await post({ ruta: 'material' })).status, 200);
    assert.equal(s.lanzado.at(-1).cwd, path.join(s.c.base, 'material'));
    assert.equal((await post({ ruta: '../../etc' })).status, 400);
    assert.equal((await post({ ruta: 'no-existe.pdf' })).status, 400);
    assert.equal(s.lanzado.length, 2);
  } finally { await s.cerrar(); }
});

test('papelera y árbol: un fichero va a la papelera del sistema; una carpeta, uno de fuera o uno que no está, no; el árbol no enseña carpetas con «_»', async () => {
  const s = await arrancar();
  const post = body => s.pedir('/api/papelera', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    fs.mkdirSync(path.join(s.c.base, '_meta')); fs.writeFileSync(path.join(s.c.base, '_meta', 'estado.md'), '# Estado\n');
    s.server.estado.cuaderno.invalidar();
    const arbol = await (await s.pedir('/api/arbol')).json();
    assert.ok(arbol.includes('material/reparto-50-30-20.png') && !arbol.includes('_meta/estado.md'));
    assert.equal((await post({ ruta: 'material/apuntes-de-clase.txt' })).status, 200);
    assert.ok(!fs.existsSync(path.join(s.c.base, 'material', 'apuntes-de-clase.txt')));
    assert.ok(s.ejecutado.at(-1).args.at(-1).endsWith('apuntes-de-clase.txt'));
    assert.ok(!(await (await s.pedir('/api/arbol')).json()).includes('material/apuntes-de-clase.txt'), 'el árbol sigue enseñando el fichero');
    assert.match((await (await post({ ruta: 'material' })).json()).error, /no carpetas/);
    assert.equal((await post({ ruta: '../../etc/passwd' })).status, 400);
    assert.equal((await post({ ruta: 'no-existe.md' })).status, 400);
    assert.equal(s.ejecutado.length, 1);
  } finally { await s.cerrar(); }
});

test('ocultar: la carpeta y lo que tiene dentro salen del árbol y del buscador, no del disco; se recupera; fuera del cuaderno, no', async () => {
  const s = await arrancar();
  const post = body => s.pedir('/api/ocultar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.deepEqual(await (await post({ ruta: 'conceptos/' })).json(), ['conceptos']);
    const arbol = await (await s.pedir('/api/arbol')).json();
    assert.ok(!arbol.some(r => r.startsWith('conceptos/')), 'la carpeta oculta sigue en el árbol');
    assert.ok(arbol.includes('inicio.md'));
    const b = await (await s.pedir('/api/buscar?q=capital')).json();
    assert.ok(!b.ficheros.some(r => r.startsWith('conceptos/')) && !b.lineas.some(l => l.ruta.startsWith('conceptos/')), 'lo oculto sale en el buscador');
    assert.ok(fs.existsSync(path.join(s.c.base, 'conceptos', 'capital.md')), 'ocultar ha tocado el disco');
    assert.equal((await s.pedir('/api/nota?p=conceptos/capital.md')).status, 200, 'una nota oculta deja de abrirse por su enlace');
    assert.deepEqual(await (await s.pedir('/api/ocultas')).json(), ['conceptos']);
    assert.deepEqual(await (await post({ ruta: 'conceptos', ocultar: false })).json(), []);
    assert.ok((await (await s.pedir('/api/arbol')).json()).includes('conceptos/capital.md'));
    assert.equal((await post({ ruta: '../fuera' })).status, 400);
  } finally { await s.cerrar(); }
});

test('buscar?por-nota=1: una línea por nota, con las ocultas fuera antes del tope; sin el parámetro, la respuesta de siempre', async () => {
  const s = await arrancar();
  const post = body => s.pedir('/api/ocultar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    fs.mkdirSync(path.join(s.c.base, 'lotes'), { recursive: true });
    for (let i = 0; i < 52; i++) fs.writeFileSync(path.join(s.c.base, 'lotes', `n${String(i).padStart(2, '0')}.md`), 'patata\npatata\n');
    const antes = await (await s.pedir('/api/buscar?q=patata&por-nota=1')).json();
    assert.equal(antes.lineas.length, 50);
    assert.equal(antes.cortado, true);
    await post({ ruta: 'lotes/' });
    const despues = await (await s.pedir('/api/buscar?q=patata&por-nota=1')).json();
    assert.deepEqual(despues.lineas, [], 'lo oculto no sale ni gasta el tope');
    assert.equal(despues.cortado, false);
    const sin = await (await s.pedir('/api/buscar?q=capital')).json();
    assert.equal(sin.cortado, undefined, 'sin el parámetro, la respuesta de hoy');
    assert.ok(sin.lineas.every(l => !l.ruta.startsWith('lotes/')));
  } finally { await s.cerrar(); }
});

test('una sola dirección: http://localhost:<puerto>/, la misma cada vez; 127.0.0.1 lleva a ella y sin cookie se explica cómo entrar', async () => {
  const s = await arrancar();
  try {
    assert.equal(s.server.url(), `http://localhost:${s.puerto}/`);
    assert.equal(s.server.urlEntrada(), `http://localhost:${s.puerto}/?t=${'ab'.repeat(16)}`);
    const r = await fetch(`http://127.0.0.1:${s.puerto}/?t=${s.server.token}`, { redirect: 'manual' });
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), `http://localhost:${s.puerto}/?t=${s.server.token}`, '127.0.0.1 no lleva a localhost con el código');
    assert.equal(r.headers.get('set-cookie'), null, 'la cookie se fija en 127.0.0.1 y localhost no la vería');
    assert.equal((await fetch(`http://127.0.0.1:${s.puerto}/api/arbol`, { headers: { cookie: s.cookie } })).status, 200, 'la API sigue respondiendo en 127.0.0.1');
    const sin = await fetch(s.server.url());
    assert.equal(sin.status, 403);
    assert.match(await sin.text(), /aún no ha entrado.*node server\.js/s);
  } finally { await s.cerrar(); }
});

test('en la app (enApp) el 403 sin cookie no manda a la terminal: dice que se cierre y se vuelva a abrir la app; en la web, lo de siempre', async () => {
  const c = crearCuaderno({ kit: false });
  const server = crearServidor({ cuaderno: new Cuaderno(c.raiz, c.base), kit: detectar(c.raiz), token: 'ab'.repeat(16), enApp: true });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const sin = await fetch(server.url());
    assert.equal(sin.status, 403);
    const texto = await sin.text();
    assert.match(texto, /Esta ventana aún no ha entrado en la app\. Cierra y vuelve a abrir la app/);
    assert.doesNotMatch(texto, /terminal|server\.js/);
  } finally { await new Promise(r => server.close(r)); c.borrar(); }
});

// Una pty de mentira que anota con qué se lanza la shell; el WebSocket /pty con la cookie y el Origin propios la abre.
function ptyFalsa() {
  const lanzadas = [];
  return { lanzadas, spawn(cmd, args, o) { lanzadas.push({ cmd, args, cwd: o.cwd }); return { onData() {}, onExit() {}, write() {}, resize() {}, kill() {} }; } };
}
async function terminalCon({ shellLogin, plataforma }) {
  const WebSocket = require('ws');
  const c = crearCuaderno({ kit: false }), pty = ptyFalsa();
  const server = crearServidor({ cuaderno: new Cuaderno(c.raiz, c.base), kit: detectar(c.raiz), token: 'ab'.repeat(16), pty, plataforma, shellLogin });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const puerto = server.address().port;
  try {
    await new Promise((ok, mal) => { const ws = new WebSocket(`ws://127.0.0.1:${puerto}/pty`, { headers: { cookie: `cuaderno=${server.token}`, origin: `http://127.0.0.1:${puerto}` } }); ws.on('open', () => { setTimeout(() => { ws.close(); ok(); }, 50); }); ws.on('error', mal); });
    return { lanzadas: pty.lanzadas, raiz: c.raiz };
  } finally { await new Promise(r => server.close(r)); c.borrar(); }
}

test('shellLogin (la app): en Mac y Linux la terminal lanza la shell con -l, en la raíz del cuaderno; sin shellLogin (la web) sin argumentos; en Windows nunca cambia nada', async () => {
  const shell = process.env.SHELL || 'bash';
  const app = await terminalCon({ shellLogin: true, plataforma: 'darwin' });
  assert.deepEqual(app.lanzadas, [{ cmd: shell, args: ['-l'], cwd: app.raiz }]);
  const linux = await terminalCon({ shellLogin: true, plataforma: 'linux' });
  assert.deepEqual(linux.lanzadas[0].args, ['-l']);
  const web = await terminalCon({ shellLogin: false, plataforma: 'darwin' });
  assert.deepEqual(web.lanzadas, [{ cmd: shell, args: [], cwd: web.raiz }]);
  const windows = await terminalCon({ shellLogin: true, plataforma: 'win32' });
  assert.deepEqual(windows.lanzadas[0], { cmd: 'powershell.exe', args: [], cwd: windows.raiz });
});

test('la cookie dura un año: con el código fijo, recargar tras reiniciar el servidor o el navegador sigue valiendo', async () => {
  const s = await arrancar();
  try {
    const r = await fetch(`${s.base}/?t=${s.server.token}`, { redirect: 'manual' });
    assert.match(r.headers.get('set-cookie'), /Max-Age=31536000/);
    assert.match(r.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  } finally { await s.cerrar(); }
});

test('desactualizada: si el código de la app cambia en el disco tras arrancar, /api/info lo dice', async () => {
  const fuentes = fs.mkdtempSync(path.join(os.tmpdir(), 'fuentes-'));
  fs.writeFileSync(path.join(fuentes, 'servidor.js'), '// antes');
  const c = crearCuaderno();
  const server = crearServidor({ cuaderno: new Cuaderno(c.raiz, c.base), kit: detectar(c.raiz), token: 'ab'.repeat(16), fuentes: [fuentes] });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const pedir = () => fetch(`http://127.0.0.1:${server.address().port}/api/info`, { headers: { cookie: `cuaderno=${'ab'.repeat(16)}`, origin: `http://127.0.0.1:${server.address().port}` } }).then(r => r.json());
  try {
    assert.equal((await pedir()).desactualizada, false);
    const luego = new Date(Date.now() + 5000);
    fs.utimesSync(path.join(fuentes, 'servidor.js'), luego, luego);
    assert.equal((await pedir()).desactualizada, true, 'no avisa de que el código cambió');
  } finally { await new Promise(r => server.close(r)); c.borrar(); fs.rmSync(fuentes, { recursive: true, force: true }); }
});

test('rutas de lectura y de nota nueva: títulos, recorrido y crear una nota', async () => {
  const s = await arrancar();
  const post = (ruta, body) => s.pedir(ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const t = await (await s.pedir('/api/titulos')).json();
    assert.equal(t['conceptos/capital.md'], 'Capital'); assert.equal(t['material/calculadora-50-30-20.html'], 'Calculadora 50/30/20');
    const r = await (await s.pedir('/api/recorrido')).json();
    assert.equal(r.notas, 24); assert.deepEqual(r.fallos, []);   // 24 (2026-10-14: +insertar-imagen/con-attachments/nota.md); 23 (2026-10-13: +navegacion/una-nota-con-un-nombre-muy-largo-para-la-barra-superior.md, y antes +render/fragmentos-de-busqueda.md): con la nota larga de lectura/ (2026-10-09) y comentarios/nota-comentada.md
    const n = await (await post('/api/nota/nueva', { titulo: 'Idea nueva', carpeta: 'conceptos' })).json();
    assert.equal(n.ruta, 'conceptos/Idea nueva.md'); assert.equal(s.c.leer('conceptos/Idea nueva.md'), '# Idea nueva\n\n');   // el título y una línea en blanco para escribir debajo
    assert.equal((await post('/api/nota/nueva', { titulo: 'Idea nueva', carpeta: 'conceptos' })).status, 400, 'una nota repetida no da error');
  } finally { await s.cerrar(); }
});

test('rutas de guardar sin kit: propuesta, guardar, traer y deshacer, por la API; con kit, sus herramientas con el Node inyectado', async () => {
  const { execFileSync } = require('node:child_process');
  const s = await arrancar();
  const git = (...a) => execFileSync('git', a, { cwd: s.c.raiz, encoding: 'utf8' }).trim();
  const post = (ruta, body) => s.pedir(ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  try {
    git('init', '-q', '-b', 'main'); git('config', 'user.name', 'Prueba'); git('config', 'user.email', 'prueba@example.com'); git('add', '-A'); git('commit', '-q', '-m', 'base');
    fs.appendFileSync(path.join(s.c.base, 'tareas.md'), '- [ ] Por la API\n');
    const p = await (await s.pedir('/api/guardar/propuesta')).json();
    assert.equal(p.repo, true); assert.equal(p.kit, 'carpeta'); assert.deepEqual(p.cambios.map(c => c.ruta || c), ['tareas.md']); assert.ok(p.mensaje);
    const g = await post('/api/guardar', { mensaje: 'Guardado por la API' });
    assert.equal(git('log', '-1', '--format=%s'), 'Guardado por la API', `guardar no ha hecho commit: ${g.salida}`);
    const t = await post('/api/traer', {});
    assert.match(t.salida, /remoto/i, 'traer sin remoto no lo dice');
    const ver = await post('/api/deshacer', { ver: true });
    assert.equal(ver.codigo, 0); assert.match(ver.salida, /Guardado por la API/);
    assert.equal(git('log', '-1', '--format=%s'), 'Guardado por la API', 'deshacer con ver: true ha revertido');
    const d = await post('/api/deshacer', { ver: false });
    assert.equal(d.codigo, 0); assert.doesNotMatch(s.c.leer('tareas.md'), /Por la API/, 'deshacer no ha revertido');
  } finally { await s.cerrar(); }
  // Con kit: las rutas lanzan guardar.js y deshacer.js del kit con el Node que recibe crearServidor (ejecutarNode, la app de
  // escritorio) y su entorno; las herramientas falsas chivan lo que reciben.
  const ejecutarNode = { cmd: otroNode(), env: { ELECTRON_RUN_AS_NODE: '1' } };
  const k = await arrancar({ kit: true, ejecutarNode });
  const leerLanzado = herramientasChivatas(k.c.raiz, ['guardar.js', 'deshacer.js']);
  const postK = (ruta, body) => k.pedir(ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  try {
    for (const [ruta, body, args] of [['/api/guardar', { mensaje: 'Con kit' }, ['Con kit']], ['/api/traer', {}, ['--traer']], ['/api/deshacer', { ver: true }, ['--ver']], ['/api/deshacer', { ver: false }, []]]) {
      const r = await postK(ruta, body);
      assert.equal(r.codigo, 0, `${ruta}: ${r.salida}`);
      const l = leerLanzado();
      assert.deepEqual(l.args, args, ruta);
      assert.equal(path.basename(l.execPath), path.basename(ejecutarNode.cmd), ruta); assert.equal(l.RUN_AS_NODE, '1', ruta); assert.equal(l.GIT_TERMINAL_PROMPT, '0', ruta);
    }
  } finally { await k.cerrar(); }
});

// Una web ajena puede lanzar un GET (una imagen, un enlace) aunque no lea la respuesta: ninguno puede cambiar el
// cuaderno. Las escrituras van por POST con cuerpo JSON, que el navegador no manda a otro origen sin preguntar.
test('ningún GET de la API escribe en el cuaderno', async () => {
  const s = await arrancar();
  const foto = () => fs.readdirSync(s.c.raiz, { recursive: true }).filter(f => !String(f).split(path.sep).includes('.git')).sort()
    .map(f => { const a = path.join(s.c.raiz, f); return fs.statSync(a).isFile() ? `${f}:${fs.readFileSync(a, 'utf8')}` : f; }).join('\n');
  try {
    const antes = foto();
    const rutas = [...new Set([...fs.readFileSync(path.join(__dirname, '..', 'servidor.js'), 'utf8').matchAll(/p === '(\/api\/[\w/.-]+)'/g)].map(m => m[1]))];
    for (const r of rutas) await (await s.pedir(`${r}?p=inicio.md&q=a`)).arrayBuffer();
    assert.equal(foto(), antes);
  } finally { await s.cerrar(); }
});

test('un fichero del cuaderno se sirve por trozos (Range): vídeo y audio se reproducen y se puede saltar', async () => {
  const s = await arrancar();
  try {
    fs.writeFileSync(path.join(s.c.base, 'clip.mp4'), '0123456789');
    const r = await s.pedir('/fichero/clip.mp4', { headers: { range: 'bytes=2-5' } });
    assert.equal(r.status, 206);
    assert.equal(r.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(r.headers.get('content-type'), 'video/mp4');
    assert.equal(await r.text(), '2345');
    assert.equal(await (await s.pedir('/fichero/clip.mp4', { headers: { range: 'bytes=-3' } })).text(), '789');
    assert.equal((await s.pedir('/fichero/clip.mp4', { headers: { range: 'bytes=20-' } })).status, 416);
    const entero = await s.pedir('/fichero/clip.mp4');
    assert.equal(entero.status, 200); assert.equal(entero.headers.get('accept-ranges'), 'bytes'); assert.equal(await entero.text(), '0123456789');
  } finally { await s.cerrar(); }
});

test('/api/comentario acepta la fecha (para deshacer un cierre con la del comentario original) y se la salta si no es AAAA-MM-DD', async () => {
  const s = await arrancar();
  const post = (ruta, body) => s.pedir(ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await post('/api/comentario', { ruta: 'conceptos/capital.md', desde: 0, hasta: 1, texto: 'con fecha', original: '# Capital', fecha: '2026-01-02' })).status, 200);
    assert.match(s.c.leer('conceptos/capital.md'), /\[!comment\] Alumno \(2026-01-02\)\n> con fecha/);
    assert.equal((await post('/api/comentario', { ruta: 'conceptos/capital.md', desde: 0, hasta: 1, texto: 'fecha rara', original: '# Capital', fecha: 'ayer' })).status, 200);
    assert.doesNotMatch(s.c.leer('conceptos/capital.md'), /Alumno \(ayer\)/, 'una fecha que no es AAAA-MM-DD se ignora');
  } finally { await s.cerrar(); }
});

test('POST /api/imagen/destino: dónde va la imagen y con qué nombre; una nota fuera del cuaderno → 400', async () => {
  const s = await arrancar({ kit: false });
  try {
    const post = body => s.pedir('/api/imagen/destino', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const r = await post({ nota: 'insertar-imagen/con-attachments/nota.md', nombre: 'Mi captura.png', origen: '', reservados: [] });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { dentro: false, ruta: 'insertar-imagen/con-attachments/attachments/Mi captura-2.png', enlace: 'attachments/Mi%20captura-2.png' });
    assert.equal((await post({ nota: '../x.md', nombre: 'a.png' })).status, 400);
    assert.equal((await post({ nota: 'inicio.md', nombre: 'a.pdf' })).status, 400);
  } finally { await s.cerrar(); }
});

// POST /api/imagen: bytes en crudo, tope de 25 MB rechazado con un 413 que el cliente recibe de verdad.
const http = require('node:http');
const { TOPE_IMAGEN } = require('../public/imagenes');
const subir = (s, query, { cabeceras = {}, trozos, declarar } = {}) => new Promise((ok, mal) => {
  const req = http.request({ host: '127.0.0.1', port: s.puerto, path: `/api/imagen?${query}`, method: 'POST',
    headers: { cookie: s.cookie, origin: `http://localhost:${s.puerto}`, ...(declarar !== undefined ? { 'content-length': declarar } : {}), ...cabeceras } }, res => {
    const partes = []; res.on('data', d => partes.push(d)); res.on('end', () => ok({ status: res.statusCode, cuerpo: Buffer.concat(partes).toString() }));
  });
  req.on('error', mal);
  (async () => { for (const t of trozos) { if (!req.write(t)) await new Promise(r => req.once('drain', r)); if (req.destroyed) return; } req.end(); })().catch(mal);
});
const q = (nota, ruta) => `nota=${encodeURIComponent(nota)}&ruta=${encodeURIComponent(ruta)}`;
const NOTA = 'insertar-imagen/con-attachments/nota.md', DIR = 'insertar-imagen/con-attachments/attachments';

test('POST /api/imagen: guarda los bytes, nunca encima de otra, y responde ruta y enlace', async () => {
  const s = await arrancar({ kit: false });
  try {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 9, 8, 7]);
    const r = await s.pedir(`/api/imagen?${q(NOTA, `${DIR}/nueva foto.png`)}`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: bytes });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ruta: `${DIR}/nueva foto.png`, enlace: 'attachments/nueva%20foto.png' });
    assert.deepEqual(fs.readFileSync(path.join(s.c.base, DIR, 'nueva foto.png')), bytes);
    const otra = await s.pedir(`/api/imagen?${q(NOTA, `${DIR}/nueva foto.png`)}`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: Buffer.from('otra') });
    assert.equal((await otra.json()).ruta, `${DIR}/nueva foto-2.png`);
    assert.deepEqual(fs.readFileSync(path.join(s.c.base, DIR, 'nueva foto.png')), bytes);
    // lo que no es imagen o sale de la carpeta de la nota → 400 y nada en el disco
    for (const ruta of [`${DIR}/x.html`, '../x.png', 'otra/x.png'])
      assert.equal((await s.pedir(`/api/imagen?${q(NOTA, ruta)}`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: bytes })).status, 400, ruta);
    assert.equal(fs.existsSync(path.join(s.c.base, 'otra')), false);
  } finally { await s.cerrar(); }
});

test('POST /api/imagen: un cuerpo JSON o de texto → 415; sin cookie o con Origin ajeno → 403', async () => {
  const s = await arrancar({ kit: false });
  try {
    const ruta = `/api/imagen?${q(NOTA, `${DIR}/j.png`)}`;
    assert.equal((await s.pedir(ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 415);
    assert.equal((await s.pedir(ruta, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' })).status, 415);
    assert.equal((await fetch(s.base + ruta, { method: 'POST', headers: { 'content-type': 'image/png' }, body: 'x' })).status, 403);
    assert.equal((await s.pedir(ruta, { method: 'POST', headers: { 'content-type': 'image/png', origin: 'http://evil.example' }, body: 'x' })).status, 403);
    assert.equal(fs.existsSync(path.join(s.c.base, DIR, 'j.png')), false);
  } finally { await s.cerrar(); }
});

test('POST /api/imagen: con content-length mayor que el tope el cliente recibe un 413 (no un corte) y no se escribe nada', async () => {
  const s = await arrancar({ kit: false });
  try {
    const r = await subir(s, q(NOTA, `${DIR}/grande.png`), { cabeceras: { 'content-type': 'image/png' }, declarar: TOPE_IMAGEN + 1, trozos: [...Array.from({ length: 25 }, () => Buffer.alloc(1 << 20, 1)), Buffer.alloc(1, 1)] });
    assert.equal(r.status, 413);
    assert.equal(fs.existsSync(path.join(s.c.base, DIR, 'grande.png')), false);
    // y el servidor sigue atendiendo
    assert.equal((await s.pedir('/api/info')).status, 200);
  } finally { await s.cerrar(); }
});

test('POST /api/imagen: un cuerpo troceado sin content-length que pasa del tope → 413 recibido y nada en el disco', async () => {
  const s = await arrancar({ kit: false });
  try {
    const trozo = Buffer.alloc(1 << 20, 2);
    const r = await subir(s, q(NOTA, `${DIR}/grande.png`), { cabeceras: { 'content-type': 'image/png', 'transfer-encoding': 'chunked' }, trozos: Array.from({ length: 27 }, () => trozo) });
    assert.equal(r.status, 413);
    assert.equal(fs.existsSync(path.join(s.c.base, DIR, 'grande.png')), false);
    assert.equal((await s.pedir('/api/info')).status, 200);
  } finally { await s.cerrar(); }
});

test('POST /api/imagen: un cuerpo de justo el tope entra', async () => {
  const s = await arrancar({ kit: false });
  try {
    const r = await s.pedir(`/api/imagen?${q(NOTA, `${DIR}/tope.png`)}`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: Buffer.alloc(TOPE_IMAGEN, 3) });
    assert.equal(r.status, 200);
    assert.equal(fs.statSync(path.join(s.c.base, DIR, 'tope.png')).size, TOPE_IMAGEN);
  } finally { await s.cerrar(); }
});
