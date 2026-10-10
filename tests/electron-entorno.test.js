'use strict';
// El entorno de la shell de login para la app de escritorio (electron/entorno.js): con shells falsas (scripts) que
// hacen ruido, que tardan o que solo contestan en modo interactivo; qué variables se importan; Windows; el Node del kit.
// Es asíncrona (spawn con promesa) para que el proceso principal de la app siga atendiendo eventos mientras espera.
// Y las puras de la ventana: esquemaPermitido (qué enlaces van fuera) y temaNativo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { entornoDeLaShell, ejecutarShell, nodeDelKit, esquemaPermitido, temaNativo, parsear, respaldo, MARCADOR, ESQUEMAS, TOPE } = require('../electron/entorno');

const sinSh = process.platform === 'win32';   // las shells falsas son scripts de sh: en Windows no se ejecutan (ni hace falta)
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-entorno-'));
const home = path.join(base, 'casa');
fs.mkdirSync(path.join(home, '.nvm', 'versions', 'node', 'v24.1.0', 'bin'), { recursive: true });
fs.mkdirSync(path.join(home, '.nvm', 'versions', 'node', 'v22.0.0', 'bin'), { recursive: true });
// Una shell de mentira: un script que recibe (-lc | -ilc, orden), hace lo que diga `cuerpo` y, si `ejecuta`, ejecuta la orden.
function shell(nombre, cuerpo) {
  const f = path.join(base, nombre);
  fs.writeFileSync(f, `#!/bin/sh\n${cuerpo}\n`, { mode: 0o755 });
  return f;
}
const ruidosa = shell('ruidosa', 'echo "Bienvenido al sistema (MOTD)"; echo "nvm: aviso" >&2; export PATH="/ruta/de/la/shell/bin:$PATH" LANG=es_ES.UTF-8 LC_ALL=es_ES.UTF-8 SSH_AUTH_SOCK=/tmp/agente.sock GIT_SSH_COMMAND="ssh -i clave" SECRETA=no; eval "$2"; echo "y más ruido al salir"');
const soloInteractiva = shell('solo-interactiva', 'if [ "$1" = "-ilc" ]; then export PATH="/interactiva/bin:$PATH"; eval "$2"; else echo "nada, el PATH está en el .bashrc"; fi');
const lenta = shell('lenta', 'sleep 5; eval "$2"');
const rota = shell('rota', 'echo "error al cargar el perfil" >&2; exit 1');
const env = { PATH: '/usr/bin:/bin', HOME: home, SHELL: ruidosa, PROPIA: 'sí' };
test.after(() => fs.rmSync(base, { recursive: true, force: true }));

test('parsear: lo de fuera de los marcadores es ruido; dentro, NOMBRE=valor por \\0 (valores con = y saltos de línea)', () => {
  const salida = `MOTD\nmás ruido ${MARCADOR}PATH=/a:/b\0LANG=es_ES.UTF-8\0CON_IGUAL=a=b=c\0MULTI=una\nlínea\0${MARCADOR}adiós\n`;
  assert.deepEqual(parsear(salida), { PATH: '/a:/b', LANG: 'es_ES.UTF-8', CON_IGUAL: 'a=b=c', MULTI: 'una\nlínea' });
  assert.equal(parsear('sin marcadores'), null);
  assert.equal(parsear(`${MARCADOR}solo uno`), null, 'con un marcador no vale: la salida está cortada');
  assert.deepEqual(parsear(`${MARCADOR}${MARCADOR}`), {}, 'vacío entre marcadores es un entorno vacío, no un fallo');
});

test('shell con ruido antes y después: se importan PATH, LANG, LC_*, SSH_AUTH_SOCK y GIT_*, no lo demás; el respaldo se añade al final', { skip: sinSh }, async () => {
  const r = await entornoDeLaShell({ env, home, plataforma: 'linux' });
  assert.equal(r.origen, 'shell -lc');
  assert.equal(r.shell, ruidosa);
  assert.equal(r.error, undefined);
  assert.ok(r.env.PATH.startsWith('/ruta/de/la/shell/bin:/usr/bin:/bin:'), `el PATH de la shell primero: ${r.env.PATH}`);
  assert.equal(r.env.PATH, ['/ruta/de/la/shell/bin', '/usr/bin', '/bin', ...respaldo(home)].join(':'));
  assert.equal(r.env.LANG, 'es_ES.UTF-8'); assert.equal(r.env.LC_ALL, 'es_ES.UTF-8');
  assert.equal(r.env.SSH_AUTH_SOCK, '/tmp/agente.sock'); assert.equal(r.env.GIT_SSH_COMMAND, 'ssh -i clave');
  assert.equal(r.env.SECRETA, undefined, 'una variable que no está en la lista no se importa');
  assert.equal(r.env.PROPIA, 'sí', 'lo que ya tenía el proceso se conserva');
  assert.equal(r.env.HOME, home);
  assert.ok(r.ms >= 0 && r.ms < 5000);
  assert.deepEqual(env, { PATH: '/usr/bin:/bin', HOME: home, SHELL: ruidosa, PROPIA: 'sí' }, 'el entorno de partida no se toca');
});

