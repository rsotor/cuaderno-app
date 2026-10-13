'use strict';
// Segunda tanda de maquetas (2026-10-13): variante A2 = A con los cambios de Roberto. NO toca la app: copia del cuaderno de
// ejemplo en cuadernos-prueba/maquetas-2026-10-13/ + HTML y CSS inyectados con Playwright. La primera tanda (maqueta.js) sigue intacta.
//   node docs/diseno/maquetas-2026-10-13/maqueta-a2.js   → regenera las capturas a2-* y mide los contrastes
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const RAIZ = path.resolve(__dirname, '..', '..', '..');
const SALIDA = __dirname;
process.env.CUADERNO_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-config-'));
const { chromium } = require(path.join(RAIZ, 'node_modules', 'playwright'));
const { Cuaderno } = require(path.join(RAIZ, 'cuaderno'));
const { detectar } = require(path.join(RAIZ, 'kit'));
const { crearServidor } = require(path.join(RAIZ, 'servidor'));

function montarCuaderno() {
  const base = path.join(RAIZ, 'cuadernos-prueba', 'maquetas-2026-10-13');
  fs.rmSync(base, { recursive: true, force: true });
  const dir = path.join(base, 'curso-ejemplo');
  fs.cpSync(path.join(RAIZ, 'ejemplos', 'cuaderno-ejemplo'), dir, { recursive: true });
  const antes = new Date(Date.now() - 3 * 86400e3).toISOString();
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Maqueta', GIT_AUTHOR_EMAIL: 'maqueta@example.com', GIT_COMMITTER_NAME: 'Maqueta', GIT_COMMITTER_EMAIL: 'maqueta@example.com', GIT_AUTHOR_DATE: antes, GIT_COMMITTER_DATE: antes };
  const git = (...a) => execFileSync('git', a, { cwd: dir, env, stdio: 'ignore' });
  git('init', '-q'); git('add', '-A'); git('commit', '-q', '-m', 'ejemplo');
  fs.appendFileSync(path.join(dir, 'lectura', 'mercado-de-la-plaza.md'), '\n');
  return { base, dir };
}

