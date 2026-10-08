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
chat no existe. Propuesta:

1. **Un panel con dos pestañas: Chat y Terminal.** Una barra arriba con las dos pestañas, el título de la sesión y
   cerrar. El botón **Profesor** sigue abriendo la terminal con el comando del kit; **Terminal** abre la pestaña
   Terminal; un botón nuevo **Chat** (icono de bocadillo, encima de Terminal en la barra lateral) abre la pestaña
   Chat. Las dos pestañas conservan su contenido al cambiar de una a otra: la terminal no muere por mirar el chat.
   Atajos: Ctrl ` sigue siendo la terminal; el del chat se decide con la prueba (Ctrl J y Ctrl K están cogidos por
   el navegador o por el buscador: **por comprobar** cuál se puede capturar).
2. **Posición a elegir: derecha (por defecto) o abajo.** Ajuste nuevo en Ajustes, «Panel», junto a tema y letra;
   se guarda en la configuración del usuario (`/api/configuracion`, `panel: 'derecha' | 'abajo'`), igual para todos
   los cuadernos. En `#app` va `data-panel="derecha|abajo"`: a la derecha la rejilla pasa a tres columnas
   (`280px minmax(0, 1fr) var(--panel-ancho)`); abajo, a la segunda fila como hoy pero con `var(--panel-alto)`.
3. **Tamaño ajustable por el alumno:** un asa de arrastre en el borde interior del panel (vertical a la derecha,
   horizontal abajo), de 6 px visibles y 12 px de zona activa, con `cursor: col-resize | row-resize`. Límites:
   derecha, de 320 px a 60 % del ancho; abajo, de 180 px a 70 % del alto. Doble clic en el asa vuelve al valor
   por defecto (420 px / 320 px). El tamaño se guarda en la configuración del usuario, uno por posición
   (`panel_ancho`, `panel_alto`), para que valga en todas las pestañas y al reabrir. Al soltar, la terminal se
   reajusta (`fit`; el `ResizeObserver` de `app.js:354` ya lo hace).
4. **Pantalla estrecha (760 px o menos):** el panel ocupa toda la pantalla como capa, igual que hace la barra
   lateral, sin asa; cerrar devuelve la nota.
5. **La columna de lectura cede.** Con la barra de 280 px y el panel de 420 px, en 1440 px quedan 740 px para la
   nota (la columna de 76 ch pedía unos 780): el texto se reparte más estrecho mientras el panel está abierto. Es el
   precio de tener el chat al lado de la nota; abajo no se paga. Si molesta, el alumno pone el panel abajo o lo
   estrecha.
6. **Vida de cada cosa:** cerrar el panel no cierra el chat (la sesión vive en el servidor y se recupera al
   reabrir); cerrar la pestaña Terminal mata la pty como hoy. Cambiar de cuaderno cierra las dos.

**Tests:** recorrido de navegador nuevo (`tests/navegador/panel.test.js`): abrir el panel desde el botón, cambiar la
posición en Ajustes y ver la rejilla cambiar, arrastrar el asa y comprobar que el ancho persiste tras recargar, pasar
de Chat a Terminal y volver sin perder la terminal, y a 390 px la capa completa. Test de servidor para los campos
nuevos de la configuración.

## 3. El chat: puente por proveedor

`TBD` hasta que vuelva `chat-puentes.md` (en curso). Lo que ya está fijado por Roberto: sesión propia por cuaderno,
proveedor único global, Claude y Codex en la v1, interfaz nuestra.

## 4. Ajustes de conexión

`TBD` (depende del §3). Fijado: la app no hace el login; lo hace cada CLI. La app detecta el binario y si está
conectado, y ofrece abrir el login en la pestaña Terminal.

## Rondas de abogado del diablo

(pendiente)