test('si -lc no da marcadores se prueba -ilc (el PATH en el .bashrc)', { skip: sinSh }, async () => {
  const r = await entornoDeLaShell({ env: { ...env, SHELL: soloInteractiva }, home, plataforma: 'linux' });
  assert.equal(r.origen, 'shell -ilc');
  assert.ok(r.env.PATH.startsWith('/interactiva/bin:'));
  assert.equal(r.error, undefined);
});

test('shell que tarda más del tope: respaldo, con el motivo, y las rutas conocidas en el PATH', { skip: sinSh }, async () => {
  const t0 = Date.now();
  let latidos = 0;
  const latido = setInterval(() => latidos++, 20);   // mientras se espera a la shell, el bucle de eventos sigue vivo
  const r = await entornoDeLaShell({ env: { ...env, SHELL: lenta }, home, plataforma: 'linux', tope: 400 });
  clearInterval(latido);
  assert.ok(Date.now() - t0 < 4000, 'no espera a que la shell acabe');
  assert.ok(latidos >= 5, `el proceso atendió eventos mientras esperaba (${latidos} latidos)`);
  assert.equal(r.origen, 'respaldo');
  assert.match(r.error, /lenta -lc: no ha contestado en 0\.4 s/);
  assert.equal(r.env.PATH, ['/usr/bin', '/bin', ...respaldo(home)].join(':'));
  assert.ok(r.env.PATH.includes('/opt/homebrew/bin') && r.env.PATH.includes(path.join(home, '.local', 'bin')));
  assert.ok(r.env.PATH.includes(path.join(home, '.nvm', 'versions', 'node', 'v24.1.0', 'bin')), 'las versiones de nvm');
});

test('shell que falla sin marcadores en -lc ni en -ilc: respaldo y el código de salida en el error', { skip: sinSh }, async () => {
  const r = await entornoDeLaShell({ env: { ...env, SHELL: rota }, home, plataforma: 'linux' });
  assert.equal(r.origen, 'respaldo');
  assert.match(r.error, /rota -ilc: sin marcadores en la salida \(código 1\)/);
});

test('shell que no existe: respaldo con el error del sistema', { skip: sinSh }, async () => {
  const r = await entornoDeLaShell({ env: { ...env, SHELL: path.join(base, 'no-existe') }, home, plataforma: 'linux' });
  assert.equal(r.origen, 'respaldo');
  assert.match(r.error, /no-existe -lc: .*ENOENT/);
});

test('`ejecutar` inyectable (devuelva promesa o valor): se llama con -lc y la orden con env -0 entre marcadores, y con el tope', async () => {
  const llamadas = [];
  const ejecutar = async (sh, args, o) => { llamadas.push({ sh, args, o }); return { stdout: `${MARCADOR}PATH=/x\0LANG=C\0${MARCADOR}`, status: 0 }; };
  const r = await entornoDeLaShell({ env: { PATH: '/bin', SHELL: '/bin/zsh' }, home, plataforma: 'darwin', ejecutar, tope: 1234 });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].sh, '/bin/zsh');
  assert.deepEqual(llamadas[0].args, ['-lc', `printf ${MARCADOR}; env -0; printf ${MARCADOR}`]);
  assert.equal(llamadas[0].o.timeout, 1234);
  assert.equal(r.origen, 'shell -lc'); assert.equal(r.env.LANG, 'C');
  assert.ok(r.env.PATH.startsWith('/x:'));
  // Sin SHELL, /bin/sh.
  const r2 = await entornoDeLaShell({ env: { PATH: '/bin' }, home, plataforma: 'linux', ejecutar: (sh, a) => { llamadas.push({ sh, a }); return { stdout: '', status: 0 }; } });
  assert.equal(llamadas[1].sh, '/bin/sh'); assert.equal(llamadas[2].a[0], '-ilc'); assert.equal(r2.origen, 'respaldo');
});

