# El chat con el profesor: vías, alcances y tiempos

**Fase 8 del plan vivo · 2026-10-08 · estado: superado el mismo día.** Las notas de Roberto de abajo cambiaron el encargo (cajón propio, Claude y Codex, imágenes, página abierta); la recomendación vigente está en `chat-diseno.md` con la investigación de `chat-puentes.md` y `chat-interfaces-existentes.md`. Se conserva por las vías descartadas y sus fuentes. Este documento compara las formas de que el alumno
hable con el profesor desde la app, con lo que da y lo que no da cada una, sus riesgos y una estimación de
esfuerzo. Termina con una recomendación. La decisión es de Roberto; hasta entonces no se toca la terminal (fase 9).

Aclaración de Roberto (2026-10-08): el objetivo es **un chat conectado al profesor dentro de la app**, no
necesariamente una interfaz nuestra; un Discord o parecido también sirve. Eso abre las vías de §2.

> [!comment] Alumno (2026-10-08)
> eso es la idea es poder meter la iteraccion con el profesor/asistente loq ue tenemos en obsidian con claudian o en terminal pues aqui. debemos
> * poder darle un pcoo de formato peude ser simple pero que enteinda si le paso lsitados o enalces
> * poder adjutnar imagenes
> * debe poder tener permisos apra crear nuevas carpeta, ficheros etc
> * estaria bien poder relacioanr que página estabmos viendo

Todo lo que sigue sale de la documentación y el código oficiales leídos hoy (enlaces al final), no de memoria.
Lo que no está documentado se marca como **por comprobar**.

## 0. Lo que manda

1. **Suscripción, sin API key** (§6 del plan). El alumno ya paga Claude Code; la app no puede exigirle otra cosa. @@ debemos tener en cuenta que puede ser claude, codex, gemini o lo qeu sea deberiamos tener una settings apra logarnos y guardar esa conexion no?
2. **El profesor es la sesión del kit.** Quien contesta tiene que llevar el AGENTS.md del cuaderno, sus skills y sus
   herramientas (principios 2 y 3). Un chat que hable con "otro Claude" sin ese contexto no es el profesor. @@ el profesor o el aistente, da igual. es decir el llm lee laconfiguración del proyecto al quee sta conctado el cuaderno apra saber que ejecutar. si tengo varios cuadernos, pueden ser varias sesiones diferentes
3. **Nada que esconder.** El repo es público y lo usarán otros alumnos. Lo que hagamos tiene que estar permitido
   para un producto de terceros, no solo para uso propio.
4. **Control de la experiencia** (principio 4), pero no a cualquier precio: la terminal ya funciona.

Hoy la app lanza el comando del adaptador del kit (`claude`) en una pty y lo pinta con xterm. Eso es la vía A.

## 1. Vías con interfaz nuestra

### A. Terminal sola (lo que hay)

La sesión interactiva de Claude Code dentro de la app, cuidada: pestañas, fuente, tema, pegar, scroll, el botón
Profesor. Sin chat propio.

- **Da:** todo lo que hace Claude Code, tal cual, con la suscripción. Cero protocolo que pueda cambiar.
- **No da:** una conversación con el aspecto de un chat. El alumno ve una terminal.
- **Riesgos:** `node-pty` en Windows (fase 11); el bug de la terminal que se cierra en Chrome headless (Inbox). Si
  `ANTHROPIC_API_KEY` está en el entorno, Claude Code la usa y factura por API: la app debe quitarla del entorno
  del proceso hijo.
- **Esfuerzo:** pequeño. Una o dos sesiones. Hay que hacerlo en cualquier caso: es la base y el plan B de todo lo demás.

> [!comment] Alumno (2026-10-08)
> no me esta funcionando me dale el sesion terminada y no me permite escribir como si fuese una terminal

### B. Un *channel* propio (un `fakechat` nuestro)

