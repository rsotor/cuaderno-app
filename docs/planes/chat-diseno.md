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

Sale de `chat-puentes.md` (investigación del 2026-10-08, con fuentes). Tres formas de hablar con los dos proveedores:

| | A · CLIs directos, adaptador propio | B · ACP con los adaptadores oficiales | C · Agent SDK + Codex SDK |
|---|---|---|---|
| Qué es | `claude -p --input-format stream-json` y `codex app-server`, los dos JSONL por stdio, detrás de una interfaz mínima nuestra | Un cliente ACP y dos adaptadores (`claude-agent-acp`, `codex-acp`) | Las bibliotecas de cada casa |
| Suscripción | Sí, el binario del alumno | Sí vía CLI, pero el de Claude lleva dentro el Agent SDK | Técnicamente sí; la doc del SDK manda API key |
| Política (literal) | Claude: sin texto expreso; cubre «end user signing in to the unmodified Claude Code binary with their own subscription». Codex: «local or open-source application ... you can continue using it» | Hereda la nota del SDK: «does not allow third party developers to offer claude.ai login ... including agents built on the Claude Agent SDK» | La misma nota, de frente; Codex SDK no documenta imágenes ni aprobaciones |
| Dependencias nuevas | 0 | ACP SDK + 2 adaptadores + SDK de Claude + zod, Node 22+, ESM | 2 SDK + binarios, ESM |
| Riesgo | Protocolo de Codex «experimental»; formato de stdin de Claude sin documentar (prueba de 5 líneas) | Doble capa sobre lo mismo, y la política | Política explícita en contra |

**Recomendación: A.** Es la única con cero dependencias, la que más lejos queda de lo que la nota de Anthropic nombra
(«agents built on the Claude Agent SDK»), y la única documentada para Codex con imágenes, aprobaciones y reanudar.
ACP solo compensa con muchos agentes; aquí son dos, y sus diferencias (página abierta, skills en `.claude` o
`.agents`, política de login) ACP no las resuelve. Gemini queda como tercer adaptador futuro (`gemini --acp`).

### 3.1 Arquitectura

- **Servidor:** una `SesionChat` por cuaderno abierto, con un proceso hijo del proveedor elegido, `cwd` en la raíz del
  cuaderno. Un adaptador por proveedor (`chat/claude.js`, `chat/codex.js`) con la misma interfaz:
  `enviar({texto, imagenes, pagina})`, `responderPermiso(id, decision)`, `cancelar()`, `cerrar()`, y eventos
  `texto` (trozo), `herramienta` (qué hace, resumida), `permiso` (petición con opciones), `fin`, `error`.
- **Navegador:** WebSocket `/chat` con el mismo token y `Origin` que `/pty`. Mensajes del cliente: `enviar`, `permiso`,
  `cancelar`. La pestaña Chat pinta los trozos según llegan y las herramientas como líneas discretas plegadas.
- **Entorno del hijo:** se quitan `ANTHROPIC_API_KEY` y `OPENAI_API_KEY` (si están, los CLIs las usan y facturan por
  API), se deja el resto. Binarios `claude` y `codex` del PATH del alumno, sin modificar; ruta configurable en Ajustes
  por si no están en el PATH del servicio (fase 11).
- **Sesión por cuaderno y reanudar:** Claude, `--session-id` nuevo y `--resume` después; Codex, `thread/start` y
  `thread/resume`. El identificador se guarda en la configuración del usuario, por cuaderno y proveedor, fuera del
  cuaderno; la clave del cuaderno es su **ruta real resuelta** (si el alumno mueve o renombra el cuaderno, el chat
  empieza de cero y la conversación anterior queda en el fichero viejo; se dice así en la ayuda). Reanudar no
  reproduce el historial, así que la app guarda su propia copia de lo pintado (JSONL, en la carpeta de configuración
  del usuario, un fichero por cuaderno y proveedor) y la enseña al reabrir; las imágenes van dentro como miniatura
  en base64 (tope pequeño), porque los adjuntos originales viven en la carpeta temporal y el sistema la vacía.
  `config.apariencia` (lo que ve el navegador de la configuración) **no expone** identificadores de sesión ni rutas;
  un test lo comprueba. **Nada de esto se escribe en el
  cuaderno** (principio 1: lo que la app escribe en el cuaderno es Markdown del curso). «Guardar el chat como nota»
  queda para el Inbox.
- **Terminal y chat son sesiones distintas.** La terminal no cambia.

### 3.2 Los cuatro requisitos

