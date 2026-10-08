# El chat con el profesor: vías, alcances y tiempos

**Fase 8 del plan vivo · 2026-10-08 · estado: para decidir.** Este documento compara las formas de que el alumno
hable con el profesor desde la app, con lo que da y lo que no da cada una, sus riesgos y una estimación de
esfuerzo. Termina con una recomendación. La decisión es de Roberto; hasta entonces no se toca la terminal (fase 9).

Todo lo que sigue sale de la documentación oficial leída hoy (enlaces al final), no de memoria. Lo que no está
documentado se marca como **por comprobar**.

## 0. Lo que manda

1. **Suscripción, sin API key** (§6 del plan). El alumno ya paga Claude Code; la app no puede exigirle otra cosa.
2. **El profesor es la sesión del kit.** Quien contesta tiene que llevar el AGENTS.md del cuaderno, sus skills y sus
   herramientas (principios 2 y 3). Un chat que hable con "otro Claude" sin ese contexto no es el profesor.
3. **Nada que esconder.** El repo es público y lo usarán otros alumnos. Lo que hagamos tiene que estar permitido
   para un producto de terceros, no solo para uso propio.
4. **Control de la experiencia** (principio 4), pero no a cualquier precio: la terminal ya funciona.

Hoy la app lanza el comando del adaptador del kit (`claude`) en una pty y lo pinta con xterm. Eso es la vía A.

## 1. Las vías

### A. Terminal sola (lo que hay)

La sesión interactiva de Claude Code dentro de la app, cuidada: pestañas, fuente, tema, pegar, scroll, el botón
Profesor. Sin chat propio.

- **Da:** todo lo que hace Claude Code, tal cual, con la suscripción. Cero protocolo que pueda cambiar.
- **No da:** una conversación con el aspecto de la app. El alumno ve una terminal.
- **Riesgos:** `node-pty` en Windows (fase 11); el bug de la terminal que se cierra en Chrome headless (Inbox).
- **Esfuerzo:** pequeño. Una o dos sesiones. Hay que hacerlo en cualquier caso: es la base y el plan B de todo lo demás.

### B. La app como *channel* de Claude Code (un `fakechat` propio)

Un channel es un servidor MCP que Claude Code arranca como subproceso (stdio) y que **empuja mensajes dentro de la
sesión ya abierta**. El servidor declara la capability experimental `claude/channel`, emite notificaciones
`notifications/claude/channel` con `content` y `meta`, y expone una herramienta `reply` con la que Claude contesta.
El mensaje llega al modelo como un evento `<channel source="…">`, y la terminal lo enseña como una línea
`← cuaderno: …`. `fakechat`, el ejemplo oficial, es exactamente esto con una UI web en `localhost:8787`: adjuntos
(hasta 50 MB, en `~/.claude/channels/fakechat/inbox/`), edición de mensajes (`edit_message`), un solo chat, sin
historial. El requisito es `@modelcontextprotocol/sdk`; vale Node, no hace falta Bun.

Cómo encajaría: la app arranca el adaptador del kit con dos flags más, `--mcp-config '<json en línea>'` y el
flag de channel; el servidor MCP es un fichero nuestro que habla con el servidor de la app por localhost (token
incluido); el panel de chat envía por ahí y pinta lo que `reply` traiga. El cuaderno no cambia: nada de `.mcp.json`
en su repo.

- **Da:** la **misma sesión que la terminal**, con AGENTS.md, skills y herramientas del kit. El alumno escribe en
  el chat o en la terminal y es la misma conversación. Si Claude pide permiso para una herramienta, un channel con
  la capability `claude/channel/permission` recibe el aviso y puede aprobar o denegar desde el chat (*permission
  relay*). La suscripción Pro o Max basta y no hay comprobación de organización.
- **No da:** streaming. El channel solo recibe lo que Claude decide enviar con `reply`, no la respuesta entera ni
  lo que escribe en la terminal. Claude Code no acusa recibo de las notificaciones: si la sesión está ocupada, los
  mensajes se encolan y llegan juntos en el turno siguiente, y no hay forma documentada de saber si está ocupada.
  La primera llamada a `reply` pide permiso en la terminal, salvo que se permita `mcp__<servidor>__reply` en los
  ajustes.