Un channel es un servidor MCP que Claude Code arranca como subproceso (stdio) y que **empuja mensajes dentro de la
sesión ya abierta**. El servidor declara la capability experimental `claude/channel`, emite notificaciones
`notifications/claude/channel` con `content` y `meta`, y expone una herramienta `reply` con la que Claude contesta.
El mensaje llega al modelo como un evento `<channel source="…">`, y la terminal lo enseña como una línea
`← cuaderno: …`. El requisito es `@modelcontextprotocol/sdk`; vale Node, no hace falta Bun.

Cómo encajaría: la app arranca el adaptador del kit con dos flags más, `--mcp-config '<json en línea>'` y el
flag de channel; el servidor MCP es un fichero nuestro que habla con el servidor de la app por localhost (con el
token de la app y comprobación de `Origin`); el panel de chat envía por ahí y pinta lo que `reply` traiga. El
cuaderno no cambia: nada de `.mcp.json` en su repo.

- **Da:** la **misma sesión que la terminal**, con AGENTS.md, skills y herramientas del kit. Si Claude pide permiso
  para una herramienta, un channel con la capability `claude/channel/permission` recibe el aviso y puede aprobar o
  denegar desde el chat (*permission relay*). Interfaz nuestra al 100 %: render, tema, historial, varios chats.
- **No da:** streaming. El channel solo recibe lo que Claude decide enviar con `reply`, no la respuesta entera ni
  lo que escribe en la terminal. Claude Code no acusa recibo de las notificaciones: si la sesión está ocupada, los
  mensajes se encolan y llegan juntos en el turno siguiente, y no hay forma documentada de saber si está ocupada.
  La primera llamada a `reply` pide permiso en la terminal, salvo que se permita `mcp__<servidor>__reply` en los
  ajustes.
- **Riesgos:**
  - **Research preview.** Los flags no salen en `--help`; la sintaxis y el contrato "pueden cambiar".
  - **Lista blanca.** `--channels` solo acepta plugins del *marketplace* oficial de Anthropic. Un channel propio
    tiene que arrancarse con `--dangerously-load-development-channels server:<nombre>`, que **abre un diálogo de
    aviso a pantalla completa en cada arranque** ("I am using this for local development"). Para librarse del
    aviso hay que estar en la lista oficial, y eso pasa por un contacto de Anthropic.
  - Team y Enterprise exigen que un administrador active `channelsEnabled`.
  - Dos dependencias nuevas (`@modelcontextprotocol/sdk`, y `zod` si se hace el relay de permisos).
  - **Por comprobar:** si `--mcp-config` en línea evita el diálogo de consentimiento de "nuevo servidor MCP en este
    proyecto", y si el adaptador del kit admite flags añadidos sin tocar el kit.
- **Esfuerzo:** medio. Tres o cuatro sesiones (prueba de concepto, panel, relay de permisos, tests).

### C. Chat propio sobre `claude -p` (modo programático, `stream-json`)

La app arranca `claude -p --output-format stream-json --input-format stream-json --verbose
--include-partial-messages` en la carpeta del cuaderno y mantiene la conversación por stdin y stdout. Sin `--bare`,
porque el modo *bare* no usa la sesión de la suscripción y no carga el AGENTS.md ni las skills.

- **Da:** control total: tokens en vivo, nuestro render, reanudar la sesión al reabrir la app.
- **No da:** la misma sesión que la terminal. Reanudar el mismo `session-id` desde dos procesos no está
  bloqueado: la documentación avisa de que los mensajes "se entrelazan en un único transcript". Los permisos los
  tenemos que resolver nosotros (`--permission-prompt-tool`, cuyo esquema no está documentado, o un
  `--permission-mode` fijo).
