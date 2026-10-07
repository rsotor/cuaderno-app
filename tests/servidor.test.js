'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Cuaderno } = require('../cuaderno');
const { detectar } = require('../kit');
const { crearServidor } = require('../servidor');
const { crearCuaderno } = require('./ayuda');

async function arrancar(opciones = {}) {
  const c = crearCuaderno(opciones);
  const kit = detectar(c.raiz);
  const server = crearServidor({ cuaderno: new Cuaderno(c.raiz, kit.base), kit, token: 'ab'.repeat(16) });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const puerto = server.address().port;
  const base = `http://127.0.0.1:${puerto}`;
  const cookie = `cuaderno=${server.token}`;
  const pedir = (ruta, opts = {}) => fetch(base + ruta, { redirect: 'manual', ...opts, headers: { cookie, ...(opts.headers || {}) } });
  const cerrar = () => new Promise(r => server.close(() => { c.borrar(); r(); }));
  return { c, server, base, puerto, cookie, pedir, cerrar };
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
    assert.deepEqual(info, { nombre: require('node:path').basename(s.c.raiz), kit: 'kit', profesor: true, portada: 'inicio.md' });
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
    assert.equal((await s.pedir('/fichero/conceptos/capital.md')).status, 200);
    assert.equal((await s.pedir('/fichero/..%2F..%2Fx')).status, 400);
  } finally { await s.cerrar(); }
});

test('sin kit: sin profesor y las tareas son solo las propias', async () => {
  const s = await arrancar();
  try {
    const info = await (await s.pedir('/api/info')).json();
    assert.equal(info.kit, 'carpeta'); assert.equal(info.profesor, false);
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
