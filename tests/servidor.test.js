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
const { crearCuaderno } = require('./ayuda');

async function arrancar(opciones = {}) {
  const c = crearCuaderno(opciones);
  const kit = detectar(c.raiz);
  const lanzado = [], ejecutado = [];   // lo que la app habría lanzado en el sistema (el gestor de archivos); en los tests no se abre nada
  const server = crearServidor({ cuaderno: new Cuaderno(c.raiz, kit.base), kit, token: 'ab'.repeat(16), lanzar: (cmd, args, o) => lanzado.push({ cmd, args, cwd: o.cwd }),
    ejecutar: (cmd, args) => { ejecutado.push({ cmd, args }); fs.rmSync(args.at(-1)); },   // la papelera, simulada: el fichero desaparece
    plataforma: 'darwin' });   // fija: el resultado no depende del sistema que corre los tests (cada uno, en sistema.test.js)
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const puerto = server.address().port;
  const base = `http://127.0.0.1:${puerto}`;
  const cookie = `cuaderno=${server.token}`;
  const pedir = (ruta, opts = {}) => fetch(base + ruta, { redirect: 'manual', ...opts, headers: { cookie, ...(opts.headers || {}) } });
  const cerrar = () => new Promise(r => server.close(() => { c.borrar(); r(); }));
  return { c, server, base, puerto, cookie, pedir, cerrar, lanzado, ejecutado };
}

