'use strict';
// Maquetas visuales de la reorganización de navegación (2026-10-13). NO toca la app: arranca el servidor sobre una copia
// del cuaderno de ejemplo en cuadernos-prueba/maquetas-2026-10-13/ e inyecta HTML y CSS en la página con Playwright.
//   node docs/diseno/maquetas-2026-10-13/maqueta.js        → regenera las capturas en esta misma carpeta
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

// ---------- el cuaderno: copia nueva del de ejemplo, con git (3 días desde el último guardado y 1 cambio pendiente)
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

// ---------- la maqueta (todo lo que sigue se ejecuta DENTRO de la página)
const CSS = `
/* ===== común A y B ===== */
.marca { padding: 12px 12px 6px !important; gap: 0 !important; }
.marca > a, .marca > small, .marca > .guardar-barra { display: none !important; }
.m-linea1 { display: flex; align-items: center; min-height: 30px; padding-right: 36px; }
.m-grupo { display: flex; align-items: center; min-width: 0; border-radius: var(--radio); }
.m-grupo:hover { background: rgba(127,127,127,.12); }
.m-nombre { display: flex; gap: 8px; align-items: center; min-width: 0; padding: 3px 4px 3px 6px; font-weight: 650; color: var(--tinta); text-decoration: none; }
.m-nombre span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-selector { flex: none; border: 0; background: none; min-height: 24px; padding: 0 6px 0 0; color: var(--tinta-suave); line-height: 1; }
.m-selector .icono { width: 15px; height: 15px; stroke-width: 2; }
.m-selector:hover { border: 0; color: var(--tinta); }
.m-linea2 { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
.m-texto { flex: 1 1 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; color: var(--tinta-suave); padding-left: 2px; }
.m-linea2 button { flex: none; }
.m-linea2 .m-guardar { min-height: 28px; padding: 2px 11px; font-size: 13.5px; }
.m-linea2 .m-ico { width: 28px; min-height: 28px; height: 28px; padding: 0; }
.m-linea2 .m-guardar:not(.primario) { color: var(--tinta-suave); }
.m-fila { display: flex; align-items: center; gap: 2px; padding: 2px 10px 4px; }
.m-btn { border: 0; background: none; color: var(--tinta-suave); min-height: 30px; padding: 0 8px; gap: 5px; text-decoration: none; display: inline-flex; align-items: center; border-radius: var(--radio); }
.m-btn:hover { background: rgba(127,127,127,.14); color: var(--tinta); border: 0; }
.m-btn.activa { background: var(--acento-suave); color: var(--acento); }
.m-btn .icono { width: 17px; height: 17px; }
.m-btn .n { font-size: 12px; font-variant-numeric: tabular-nums; }
.m-btn.mas { margin-left: auto; color: var(--acento); }
.m-rotulo { margin: 8px 18px 0; padding: 12px 0 2px; border-top: 1px solid var(--linea); font-size: 11px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: var(--tinta-suave); }
.paginas, .pie-lateral { display: none !important; }
#arbol { padding-top: 2px !important; }
#buscador { margin: 8px 12px 8px !important; }
.m-nueva { display: flex; align-items: center; gap: 8px; margin: 0 12px 0; padding: 6px 10px; border: 0; background: none; color: var(--tinta-suave); min-height: 32px; justify-content: flex-start; width: calc(100% - 24px); }
.m-nueva:hover { background: rgba(127,127,127,.14); color: var(--tinta); border: 0; }
.m-nueva .icono { color: var(--acento); }
/* ===== barra superior ===== */
#app .miga-barra.miga-barra { padding: 8px 20px 8px 16px !important; min-height: 50px; gap: 6px; }
#miga { font-size: 14.5px !important; color: var(--tinta-suave); }
#miga strong { color: var(--tinta); font-weight: 650; }
#miga button { display: none !important; }
.m-flechas { display: flex; gap: 0; margin-right: 6px; }
.m-flecha { width: 30px; min-height: 30px; padding: 0; border: 0; background: none; color: var(--tinta); border-radius: var(--radio); }
.m-flecha:hover { background: rgba(127,127,127,.14); border: 0; }
.m-flecha[disabled] { opacity: .32; background: none; }
.m-flecha .icono { width: 19px; height: 19px; stroke-width: 2; }
.m-espacio { flex: 1; }
#btn-editar.m-editar { border: 0; background: none; color: var(--tinta); padding: 0 10px; min-height: 32px; font-weight: 500; }
#btn-editar.m-editar:hover { background: rgba(127,127,127,.14); }
.m-mas-nota { width: 32px; min-height: 32px; padding: 0; border: 0; background: none; color: var(--tinta-suave); }
.m-mas-nota:hover { background: rgba(127,127,127,.14); color: var(--tinta); border: 0; }
.m-div { width: 1px; height: 20px; background: var(--linea); margin: 0 8px; flex: none; }
.m-bar-iconos { display: flex; gap: 2px; align-items: center; }
.m-menu { position: absolute; right: 20px; top: 46px; z-index: 30; min-width: 230px; background: var(--papel); border: 1px solid var(--linea); border-radius: 8px; box-shadow: var(--sombra); padding: 4px; }
.m-menu button { display: flex; width: 100%; justify-content: flex-start; border: 0; background: none; padding: 7px 10px; gap: 10px; color: var(--tinta); }
.m-menu button:hover { background: rgba(127,127,127,.14); border: 0; }
.m-menu hr { border: 0; border-top: 1px solid var(--linea); margin: 4px 2px; }
.m-menu .borrar { color: var(--mal); }
@media (max-width: 760px) {
  .m-flechas, .m-bar-iconos, .m-div { display: none !important; }
  #btn-editar.m-editar .txt { display: none; }
  #app .miga-barra.miga-barra { padding: 8px 8px 8px 8px !important; }
}
`;