- **Riesgos:**
  - **Research preview.** Los flags no salen en `--help`; la sintaxis y el contrato "pueden cambiar".
  - **Lista blanca.** `--channels` solo acepta plugins del *marketplace* oficial de Anthropic. Un channel propio
    tiene que arrancarse con `--dangerously-load-development-channels server:<nombre>`, que **abre un diálogo de
    aviso a pantalla completa en cada arranque** ("I am using this for local development"). Solo funciona en
    sesión interactiva, que es la nuestra. Para librarse del aviso hay que estar en la lista oficial, y eso pasa por
    un contacto de Anthropic. Esta es la pega de verdad: cada vez que el alumno pulse Profesor verá ese aviso.
  - Team y Enterprise exigen que un administrador active `channelsEnabled`.
  - Dos dependencias nuevas (`@modelcontextprotocol/sdk`, y `zod` si se hace el relay de permisos).
  - **Por comprobar:** si `--mcp-config` en línea evita el diálogo de consentimiento de "nuevo servidor MCP en este
    proyecto", y si el adaptador del kit admite flags añadidos sin tocar el kit.
- **Esfuerzo:** medio. Una sesión de prueba de concepto (servidor MCP en Node, los dos flags, un panel mínimo,
  medir el aviso y los permisos); dos más para el panel con render Markdown nuestro, adjuntos y el relay de
  permisos; una de tests de navegador. Tres o cuatro en total.

### C. Chat propio sobre `claude -p` (modo programático, `stream-json`)

La app arranca `claude -p --output-format stream-json --input-format stream-json --verbose
--include-partial-messages` en la carpeta del cuaderno y mantiene la conversación por stdin y stdout, o un proceso
por turno con `--resume <id>`. Sin `--bare`, porque el modo *bare* no usa la sesión de la suscripción y no carga
el AGENTS.md ni las skills.

- **Da:** control total de la experiencia: tokens en vivo, nuestro render, las herramientas pintadas como queramos,
  reanudar la sesión al reabrir la app.
- **No da:** la misma sesión que la terminal. Serían dos sesiones (dos contextos) o el chat sustituye a la terminal.
  Reanudar el mismo `session-id` desde dos procesos no está bloqueado: la documentación avisa de que los mensajes
  "se entrelazan en un único transcript".
  Los permisos los tenemos que resolver nosotros (`--permission-prompt-tool` con un servidor MCP propio, o un
  `--permission-mode` fijo). Las herramientas que necesitan terminal (preguntas de opción múltiple, aprobación del
  modo plan) se desactivan en `-p`.
- **Riesgos:**
  - **Política de Anthropic.** La documentación del Agent SDK dice, literal: *"Unless previously approved,
    Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products"*.
    Una app pública que envuelve el CLI con la cuenta del alumno para dar su propio chat está en esa zona. La vía
    B no tiene este problema: el alumno ejecuta Claude Code y nuestra app es un channel, que es el patrón que la
    propia documentación propone. Mientras esa nota siga así, C queda fuera para un repo público.
  - Es la vía con más superficie que construir y mantener: parser del stream, permisos, errores, reanudación. El
    esquema de la herramienta de `--permission-prompt-tool` no está documentado en las páginas del CLI.
  - Si `ANTHROPIC_API_KEY` está en el entorno, `-p` la usa siempre y factura por API: la app tendría que quitarla
    del entorno del proceso hijo. Esto vale también para la terminal de la vía A.
- **Esfuerzo:** grande. Cuatro a seis sesiones.

### D. Agent SDK

Confirmado hoy: exige API key y la misma nota de política de la vía C. Sigue descartado.

**Remote Control**, de paso: permite manejar la sesión local desde claude.ai o la app de Claude, con suscripción,
pero la interfaz es la de Anthropic, no la nuestra. No es embebible; no es una vía para la app.

### E. Codex (OpenAI): `codex app-server`