const CSS = `
:root { --apagado: #6b6f78; --borde-arbol: rgba(27,27,31,.28); }
@media (prefers-color-scheme: dark) { :root { --apagado: #7f848d; --borde-arbol: rgba(230,230,230,.30); } }
.marca { padding: 12px 12px 4px !important; gap: 0 !important; position: relative; }
.marca > a, .marca > small, .marca > .guardar-barra { display: none !important; }
.m-linea1 { display: flex; align-items: center; min-height: 30px; padding-right: 36px; }
.m-nombre { display: flex; gap: 8px; align-items: center; min-width: 0; border: 0; background: none; padding: 3px 6px; min-height: 28px; font-weight: 650; font-size: inherit; color: var(--tinta); border-radius: var(--radio); }
.m-nombre:hover, .m-nombre[aria-expanded="true"] { background: rgba(127,127,127,.16); border: 0; }
.m-nombre span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-nombre .icono { flex: none; }
.m-nombre .m-v { width: 15px; height: 15px; stroke-width: 2; color: var(--tinta-suave); }
.m-linea2 { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.m-texto { flex: 1 1 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; color: var(--tinta); padding-left: 6px; }
.m-texto.ok { font-weight: 500; color: var(--tinta-suave); }
.m-linea2 button { flex: none; }
.m-linea2 .m-guardar { min-height: 28px; padding: 2px 10px; font-size: 13px; }
.m-linea2 .m-guardar.quieto { background: transparent; color: var(--acento); border: 1px solid var(--acento); font-weight: 600; }
.m-linea2 .m-guardar.quieto:hover { background: var(--acento-suave); }
.m-linea2 .m-guardar.sin { color: var(--tinta-suave); }
.m-linea2 .m-ico { width: 28px; min-height: 28px; height: 28px; padding: 0; }
.m-fila { display: flex; align-items: center; gap: 0; padding: 6px 6px 8px; }
.m-btn { border: 0; background: none; color: var(--tinta-suave); min-height: 30px; padding: 0 5px; gap: 4px; text-decoration: none; display: inline-flex; align-items: center; border-radius: var(--radio); font-size: 12.5px; white-space: nowrap; flex: none; }
.m-btn:hover { background: rgba(127,127,127,.16); color: var(--tinta); border: 0; }
.m-btn.solo { width: 28px; padding: 0; justify-content: center; }
.m-btn .icono { width: 17px; height: 17px; }
.m-btn .n { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--tinta); }
.m-btn.mas { margin-left: auto; color: var(--acento); }
.paginas { display: none !important; }
#buscador, label[for="buscador"] { display: none !important; }
/* borde superior grueso en lugar del rótulo NOTAS */
#arbol { padding-top: 6px !important; margin: 0 10px; border-top: 2px solid var(--borde-arbol); }
.pie-lateral { display: flex !important; justify-content: flex-start !important; gap: 2px; padding: 6px 8px !important; border-top: 1px solid var(--linea); }
.pie-lateral button { border: 0 !important; background: none !important; min-height: 30px; width: 30px; padding: 0 !important; justify-content: center; flex: none !important; margin: 0 !important; color: var(--tinta-suave); border-radius: var(--radio); font-size: 0 !important; gap: 0 !important; }
.pie-lateral button:hover { background: rgba(127,127,127,.16) !important; color: var(--tinta); }
.pie-lateral .icono { width: 17px; height: 17px; }
/* barra superior */
#app .miga-barra.miga-barra { padding: 8px 20px 8px 16px !important; min-height: 50px; gap: 6px; }
#miga { font-size: 14.5px !important; color: var(--tinta-suave); }
#miga strong { color: var(--tinta); font-weight: 650; }
#miga button { display: none !important; }
.m-flechas { display: flex; margin-right: 6px; }
.m-flecha { width: 30px; min-height: 30px; padding: 0; border: 0; background: none; color: var(--tinta); border-radius: var(--radio); }
.m-flecha:hover:not([disabled]) { background: rgba(127,127,127,.16); border: 0; }
.m-flecha[disabled] { opacity: 1; color: var(--apagado); background: none; }
.m-flecha .icono { width: 19px; height: 19px; stroke-width: 2; }
.m-espacio { flex: 1; }
#btn-editar.m-editar { border: 0; background: none; color: var(--tinta); padding: 0 10px; min-height: 32px; font-weight: 500; }
#btn-editar.m-editar:hover { background: rgba(127,127,127,.16); }
.m-mas-nota { width: 32px; min-height: 32px; padding: 0; border: 0; background: none; color: var(--tinta-suave); }
.m-mas-nota .icono { width: 20px; height: 20px; stroke-width: 2; fill: currentColor; }
.m-mas-nota:hover, .m-mas-nota[aria-expanded="true"] { background: rgba(127,127,127,.16); color: var(--tinta); border: 0; }
/* menús */
.m-menu { position: absolute; z-index: 30; min-width: 250px; background: var(--papel); border: 1px solid var(--linea); border-radius: 8px; box-shadow: var(--sombra); padding: 4px; }
.m-menu button { display: flex; width: 100%; justify-content: flex-start; align-items: center; border: 0; background: none; padding: 7px 10px; gap: 10px; color: var(--tinta); font-weight: 400; text-align: left; }
.m-menu button:hover { background: rgba(127,127,127,.16); border: 0; }
.m-menu button .sub { margin-left: auto; font-size: 12px; color: var(--tinta-suave); }
.m-menu button .ok { margin-left: auto; width: 15px; height: 15px; color: var(--acento); }
.m-menu hr { border: 0; border-top: 1px solid var(--linea); margin: 4px 2px; }
.m-menu .borrar, .m-menu .borrar .icono { color: var(--mal); }
.m-menu .tit { padding: 6px 10px 4px; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--tinta-suave); }
#m-menu-cuaderno { left: 12px; top: 46px; min-width: 236px; }
#m-menu-nota { right: 20px; top: 46px; }
/* tooltip simulado */
.m-tip { position: absolute; z-index: 40; background: #2a2c31; color: #f2f3f5; font-size: 12px; padding: 4px 8px; border-radius: 5px; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
/* modal de búsqueda */
.m-velo { position: fixed; inset: 0; z-index: 50; background: rgba(10,12,16,.38); display: flex; justify-content: center; align-items: flex-start; padding-top: 11vh; }
.m-caja { width: min(620px, 92vw); background: var(--papel); border: 1px solid var(--linea); border-radius: 12px; box-shadow: 0 24px 60px rgba(0,0,0,.35); overflow: hidden; color: var(--tinta); }
.m-campo { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--linea); }
.m-campo .icono { width: 19px; height: 19px; color: var(--tinta-suave); flex: none; }
.m-campo .q { flex: 1; font-size: 17px; color: var(--tinta); }
.m-campo .q::after { content: ''; display: inline-block; width: 1.5px; height: 1.1em; background: var(--acento); vertical-align: -2px; margin-left: 1px; }
.m-campo kbd, .m-pie kbd { font: 11.5px/1 inherit; font-family: inherit; border: 1px solid var(--linea); border-radius: 4px; padding: 2px 5px; color: var(--tinta-suave); }
.m-lista { padding: 6px; }
.m-res { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 7px; }
.m-res.sel { background: var(--acento-suave); }
.m-res .icono { width: 17px; height: 17px; color: var(--tinta-suave); flex: none; }
.m-res .t { font-size: 14.5px; }
.m-res .s { display: block; font-size: 12.5px; color: var(--tinta-suave); margin-top: 1px; }
.m-res .t b { font-weight: 700; color: var(--acento); }
.m-res .c { margin-left: auto; font-size: 12.5px; color: var(--tinta-suave); }
.m-tarea { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-top: 1px solid var(--linea); font-size: 14px; }
.m-tarea .icono { width: 17px; height: 17px; color: var(--acento); }
.m-tarea .r { margin-left: auto; color: var(--tinta-suave); font-size: 12.5px; }
.m-pie { display: flex; gap: 14px; padding: 8px 16px; border-top: 1px solid var(--linea); font-size: 12px; color: var(--tinta-suave); background: rgba(127,127,127,.06); }
@media (max-width: 760px) {
  .m-flechas { display: none !important; }
  #btn-editar.m-editar .txt { display: none; }
  #app .miga-barra.miga-barra { padding: 8px 8px !important; }
}
`;