- **Riesgos:** **la política de Anthropic.** La documentación del Agent SDK dice, literal: *"Unless previously
  approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their
  products"*. Una app pública que envuelve el CLI con la cuenta del alumno para dar su propio chat está en esa zona.
  Los channels no tienen este problema: el alumno ejecuta Claude Code y nuestra app es un channel, que es el patrón
  que la propia documentación propone. Mientras esa nota siga así, C queda fuera para un repo público.
- **Esfuerzo:** grande. Cuatro a seis sesiones.

### D. Agent SDK

Confirmado hoy: exige API key y la misma nota de política de la vía C. Sigue descartado.

### E. Codex (OpenAI): `codex app-server` y `codex exec --json`

Equivalentes a la vía C para Codex: JSON-RPC por stdio, experimental y "no soportado para producción"; `exec --json`
es más sencillo pero su documentación de autenticación dice de la cuenta de ChatGPT: "Do not use this workflow for
public or open-source repositories". No hay equivalente de los channels. Solo tiene sentido si el kit tiene
adaptador de Codex. Queda en la fase 12 como "por comprobar".

## 2. Vías con un chat que ya existe

Todas usan los **plugins oficiales de channels**, que están en la lista blanca: se arrancan con `--channels
plugin:<nombre>@claude-plugins-official` y **no muestran el aviso de desarrollo**. Comparten tres requisitos: el
alumno instala el plugin una vez desde Claude Code (`/plugin install …`), tiene **Bun** instalado (los plugins
oficiales son scripts Bun; no hay versión Node) y la app añade el flag al comando del adaptador. La app puede
detectar las dos cosas y guiar al alumno. Todas llegan a la misma sesión que la terminal, y la terminal enseña el
mensaje entrante y la llamada a `reply`.

### F. `fakechat` oficial, embebido en la app

El servidor de `fakechat` (`server.ts`, Bun) sirve una página de chat en `http://127.0.0.1:8787` (`FAKECHAT_PORT`
para cambiarlo), con WebSocket en `/ws`, subida de ficheros en `POST /upload` y descarga en `/files/`. Leído el
código: **no manda `X-Frame-Options` ni `Content-Security-Policy`**, así que la app puede pintarlo en un `iframe`
dentro de su propia ventana, al lado de la terminal o en su lugar. Herramientas: `reply` (texto, `reply_to`, hasta
50 MB de ficheros) y `edit_message`. La notificación lleva `chat_id: 'web'`, `message_id`, `user: 'web'`, `ts` y
`file_path` si hay adjunto.

- **Da:** un chat dentro de la app, con la misma sesión que la terminal, **sin escribir ningún puente** y sin el
  aviso de desarrollo. Esfuerzo nuestro: detectar Bun y el plugin, añadir el flag, un panel con el `iframe`, y el
  tema (el `iframe` no hereda nuestro CSS; `fakechat` trae estilo propio, "tipo iMessage").
- **No da:** historial (cada recarga empieza un chat vacío; el servidor no guarda ni reenvía mensajes), varios
  chats, búsqueda, ni tema nuestro. Sin streaming, como todo channel. La propia documentación lo llama "herramienta
  de desarrollo, no un puente de mensajería real".
- **Riesgos:**
  - **Seguridad.** El servidor **no comprueba `Origin` ni tiene token**: cualquier página web abierta en el
    navegador del alumno podría conectar a `ws://127.0.0.1:8787/ws` y meter texto en la sesión del profesor. Es la
    misma debilidad para cualquiera que use `fakechat`, pero nuestra app, que sí exige token y `Origin`, estaría
    embebiendo algo que no lo hace. Hay que decirlo al alumno o pedir a Anthropic que lo cierre.
  - Es una demo: puede cambiar o desaparecer con cualquier versión del plugin. Puerto fijo, un solo servidor por
    máquina (dos cuadernos abiertos a la vez chocarían salvo `FAKECHAT_PORT` distinto por cuaderno, cosa que la
    app puede fijar en el entorno del adaptador).
  - Bun es una dependencia del sistema fuera de Node; la app solo puede comprobar que está.
