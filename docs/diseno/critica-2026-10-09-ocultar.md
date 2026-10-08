# cuaderno-app · crítica de diseño, ocultar en el árbol, 2026-10-09

**Alcance:** iconos de fila del árbol («Ocultar aquí, solo en la app» y «Mostrar en el Finder») y sección «Ocultas en este cuaderno» de Ajustes. Tema claro, 1280 px. Método: `design-critique` (usabilidad, jerarquía, consistencia, accesibilidad) sobre `despues-ocultar-arbol-2026-10-09.png` y `despues-ocultar-ajustes-2026-10-09.png`; los valores salen de `public/estilo.css:94-100` y `:287-290`. Usuario final: alumno no técnico. No repite lo ya decidido en `critica-2026-10-08.md` ni en `critica-2026-10-08-ficheros.md` (icono de carpeta escondido hasta el hover, hover frente a selección: ya razonados).

## Objeciones (por impacto)

**1. Usabilidad · «Ocultar» es un icono mudo, de 26 px, pegado al de la carpeta y sin vuelta visible.**
Se ve: en la fila, un ojo tachado y una carpeta a 2 px de distancia (`estilo.css:97`, `gap: 2px`), cada uno de 26 px (`:94`), con `opacity: 0` hasta el hover. El texto «solo en la app» vive solo en el `title`.
Por qué importa: el ojo tachado en la mayoría de interfaces significa «esto ya está oculto» o «mostrar contraseña», no «ocultar». Con 2 px de separación, un clic algo impreciso en la carpeta lo ejecuta el ojo, y la fila desaparece sin aviso, sin saber qué ha pasado ni dónde se recupera.
Arreglo mínimo: ojo normal (no tachado) para «Ocultar» y separar los iconos (`gap: 6px`); al ocultar, un aviso breve «Oculto «Capital» en este cuaderno. Deshacer» (el mismo mecanismo de avisos de la app, si lo hay).

**2. Consistencia · el modal dice «iguales para todos tus cuadernos» y la sección nueva es de un solo cuaderno.**
Se ve: arriba a la derecha de Ajustes, «iguales para todos tus cuadernos» (Tema, Letra...). Debajo, tras una línea, «Ocultas en este cuaderno». Las rutas salen en monoespaciada sin distinguir carpeta de fichero (`conceptos` frente a `material/apuntes-de-clase.txt`), y los dos «Mostrar» no dicen cuál.
Por qué importa: el rótulo del encabezado queda falso para la mitad del modal; el alumno no sabe si al ocultar aquí ocurre en sus otros cuadernos. Y para un lector de pantalla, dos botones «Mostrar» iguales no tienen nombre propio.
Arreglo mínimo: quitar el rótulo del encabezado y ponerlo en las secciones («En todos tus cuadernos» sobre Tema... y el actual «Ocultas en este cuaderno» en la nueva); `aria-label="Mostrar material/apuntes-de-clase.txt"` en cada botón; carpetas con barra final (`conceptos/`) o el icono de carpeta delante.

**3. Usabilidad · ocultar no deja rastro en el árbol: lo único que dice que hay cosas ocultas está dentro de Ajustes.**
Se ve: en la segunda captura `conceptos` ha desaparecido del árbol sin marca alguna; la única pista es la lista de Ajustes, a dos clics y en un modal de preferencias de aspecto.
Por qué importa: a la semana, el alumno (o su profesor) buscará «Capital» y no estará; creerá que se ha borrado, que es justo lo que el texto «no se borra nada» intenta evitar, pero solo si llega a leerlo.
Arreglo mínimo: una línea discreta al final del árbol, «2 ocultas · Ver», que abre Ajustes en esa sección (misma tipografía pequeña que el `small` de las hojas); aparece solo si hay ocultas.

## Lo que está bien y no se toca
- «solo en la app: no se borra nada» en la propia sección: dice lo que importa en una línea.
- «Mostrar» como botón con borde, legible y siempre visible: el camino de vuelta no depende del hover.
- El árbol y los botones «Terminal» y «Ajustes» abajo no cambian de peso ni de alineación; los iconos de fila respetan la sangría.
- `focus-visible` y `@media (hover: none)` ya dejan los iconos visibles con teclado y en táctil (`estilo.css:96,100`).

## Veredicto
**Atender antes del commit: la 2** (rótulo falso, cambio de texto) **y la 1** (cambio de icono y de `gap`; el aviso con «Deshacer» puede ir al Inbox si cuesta). **La 3** puede entrar en esta tanda si cuesta poco o ir al Inbox sin bloquear.

## Qué se hizo con cada objeción
TODO: se rellena al atenderlas o razonarlas.

## Qué se hizo con cada objeción (2026-10-09)

1. **Aplicada en parte.** Los dos iconos van separados 6 px. El ojo tachado se queda: es el signo habitual de «ocultar» (lo usan Figma, Photoshop o el Finder en sus menús) y lleva `title` y `aria-label` «Ocultar…». Tras ocultar ya sale un aviso que dice dónde recuperarlo («Para verlo otra vez: Ajustes»); un «Deshacer» en el aviso queda al Inbox.
2. **Aplicada.** Cada sección del modal dice su alcance («Para todos tus cuadernos» / «Solo en este cuaderno y solo en la app») y cada «Mostrar» lleva `aria-label` con su ruta.
3. **Al Inbox.** Un rastro en el árbol («N ocultas · Ver») pide pedir la lista en cada repintado; se decide con el primer uso de Roberto.