function aplicar({ css, textoEstado, cambios, anchoLateral, accion }) {
  const $ = s => document.querySelector(s);
  const ico = (id, extra = '') => `<svg class="icono" aria-hidden="true" ${extra}><use href="#${id}"/></svg>`;
  $('svg[style*="display:none"]').insertAdjacentHTML('beforeend', `
    <symbol id="m-abajo" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
    <symbol id="m-izq" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></symbol>
    <symbol id="m-der" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></symbol>
    <symbol id="m-mas" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
    <symbol id="m-lupa" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></symbol>
    <symbol id="m-check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></symbol>
    <symbol id="m-nota" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/></symbol>
    <symbol id="m-puntos" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5" stroke="none"/><circle cx="12" cy="12" r="1.5" stroke="none"/><circle cx="19" cy="12" r="1.5" stroke="none"/></symbol>`);
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  if (anchoLateral) { const s2 = document.createElement('style'); s2.textContent = `#app { grid-template-columns: ${anchoLateral}px minmax(0, 1fr) !important; }`; document.head.appendChild(s2); }

  const nombre = $('#nombre-curso').textContent;
  const nT = $('#n-tareas').textContent.replace(/[()]/g, '') || '1';
  const nC = $('#n-comentarios').textContent.replace(/[()]/g, '') || '3';

  // nombre ▾ (abre el selector) + plegar; segunda línea: estado + Guardar + traer + deshacer
  const marca = $('.marca');
  const l1 = document.createElement('div'); l1.className = 'm-linea1';
  l1.innerHTML = `<button type="button" class="m-nombre" id="m-nombre" aria-haspopup="menu" aria-expanded="false" title="Cambiar de cuaderno">${ico('i-cuaderno')}<span>${nombre}</span>${ico('m-abajo', 'class="icono m-v"')}</button>`;
  const l2 = document.createElement('div'); l2.className = 'm-linea2';
  l2.innerHTML = `<span class="m-texto ${cambios ? '' : 'ok'}" title="${textoEstado}">${textoEstado}</span>
    <button type="button" class="m-guardar ${cambios ? 'quieto' : 'sin secundario'}" title="Guardar el cuaderno entero (todas las notas con cambios), no solo esta nota" aria-label="Guardar el cuaderno">Guardar</button>
    <button type="button" class="m-ico secundario" title="Traer lo que cambió en otro sitio" aria-label="Traer">${ico('i-traer')}</button>
    <button type="button" class="m-ico secundario" title="Deshacer el último guardado del cuaderno" aria-label="Deshacer el último guardado">${ico('i-deshacer')}</button>`;
  marca.append(l1, l2);
  marca.appendChild($('#btn-plegar'));

  // fila de accesos: ⌂ lupa Tareas 1 Comentarios 3 … +
  const fila = document.createElement('div'); fila.className = 'm-fila';
  fila.innerHTML = `<a class="m-btn solo" href="#/" title="Inicio" aria-label="Inicio">${ico('i-casa')}</a>
    <button type="button" class="m-btn solo" id="btn-lupa" title="Buscar (⌘K)" aria-label="Buscar">${ico('m-lupa')}</button>
    <a class="m-btn" href="#/tareas" title="Tareas (${nT} abierta)" aria-label="Tareas, ${nT} abierta">Tareas <span class="n">${nT}</span></a>
    <a class="m-btn" href="#/comentarios" title="Comentarios (${nC})" aria-label="Comentarios, ${nC}">Comentarios <span class="n">${nC}</span></a>
    <button type="button" class="m-btn solo mas" title="Nueva nota" aria-label="Nueva nota">${ico('m-mas')}</button>`;
  $('#buscador').after(fila);

  // barra superior
  const barra = $('.miga-barra');
  const flechas = document.createElement('div'); flechas.className = 'm-flechas';
  flechas.innerHTML = `<button type="button" class="m-flecha" title="Atrás (⌘[)" aria-label="Atrás">${ico('m-izq')}</button><button type="button" class="m-flecha" id="m-adelante" title="Adelante (⌘])" aria-label="Adelante" disabled>${ico('m-der')}</button>`;
  const espacio = document.createElement('span'); espacio.className = 'm-espacio';
  const editar = $('#btn-editar'); editar.hidden = false; editar.className = 'm-editar'; editar.innerHTML = `${ico('i-lapiz')}<span class="txt">Editar</span>`;
  const mas = document.createElement('button'); mas.type = 'button'; mas.className = 'm-mas-nota'; mas.id = 'btn-mas'; mas.setAttribute('aria-label', 'Más acciones de la nota'); mas.title = 'Más acciones'; mas.setAttribute('aria-haspopup', 'menu'); mas.innerHTML = ico('m-puntos');
  barra.insertBefore(flechas, $('#miga'));
  barra.append(espacio, editar, mas);
  barra.style.position = 'relative';

  if (accion === 'menu-nota') {
    mas.setAttribute('aria-expanded', 'true');
    const m = document.createElement('div'); m.id = 'm-menu-nota'; m.className = 'm-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = `<button role="menuitem">${ico('i-carpeta')}Mostrar en el Finder</button><button role="menuitem">${ico('i-copiar')}Copiar la ruta</button><button role="menuitem">${ico('i-ojo-tachado')}Ocultar<span class="sub">solo en la app</span></button><hr><button role="menuitem" class="borrar">${ico('i-papelera')}Mover a la papelera</button>`;
    barra.appendChild(m);
  }
  if (accion === 'selector') {
    $('#m-nombre').setAttribute('aria-expanded', 'true');
    const m = document.createElement('div'); m.id = 'm-menu-cuaderno'; m.className = 'm-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = `<div class="tit">Recientes</div>
      <button role="menuitemradio" aria-checked="true">${ico('i-cuaderno')}${nombre}${ico('m-check', 'class="icono ok"')}</button>
      <button role="menuitem">${ico('i-cuaderno')}taller-de-escritura</button>
      <button role="menuitem">${ico('i-cuaderno')}historia-del-arte</button>
      <button role="menuitem">${ico('i-cuaderno')}cocina-de-temporada</button><hr>
      <button role="menuitem">${ico('i-carpeta')}Abrir carpeta…</button>`;
    marca.appendChild(m);
  }
  if (accion === 'tooltip') {
    const r = $('#btn-lupa').getBoundingClientRect();
    const t = document.createElement('div'); t.className = 'm-tip'; t.textContent = 'Buscar (⌘K)';
    t.style.left = (r.left - 6) + 'px'; t.style.top = (r.bottom + 6) + 'px';
    document.body.appendChild(t);
    $('#btn-lupa').style.background = 'rgba(127,127,127,.16)';
  }
  if (accion === 'modal') {
    const v = document.createElement('div'); v.className = 'm-velo';
    const r = (t, c, sel, sn) => `<div class="m-res${sel ? ' sel' : ''}">${ico('m-nota')}<span class="t">${t}${sn ? `<span class="s">${sn}</span>` : ''}</span><span class="c">${c}</span></div>`;
    v.innerHTML = `<div class="m-caja" role="dialog" aria-label="Buscar">
      <div class="m-campo">${ico('m-lupa')}<span class="q">merc</span><kbd>esc</kbd></div>
      <div class="m-lista">
        ${r('<b>merc</b>ado-de-la-plaza', 'lectura', true)}
        ${r('pendientes', 'iniciativas / mudanza', false, '…pasar por el <b>merc</b>ado a por cajas…')}
        ${r('capital', 'conceptos', false, '…el <b>merc</b>ado de capitales…')}
        ${r('inicio', '', false, '…la lectura del <b>merc</b>ado de la plaza…')}
      </div>
      <div class="m-tarea">${ico('m-mas')}<span>Apuntar tarea: «merc»</span><span class="r">escribe + delante</span></div>
      <div class="m-pie"><span><kbd>↑</kbd> <kbd>↓</kbd> moverse</span><span><kbd>↵</kbd> abrir</span><span><kbd>⌘</kbd><kbd>↵</kbd> tarea</span><span><kbd>esc</kbd> cerrar</span></div></div>`;
    document.body.appendChild(v);
  }
}

// contraste WCAG entre el color de un elemento (su trazo/texto) y el fondo efectivo que tiene detrás
function medir(sel) {
  const el = document.querySelector(sel);
  const parse = c => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] === undefined ? 1 : m[3] }; };
  let fondo = { r: 255, g: 255, b: 255 };
  const cadena = []; for (let e = el; e; e = e.parentElement) cadena.push(e);
  for (const e of cadena.reverse()) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) fondo = { r: fondo.r * (1 - c.a) + c.r * c.a, g: fondo.g * (1 - c.a) + c.g * c.a, b: fondo.b * (1 - c.a) + c.b * c.a }; }
  const t = parse(getComputedStyle(el).color); const op = parseFloat(getComputedStyle(el).opacity);
  const a = t.a * op;
  const f = { r: fondo.r * (1 - a) + t.r * a, g: fondo.g * (1 - a) + t.g * a, b: fondo.b * (1 - a) + t.b * a };
  const L = c => { const f2 = [c.r, c.g, c.b].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * f2[0] + .7152 * f2[1] + .0722 * f2[2]; };
  const [l1, l2] = [L(f), L(fondo)].sort((x, y) => y - x);
  return +((l1 + .05) / (l2 + .05)).toFixed(2);
}

async function main() {
  const { dir } = montarCuaderno();
  const kit = detectar(dir);
  const server = crearServidor({ cuaderno: new Cuaderno(dir, kit.base), kit, pty: null, plataforma: 'darwin' });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const navegador = await chromium.launch();
  const contrastes = [];
  try {
    const hecho = [];
    async function foto(nombre, { tema = 'light', ancho = 1440, alto = 900, textoEstado = '1 cambio', cambios = true, anchoLateral = null, accion = null, abrirMenu = false, medirTema = null, clip = null } = {}) {
      const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, colorScheme: tema });
      await ctx.addInitScript(() => { window.cuadernoApp = { plataforma: 'darwin', alAccion() {}, elegirCarpeta: async () => null }; });
      const p = await ctx.newPage();
      p.on('pageerror', e => console.error('[error en la página]', e.message));
      await p.goto(server.urlEntrada());
      await p.goto(`http://localhost:${server.address().port}/#/n/lectura/mercado-de-la-plaza.md`);
      await p.reload(); await p.locator('#miga strong').waitFor();
      await p.locator('#btn-editar:not([hidden])').waitFor();
      await p.waitForTimeout(600);
      await p.evaluate(aplicar, { css: CSS, textoEstado, cambios, anchoLateral, accion });
      if (abrirMenu) await p.click('#btn-menu');
      await p.waitForTimeout(500);
      if (medirTema) {
        for (const [etq, sel] of [['«…» de la nota', '#btn-mas'], ['flecha › apagada', '#m-adelante'], ['flecha ‹ activa', '.m-flecha'], ['lupa/accesos', '#btn-lupa'], ['texto de estado', '.m-texto'], ['Guardar (borde y texto)', '.m-guardar']]) {
          contrastes.push(`${medirTema}: ${etq} = ${await p.evaluate(medir, sel)}:1 (color ${await p.evaluate(s => getComputedStyle(document.querySelector(s)).color, sel)})`);
        }
      }
      await p.screenshot({ path: path.join(SALIDA, nombre), ...(clip ? { clip } : {}) });
      hecho.push(nombre);
      await ctx.close();
    }
    await foto('a2-claro.png', { tema: 'light', medirTema: 'claro' });
    await foto('a2-oscuro.png', { tema: 'dark', medirTema: 'oscuro' });
    await foto('a2-menu-nota.png', { accion: 'menu-nota' });
    await foto('a2-selector-cuaderno.png', { accion: 'selector' });
    await foto('a2-busqueda-modal-claro.png', { accion: 'modal' });
    await foto('a2-busqueda-modal-oscuro.png', { tema: 'dark', accion: 'modal' });
    await foto('a2-estado-largo.png', { anchoLateral: 260, textoEstado: '128 cambios por guardar' });
    await foto('a2-estrecho-menu.png', { ancho: 700, abrirMenu: true });
    await foto('a2-tooltip-lupa.png', { accion: 'tooltip', clip: { x: 0, y: 0, width: 420, height: 260 } });
    console.log(hecho.join('\n')); console.log(contrastes.join('\n'));
  } finally {
    await navegador.close();
    await new Promise(r => server.close(r));
    fs.rmSync(process.env.CUADERNO_CONFIG_DIR, { recursive: true, force: true });
  }
}
main().catch(e => { console.error(e); process.exit(1); });