- **Esfuerzo:** pequeño. Una sesión, más la prueba real con Bun y el plugin en el ordenador de Roberto (aquí no
  se puede automatizar sin Bun).

### G. Telegram, Discord o iMessage oficiales

El alumno habla con el profesor desde su móvil o desde la app de Discord o Telegram; la sesión sigue en la app.
Telegram: crear un bot con BotFather, `/telegram:configure <token>`, emparejar con un código, `allowlist`. Discord:
bot en el Developer Portal con *Message Content Intent*, invitarlo a un servidor compartido, mismo emparejamiento;
trae hilos, reacciones, indicador de "escribiendo", historial (`fetch_messages`, hasta 100) y adjuntos (10 × 25 MB).
iMessage: solo macOS, sin bot ni token; lee la base de Mensajes (Acceso total al disco) y basta escribirse a uno
mismo.

> [!comment] Alumno (2026-10-08)
> no no, esto seria integrarlo aqui, es decir que tenga una sección drawer a al derecha que me abra la conversacion/hat pero todo dentro del mismo sitio, la cosa es si podemos integrarlo aqui

- **Da:** un chat de verdad, con historial, notificaciones y móvil, sin escribir nada. Permiten el relay de
  permisos desde el chat (Telegram y Discord lo gatean con la allowlist).
- **No da:** chat **dentro de la app**: Discord y Telegram web no se dejan embeber en un `iframe`; la app solo puede
  abrirlos en otra pestaña. Todo el texto del alumno y del profesor pasa por los servidores de Discord, Telegram o
  Apple, que son terceros ajenos a Anthropic: para notas de estudio puede dar igual, pero hay que decirlo.
- **Riesgos:** la configuración del bot es un trámite real para un alumno (Developer Portal, intents, permisos,
  emparejamiento); iMessage pide permisos de sistema delicados. Un bot mal configurado (sin allowlist) deja que
  desconocidos hablen con la sesión.
- **Esfuerzo:** muy pequeño para nosotros: ajuste del usuario con los plugins a cargar, el flag, y una página de
  ayuda con los pasos. Media sesión. Es un complemento de F o B, no una alternativa al chat en la app.

### H. Remote Control (claude.ai y la app de Claude)

`claude --remote-control` deja manejar la sesión local desde claude.ai o la app móvil de Claude, con suscripción
Pro, Max, Team o Enterprise, sin bot, sin Bun y sin API key. La interfaz es la de Anthropic y no se embebe. Cumple
"cualquier chat" y es lo que menos pide al alumno; no cumple "dentro de la app". **Por comprobar:** la elegibilidad
(`claude doctor` la informa) y si el flag convive con `--channels`.

### Lo que no sirve

Un cliente de chat genérico para LLM (Open WebUI, LibreChat y parecidos) conectado a la API de Anthropic: exige
API key y, sobre todo, habla con un modelo sin el AGENTS.md ni las herramientas del kit. No es el profesor.

## 3. Comparación

| | A Terminal | B Channel propio | C `claude -p` | F `fakechat` embebido | G Telegram/Discord/iMessage | H Remote Control |
|---|---|---|---|---|---|---|
| Misma sesión que la terminal | es la terminal | sí | no | **sí** | sí | sí |
| Chat dentro de la app | no | **sí** | sí | **sí** (iframe) | no (otra pestaña o móvil) | no |
| Suscripción, permitido para terceros | sí | sí | zona gris | sí | sí | sí |
| Aviso de desarrollo al arrancar | no | **sí, siempre** | no | no | no | no |
| Interfaz nuestra | no | **total** | total | no (la de la demo) | no | no |
| Historial y varios chats | la terminal | sí | sí | **no** | sí | sí |
| Pide al alumno | nada | nada | nada | Bun + plugin | Bun + plugin + bot | elegibilidad |
| Seguridad del puente | token y Origin de la app | token y Origin | n/a | **sin Origin ni token** | allowlist del bot | la de Anthropic |
| Dependencias nuevas del repo | 0 | 1-2 | 0 | 0 | 0 | 0 |
| Esfuerzo (sesiones) | 1-2 | 3-4 | 4-6 | **1** | 0,5 | 0,5 |
| Riesgo principal | Windows | aviso y contrato | política | demo sin blindar | trámite del bot, terceros | no embebible |