- **Formato:** la respuesta se pinta con el render Markdown que ya tiene la app (listas, enlaces, código), saneado como
  las notas. Lo que escribe el alumno va tal cual.
- **Imágenes:** pegar o arrastrar en la caja del chat; el navegador la sube (`POST /api/chat/adjunto`, con límite de
  tamaño) y el servidor la guarda en una carpeta temporal del sistema, no en el cuaderno. A Claude va como bloque
  `image` en base64 dentro del mensaje (**por comprobar** con la prueba de 5 líneas); a Codex, como `localImage` con la
  ruta. En el chat se ve la miniatura.
- **Página abierta:** no vale `--append-system-prompt` (Claude lo graba en la primera petición y lo reutiliza al
  reanudar). Va como una primera línea en cada mensaje del alumno: `Página abierta: <ruta relativa>` (y nada si no hay
  nota abierta). Igual para los dos proveedores, así el asistente puede leer el fichero con sus herramientas.
- **Permisos: los del kit, no los de la app** (Roberto, 2026-10-08; principio 2). El kit ya define qué puede hacer el
  profesor sin preguntar y lo aplica con `permisos.js --aplicar` («aceptar una vez»): para Claude,
  `.claude/settings.local.json` con las herramientas del kit y git de solo lectura; para Codex, `.codex/config.toml`
  (la raíz del curso en `writable_roots`, sin red) y `.codex/rules/profesor-kit.rules`. La app **no impone modo de
  permisos**: lanza el CLI en la raíz del curso, en su modo normal, y el CLI carga esa configuración solo (Claude en
  `-p` sin `--bare` lee `project` y `local`; Codex lee el `.codex/` del curso si la carpeta es de confianza; **por
  comprobar** en la prueba (c) que `app-server` lo respeta sin pasar `sandbox` ni `approvalPolicy` en `thread/start`).
  Si el curso no tiene los permisos aplicados, el chat lo dice y ofrece aplicarlos **con la herramienta del kit**
  (`node .kit/herramientas/permisos.js --aplicar`, enseñando su salida), nunca escribiendo la app esos ficheros. En
  un cuaderno sin kit no hay lista: todo pregunta. Lo que la configuración del kit no resuelve llega al chat como una
  tarjeta con «Permitir», «Permitir en esta sesión» y «Denegar»: Claude por el hook `PermissionRequest` de tipo `http` apuntando a `/api/chat/permiso` (inyectado con
  `--settings` en línea; el servidor retiene la respuesta hasta que el alumno decide, con el tope de 600 s del hook).
  **Excepción a la regla del token:** ese POST lo hace el proceso `claude`, sin cookie ni `Origin`, así que la ruta no
  usa el token de la app sino un **secreto propio por sesión de chat**, generado al arrancar el hijo, que viaja en la
  cabecera del hook dentro del `--settings` y se comprueba en esa única ruta (además de que el servidor solo escucha
  en 127.0.0.1). Sin el secreto, 403 y el permiso se deniega. Es la única ruta del servidor fuera de la regla del token
  y queda escrita en §6 del plan vivo (Seguridad del servidor local);
  Codex por `item/*/requestApproval` → `accept` / `acceptForSession` / `decline`. Un permiso sin responder al cerrar la
  sesión se deniega.

### 3.3 Lo que hay que decir y comprobar

- **Política.** Ninguna de las dos casas nombra «app local de código abierto que lanza el CLI ya conectado del
  usuario». Reglas de diseño para quedar fuera de lo prohibido: la app **no hace login** ni lo ofrece, no lee ni guarda
  credenciales ni tokens, no modifica los binarios, y el producto no se llama «Claude Code» (en texto, «Claude» y
  «Codex»). **Decisión de Roberto:** escribir a Anthropic y a OpenAI antes de hacer público el repo, con el caso
  descrito en una página. Mientras, el repo sigue privado.
- **Seguridad de `-p`:** sin `--bare`, Claude ejecuta los hooks de `.claude/settings.json` y conecta los `.mcp.json` del
  cuaderno sin diálogo de confianza. La app avisa la primera vez que se abre un cuaderno nuevo con el chat o la terminal.
- **Versiones mínimas:** `claude --version` (2.1.277 para `AGENTS.md`, 2.1.259 para `--permission-prompts`) y la de
  `codex`; si no llegan, el chat lo dice y no arranca.