Equivalente a la vía C para Codex: JSON-RPC 2.0 por stdio, métodos `thread/start`, `turn/start`, `turn/interrupt`,
aprobaciones como peticiones del servidor (`item/permissions/requestApproval`), inicio de sesión con la cuenta de
ChatGPT gestionado por el propio Codex (`account/login/start`), o un patrón de token compartido en que la app
obtiene el OAuth de ChatGPT del usuario. La documentación lo marca como experimental y "no soportado para
producción"; los esquemas se generan por versión (`codex generate-ts`). Existe también `codex exec --json` (JSONL
por stdout, reanudable), más sencillo, pero su documentación de autenticación recomienda API key para automatizar y
dice de la cuenta de ChatGPT: "Do not use this workflow for public or open-source repositories". No hay
equivalente de los channels. Solo tiene sentido si el kit tiene adaptador de Codex, y después de decidir la vía con Claude.
Esfuerzo grande. Queda en la fase 12 como "por comprobar".

## 2. Comparación

| | A Terminal | B Channel | C `claude -p` | D Agent SDK | E Codex app-server |
|---|---|---|---|---|---|
| Misma sesión que la terminal | es la terminal | **sí** | no | no | no |
| Suscripción sin API key | sí | sí | sí, pero política en contra para terceros | **no** | sí (ChatGPT), por comprobar |
| Permitido para un producto de terceros | sí | **sí** (patrón oficial) | zona gris | no | por comprobar |
| Control de la experiencia | bajo | medio (sin streaming) | **total** | total | total |
| Estado | estable | research preview, aviso en cada arranque | estable | estable | experimental |
| Dependencias nuevas | 0 | 1-2 | 0 | 1 | 0-1 |
| Esfuerzo (sesiones) | 1-2 | 3-4 | 4-6 | — | 4-6 |
| Riesgo principal | Windows | el aviso y el cambio de contrato | la política de Anthropic | API key | protocolo experimental |

## 3. Recomendación

1. **La fase 9 (terminal cuidada) se hace sí o sí.** Es la única vía estable hoy y el plan B de las demás.
2. **El chat va por la vía B, el channel**, y es la única que cumple las cuatro condiciones de §0 a la vez. Su coste
   es el aviso a pantalla completa en cada arranque mientras no estemos en la lista oficial, y la falta de streaming.
   Antes de comprometer la fase 12 propongo **una sesión de prueba de concepto** que responda a lo que está por
   comprobar: el aviso, el consentimiento MCP, la aprobación de `reply`, qué pasa si la sesión está ocupada y si el
   adaptador del kit tolera los flags. Con eso en la mano se decide si la fase 12 se adelanta a la 9 (como dice el
   plan) o se queda detrás.
3. **La vía C queda descartada para este repo mientras la nota de política no cambie.** Si Roberto quiere un chat
   solo para uso propio, es técnicamente la mejor; pero no es lo que dice el principio 5.
4. **Codex se revisa cuando el kit tenga adaptador** y la vía con Claude esté cerrada.

## 4. Tiempos

| Paso | Sesiones | Depende de |
|---|---|---|
| Prueba de concepto del channel (vía B) | 1 | nada |
| Fase 9 · terminal cuidada | 1-2 | nada |
| Fase 12 · chat por channel, completo con tests | 2-3 | la prueba de concepto |
| Relay de permisos en el chat | dentro de la 12 | la prueba de concepto |
| Codex | 4-6 | adaptador en el kit |

## Fuentes

- Channels: https://code.claude.com/docs/en/channels
- Referencia para construir un channel: https://code.claude.com/docs/en/channels-reference
- `fakechat` (ejemplo oficial): https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/fakechat
- Modo programático (`claude -p`, `stream-json`): https://code.claude.com/docs/en/headless
- Referencia de flags del CLI: https://code.claude.com/docs/en/cli-reference
- Agent SDK (nota sobre login de claude.ai y licencia): https://code.claude.com/docs/en/agent-sdk/overview
- Sesiones (entrelazado al reanudar desde dos sitios): https://code.claude.com/docs/en/sessions
- Autenticación del CLI (precedencia de `ANTHROPIC_API_KEY`): https://code.claude.com/docs/en/authentication
- Remote Control: https://code.claude.com/docs/en/remote-control
- Codex app-server: https://learn.chatgpt.com/docs/app-server · https://openai.com/index/unlocking-the-codex-harness
- Codex, modo no interactivo y autenticación: https://learn.chatgpt.com/docs/non-interactive-mode · https://learn.chatgpt.com/docs/auth
