'use strict';
// Mide la terminal de la app y los avisos de cambios, para comparar antes y después de tocarlos (informe, no un test):
//   node pruebas/medir-terminal.js [etiqueta]      (N=200000 cambia las líneas del seq; CUADERNO_CHROMIUM manda sobre el Chromium)
// Corre sobre una copia temporal de ejemplos/cuaderno-ejemplo/ (tests/ayuda.js) y una pty de mentira que vuelca la salida
// de golpe, así que mide lo que cuesta pintar en la pantalla, no la pty. Tres cosas:
//   seq    · 200 000 líneas seguidas (un `seq 1 200000`): tiempo hasta tener todo en el búfer y pintado.
//   tui    · 300 redibujos de pantalla completa, uno por fotograma, con colores por celda (algo como Claude Code): milisegundos
//            de cada fotograma de la página (ideal 16,7) y tareas largas (>50 ms).
//   cambios· 40 ficheros nuevos seguidos, a 20 y a 200 ms: cuántas veces pide la pantalla /api/info.
const fs = require('node:fs');
const path = require('node:path');
const { arrancar, ptyFalso, hasta } = require('../tests/navegador/ayuda');

(async () => {
  const pty = ptyFalso();
  const e = await arrancar({ kit: false, pty });
  const salida = { etiqueta: process.argv[2] || '' };
  try {
    await e.pagina.setViewportSize({ width: 1600, height: 1000 });
    await e.ir('#/');
    await e.pagina.click('#btn-ajustes'); await e.pagina.selectOption('#ajustes-panel', 'abajo'); await e.pagina.click('#ajustes-cerrar');
    await e.pagina.click('#btn-terminal');
    await hasta(() => pty.procesos.length === 1, 'medida', 'no se abre la pty');
    const p = pty.procesos[0];
    await new Promise(r => setTimeout(r, 800));
    salida.renderer = await e.pagina.evaluate(() => (document.querySelector('#terminal canvas') ? 'canvas (WebGL)' : 'DOM'));
    salida.tamano = await e.pagina.evaluate(() => [sesiones[0].term.cols, sesiones[0].term.rows]);
    const instrumentar = () => {
      window.__f = []; window.__lt = 0; window.__ltN = 0; let u = performance.now();
      const t = n => { window.__f.push(n - u); u = n; requestAnimationFrame(t); }; requestAnimationFrame(t);
      try { new PerformanceObserver(l => { for (const x of l.getEntries()) { window.__lt += x.duration; window.__ltN++; } }).observe({ entryTypes: ['longtask'] }); } catch { /* sin tareas largas */ }
    };
    const resumen = () => e.pagina.evaluate(() => { const f = window.__f.slice(2).sort((a, b) => a - b); return { fotogramas: f.length, p50_ms: +f[Math.floor(f.length / 2)].toFixed(1), p95_ms: +f[Math.floor(f.length * .95)].toFixed(1), max_ms: +f[f.length - 1].toFixed(1), tareas_largas: window.__ltN, tareas_largas_ms: Math.round(window.__lt) }; });
    const esperarFin = marca => e.pagina.evaluate(async marca => {
      const b = sesiones[0].term.buffer.active, t0 = performance.now();
      for (;;) {
        let txt = ''; for (let i = Math.max(0, b.length - 80); i < b.length; i++) txt += b.getLine(i)?.translateToString(true) || '';
        if (txt.includes(marca)) break; await new Promise(r => setTimeout(r, 20));
      }
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return performance.now() - t0;
    }, marca);
    const enviar = async (trozos, pausa) => { for (const t of trozos) { p.datos(t); await new Promise(r => setTimeout(r, pausa)); } };

    // seq
    const n = +process.env.N || 200000, trozos = []; let s = '';
    for (let i = 1; i <= n; i++) { s += i + '\r\n'; if (s.length > 16384) { trozos.push(s); s = ''; } }
    trozos.push(s + 'FINSEQ\r\n');
    await e.pagina.evaluate(instrumentar); await new Promise(r => setTimeout(r, 300));
    let t0 = Date.now(); await enviar(trozos, 0); const resto = await esperarFin('FINSEQ');
    salida.seq = { lineas: n, total_ms: Date.now() - t0, tras_enviar_ms: Math.round(resto), ...await resumen() };

    // tui: un fotograma de la página por redibujo
    const [cols, filas] = salida.tamano, tui = [];
    for (let k = 0; k < 300; k++) {
      let f = '\x1b[H';
      for (let r = 0; r < filas; r++) {
        for (let c = 0; c < cols; c += 3) f += `\x1b[38;5;${(k + c) % 200 + 16}m\x1b[48;5;${(k + r * 5 + c) % 24 + 232}m${String.fromCharCode(65 + (k + c + r) % 26).repeat(Math.min(3, cols - c))}`;
        f += '\x1b[0m' + (r < filas - 1 ? '\r\n' : '');
      }
      tui.push(f);
    }
    tui.push('\x1b[HFINTUI');
    await e.pagina.evaluate(instrumentar); await new Promise(r => setTimeout(r, 300));
    t0 = Date.now(); await enviar(tui, 16); const resto2 = await esperarFin('FINTUI');
    salida.tui = { redibujos: 300, total_ms: Date.now() - t0, tras_enviar_ms: Math.round(resto2), ...await resumen() };

    // cambios en disco
    const contar = async pausa => {
      let c = 0; const f = r => { if (r.url().includes('/api/info')) c++; };
      e.pagina.on('request', f);
      for (let i = 0; i < 40; i++) { fs.writeFileSync(path.join(e.c.raiz, `medida-${pausa}-${i}.md`), `# medida ${i}\n`); await new Promise(r => setTimeout(r, pausa)); }
      await new Promise(r => setTimeout(r, 2500)); e.pagina.off('request', f); return c;
    };
    salida.cambios = { ficheros: 40, info_con_20ms: await contar(20), info_con_200ms: await contar(200) };
  } finally { await e.cerrar(); }
  console.log(JSON.stringify(salida, null, 1));
})().catch(x => { console.error(x); process.exit(1); });