- **Para el kit (principio 3, primero el kit), comprobado en profesor-kit el 2026-10-08:** el kit ya tiene
  adaptador de Codex (`.kit/adaptadores/codex.json`: skills en `.agents/skills`, permisos en `.codex/`, probado en
  Windows con Codex 0.159.3 «con limitaciones»: sin prueba real completa y sin selector de opciones) y de Claude
  (`claude-code.json`). La raíz lleva `CLAUDE.md` con `@AGENTS.md`. No hace falta pedirle nada al kit para la v1.
  Lo que sí: `segundo_plano` de cada adaptador trae los argumentos para trabajar sin conversación; el chat **no** los
  usa (es conversación), pero es la referencia de cómo llama el kit a cada CLI.
- **Pruebas previas (primera tarea del plan, desechables):** (a) `claude -p` por stdin con un mensaje con imagen y
  `--include-partial-messages`, sobre una copia de `ejemplos/curso-demo`; (b) el hook `PermissionRequest` http dispara en
  `-p` y espera la respuesta; (c) `codex app-server`: `initialize`, `thread/start`, un turno con `localImage`, la lista real de valores de
  `approvalPolicy` y `sandbox` (del esquema generado con `generate-json-schema`), y que un turno cree un fichero
  dentro del cuaderno sin preguntar y otro fuera llegue como aprobación; (d) la comprobación de conexión de Codex
  (`codex login status` frente a `account/read`). Si (a), (b) o (c) fallan, el plan cambia antes de escribir el
  panel de chat.

## 4. Ajustes de conexión

- **Proveedor: en un curso con kit lo dice el curso**, no la app: `config/ajustes.json` → `llm` →
  `.kit/adaptadores/<llm>.json` (`comando`, skills, permisos), que es lo que `kit.js` ya resuelve hoy para el botón
  Profesor; las skills están instaladas y los permisos aplicados para ese asistente, cambiarlo desde la app rompería
  las dos cosas. El selector de Ajustes «Asistente: Claude | Codex» vale para los **cuadernos sin kit** (y como valor
  por defecto). Señalado a Roberto: matiza su «el mismo proveedor para todas las conversaciones». Cambiar el selector
  cierra la sesión abierta y arranca con el otro; los historiales se guardan por proveedor.
- **Estado de conexión, al abrir Ajustes y al abrir el chat:** Claude, `claude auth status` (código 0 y `authMethod`);
  Codex, **una sola vía**, decidida en la prueba previa (d): `codex login status` si existe y responde en frío, si no,
  `account/read` de un `app-server` efímero. Las dos comprobaciones con tope de 5 s y, si el hijo no responde, un error
  visible en Ajustes, nunca un estado inventado. Se enseña «Conectado como <método>», «No instalado» o «Sin conectar».
- **Conectar: la app no lo hace ni lo lanza.** Un botón que lanzara `claude auth login` sería un «iniciar sesión en
  Claude» ofrecido por la app, justo lo que la nota de política nombra. Lo que hay: cuando falta la conexión, Ajustes
  enseña el comando (`claude auth login` o `codex login`) como texto copiable y un botón «Abrir la terminal» que solo
  abre la pestaña Terminal con el shell; el alumno lo teclea él. **Decisión de Roberto** (es más incómodo que un botón,
  y es a propósito).
- **Ruta del binario:** campo opcional por proveedor, por defecto el PATH. Al guardarla se comprueba que existe y es
  ejecutable; si no, se rechaza con el motivo. Se lanza siempre con `spawn` sin shell y con argumentos separados (un
  script del alumno es su decisión; lo que no hay es interpolación). Sustituye a nada: `comando_agente` (el comando
  del Profesor en cuadernos sin kit) sigue siendo de la terminal.

## Rondas de abogado del diablo

- 2026-10-08, ronda corta sobre los §3 y §4 (puente y ajustes): 5 objeciones, las 5 aplicadas (secreto propio para el hook de permisos, única ruta fuera del token; permisos de Codex «por comprobar» y prueba previa ampliada; sin botón de login, comando copiable; una sola vía para el estado de Codex con tope y error visible, ruta del binario validada; clave del cuaderno por ruta real, miniaturas dentro del historial, `config.apariencia` no filtra). El crítico pide que el secreto del hook entre en la ronda completa antes de cerrar el documento.
- 2026-10-08, ronda corta sobre el §2 (panel): 5 objeciones, las 5 aplicadas (sesiones de terminal que conviven y `fit` al reactivar; rejilla por estado abierto/cerrado; límites que protegen a la nota y acotado del valor guardado; ciclo de vida del chat con el panel cerrado y al cambiar de cuaderno; tests de esos casos y el atajo asignado a la primera tarea).