test('la shell contesta con marcadores pero su entorno no trae PATH: el error lo dice así (no «sin marcadores»), y se pasa a -ilc', async () => {
  const llamadas = [];
  const ejecutar = (sh, args) => { llamadas.push(args[0]); return { stdout: `${MARCADOR}LANG=C\0${MARCADOR}`, status: 0 }; };
  const r = await entornoDeLaShell({ env: { PATH: '/bin', SHELL: '/bin/zsh' }, home, plataforma: 'darwin', ejecutar });
  assert.deepEqual(llamadas, ['-lc', '-ilc']);
  assert.equal(r.origen, 'respaldo');
  assert.equal(r.error, '/bin/zsh -ilc: la shell contestó pero su entorno no trae PATH (código 0)');
  assert.equal(r.env.LANG, undefined, 'sin PATH no se importa nada: la respuesta no es de fiar');
});

test('Windows: no se ejecuta nada ni se añade nada; origen «sistema»', async () => {
  const ejecutar = () => { throw new Error('no debía ejecutarse'); };
  const r = await entornoDeLaShell({ env: { PATH: 'C:\\Windows', SHELL: 'x' }, home, plataforma: 'win32', ejecutar });
  assert.deepEqual(r, { env: { PATH: 'C:\\Windows', SHELL: 'x' }, origen: 'sistema', ms: 0, shell: null });
});

test('respaldo: Homebrew, /usr/local/bin, ~/.local/bin y las versiones de nvm (la más nueva primero); sin nvm, sin versiones', () => {
  assert.deepEqual(respaldo(home), ['/opt/homebrew/bin', '/usr/local/bin', path.join(home, '.local', 'bin'), path.join(home, '.nvm', 'versions', 'node', 'v24.1.0', 'bin'), path.join(home, '.nvm', 'versions', 'node', 'v22.0.0', 'bin')]);
  assert.deepEqual(respaldo(path.join(base, 'sin-nvm')), ['/opt/homebrew/bin', '/usr/local/bin', path.join(base, 'sin-nvm', '.local', 'bin')]);
});

test('nodeDelKit: el binario del padre (CUADERNO_NODE) con ELECTRON_RUN_AS_NODE; sin la variable, el de este proceso', () => {
  assert.deepEqual(nodeDelKit({ CUADERNO_NODE: '/apps/Cuaderno' }), { cmd: '/apps/Cuaderno', env: { ELECTRON_RUN_AS_NODE: '1' } });
  assert.deepEqual(nodeDelKit({}), { cmd: process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' } });
  assert.equal(nodeDelKit().cmd, process.execPath);
});

test('ejecutarShell: el contrato de spawnSync en asíncrono (stdout, status; error con ETIMEDOUT o ENOENT), y el tope por defecto son 10 s', { skip: sinSh }, async () => {
  assert.equal(TOPE, 10_000);
  const bien = await ejecutarShell(ruidosa, ['-lc', 'printf hola'], { timeout: 5000, env: { PATH: '/usr/bin:/bin' } });
  assert.equal(bien.status, 0); assert.ok(bien.stdout.includes('hola')); assert.equal(bien.error, undefined);
  const mal = await ejecutarShell(rota, ['-lc', 'x'], { timeout: 5000, env: { PATH: '/usr/bin:/bin' } });
  assert.equal(mal.status, 1);
  const t0 = Date.now();
  const tarde = await ejecutarShell(lenta, ['-lc', 'x'], { timeout: 100, env: { PATH: '/usr/bin:/bin' } });
  assert.ok(Date.now() - t0 < 3000);
  assert.equal(tarde.error.code, 'ETIMEDOUT'); assert.equal(tarde.status, null);
  const noHay = await ejecutarShell(path.join(base, 'no-existe'), ['-lc', 'x'], { timeout: 1000, env: {} });
  assert.equal(noHay.error.code, 'ENOENT');
});

test('esquemaPermitido: solo http, https y mailto van al navegador del sistema; file, javascript, smb, vnc, data, lo roto y lo vacío, no', () => {
  assert.deepEqual(ESQUEMAS, ['http:', 'https:', 'mailto:']);
  for (const u of ['https://example.com/ruta?x=1', 'http://example.com', 'HTTPS://MAYUSCULAS.example', 'mailto:alguien@example.com']) assert.equal(esquemaPermitido(u), true, u);
  for (const u of ['file:///etc/passwd', 'javascript:alert(1)', 'smb://servidor/recurso', 'vnc://host', 'data:text/html,hola', 'ftp://example.com', 'about:blank', 'no es una url', '', null, undefined, 42]) assert.equal(esquemaPermitido(u), false, String(u));
});

test('temaNativo: auto → system, claro → light, oscuro → dark; cualquier otra cosa → system', () => {
  assert.equal(temaNativo('auto'), 'system'); assert.equal(temaNativo('claro'), 'light'); assert.equal(temaNativo('oscuro'), 'dark');
  for (const t of ['dark', 'light', 'system', '', null, undefined, 3, 'Oscuro']) assert.equal(temaNativo(t), 'system', String(t));
});
