feat: imágenes en el editor de la nota

Qué hace
- El editor pinta las imágenes (`![](…)` y `![[…]]`), también en «Markdown plano», y las rutas con `%20` que antes salían rotas.
- Se mete una imagen arrastrándola al editor o con el botón «Imagen» de la barra de formato. Se ve al momento desde donde esté y no se escribe nada en el cuaderno hasta Aplicar.
- Al Aplicar, se copia junto a la nota: en la carpeta de imágenes que ya haya (attachments, adjuntos, imagenes, images, assets) o en `imagenes/`. Nombre repetido: `-2`, `-3`; nunca se sobrescribe. Una imagen que ya está dentro del cuaderno se enlaza sin copiar. Tope de 25 MB.
- Si algo falla al aplicar, lo subido va a la papelera, la nota no se escribe y el editor conserva texto e imágenes. Descartar no deja nada.
- Dos rutas nuevas: `POST /api/imagen/destino` (dónde irá y con qué nombre) y `POST /api/imagen` (bytes en crudo, sin sobrescribir). La app de escritorio expone `rutaDeFichero`.
- Crítica de diseño (`docs/diseno/critica-2026-10-14-imagenes.md`): 4 objeciones, 2 aplicadas (la imagen ocupa su propia línea si el cursor cae en mitad de una; filo de 1 px), 2 razonadas.

Cómo se prueba
- `npm test`, `npm run test:cobertura`, `npm run test:navegador`, `npm run test:electron`.
- Casos 35 y 36 del cuaderno de ejemplo (`ejemplos/cuaderno-ejemplo.md`); con kit, `tests/guardar.test.js` con `CUADERNO_KIT_PRUEBA`.
- Capturas del después: `node pruebas/capturas-imagenes.js` (en `docs/capturas/imagenes/`).
- A mano tras el merge (Mac de Roberto): arrastrar desde Descargas, elegir una de una iniciativa con `attachments/`, descartar, y una nota real copiada a `cuadernos-prueba/` con `%20`.

Cifras (en la rama, última pasada)
- `npm test`: 317 tests, 314 pasan, 3 saltados, 0 fallos.
- `npm run test:cobertura`: mismos 317; líneas 99,43 %, ramas 90,75 %, funciones 97,64 % (suelo 85 %; `servidor.js` ramas 85,30 %).
- `npm run test:navegador`: 183 de 183.
- `npm run test:electron`: 20 de 20.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
