# El chat en la app: diseño

**2026-10-08 · estado: borrador en discusión.** Sale de las notas de Roberto en `chat-alcances.md` y de dos decisiones
suyas de hoy: el chat es una **sesión propia** por cuaderno (ya no hace falta que sea la misma que la terminal) y
el **proveedor es uno para toda la app** (ajuste global), con **Claude Code y Codex desde el día 1**. La
investigación de los puentes está en `chat-puentes.md`; el plan por tareas saldrá de este documento cuando se apruebe.

## 1. Lo que manda (de Roberto, literal o casi)

- El chat va **dentro de la app**, como cajón a la derecha, todo en el mismo sitio.
- Formato sencillo (listas, enlaces); **imágenes adjuntas**; **permisos** para crear carpetas y ficheros; que sepa
  **qué página se está viendo**.
- Multiproveedor: Claude y Codex ahora, Gemini u otros después. Unos ajustes para elegir proveedor y ver si la
  conexión está hecha.
- El asistente lee la configuración del cuaderno al que está conectado (AGENTS.md y lo del kit).
- Suscripción, sin API key (§6 del plan vivo). Repo público: solo lo permitido para terceros.

## 2. El panel: terminal y chat, un mismo espacio

Hoy la terminal es una franja fija de 320 px bajo la nota (`public/estilo.css:218`), sin tamaño ajustable, y el
chat no existe. Propuesta (tras la ronda corta del 2026-10-08, ver al final):

1. **Un panel con dos pestañas: Chat y Terminal.** Una barra arriba con las dos pestañas, el título de la sesión y
   cerrar. La pestaña **Terminal admite varias sesiones** (es lo que la fase 9 llamaba «pestañas»: shell y Profesor
   conviven; hoy `app.js:342` mata una para abrir la otra, eso se va). **Profesor** abre su sesión en la pestaña
   Terminal sin tocar el shell; **Terminal** abre la pestaña Terminal; un botón nuevo **Chat** (icono de bocadillo,
   encima de Terminal en la barra lateral) abre la pestaña Chat. Las pestañas conservan su contenido al cambiar:
   la terminal no muere por mirar el chat. Como una pestaña oculta mide 0, el `ResizeObserver` ignora tamaños 0 y
   se hace `fit` al reactivar la pestaña, para no mandar a la pty un `resize` a 0 (`app.js:353`).
   Atajos: Ctrl ` sigue siendo la terminal. El del chat se decide en la **primera tarea de la fase**, con una sonda
   en Chrome, Safari y Firefox de qué combinaciones se pueden capturar (Ctrl J y Ctrl K no valen de entrada).
2. **Posición a elegir: derecha (por defecto) o abajo.** Ajuste nuevo en Ajustes, «Panel», junto a tema y letra;
   se guarda en la configuración del usuario (`/api/configuracion`, `panel: 'derecha' | 'abajo'`), igual para todos
   los cuadernos. Rejilla, con `data-panel` y la clase `panel-abierto` en `#app`:
   - cerrado: la de hoy, `280px minmax(0, 1fr)` y filas `1fr auto`; sin columna ni fila fantasma;
   - derecha abierto: `280px minmax(0, 1fr) var(--panel-ancho)`, el panel en la columna 3, filas 1 a 3;
   - abajo abierto: columnas de hoy, filas `1fr var(--panel-alto)`, el panel en la columna 2, fila 2 (como ahora).
3. **Tamaño ajustable por el alumno:** un asa de arrastre en el borde interior del panel (vertical a la derecha,
   horizontal abajo), de 6 px visibles y 12 px de zona activa, con `cursor: col-resize | row-resize`. Doble clic en
   el asa vuelve al valor por defecto (420 px / 320 px). El tamaño se guarda en la configuración del usuario, uno por
   posición (`panel_ancho`, `panel_alto`), para que valga en todas las pestañas y al reabrir. Al soltar, la terminal
   se reajusta (`fit`; el `ResizeObserver` de `app.js:354` ya lo hace).
   **Límites, siempre a favor de la nota:** la nota conserva al menos 480 px de ancho (derecha) o 240 px de alto
   (abajo). Mínimo del panel 320 px / 180 px; máximo, lo que quede tras la barra lateral y ese mínimo de la nota.
   El valor guardado se **acota al leerlo y en cada cambio de tamaño de la ventana**, porque está en píxeles y otra
   ventana u otro monitor pueden dejarlo fuera de rango. Si no cabe ni el mínimo (ventana de menos de unos 1080 px
   de ancho con el panel a la derecha), el panel pasa a capa completa (punto 4), no se queda a medias.
4. **Capa completa:** a 760 px o menos, siempre; y por encima, cuando no cabe el mínimo del punto 3. El panel ocupa
   toda la pantalla como capa, igual que hace la barra lateral, sin asa; cerrar devuelve la nota.
5. **La columna de lectura cede.** Con la barra de 280 px y el panel de 420 px, en 1440 px quedan 740 px para la
   nota (la columna de 76 ch pedía unos 780): el texto se reparte más estrecho mientras el panel está abierto. Es el
   precio de tener el chat al lado de la nota; abajo no se paga. Si molesta, el alumno pone el panel abajo o lo
   estrecha. Con el panel cerrado la nota recupera todo su ancho (lo mide el test).
6. **Vida de cada cosa:** cerrar el panel no cierra el chat: la sesión vive en el servidor y se recupera al reabrir,
   con su historial. Si mientras está cerrado el asistente **termina una respuesta o pide un permiso**, el botón
   Chat lo marca (un punto) y un permiso pendiente además avisa con el aviso corto de la app, para que nadie se quede
   esperando sin verlo. Cerrar una sesión de la pestaña Terminal mata su pty como hoy. **Cambiar de cuaderno** corta
   la sesión del chat en el servidor (no solo la interfaz), deniega los permisos pendientes y mata las ptys.

**Tests:** recorrido de navegador nuevo (`tests/navegador/panel.test.js`): abrir el panel desde el botón; cambiar
la posición en Ajustes y ver la rejilla cambiar; arrastrar el asa y comprobar que el ancho persiste tras recargar;
pasar de Chat a Terminal y volver sin perder la terminal y con la pty al tamaño correcto (ni 0 ni el de antes);
Profesor con el shell abierto deja el shell vivo; con el panel cerrado la nota mide lo mismo que hoy (sin columna
fantasma) y abierto, lo que diga el punto 5; un valor guardado fuera de rango se acota al abrir; Ctrl ` con el foco
en el chat abre la terminal; a 390 px y a 900 px con el panel a la derecha, la capa completa. Test de servidor para
los campos nuevos de la configuración.

## 3. El chat: puente por proveedor

`TBD` hasta que vuelva `chat-puentes.md` (en curso). Lo que ya está fijado por Roberto: sesión propia por cuaderno,
proveedor único global, Claude y Codex en la v1, interfaz nuestra.

## 4. Ajustes de conexión

`TBD` (depende del §3). Fijado: la app no hace el login; lo hace cada CLI. La app detecta el binario y si está
conectado, y ofrece abrir el login en la pestaña Terminal.

## Rondas de abogado del diablo

- 2026-10-08, ronda corta sobre el §2 (panel): 5 objeciones, las 5 aplicadas (sesiones de terminal que conviven y `fit` al reactivar; rejilla por estado abierto/cerrado; límites que protegen a la nota y acotado del valor guardado; ciclo de vida del chat con el panel cerrado y al cambiar de cuaderno; tests de esos casos y el atajo asignado a la primera tarea).