## 4. Recomendación

1. **La fase 9 (terminal cuidada) se hace sí o sí.** Es la única vía estable hoy y el plan B de las demás.
2. **Primer chat en la app: F, `fakechat` embebido.** Una sesión, cero código de puente, sin aviso de desarrollo, y
   la misma sesión que la terminal. Se acepta a cambio: sin historial entre recargas, interfaz ajena y la falta de
   `Origin` en el servidor de la demo, que se le comunica al alumno en la ayuda y se reporta a Anthropic. Es la forma
   más barata de **saber si un chat así se usa de verdad** antes de invertir en uno propio.
3. **Complemento G, opcional y por ajuste del usuario:** quien quiera hablar con el profesor desde el móvil añade
   Telegram, Discord o iMessage a la lista de channels; la app solo pone el flag y la página de ayuda.
4. **B, el channel propio, solo si F se queda corto** (historial, varios chats, tema, seguridad) y después de intentar
   la lista oficial con Anthropic, porque el aviso en cada arranque es un coste serio para un alumno. Mientras, se
   hace la prueba de concepto de una sesión para despejar lo que está por comprobar.
5. **C queda descartada para este repo mientras la nota de política no cambie.** D sigue descartada; Codex se revisa
   cuando el kit tenga adaptador; H se anota como alternativa para quien no quiera instalar Bun.

Si Roberto confirma, la fase 12 del plan pasa a ser "chat por channel oficial (`fakechat` embebido, con Telegram,
Discord o iMessage opcionales)" y el channel propio queda como fase posterior condicionada.

## 5. Tiempos

| Paso | Sesiones | Depende de |
|---|---|---|
| Fase 9 · terminal cuidada (A) | 1-2 | nada |
| Fase 12 · `fakechat` embebido (F): detección de Bun y plugin, flag, panel, ayuda | 1 | prueba manual con Bun en el ordenador de Roberto |
| Channels de móvil opcionales (G): ajuste, flag, ayuda | 0,5 | F |
| Prueba de concepto del channel propio (B) | 1 | nada; solo si se decide ir a por B |
| Channel propio completo con relay de permisos y tests (B) | 2-3 | la prueba de concepto y, a ser posible, la lista oficial |
| Codex (E) | 4-6 | adaptador en el kit |

## Fuentes

- Channels: https://code.claude.com/docs/en/channels
- Referencia para construir un channel: https://code.claude.com/docs/en/channels-reference
- `fakechat` (código y README): https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/fakechat
- Discord, Telegram e iMessage oficiales: https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins
- Modo programático (`claude -p`, `stream-json`): https://code.claude.com/docs/en/headless
- Referencia de flags del CLI: https://code.claude.com/docs/en/cli-reference
- Sesiones (entrelazado al reanudar desde dos sitios): https://code.claude.com/docs/en/sessions
- Autenticación del CLI (precedencia de `ANTHROPIC_API_KEY`): https://code.claude.com/docs/en/authentication
- Remote Control: https://code.claude.com/docs/en/remote-control
- Agent SDK (nota sobre login de claude.ai y licencia): https://code.claude.com/docs/en/agent-sdk/overview
- Codex app-server: https://learn.chatgpt.com/docs/app-server · https://openai.com/index/unlocking-the-codex-harness
- Codex, modo no interactivo y autenticación: https://learn.chatgpt.com/docs/non-interactive-mode · https://learn.chatgpt.com/docs/auth