function aplicar({ variante, css, textoEstado, cambios, anchoLateral, menuNota }) {
  const $ = s => document.querySelector(s);
  const ico = (id, extra = '') => `<svg class="icono" aria-hidden="true" ${extra}><use href="#${id}"/></svg>`;
  // iconos nuevos, en el mismo estilo de trazo que los de la app
  $('svg[style*="display:none"]').insertAdjacentHTML('beforeend', `
    <symbol id="m-abajo" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
    <symbol id="m-izq" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></symbol>
    <symbol id="m-der" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></symbol>
    <symbol id="m-mas" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
    <symbol id="m-puntos" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></symbol>
    <symbol id="m-mover" viewBox="0 0 24 24"><path d="M3 6h6l2 2h10v11H3zM9 14h7m-3-3 3 3-3 3"/></symbol>`);
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  if (anchoLateral) { const s2 = document.createElement('style'); s2.textContent = `#app { grid-template-columns: ${anchoLateral}px minmax(0, 1fr) !important; }`; document.head.appendChild(s2); }

  const nombre = $('#nombre-curso').textContent;
  const nT = $('#n-tareas').textContent.replace(/[()]/g, '') || '1';
  const nC = $('#n-comentarios').textContent.replace(/[()]/g, '') || '3';

  // --- rojo: nombre ▾ + plegar; segunda línea: estado + Guardar + descargar + deshacer
  const marca = $('.marca');
  const l1 = document.createElement('div'); l1.className = 'm-linea1';
  l1.innerHTML = `<div class="m-grupo"><a class="m-nombre" href="#/" title="Ir al inicio del cuaderno">${ico('i-cuaderno')}<span>${nombre}</span></a><button type="button" class="m-selector" aria-label="Cambiar de cuaderno" title="Cambiar de cuaderno: recientes y Abrir carpeta…" aria-haspopup="menu">${ico('m-abajo')}</button></div>`;
  const l2 = document.createElement('div'); l2.className = 'm-linea2';
  l2.innerHTML = `<span class="m-texto" title="${textoEstado}">${textoEstado}</span>
    <button type="button" class="m-guardar ${cambios ? 'primario' : 'secundario'}" title="Guardar el cuaderno entero (todas las notas con cambios), no solo esta nota" aria-label="Guardar el cuaderno">Guardar</button>
    <button type="button" class="m-ico secundario" title="Traer lo que cambió en otro sitio" aria-label="Traer">${ico('i-traer')}</button>
    <button type="button" class="m-ico secundario" title="Deshacer el último guardado del cuaderno" aria-label="Deshacer el último guardado">${ico('i-deshacer')}</button>`;
  marca.append(l1, l2);
  const plegar = $('#btn-plegar'); l1.appendChild(plegar);   // el botón de plegar, donde está (absoluto arriba a la derecha)
  marca.style.position = 'relative'; marca.appendChild(plegar);

  // --- verde + azul + naranja
  const fila = document.createElement('div'); fila.className = 'm-fila';
  const bTareas = `<a class="m-btn" href="#/tareas" title="Tareas (${nT} abierta)" aria-label="Tareas, ${nT} abierta">${ico('i-casillas')}<span class="n">${nT}</span></a>`;
  const bComent = `<a class="m-btn" href="#/comentarios" title="Comentarios (${nC})" aria-label="Comentarios, ${nC}">${ico('i-bocadillo')}<span class="n">${nC}</span></a>`;
  const bTerm = `<button type="button" class="m-btn" title="Terminal (Ctrl \`)" aria-label="Terminal">${ico('i-terminal')}</button>`;
  const lateral = $('#lateral');
  const buscador = $('#buscador');
  if (variante === 'A') {
    fila.innerHTML = bTareas + bComent + bTerm + `<button type="button" class="m-btn mas" title="Nueva nota" aria-label="Nueva nota">${ico('m-mas')}</button>`;
    buscador.after(fila);
  } else {
    fila.className = 'm-nueva-envoltura';
    fila.innerHTML = `<button type="button" class="m-nueva" title="Crear una nota nueva" aria-label="Nueva nota">${ico('m-mas')}Nueva nota</button>`;
    buscador.after(fila);
  }
  const rot = document.createElement('div'); rot.className = 'm-rotulo'; rot.textContent = 'Notas';
  fila.after(rot);

  // --- morado: barra superior
  const barra = $('.miga-barra');
  const flechas = document.createElement('div'); flechas.className = 'm-flechas';
  flechas.innerHTML = `<button type="button" class="m-flecha" title="Atrás (⌘[)" aria-label="Atrás">${ico('m-izq')}</button><button type="button" class="m-flecha" title="Adelante (⌘])" aria-label="Adelante" disabled>${ico('m-der')}</button>`;
  const espacio = document.createElement('span'); espacio.className = 'm-espacio';
  const editar = $('#btn-editar'); editar.hidden = false; editar.className = 'm-editar'; editar.innerHTML = `${ico('i-lapiz')}<span class="txt">Editar</span>`; editar.setAttribute('aria-label', 'Editar la nota');
  const mas = document.createElement('button'); mas.type = 'button'; mas.className = 'm-mas-nota'; mas.setAttribute('aria-label', 'Más acciones de la nota'); mas.title = 'Más acciones: mover, copiar la ruta, borrar'; mas.setAttribute('aria-haspopup', 'menu'); mas.innerHTML = ico('m-puntos');
  barra.insertBefore(flechas, $('#miga'));
  barra.append(espacio);
  if (variante === 'B') {
    const g = document.createElement('div'); g.className = 'm-bar-iconos';
    g.innerHTML = bTareas + bComent + bTerm;
    const d = document.createElement('span'); d.className = 'm-div';
    barra.append(g, d);
  }
  barra.append(editar, mas);
  if (menuNota) {
    const m = document.createElement('div'); m.className = 'm-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = `<button role="menuitem">${ico('m-mover')}Mover a otra carpeta…</button><button role="menuitem">${ico('i-copiar')}Copiar la ruta</button><button role="menuitem">${ico('i-carpeta')}Mostrar en el Finder</button><hr><button role="menuitem" class="borrar">${ico('i-papelera')}Mover a la papelera</button>`;
    barra.appendChild(m);
  }
}

