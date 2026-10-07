'use strict';
// Recorre todas las notas de un cuaderno y dice qué enlaces están rotos y qué notas no se pueden pintar.
//   node pruebas/recorrido.js <carpeta-del-cuaderno>
const path = require('node:path');
const { Cuaderno } = require('../cuaderno');
const { detectar } = require('../kit');

function recorrer(carpeta) {
  const raiz = path.resolve(carpeta);
  const kit = detectar(raiz);
  return new Cuaderno(raiz, kit.base).recorrido();
}

if (require.main === module) {
  if (!process.argv[2]) { console.error('Uso: node pruebas/recorrido.js <carpeta-del-cuaderno>'); process.exit(2); }
  const r = recorrer(process.argv[2]);
  console.log(`${r.notas} notas · ${r.rotos.length} enlaces rotos · ${r.fallos.length} notas sin pintar`);
  for (const x of r.rotos) console.log(`  roto: ${x.ruta} → [[${x.destino}]]`);
  for (const x of r.fallos) console.log(`  fallo: ${x.ruta}: ${x.error}`);
  process.exitCode = r.rotos.length || r.fallos.length ? 1 : 0;
}

module.exports = { recorrer };
