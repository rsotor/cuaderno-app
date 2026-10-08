# cuaderno-app · crítica de diseño, árbol plegado y copiar ruta, 2026-10-09

**Alcance:** árbol de la barra lateral con carpetas plegadas por defecto (se abren las que llevan a la nota abierta) y los tres iconos de la miga (mostrar en el Finder, copiar la ruta, papelera). Tema claro, 1280 px. Método: `design-critique` (usabilidad, jerarquía, consistencia, accesibilidad) sobre `despues-arbol-plegado-2026-10-09.png` y `despues-miga-copiar-2026-10-09.png`; valores de `public/estilo.css:76-88` y `:105-109`. Usuario final: alumno no técnico. No repite lo ya decidido en `critica-2026-10-08-ficheros.md` ni `critica-2026-10-09-ocultar.md` (papelera sin confirmar, iconos de fila solo con hover, separación entre iconos).

## Objeciones (por impacto)

**1. Usabilidad · la papelera de la miga está siempre visible, a un clic de «copiar», y también en ficheros que el kit genera.**
Se ve: tras `inicio.md` (la nota «Lo genera tu profesor cada vez que guarda: no lo edites») salen carpeta, copiar y papelera, los tres de 15 px en gris, con la papelera a 10 px de copiar (`estilo.css:108`). En el árbol los iconos solo salen con hover; aquí no.
Por qué importa: copiar es la acción inocua y la más probable, y está pegada a la única destructiva, que no pide confirmar. En un fichero generado, la papelera invita a borrar justo lo que no se debe tocar.
Arreglo mínimo: en la miga, papelera con la misma regla de hover/foco que el árbol (`opacity: 0` hasta `#miga:hover`/`:focus-within`, visible en `hover: none`), o separarla del grupo (`margin-left: 18px`); en ficheros que el kit regenera, no mostrarla.

**2. Accesibilidad · iconos de 15 px en gris suave, sin texto, para tres acciones distintas.**
Se ve: carpeta, dos cuadrados y papelera casi con el mismo peso y color (`--tinta-suave`), objetivo de 24 px (`:105`), junto a un nombre de 13 px. «Dos cuadrados» se lee como «duplicar el fichero», no como «copiar la ruta»; «Finder» solo existe en Mac y el significado solo está en el `title`.
Por qué importa: un alumno no técnico no sabe qué hace cada uno sin pasar el ratón por encima (y en táctil no hay `title`); el contraste del gris sobre el fondo de la barra es justo para un icono sin etiqueta; 24 px queda por debajo de lo cómodo.
Arreglo mínimo: objetivo de 28 px (`min-width/min-height`), icono a 16 px y color `--tinta` al 70 %; el `title` de la carpeta pasa a «Mostrar en el Finder» solo en Mac y «en el Explorador» en Windows (como ya se hace con la papelera); icono de copiar con un «portapapeles» en lugar de dos cuadrados, si existe en el juego de iconos.

**3. Jerarquía · en el árbol, la nota suelta de raíz se confunde con una carpeta y se llama distinto que en todas partes.**
Se ve: tras `sesiones` aparece «Mi curso», sin chevron y sin peso, pegada al pie y a 34 px de sangría como las carpetas (`:86`); es la misma nota que arriba es «Inicio» y en la miga `inicio.md`. Con todo plegado, la lista es cinco carpetas y una fila huérfana sin separación.
Por qué importa: tres nombres para un mismo fichero (Inicio, Mi curso, `inicio.md`) hacen dudar de si son dos notas; una hoja de raíz al final de las carpetas parece un elemento más de «sesiones».
Arreglo mínimo: no repetir la nota de inicio en el árbol cuando ya está el acceso «Inicio» (o, si se queda, mismo nombre que el acceso); las hojas de raíz, con un margen superior de 6 px sobre la última carpeta.

## Lo que está bien y no se toca
- Carpetas plegadas con chevron que gira: el árbol cabe de un vistazo y no hay que desplazarse.
- Se abre solo el camino a la nota abierta (`material` en la segunda captura) y la fila activa se ve sin duda.
- Copiar ya avisa («Ruta copiada») y cada botón lleva `aria-label` con el nombre del fichero.
- La miga alinea con el inicio de la columna de la nota y no salta al cambiar de fichero.

## Veredicto
**Atender antes del commit: la 1** (cambio de CSS, pequeño y de riesgo real). **La 2** puede entrar en esta tanda si cuesta poco (tamaño y `title` por sistema). **La 3** al Inbox si hay que decidir qué hace el kit con la nota de inicio.

## Qué se hizo con cada objeción (2026-10-09)

1. **Aplicada.** La papelera de la miga queda a 18 px de copiar y no sale en las notas que regenera el profesor
   (`> Lo genera tu profesor…` al principio, como `inicio.md`); un recorrido lo comprueba.
2. **Aplicada en parte.** Los tres botones de la miga pasan a 28 px de objetivo. El `title` ya dice el gestor de
   cada sistema («el Finder», «el Explorador», «la carpeta»): la objeción partía de verlo en un Mac.
3. **Al Inbox.** «Mi curso» en la raíz del árbol es `inicio.md`, la misma nota que el acceso «Inicio».