// ---------- capturas
async function main() {
  const { base, dir } = montarCuaderno();
  const kit = detectar(dir);
  const server = crearServidor({ cuaderno: new Cuaderno(dir, kit.base), kit, pty: null, plataforma: 'darwin' });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const navegador = await chromium.launch();
  try {
    const hecho = [];
    async function foto(nombre, { tema = 'light', ancho = 1440, alto = 900, variante = null, textoEstado = '1 cambio', cambios = true, anchoLateral = null, menuNota = false, abrirMenu = false } = {}) {
      const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, colorScheme: tema });
      await ctx.addInitScript(() => { window.cuadernoApp = { plataforma: 'darwin', alAccion() {}, elegirCarpeta: async () => null }; });
      const p = await ctx.newPage();
      p.on('pageerror', e => console.error('[error en la página]', e.message));
      await p.goto(server.urlEntrada());
      await p.goto(`http://localhost:${server.address().port}/#/n/lectura/mercado-de-la-plaza.md`);
      await p.reload(); await p.locator('#miga strong').waitFor();
      await p.locator('#btn-editar:not([hidden])').waitFor();
      await p.waitForTimeout(600);
      if (variante) await p.evaluate(aplicar, { variante, css: CSS, textoEstado, cambios, anchoLateral, menuNota });
      if (abrirMenu) await p.click('#btn-menu');
      await p.waitForTimeout(500);
      await p.screenshot({ path: path.join(SALIDA, nombre) });
      hecho.push(nombre);
      await ctx.close();
    }
    for (const [t, n] of [['light', 'claro'], ['dark', 'oscuro']]) {
      await foto(`antes-${n}.png`, { tema: t });
      await foto(`a-${n}.png`, { tema: t, variante: 'A' });
      await foto(`b-${n}.png`, { tema: t, variante: 'B' });
    }
    await foto('a-estado-largo-cambios.png', { variante: 'A', anchoLateral: 220, textoEstado: '128 cambios por guardar' });
    await foto('a-estado-largo-guardado.png', { variante: 'A', anchoLateral: 220, textoEstado: 'guardado hace 3 semanas', cambios: false });
    await foto('a-estrecho-menu.png', { variante: 'A', ancho: 700, alto: 900, abrirMenu: true });
    await foto('a-menu-nota.png', { variante: 'A', menuNota: true });
    console.log(hecho.join('\n'));
  } finally {
    await navegador.close();
    await new Promise(r => server.close(r));
    fs.rmSync(process.env.CUADERNO_CONFIG_DIR, { recursive: true, force: true });
  }
}
main().catch(e => { console.error(e); process.exit(1); });
