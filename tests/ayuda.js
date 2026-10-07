'use strict';
// Cuadernos de mentira para los tests: pequeños, con los formatos del kit, en una carpeta temporal que se borra.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const NOTAS = {
  'inicio.md': `# Mi curso\n\n> Lo genera tu profesor cada vez que guarda: **no lo edites**.\n\n👉 Sigue por aquí: [[01-01-01-sesion|1.1 La sesión]]\n\n| Sesión | Estudiada (tú) |\n|---|---|\n| [[01-01-01-sesion\\|1.1 La sesión]] | ⬜ |\n`,
  'conceptos/interes.md': `---\ntipo: concepto\nalias: [interés, rédito]\nrequiere: [capital]\n---\n# Interés\n\nEl precio del dinero. Con $i = 5\\%$ al año:\n\n$$\nI = C \\cdot i \\cdot t\n$$\n\n> [!info]- Ampliación fuera de los apuntes\n> Esto no estaba en el curso.\n\nVer [[capital]] y [[no-existe]].\n`,
  'conceptos/capital.md': `# Capital\n\nLo que pones. Enlaza con [[interes|el interés]].\n`,
  'sesiones/01-01-01-sesion.md': `---\ntipo: sesion\nestudiada: false\n---\n# 1.1 La sesión\n\n- [ ] estudiada\n\nUn párrafo.\n\n- [ ] Leer [[interes]]\n- [x] Hecho ya\n`,
  'examenes/01-examen.md': `---\ntipo: examen\nunidad: 01\nnota:\nintentos: 0\ntipo_examen: modulo\naprobado: 6\n---\n# Examen · Módulo 1\n\n2 preguntas. Se aprueba con 6.\n\n**1.** Tienes 100 € y la inflación es del 3 %.\n\n¿Qué pasa con tu poder de compra? *(elige una)*\n\n- [ ] a) Sube\n- [ ] b) Baja\n- [ ] c) Igual\n\n**2.** ¿Cuáles son funciones del dinero? *(elige todas las que valgan)*\n\n- [ ] a) Medio de cambio\n- [ ] b) Unidad de cuenta\n- [ ] c) Fuente de inflación\n`,
  'flashcards/01-tarjetas.md': `---\ntipo: flashcards\nsesion: 01-01-01-sesion\n---\n# Flashcards · 01-01-01-sesion\n\n**¿Qué es el interés? (en una frase)**\n> [!success]- Respuesta\n> El precio del dinero.\n\n- [ ] ✅ la sabía\n- [ ] ❌ no la sabía\n*Caja 1 de 5 · te toca el 3/10*\n\n**Un café cuesta 1,50 € y un corte de pelo 12,00 €. ¿Qué función del dinero es? (el nombre)**\n> [!success]- Respuesta\n> Unidad de cuenta: todo se mide con la misma vara.\n\n- [x] ✅ la sabía\n- [ ] ❌ no la sabía\n*Caja 2 de 5 · te toca el 9/10*\n`,
  'tareas.md': `# Mis tareas\n\nLo que te apuntas tú. Tu profesor lo lee, pero no lo reescribe.\n\n- [ ] Comprar cuaderno\n`,
  'oculta/.secreto.md': '# no',
  'node_modules/paquete/README.md': '# no',
};

// opciones: { crlf, kit: 'kit' | 'salida-sin-motor' | 'carpeta', ignorar: texto de .gitignore, obsidianignore }
function crearCuaderno({ crlf = false, kit = 'carpeta', ignorar = '', obsidianignore = '' } = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-test-'));
  const base = kit === 'carpeta' ? raiz : path.join(raiz, 'estudio');
  for (const [rel, texto] of Object.entries(NOTAS)) {
    const abs = path.join(base, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, crlf ? texto.replace(/\n/g, '\r\n') : texto);
  }
  if (kit !== 'carpeta') fs.mkdirSync(path.join(raiz, 'config'), { recursive: true });
  if (kit === 'kit') {
    fs.mkdirSync(path.join(raiz, '.kit', 'adaptadores'), { recursive: true });
    fs.writeFileSync(path.join(raiz, '.kit', 'motor.json'), JSON.stringify({ repo: 'rsotor/profesor-kit', version_datos: 9 }));
    fs.writeFileSync(path.join(raiz, '.kit', 'adaptadores', 'claude-code.json'), JSON.stringify({ id: 'claude-code', comando: 'claude' }));
  }
  if (ignorar) fs.writeFileSync(path.join(raiz, '.gitignore'), ignorar);
  if (obsidianignore) fs.writeFileSync(path.join(base, '.obsidianignore'), obsidianignore);
  return { raiz, base, leer: rel => fs.readFileSync(path.join(base, rel), 'utf8'), borrar: () => fs.rmSync(raiz, { recursive: true, force: true }) };
}

module.exports = { crearCuaderno, NOTAS };
