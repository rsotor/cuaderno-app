# Referentes de UI para la reorganización de la pantalla (2026-10-13)

Investigación solo en la web (sin abrir las apps). Responde a las 7 preguntas de `navegacion-2026-10-13-roberto.md`.

**Cómo leerlo.** «Doc» = lo dice documentación oficial o notas de versión (enlazada). «Comunidad» = foro, blog o tercero: indicio, no prueba.
«Deducción» = mío, no documentado. «TODO» = no lo pude confirmar con una fuente; hay que mirarlo en la app real.
**Límite honesto:** la documentación oficial casi nunca dice *dónde* está cada cosa en pantalla; para eso hay mucho TODO.
Apps cubiertas: Obsidian, Notion, Slack, Linear, VS Code, Craft, Logseq, Zed, Bear, Finder, Claude Desktop. Filebrowser no aportó nada (la doc redirige al README de GitHub, sin descripción de interfaz).

## Fuentes (abreviaturas)

- [OBS-vaults](https://obsidian.md/help/manage-vaults) · [OBS-ribbon](https://obsidian.md/help/ribbon) · [OBS-tabs](https://obsidian.md/help/tabs) · [OBS-statusbar](https://obsidian.md/help/status-bar) · [OBS-sync](https://obsidian.md/help/Obsidian%20Sync/Status%20icon%20and%20messages)
- [OBS-foro-flechas](https://forum.obsidian.md/t/back-and-foward-buttons/1049) (cita la nota de v0.8.13, nov 2020) · [OBS-foro-atajos](https://forum.obsidian.md/t/on-mac-view-menu-keyboard-shortcuts-for-navigate-back-and-navigate-forward-are-incorrect/5892) · [OBS-foro-ratón](https://forum.obsidian.md/t/navigate-forward-backwards-mouse-buttons-does-not-work-on-separate-window/80618) · [OBS-plugin-deslizar](https://community.obsidian.md/plugins/horizontal-deslizar-gestures)
- [NOT-sidebar](https://www.notion.com/help/navigate-with-the-sidebar) · [NOT-atajos](https://www.notion.com/help/keyboard-shortcuts) · [NOT-borrar](https://www.notion.com/help/duplicate-delete-and-restore-content) · [NOT-offline](https://www.notion.com/help/guides/working-offline-in-notion-everything-you-need-to-know)
- [SLA-blog](https://slack.com/intl/es-es/blog/productivity/how-to-get-your-work-back-on-track-in-slack) (2019) · [SLA-guía](https://slack.com/help/articles/360059928654-How-to-use-Slack--your-quick-start-guide) · [SLA-lector](https://slack.com/help/articles/360000411963-Use-Slack-with-a-screen-reader)
- [LIN-espacio](https://linear.app/docs/conceptual-model) · [LIN-2021](https://linear.app/changelog/2021-09-23-desktop-navigation) · [LIN-sidebar](https://linear.app/changelog/2024-12-18-personalized-sidebar) · [LIN-inbox](https://linear.app/docs/inbox)
- [VSC-UI](https://code.visualstudio.com/docs/getstarted/userinterface) · [VSC-ficheros](https://code.visualstudio.com/docs/editing/codebasics) · [VSC-1.70](https://code.visualstudio.com/updates/v1_70) · [Cursor-foro](https://forum.cursor.com/t/where-are-the-navigation-controls/148340) (Cursor, fork de VS Code)
- [CRA-nav](https://support.craft.do/en/introduction/navigation) · [LOG-foro](https://discuss.logseq.com/t/creating-a-new-graph/8463) · [ZED-ajustes](https://zed.dev/docs/reference/all-settings) · [ZED-inicio](https://zed.dev/docs/getting-started) · [APL-finder](https://support.apple.com/en-au/guide/mac-help/mchlp3011/12.0/mac) · [APL-HIG-ruta](https://developer.apple.com/design/human-interface-guidelines/components/navigation-and-search/path-controls) · [CLA-issue](https://claudeissues.com/issue/62661-feature-feature-allow-hiding-routines-and-customize-entries-from-desktop-sidebar) · [CLA-UTD](https://atlas.utdallas.edu/TDClient/30/Portal/KB/Article/1597/How-to-Check-Your-Claude-Usage)

---

# Tablas (una por pregunta)

### 1. Cabecera de la barra lateral: nombre, inicio, cambio de espacio

| App | Cómo lo resuelve | Fuente |
|---|---|---|
| Obsidian | Icono «Vault profile» **abajo a la izquierda** de la barra lateral → selector; «Manage Vaults…» → «Open folder as vault». La doc no menciona lista de recientes. También por paleta («Open another vault»). El selector está en la cinta (ribbon) con ayuda y ajustes | Doc: OBS-vaults, OBS-ribbon |
| Notion | El **nombre del espacio, arriba**, es el menú: cambiar de espacio, crear, añadir otra cuenta, cerrar sesión. «Inicio» es un elemento aparte de la lista | Doc: NOT-sidebar |
| Linear | Menú desplegable **arriba a la izquierda** para cambiar de espacio | Doc: LIN-espacio |
| Craft | Clic en el **nombre del Space, arriba a la izquierda**, cambia de Space (cada uno con sus documentos, carpetas y etiquetas) | Doc: CRA-nav |
| Logseq | Nombre del grafo arriba de la barra → menú «Add new graph / All graphs…». «Add new graph» abre una carpeta existente y confunde (usuario) | Comunidad: LOG-foro |
| Slack | TODO (el nombre del espacio arriba a la izquierda no lo confirmé en doc) | — |
| VS Code, Zed | Cambio de proyecto por menú Archivo / paleta; el nombre del proyecto va en la barra de título. Zed: nombre del proyecto en título TODO | Doc parcial: VSC-1.70 (solo que existe barra de título personalizable); ZED-inicio no lo cubre |
| Claude Desktop, Bear, Finder | TODO (sin fuente oficial hallada) | — |

### 2. Estado de guardado / sincronización y su acción

| App | Cómo lo resuelve | Fuente |
|---|---|---|
| VS Code | Sin cambios: nada. Con cambios: **punto en la pestaña** y **insignia con el nº de ficheros sin guardar** en el Explorador. Guardar = ⌘S, sin botón. Autoguardado opcional (`files.autoSave`) | Doc: VSC-ficheros |
| Obsidian (Sync) | Icono de estado en la **barra de estado, abajo** (escritorio): Sincronizado (verde), Sincronizando, Pausado. Clic → menú pausar/reanudar, registro, historial. Obsidian base guarda solo, sin botón | Doc: OBS-sync, OBS-statusbar |
| Notion | Guardado automático; existe un indicador de «todo al día» sin etiquetas descritas; páginas offline en Ajustes → Offline. Textos exactos («Saving…», etc.): TODO | Doc parcial: NOT-offline |
| Zed, Bear, Craft, Logseq, Slack, Linear | TODO | — |

### 3. Atrás / Adelante

| App | Cómo lo resuelve | Fuente |
|---|---|---|
| Slack | Flechas **junto a la caja «Jump to»** de la barra superior, «como el navegador»; ⌘[ ⌘] (Mac), Alt+←/→ (Win/Linux). Ratón: reportado irregular en Windows (comunidad Discord, no Slack) | Doc: SLA-blog (2019: comprobar vigencia) |
| Notion | ⌘[ / ⌘] (Ctrl en Win/Linux). Posición de las flechas: TODO | Doc: NOT-atajos |
| Linear | Botones visuales añadidos en la app de escritorio (2021-09-23); ⌘[ ⌘] y ⌘←/⌘→ (estos últimos por teclados no US). Posición: la nota no la dice | Doc: LIN-2021 |
| Obsidian | v0.8.13 (nov 2020): botones «arriba a la izquierda de la app»; en 2022 un usuario los ve solo en la **barra de título de la pestaña** y otro dice que desaparecieron. Atajos por defecto ⌘⌥←/→. Botones laterales del ratón: funcionan en la ventana principal (usuarios). Gesto de dos dedos en escritorio: no nativo, hay plugin; en móvil, dos dedos | Doc (cita de la nota): OBS-foro-flechas; Comunidad: OBS-foro-atajos, OBS-foro-ratón, OBS-plugin-deslizar |
| Zed | Ajuste `tab_bar.show_nav_history_buttons`: los botones viven en la **barra de pestañas** | Doc: ZED-ajustes |
| VS Code | Doc oficial no dice dónde. Su fork Cursor: botones en la barra de título, visibles solo con el Command Center activado | Comunidad: Cursor-foro (no es VS Code) |
| Bear | Existe guía «Navigate Your Notes History» (listada bajo iOS); contenido no accesible | Doc: [índice FAQ](https://bear.app/faq/) |
| Finder | TODO (las flechas Atrás/Adelante son conocidas, pero no hallé página oficial que las cite) | — |

### 4. Barra superior: ruta/título y acciones del documento

| App | Cómo lo resuelve | Fuente |
|---|---|---|
| VS Code | Migas de pan **arriba del editor** muestran siempre la ruta; botón «Dividir editor» **arriba a la derecha** | Doc: VSC-UI |
| Notion | Menú **«•••» arriba a la derecha** con Eliminar, Archivar (beta, planes de empresa), Historial de versiones. Migas/Compartir/Favorito: TODO | Doc: NOT-borrar |
| Obsidian | «More options» (⋯) **arriba a la derecha** de la nota; el contenido exacto del menú: TODO | Doc: OBS-tabs |
| Zed | Barra de herramientas del editor configurable: `breadcrumbs`, `quick_actions`, `selections_menu`… (se oculta si todas se apagan) | Doc: ZED-ajustes |
| Finder | Barra de ruta opcional **abajo** (Visualización → Mostrar barra de ruta) | Doc: APL-HIG-ruta |
| Slack, Linear, Craft, Bear | TODO | — |

### 5. Accesos de la barra lateral y separación del árbol

| App | Cómo lo resuelve | Fuente |
|---|---|---|
| Notion | Arriba, **con texto**: Inicio, Búsqueda, Bandeja (esquina superior derecha de la barra); debajo, **secciones** con rótulo: Recientes, Favoritos, Espacios de equipo; Ajustes al final | Doc: NOT-sidebar |
| Linear | Lista con texto, de lo personal arriba a lo compartido abajo; personalizable: reordenar, ocultar en «More», aviso de no leídos **con cuenta o con punto** | Doc: LIN-sidebar, LIN-inbox |
| Slack | Pestañas de la barra: Inicio, DMs, Actividad, Archivos (Ctrl+2 = DMs en Mac) | Doc: SLA-guía, SLA-lector |
| Obsidian | **Franja de iconos** (ribbon) separada de la barra de ficheros, solo iconos con tooltip, reordenable y ocultable; sigue visible con la barra cerrada | Doc: OBS-ribbon |
| Craft | Menú contextual «Customize Sidebar» para ocultar/reordenar secciones; ⌘\ muestra/oculta la barra | Doc: CRA-nav |
| VS Code | Barra de actividad (iconos) a la izquierda del panel lateral | Doc: VSC-UI |
| Bear, Logseq, Claude Desktop | Claude: entradas fijas arriba (Nuevo, Chats, Proyectos, Artefactos, Personalizar / «Routines» y «Customize» según versión) y recientes debajo. Fuentes de terceros; versión actual TODO | Comunidad: CLA-issue |

### 6. Ajustes y terminal / paneles

| App | Cómo lo resuelve | Fuente |
|---|---|---|
| Obsidian | Ajustes e ayuda como **iconos en la franja inferior izquierda** de la barra lateral, junto al selector de cuaderno. Atajo ⌘, : TODO | Doc: OBS-ribbon |
| Notion | «Settings» **abajo en la barra lateral** | Doc: NOT-sidebar |
| VS Code | Panel **bajo el editor** con salida, problemas y terminal; se muestra/oculta desde Ver; engranaje «Manage» abajo de la barra de actividad: TODO (lo conozco, no pude enlazarlo) | Doc: VSC-UI |
| Zed | Ajustes con ⌘, ; terminal con Ctrl+` ; ambos por atajo/menú | Doc: ZED-inicio |
| Claude (web) | «Settings» dentro del **menú de cuenta** (web); escritorio: TODO | Comunidad: CLA-UTD |
| Slack | Ayuda: icono «?» **arriba a la derecha** de la app | Doc: SLA-guía |

### 7. Buscar / Abrir (solo apunte)

| App | Cómo lo resuelve | Fuente |
|---|---|---|
| Notion | «Search» en la barra lateral + ⌘P/⌘K («busca o salta a página reciente») | Doc: NOT-sidebar, NOT-atajos |
| Slack | Caja de búsqueda arriba; salto rápido ⌘K | Doc: SLA-lector, SLA-blog |
| Linear | Menú de comandos ⌘K (acciones y páginas) | Doc: [guía](https://linear.app/enablement/guide/navigating-linear) |
| Craft | ⌘O abre documento por nombre; ⌘F busca en el documento | Doc: CRA-nav |
| Obsidian | Paleta de comandos (p. ej. «Open another vault») | Doc: OBS-vaults |

---

# Por pregunta: patrón, variantes, recomendación

## 1. Cabecera de la barra lateral

- **Patrón dominante (doc):** en las apps de espacios (Notion, Linear, Craft), **el nombre del espacio, arriba a la izquierda, es el desplegable de cambio**. Obsidian es la excepción: selector en un icono abajo a la izquierda.
- **Variantes:** Obsidian separa «cambiar de cuaderno» del resto con un icono propio; Logseq mezcla «añadir» y «abrir» y confunde (comunidad). Ninguna fuente dice que el nombre lleve al inicio; en Notion «Inicio» es un elemento aparte (deducción: nadie usa el nombre como botón de inicio; TODO verificar en Slack/Linear).
- **Recomendación:** nombre con chevron ▾ que abre «recientes + Abrir carpeta…», y el clic en el *nombre* a inicio solo si el chevron es un objetivo aparte y visible. **Matiza lo decidido:** «nombre → inicio» es lo no convencional; para alguien nuevo, lo conocido es nombre = menú. Mantener Inicio como acceso con texto si no se prueba que se entiende.

## 2. Estado de guardado y su acción

- **Patrón dominante (doc):** guardado **automático y sin texto** o mínimo: VS Code, punto + contador; Obsidian Sync, icono de color en la barra inferior. Con 0 cambios el indicador desaparece o queda neutro; con cambios, un punto o una cuenta, no una frase.
- **Variantes:** Obsidian lleva el estado a un menú al clic (pausar, registro, historial). VS Code guarda con atajo, sin botón. No encontré (doc) ninguna app con «estado en texto + botón Guardar» en una línea bajo el nombre; el truncado con «…» no se trata en ninguna fuente (TODO: mirar apps reales).
- **Recomendación:** mantener la segunda línea, pero con **punto de color + número** como señal principal y el texto como apoyo, y Guardar solo visible/destacado con cambios. **No confirma ni contradice** lo decidido: no hay referente directo; es diseño propio, así que el test de navegador con textos largos es el que manda.

## 3. Atrás / Adelante

- **Patrón dominante (doc):** atajo ⌘[ / ⌘] (Notion, Slack, Linear) **más** botones visibles en el escritorio. Posición: Slack, junto a la búsqueda arriba; Obsidian, arriba a la izquierda de la app en su origen (2020) y después en la barra de la pestaña; Zed, en la barra de pestañas.
- **Variantes:** Obsidian ofrece ⌘⌥←/→ por defecto, no ⌘[ (comunidad), lo que choca con el menú de cuaderno-app (`electron/menu.js`: ⌘[ ⌘]). Gesto de dos dedos: en Obsidian de escritorio no es nativo (hay plugin); ratón: botones laterales funcionan en la ventana principal (comunidad). Un PR de otra app Electron indica que el gesto del trackpad de macOS llega como eventos de scroll por fases, no como un evento simple ([block/buzz #3778](https://github.com/block/buzz/pull/3778), comunidad): **TODO** comprobar en Electron el evento `deslizar` de la ventana y `app-command` (Windows) antes de prometerlo.
- **Recomendación:** flechas ‹ › a la izquierda de la barra superior, solo con `window.cuadernoApp`, apagadas sin historial, con ⌘[ ⌘] (ya existen) y tooltip con el atajo. **Confirma** lo propuesto (Slack, Obsidian 2020, Linear y Zed las muestran; ⌘[ ⌘] es el atajo de Slack/Notion/Linear). Detalle: ninguna fuente dice que estén *antes de la ruta*; la más cercana es Slack (junto a la búsqueda).

## 4. Barra superior

- **Patrón dominante (doc):** ruta/título a la izquierda y un único menú «⋯»/«•••» a la derecha con lo destructivo (Notion: Eliminar, Archivar, Historial; Obsidian: «More options»). VS Code añade un botón de acción visible (dividir) arriba a la derecha.
- **Variantes:** Zed deja la barra de herramientas totalmente configurable (puede desaparecer); Finder lleva la ruta abajo.
- **Recomendación:** título/ruta a la izquierda, iconos fijos a la derecha y borrar/mover/copiar en «⋯»; Editar sin recuadro si es un icono. **Confirma** lo decidido (papelera a «…», iconos a la derecha). Para el primer uso: etiquetar «Editar» con texto o tooltip claro, porque un icono suelto es difícil de leer a la primera (deducción).

## 5. Accesos de la barra lateral

- **Patrón dominante (doc):** accesos **con texto** arriba y árbol/secciones debajo, separados por **rótulos de sección** (Notion: Recientes, Favoritos, Espacios de equipo) o por orden personal → compartido (Linear). Contadores como cuenta o punto (Linear).
- **Variantes:** Obsidian usa una franja de **solo iconos con tooltip**, físicamente separada del árbol; Linear permite ocultar lo raro en «More».
- **Recomendación:** fila de iconos con contador y tooltip (Tareas, Comentarios, «+») y rótulo «Notas» sobre el árbol; Inicio sobra solo si el nombre lleva a inicio y eso se entiende. **Confirma** el icono con contador (Obsidian, Linear), pero la evidencia de las apps para público general (Notion, Slack, Linear) es **texto**, no solo iconos: **matiza** lo decidido para el primer uso — probar icono+texto corto en Tareas/Comentarios, o iconos con tooltip y la franja separada del árbol como Obsidian.

## 6. Ajustes y terminal

- **Patrón dominante (doc):** Obsidian y Notion ponen Ajustes **abajo** en la barra lateral (icono / entrada); Zed lo da por atajo ⌘, ; VS Code deja la terminal en un **panel** que se abre y cierra, no en la barra lateral.
- **Variantes:** Claude (web) lo mete en el menú de cuenta; Slack pone Ayuda arriba a la derecha.
- **Recomendación:** Ajustes por menú + ⌘, con `window.cuadernoApp`; en web, un icono discreto abajo (la web no tiene menú). Terminal como icono que abre un panel. **Confirma** lo decidido en general. Las apps nativas de la lista **siguen mostrando Ajustes visible** además del menú (Obsidian, Notion), lo cual contradice un poco «sobra Ajustes»: para la pareja de Roberto, dejarlo como icono pequeño abajo cuesta poco.

## 7. Buscar / Abrir (apunte)

- **Patrón:** ⌘K/⌘P/⌘O con paleta o salto rápido (Notion, Slack, Linear, Craft, Obsidian) más, en Notion, una entrada «Search» visible en la barra. Para el análisis posterior: separar «buscar contenido» de «abrir nota por nombre».

---

## Resumen de lo que confirma / contradice / es nuevo

- **Confirma:** flechas ‹ › solo en escritorio con ⌘[ ⌘]; «⋯» para lo destructivo; iconos a la derecha de la barra superior; fila de accesos con contador (patrón Linear/Obsidian).
- **Contradice o matiza:** «nombre → inicio» no tiene referente (el patrón es nombre = menú de cambio); accesos solo-iconos son menos intuitivos para un primer uso que los de texto (Notion, Slack, Linear); quitar Ajustes por completo se aparta de Obsidian y Notion.
- **Sin referente:** estado + Guardar en una línea bajo el nombre.
- **Mejor idea nueva:** de Linear, ocultar lo menos usado en «Más» y mostrar avisos como **punto o número** según el caso: sirve a la vez para el estado de guardado (punto + número) y para Tareas/Comentarios.
- **TODOs que decidirían:** posición exacta de las flechas en Notion/Linear/VS Code; textos de estado de guardado en Notion/Bear/Craft; evento de gesto y botones laterales del ratón en Electron; Claude Desktop actual; Finder/Bear/Slack sin fuente oficial hallada.
