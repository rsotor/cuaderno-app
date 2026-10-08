'use strict';
// Informe de cobertura del código de la pantalla (public/app.js) con los recorridos de navegador. Junta lo que guardó
// cada recorrido (V8, por bloques) y dice qué parte del fichero ha corrido al menos una vez y qué funciones nunca.
//   npm run cobertura:pantalla
const fs = require('node:fs');
const path = require('node:path');

const dir = process.argv[2];
const fuente = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const corrido = new Uint8Array(fuente.length);   // 1 si ese carácter ha corrido en algún recorrido
const funciones = new Map();                       // inicio → { nombre, corrida }
for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.json'))) {
  for (const entrada of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) {
    if (entrada.source && entrada.source.length !== fuente.length) continue;   // otra versión del fichero
    const cuenta = new Int32Array(fuente.length).fill(-1);
    // Los rangos de V8 van de fuera a dentro: el de dentro manda sobre el de fuera.
    for (const fn of entrada.functions) for (const r of fn.ranges) cuenta.fill(r.count, r.startOffset, r.endOffset);
    cuenta.forEach((c, i) => { if (c > 0) corrido[i] = 1; });
    for (const fn of entrada.functions) {
      if (!fn.functionName) continue;
      const k = fn.ranges[0].startOffset, previa = funciones.get(k);
      funciones.set(k, { nombre: fn.functionName, corrida: (previa && previa.corrida) || fn.ranges[0].count > 0 });
    }
  }
}
const codigo = [...fuente].map((ch, i) => /\s/.test(ch) ? null : corrido[i]).filter(x => x !== null);
const pct = (a, b) => b ? (100 * a / b).toFixed(1) : '—';
const nunca = [...funciones.values()].filter(f => !f.corrida).map(f => f.nombre).sort();
console.log(`Pantalla (public/app.js) con los recorridos: ${pct(codigo.filter(Boolean).length, codigo.length)} % del código ha corrido; ${pct(funciones.size - nunca.length, funciones.size)} % de las funciones con nombre (${funciones.size - nunca.length} de ${funciones.size}).`);
if (nunca.length) console.log(`Funciones que ningún recorrido ejecuta: ${nunca.join(', ')}`);