test('sin cookie no se entra; con el token de la URL se fija la cookie y se redirige', async () => {
  const s = await arrancar();
  try {
    assert.equal((await fetch(s.base + '/')).status, 403);
    assert.equal((await fetch(s.base + '/api/arbol')).status, 403);
    assert.equal((await fetch(s.base + '/?t=' + 'ff'.repeat(16), { redirect: 'manual' })).status, 403);
    const r = await fetch(s.server.url(), { redirect: 'manual' });
    assert.equal(r.status, 302);
    assert.match(r.headers.get('set-cookie'), /^cuaderno=abab.*HttpOnly; SameSite=Strict; Path=\//);
    assert.equal(r.headers.get('location'), '/');
    assert.equal((await s.pedir('/')).status, 200);
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
  const s = await arrancar({ kit: 'kit' });
  try {
    const info = await (await s.pedir('/api/info')).json();
    assert.deepEqual(info.cuaderno, { nombre: path.basename(s.c.raiz), ruta: s.c.raiz, kit: 'kit', profesor: true, portada: 'inicio.md', git: null });
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
    assert.equal((await post('/api/casilla', { ruta: 'tareas.md', linea: 4, marcada: true })).status, 200);
    assert.match(s.c.leer('tareas.md'), /- \[x\] Comprar/);
    assert.equal((await post('/api/comentario', { ruta: 'conceptos/capital.md', desde: 0, hasta: 1, texto: 'duda', original: '# Capital' })).status, 200);
    assert.equal((await (await s.pedir('/api/comentarios')).json()).length, 1);
    assert.equal((await post('/api/tarea', { texto: 'Nueva' })).status, 200);
    assert.equal((await (await s.pedir('/api/tareas')).json())[0].items.length, 2);
    assert.equal((await post('/api/tarea', { texto: 'Releer [[conceptos/interes]] #repaso' })).status, 200);
    const ultima = (await (await s.pedir('/api/tareas')).json())[0].items.at(-1);
    assert.deepEqual([ultima.texto, ultima.enlaces, ultima.etiquetas], ['Releer interes #repaso', ['interes'], ['repaso']]);
    assert.equal((await s.pedir('/fichero/conceptos/capital.md')).status, 200);
    assert.equal((await s.pedir('/fichero/..%2F..%2Fx')).status, 400);
  } finally { await s.cerrar(); }
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
  const otro = crearCuaderno({ kit: 'salida-sin-motor' });
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
    assert.equal(info.cuaderno.nombre, 'Mi otro curso'); assert.equal(info.cuaderno.kit, 'salida-sin-motor'); assert.equal(info.cuaderno.portada, 'tareas.md');
    assert.ok((await (await pedir('/api/arbol')).json()).includes('inicio.md'));
    const lista = await (await pedir('/api/cuadernos')).json();
    assert.deepEqual(lista.map(c => [c.nombre, c.existe, c.abiertoAhora]), [['Mi otro curso', true, true]]);
    // la configuración se guarda y vuelve en /api/info
    assert.deepEqual(await (await post('/api/configuracion', { tema: 'oscuro', letra: 'grande' })).json(), { tema: 'oscuro', letra: 'grande', fuente: 'sistema', comando_agente: '', panel: 'derecha', panel_ancho: 420, panel_alto: 320 });
    // el panel: un tamaño fuera de rango no da error ni se guarda; vuelve el valor que había
    assert.equal((await (await post('/api/configuracion', { panel: 'abajo', panel_ancho: 99999 })).json()).panel_ancho, 420);
    assert.equal((await (await pedir('/api/info')).json()).configuracion.panel, 'abajo');
    assert.equal((await (await pedir('/api/info')).json()).configuracion.tema, 'oscuro');
    await post('/api/olvidar', { ruta: otro.raiz });
    assert.deepEqual(await (await pedir('/api/cuadernos')).json(), []);
  } finally { await new Promise(r => server.close(r)); otro.borrar(); fs.rmSync(process.env.CUADERNO_CONFIG_DIR, { recursive: true, force: true }); }
});

test('examen: formulario, validar sin motor guarda las marcas; con kit lanza examen.js --corregir', async () => {
  const s = await arrancar({ kit: 'salida-sin-motor' });
  try {
    const post = (ruta, body) => s.pedir(ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const ex = await (await s.pedir('/api/examen?p=examenes/01-examen.md')).json();
    assert.equal(ex.validable, false); assert.match(ex.motivo, /no trae el motor/);
    assert.equal(ex.preguntas.length, 2); assert.equal(ex.preguntas[0].unica, true); assert.match(ex.preguntas[0].enunciado, /Tienes 100 €/); assert.doesNotMatch(ex.preguntas[0].enunciado, /\*\*1\.\*\*/);
    assert.deepEqual(ex.preguntas[1].opciones.map(o => o.linea), [22, 23, 24]);   // líneas del fichero, con el frontmatter
    const r = await (await post('/api/examen/validar', { ruta: 'examenes/01-examen.md', respuestas: { 1: ['b'], 2: ['a', 'b'] } })).json();
    assert.equal(r.corregido, false); assert.match(r.salida, /Respuestas guardadas/);
    const texto = s.c.leer('examenes/01-examen.md');
    assert.match(texto, /^---\ntipo: examen\n/); assert.match(texto, /- \[x\] b\) Baja/); assert.match(texto, /- \[x\] b\) Unidad de cuenta\n- \[ \] c\)/);
    assert.equal((await (await s.pedir('/api/examen?p=examenes/01-examen.md')).json()).preguntas[0].opciones[1].marcada, true);
  } finally { await s.cerrar(); }
  const k = await arrancar({ kit: 'kit' });
  try {
    const falsa = `const a = process.argv.slice(2); if (a[0] === '--revision') { process.stdout.write('Revisión resuelta'); process.exit(0); } process.stdout.write('examen.js ' + JSON.stringify(a)); process.exit(0);`;
    fs.mkdirSync(path.join(k.c.raiz, '.kit', 'herramientas'), { recursive: true });
    fs.writeFileSync(path.join(k.c.raiz, '.kit', 'herramientas', 'examen.js'), falsa);
    const ex = await (await k.pedir('/api/examen?p=examenes/01-examen.md')).json();
    assert.equal(ex.validable, true);
    const post = (ruta, body) => k.pedir(ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const r = await (await post('/api/examen/validar', { ruta: 'examenes/01-examen.md', respuestas: { 1: ['a'] } })).json();
    assert.deepEqual(r, { codigo: 0, corregido: true, salida: 'examen.js ["--corregir","estudio/examenes/01-examen.md"]' });
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
