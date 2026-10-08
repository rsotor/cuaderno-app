# Puentes para el chat propio: Claude Code y Codex

**Investigación documental · 2026-10-08 · estado: para decidir.** Complementa `chat-alcances.md` con la decisión nueva
(chat como cajón propio, sesión propia por cuaderno, Claude Code y Codex desde el día 1, suscripción, nunca API key).
Todo sale de documentación o código oficial leído hoy; el enlace va junto al dato y, en lo clave, la frase literal.
Lo que no he podido confirmar está en «Por comprobar» (§7). Versiones leídas: Claude Code docs con flags hasta
v2.1.29x, Agent SDK TS 0.3.293, `@openai/codex` 0.161.0, ACP protocolo v1 / SDK 1.7.0.

## 0. Lo que cambia la decisión (resumen)

1. **La política de Claude no es un no rotundo para nuestro caso, pero tampoco es un sí.** La página legal de Claude Code
   permite que un producto ejecute Claude Code *sin modificar* si «each end user must authenticate with their own ...
   Claude subscription plan credentials». Lo que prohíbe es ofrecer login de claude.ai o enrutar las credenciales del
   usuario. La nota del Agent SDK sigue en pie y manda usar API key. Una app local que arranca el `claude` ya instalado
   y logueado del propio usuario, sin tocar su login, encaja en el primer texto y no en el segundo, pero **ninguna página
   lo nombra expresamente** (§1.1). Recomiendo preguntarlo a Anthropic por escrito antes de publicar.
2. **Codex es más claro:** para «una aplicación local o de código abierto» sobre app-server, OpenAI dice «you can
   continue using it» (§2.4). La frase de «public or open-source repositories» NO habla de apps que envuelven Codex: es
   de la sección de CI/CD con auth gestionada por ChatGPT (§2.4). Corrige la lectura de `chat-alcances.md` §E.
3. **`codex mcp-server` ya no existe** (la doc del SDK dice que fue eliminado). Sale de la tabla (§2.3).
4. **`--append-system-prompt` NO sirve para «página abierta»**: el prompt de sistema se graba en la primera petición y se
   reutiliza al reanudar. La página actual tiene que ir en cada mensaje del usuario (§1.2).
5. **Permisos de Claude desde el chat, vía documentada y sin SDK:** un hook `PermissionRequest` de tipo `http` (se ejecuta
   también en `-p`, timeout por defecto 600 s) que apunta a nuestro servidor local (§1.2). El esquema de
   `--permission-prompt-tool` sigue sin estar documentado.
6. **Skills: Codex no lee `.claude/skills`**; lee `.agents/skills` (§2.5). Si el kit solo deja skills en `.claude/`, Codex
   no las verá sin un enlace simbólico o un cambio en el kit.
7. **El adaptador ACP de Claude trae un flag `--hide-claude-auth`** cuyo comentario dice «this integration must never
   bill a claude.ai subscription» (§3.2): señal de que quien lo mantiene trata la suscripción como zona sensible.

## 1. Claude Code

### 1.1 Política: texto literal y qué distingue

- Nota del Agent SDK (overview y quickstart), literal: «Unless previously approved, Anthropic does not allow third party
  developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK.
  Use the API key authentication methods described in the Quickstart instead.»
  Fuentes: <https://code.claude.com/docs/en/agent-sdk/overview> · <https://code.claude.com/docs/en/agent-sdk/quickstart>
- Página legal, sección «Authentication and credential use»: «Anthropic does not permit third-party developers to offer
  Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf
  of their users. Moreover, developers may not collect, store, or intermediate Claude.ai credentials or session tokens —
  sign-in to a Claude account must complete through Anthropic's own flow.»
  Y justo después: «Nor does it prevent an end user from signing in to the unmodified Claude Code binary with their own
  Claude subscription, including where a platform hosts Claude Code as described under *Can customers offer Claude Code
  in their products?* above.»
  Fuente: <https://code.claude.com/docs/en/legal-and-compliance>
- Misma página, «Can customers offer Claude Code in their products?»: «The Claude Code binary must not be modified.» y
  «Customers may not pay for, resell, or intermediate Claude usage on their end users' behalf. Each end user must
  authenticate with their own Anthropic API key, Claude subscription plan credentials, or 3P inference provider
  credential». También: «Unless we've mutually agreed otherwise, preinstalling or running Claude Code in your products or
  services ... requires agreeing to our Commercial Terms of Service».
- Límites: «Advertised usage limits for Pro and Max plans assume ordinary, individual usage of Claude Code and the Agent
  SDK.» Y «OAuth authentication is intended exclusively for purchasers of ... subscription plans and is designed to
  support ordinary use of Claude Code and other native Anthropic applications.»
- Marca: no se puede llamar «Claude Code» al producto; en texto plano sí se puede decir que ejecuta Claude Code (legal,
  «Using the Claude Code name and logo»). La página del SDK permite «Claude Agent» / «Claude» en un menú de agentes y
  prohíbe «Claude Code» y su arte ASCII (<https://code.claude.com/docs/en/agent-sdk/overview>, «Branding guidelines»).

**¿Distingue la doc el caso «app local de código abierto que arranca el `claude` del usuario»?** No. Ninguna página
habla de «wrapper», «open source» ni «commercial use» fuera de lo citado. Lectura honesta: el texto de «end user signing
in to the unmodified Claude Code binary with their own subscription» cubre el caso, y la prohibición de «offer claude.ai
login ... route requests through plan credentials» no se aplica si la app no hace login ni toca tokens. Es una lectura,
no una autorización. El texto añade: «Anthropic reserves the right to take measures to enforce these restrictions and may
do so without prior notice.» Contacto que la doc indica para dudas: <https://www.anthropic.com/contact-sales>.

**Reglas de diseño que se desprenden del texto** (para que la app quede lo más lejos posible de la zona prohibida):
la app no tiene botón de «iniciar sesión en Claude» (solo detecta con `claude auth status` y manda al alumno a
`claude auth login` en su terminal), no lee ni guarda `~/.claude/.credentials.json` ni el llavero, no pone
`CLAUDE_CODE_OAUTH_TOKEN`, usa el binario `claude` del alumno sin modificar, y quita `ANTHROPIC_API_KEY` del entorno
del hijo (en `-p` «the key is always used when present»: <https://code.claude.com/docs/en/authentication>).

### 1.2 `claude -p` con `stream-json` (vía directa, sin dependencias)

Todo del CLI oficial: <https://code.claude.com/docs/en/cli-reference> y <https://code.claude.com/docs/en/headless>.

| Necesidad | Qué dice la doc | Estado |
|---|---|---|
| Multiturno por stdin | `--input-format`: «Specify input format for print mode (options: `text`, `stream-json`)». `--max-turns`: «With `--input-format stream-json`, a message still queued when the limit ends a turn stays queued and starts a new turn». Es decir, hay cola de mensajes por stdin | Documentado; el **formato de la línea de entrada** del CLI no está descrito (§7) |
| Tokens en vivo | `--include-partial-messages`: «Include partial streaming events in output. Requires `--print` and `--output-format stream-json`». Con `--verbose`; ejemplo `stream_event` / `text_delta` en headless | Documentado |
| Acuse de entrada | `--replay-user-messages`: «Re-emit user messages from stdin back on stdout for acknowledgment» | Documentado |
| Reanudar | `--resume <id\|nombre\|ruta .jsonl>`, `--continue`, `--session-id` («must be a valid UUID»), `--fork-session`. Las sesiones de `-p` no salen en el selector ni en `--continue`, pero «You can still resume one by passing its session ID» (<https://code.claude.com/docs/en/sessions>). `--no-session-persistence` lo impide | Documentado |
| Dos procesos, misma sesión | «If you resume the same session in two terminals without forking, messages from both interleave into one transcript.» (sessions). Con sesión propia por cuaderno deja de ser un problema si la terminal usa otra | Documentado |
| Imágenes | La página de `-p` no habla de imágenes. La del SDK sí: bloque `{type:"image", source:{type:"base64", media_type:"image/png", data}}` dentro de `message.content` de un `SDKUserMessage`, y «Image uploads» está en la lista de «Streaming Input Mode» (<https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode>). Si falta `source`, «Claude Code sends Claude a text note in place of the image». El SDK arranca el mismo binario, así que casi seguro vale igual por stdin | **Por comprobar** con una prueba de 5 líneas (§7) |
| Permisos (1): modo | `--permission-mode`: `default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions`. `acceptEdits`: «Claude writes files without prompting, and Claude Code auto-approves common filesystem commands such as `mkdir`, `touch`, `mv`, and `cp`» (headless). Solo dentro del directorio de trabajo o `--add-dir`: fuera, pide permiso (<https://code.claude.com/docs/en/agent-sdk/permissions>, «Accept edits mode») | Documentado. Cubre «crear carpetas y ficheros» **sin** diálogo |
| Permisos (2): relay al chat | `--permission-prompt-tool`: «Specify an MCP tool to handle permission prompts in non-interactive mode.» No documenta el esquema de entrada/salida (la búsqueda solo devolvió páginas de terceros) | **Por comprobar**; no depender de ella |
| Permisos (3): hook `PermissionRequest` | Entrada: `tool_name`, `tool_input`, `permission_suggestions`. Salida: `hookSpecificOutput.decision.behavior` = `allow`/`deny`, `updatedInput`, `message`, `interrupt`. En `-p`: «In sessions that can't show a prompt, such as background subagents in non-interactive mode, Claude Code still runs these hooks, and if no hook returns a decision, it denies the tool call. For a call that reaches a `--permission-prompt-tool` or the Agent SDK's `canUseTool` callback, the hooks run alongside your host, and whichever decides first applies.» Tipo `http`: «Claude Code sends the hook's JSON input as the POST request body»; «To block a tool call or deny a permission, return a 2xx response with a JSON body»; timeout por defecto 600 s (<https://code.claude.com/docs/en/hooks>) | Documentado. **Es la vía de relay recomendada**: el hook hace POST a `http://127.0.0.1:<puerto>/...` de la app, la app lo enseña en el chat y responde cuando el alumno decide. Se inyecta con `--settings '<json en línea>'` |
| Pregunta del asistente | `AskUserQuestion` es una herramienta aparte; con `--permission-prompts none` se retira. Sin esa opción, en `-p` llega al host (`canUseTool`/prompt tool) | Cómo llega por stream-json: por comprobar |
| Sin permisos | `--permission-prompts none` (v2.1.259+): lo que pediría permiso se deniega y se avisa a Claude de que nadie puede aprobar | Documentado |
| Página abierta | `--append-system-prompt` existe, pero: «Claude Code builds the system prompt once, on a conversation's first request ... and records it in the session ... every later request uses that recorded prompt, including after you return to the conversation with `--resume`» (cli-reference, «System prompt flags in resumed conversations») | **No usar para la página.** Propuesta mía (no está en la doc): prefijar cada mensaje del usuario con una línea de contexto («[Página abierta: ruta]») |
| Más carpetas | `--add-dir`: concede acceso a ficheros; «Claude Code doesn't discover most `.claude/` configuration from these directories» | Documentado |
| Fuentes de configuración | `--setting-sources user,project,local`. Sin `--bare`: «Without it, `claude -p` loads the same context an interactive session would, including anything configured in the working directory or `~/.claude`» | Documentado |
| `--bare` | «skip auto-discovery of hooks, skills, custom commands, subagents, installed plugins, MCP servers, auto memory, and CLAUDE.md»; «Set `ANTHROPIC_API_KEY` before running it, because bare mode doesn't use your subscription login»; «In bare mode, Claude Code never reads OAuth credentials or the system keychain» | **Descartado**: sin suscripción y sin CLAUDE.md/skills |
| CLAUDE.md / AGENTS.md | `-p` sin `--bare` carga lo mismo que interactivo. `AGENTS.md`: «Claude Code can read `AGENTS.md` as your project instructions», pero solo si no hay `CLAUDE.md` (ni `CLAUDE.local.md`) en el directorio o encima; si hay ambos, «Your `CLAUDE.md` files only» (v2.1.277+). Un `CLAUDE.md` que importa `@AGENTS.md` funciona (<https://code.claude.com/docs/en/memory>, «AGENTS.md») | Documentado. Qué tiene cada cuaderno del kit: por comprobar |
| Skills | `-p` carga las de `.claude/skills` del proyecto. «User-invoked skills and custom commands work. Include `/skill-name` in the prompt string» (headless) | Documentado |
| Seguridad | «Without `--bare`, a `-p` session runs the hooks in a project's `.claude/settings.json` and connects the servers in its `.mcp.json`, even in a folder you've never trusted. A `-p` session shows no workspace trust dialog.» | **Riesgo propio de abrir cuadernos ajenos**: avisar al alumno y no abrir cuadernos de origen desconocido |
| Autenticación | `claude auth status` devuelve JSON con `authMethod`: `none`, `claude.ai`, `oauth_token`, `api_key`, `api_key_helper` o `third_party`; sale con código 0 si hay sesión (cli-reference) | Documentado: sirve para el estado de conexión en Ajustes |

### 1.3 Agent SDK TypeScript (`@anthropic-ai/claude-agent-sdk`)

Fuentes: <https://code.claude.com/docs/en/agent-sdk/typescript> · <https://code.claude.com/docs/en/agent-sdk/overview> ·
<https://code.claude.com/docs/en/agent-sdk/user-input> · <https://code.claude.com/docs/en/agent-sdk/claude-code-features> ·
npm (<https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/latest>).

- **Qué hace:** «A library that runs the Claude Code binary». «The SDK bundles a native Claude Code binary for your platform
  as an optional dependency». Se puede apuntar al `claude` del alumno con `pathToClaudeCodeExecutable`.
- **¿Suscripción o API key?** La doc de inicio exige API key (cita de §1.1). Técnicamente el binario sigue su precedencia
  normal de credenciales, donde la suscripción es el último caso por defecto (authentication, «Authentication
  precedence», punto 7) y esa página dice que `ANTHROPIC_API_KEY` «apply to the CLI and the surfaces that wrap it,
  including ... the Agent SDK». Y habla de «Agent SDK logins» que verifican `forceLoginOrgUUID`. Es decir, funciona con
  login de claude.ai, pero **la doc del SDK lo desaconseja y la nota de política lo nombra**. Es la vía más expuesta.
- **API:** `canUseTool(toolName, input, {signal, suggestions})` → `{behavior:"allow", updatedInput}` o
  `{behavior:"deny", message}`; solo se invoca cuando nada anterior resuelve la llamada. `prompt: AsyncIterable<SDKUserMessage>`
  = modo de entrada en streaming (obligatorio para `interrupt()` y `setPermissionMode()`), imágenes en
  `message.content`. `resume`, `cwd`, `additionalDirectories`, `includePartialMessages`, `permissionMode`.
- **`settingSources`:** omitido = `["user","project","local"]`, es decir CLAUDE.md y `.claude/skills` como la CLI
  (claude-code-features). Ojo: «If you omit it, the session can start in auto mode» (`permissionMode`).
- **Coste para el repo:** `.mjs` (ESM) sobre un repo CommonJS: habría que usar `import()` dinámico. Peer deps `zod ^4`,
  `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`; más ocho paquetes opcionales con el binario nativo. Licencia «SEE
  LICENSE IN README.md» (Términos Comerciales de Anthropic, no OSS): <https://code.claude.com/docs/en/agent-sdk/overview>,
  «License and terms».
- **Lo que aporta frente a `-p` directo:** tipos, `canUseTool` sin montar un servidor HTTP, `interrupt()`. **Lo que no
  aporta:** nada en suscripción ni en política.

## 2. Codex (OpenAI)

Las URL `developers.openai.com/codex/...` redirigen (308) a `learn.chatgpt.com/docs/...`; cito la final.

### 2.1 `codex app-server`

Fuente principal: <https://learn.chatgpt.com/docs/app-server> (+ el README del protocolo en
<https://github.com/openai/codex/tree/main/codex-rs/app-server>, solo leí un fragmento).

- **Transporte y protocolo:** «`stdio` (`--listen stdio://`, default): newline-delimited JSON (JSONL).» y «`codex app-server`
  supports bidirectional communication using JSON-RPC 2.0 messages.» (sin la cabecera `"jsonrpc":"2.0"`). Handshake:
  «Clients must send a single `initialize` request per transport connection» y después la notificación `initialized`.
- **Estado:** «The app-server command and WebSocket transport are experimental and aren't supported for production
  workloads.» (sección «Connect the CLI»/«Protocol»). Esquemas versionados: `codex app-server generate-ts --out` y
  `generate-json-schema --out`; «Each output is specific to the Codex version you ran». Sirve para tener tipos sin
  depender de nada.
- **Hilos y turnos:** `thread/start` (con `cwd`, `approvalPolicy`, `sandbox`), `thread/resume` («reopen an existing thread
  by id so later `turn/start` calls append to it»), `thread/fork`, `thread/list` (README). `turn/start` con `input`.
- **Imágenes:** `input` admite `{"type":"text","text":...}`, `{"type":"image","url":...}` y
  `{"type":"localImage","path":"/tmp/screenshot.png"}`. Para nosotros: guardar el adjunto en una carpeta temporal y pasar
  `localImage`.
- **Streaming:** «keep reading notifications on stdout»: `item/started`, `item/agentMessage/delta`, `item/completed`,
  `turn/completed`.
- **Aprobaciones:** peticiones del servidor al cliente `item/commandExecution/requestApproval` (con `itemId`, `threadId`,
  `turnId`, `reason` y `command` opcionales) e `item/fileChange/requestApproval` (con `grantRoot` opcional). Respuesta:
  «Command execution decisions: `accept`, `acceptForSession`, `decline`, `cancel`» (igual para cambios de fichero);
  `serverRequest/resolved` confirma. También `item/permissions/requestApproval` (subconjunto de permisos de red o
  sistema de ficheros) e `item/tool/requestUserInput`.
- **Sandbox:** `sandboxPolicy`: `readOnly`, `workspaceWrite`, `externalSandbox`. El ejemplo de `thread/start` usa
  `"approvalPolicy": "never"` y `"sandbox": "workspaceWrite"` y el de `turn/start` `"unlessTrusted"`: la lista completa de
  valores no la he leído (§7).
- **Autenticación:** `account/login/start` admite «`apiKey`, `chatgpt`, `chatgptDeviceCode`, or experimental
  `chatgptAuthTokens`». Modo «ChatGPT managed»: «Codex owns the ChatGPT OAuth flow, persists tokens, and refreshes them
  automatically.» `account/read` informa de la cuenta. Credenciales: «Codex caches login details locally in a plaintext file
  at `~/.codex/auth.json` or in your OS-specific credential store» (<https://learn.chatgpt.com/docs/auth>). Nuestra app no
  debe tocar ese fichero: basta con que el alumno haya hecho `codex login`, y `account/read` dice si hay sesión.
- **Skills:** `skills/list` por `cwd`, `skills/changed`; se invocan con `$nombre` en el texto más un item `skill`.
- **AGENTS.md:** la página de app-server no lo menciona. La de configuración dice: «Codex builds an instruction chain when
  it starts (once per run ...)»; global `~/.codex/AGENTS.md`, luego desde la raíz del proyecto hasta el directorio actual,
  «at most one file per directory», tope `project_doc_max_bytes` = 32 KiB por defecto
  (<https://learn.chatgpt.com/docs/agent-configuration/agents-md>). Si hay `AGENTS.md` en la carpeta del cuaderno, se lee;
  si app-server lo reconstruye por hilo, por comprobar.

### 2.2 Codex SDK (`@openai/codex-sdk`)

<https://learn.chatgpt.com/docs/codex-sdk> y npm (<https://registry.npmjs.org/@openai/codex-sdk/latest>).
Instalación `npm install @openai/codex-sdk`, «requires Node.js 18 or later»; API TS: `codex.startThread()`,
`thread.run(prompt)`, `codex.resumeThread(threadId)`; «The TypeScript library is for server-side use.» La página **no**
documenta imágenes, autenticación, aprobaciones ni `runStreamed`. Dependencia: `@openai/codex` (el binario completo, con
paquetes opcionales por plataforma), ESM. Para Python dice que «controls the local Codex app-server over JSON-RPC»; para
TS no lo dice (por comprobar si es lo mismo por debajo). Resumen: no aporta nada que app-server no dé, y esconde
justo lo que necesitamos (aprobaciones, imágenes).

### 2.3 `codex mcp-server`

Literal: «The codex mcp-server command and standalone codex-mcp-server binary have been removed.» Quien lo use debe pasar
al app server (<https://learn.chatgpt.com/docs/codex-sdk>). **Descartado.**

### 2.4 Política de OpenAI sobre la suscripción en apps de terceros

- Sección «Auth endpoints» de app-server (<https://learn.chatgpt.com/docs/app-server>): «If you've built a local or
  open-source application using Codex app-server authentication, you can continue using it,» y «though we recommend
  migrating to Sign in with ChatGPT so users have greater control over and visibility into their usage.» Además: «App-server
  authentication has never been permitted for commercial or hosted services.»
- Modo `chatgptAuthTokens`: solo «when a host application owns the user's ChatGPT auth lifecycle», requiere
  `capabilities.experimentalApi = true`. **No usarlo** (equivale a que la app guarde tokens).
- La frase de los repos públicos, en contexto (<https://learn.chatgpt.com/docs/non-interactive-mode>): está bajo el
  encabezado «Use ChatGPT-managed auth in CI/CD (advanced)», dentro de «Authenticate in automation»: es para equipos que
  quieren ejecutar trabajos de CI con una cuenta de usuario de Codex en vez de API key, y dice literal «Do not use this
  workflow for public or open-source repositories.» Habla de `auth.json` copiado a runners de CI. **No habla de apps de
  escritorio que envuelven Codex.** La página de auth añade «Don't expose Codex execution in untrusted or public
  environments» (<https://learn.chatgpt.com/docs/auth>), también en el contexto de automatización.
- Ambigüedad que queda: «Sign in with ChatGPT» como alternativa recomendada parece un programa de login para terceros; no
  he encontrado su documentación para desarrolladores (una búsqueda solo devolvió noticias de 2025 sobre un formulario de
  interés). Y no sé si «app-server authentication» incluye a una app que solo arranca `codex app-server` con la sesión que
  el alumno ya abrió con `codex login`. Mismo tratamiento que con Claude: la app no hace login, no toca `auth.json`.

### 2.5 Skills de Codex

Rutas: `$CWD/.agents/skills` (y hacia arriba hasta la raíz del repo), `$HOME/.agents/skills`, `/etc/codex/skills`,
más las del sistema. «The page doesn't mention `.claude/skills`» (<https://learn.chatgpt.com/docs/build-skills>). Formato
`SKILL.md` con `name` y `description`, igual que el de Claude. Consecuencia: las skills del kit en `.claude/skills` no las
ve Codex. Opciones fuera del alcance de esta app: que el kit publique también `.agents/skills` (enlace simbólico; «Symlinked
skill folders are supported»), o que la app lo haga al abrir. Decisión del kit, no de la app (principio 3).

## 3. ACP (Agent Client Protocol)

<https://agentclientprotocol.com> · <https://agentclientprotocol.com/overview/introduction>.

**Qué es:** estándar editor↔agente de código, «similar to how the Language Server Protocol (LSP) standardized language
server integration»; agentes locales como subprocesos, «communicate via JSON-RPC over stdio». «Full support for remote
agents is a work in progress.» Versión del protocolo: entero `1` (`"protocolVersion": 1`, «a single integer that
identifies a **MAJOR** protocol version»: <https://agentclientprotocol.com/protocol/initialization>). La lista de agentes
(41) incluye Claude Agent, Codex CLI y Gemini CLI (<https://agentclientprotocol.com/overview/agents>).

**Lo que cubre (todo documentado):**

| Necesidad | Qué hay | Fuente |
|---|---|---|
| Sesiones | `session/new` (`cwd` «MUST be an absolute path», `mcpServers`), `session/load` (requiere `loadSession`; el agente reenvía el historial como `session/update`), `session/resume` (sin repetir historial), `additionalDirectories` | <https://agentclientprotocol.com/protocol/session-setup> |
| Turno y streaming | `session/prompt` con `prompt: ContentBlock[]`; `session/update` con `agent_message_chunk`, `agent_thought_chunk`, `tool_call`, `tool_call_update`, `plan`, `usage_update`...; `session/cancel`; paradas `end_turn`, `max_tokens`, `refusal`, `cancelled` | <https://agentclientprotocol.com/protocol/prompt-turn> |
| Imágenes | Bloque `Image` con `data` (base64) y `mimeType`; el cliente debe respetar `promptCapabilities` del agente | <https://agentclientprotocol.com/protocol/content> · initialization |
| Permisos | `session/request_permission` con `toolCall` y `options` (`optionId`, `name`, `kind`: `allow_once`, `allow_always`, `reject_once`, `reject_always`); respuesta `selected` + `optionId` o `cancelled` | <https://agentclientprotocol.com/protocol/tool-calls> |
| Ficheros del cliente | `fs/read_text_file`, `fs/write_text_file` y `terminal/*` si el cliente los anuncia (opcionales) | <https://agentclientprotocol.com/protocol/overview> |
| Autenticación | `authMethods` + `authenticate` | initialization |

### 3.1 Dependencia en el repo

`@agentclientprotocol/sdk` 1.7.0 (Apache-2.0, ESM, sin dependencias, peer `zod ^3.25 || ^4`; tiene una ruta
`./experimental/v2`). Es una dependencia más una peer (`zod`), sobre un repo hoy con seis. Alternativa: escribir el cliente
a mano (JSON-RPC por JSONL son ~150 líneas) y usar solo los nombres de método del protocolo.
Fuente: <https://registry.npmjs.org/@agentclientprotocol/sdk/latest>.

### 3.2 Adaptador de Claude

- Nombre actual: `@agentclientprotocol/claude-agent-acp` 0.88.0 (publicado hoy), `node >= 22`, dependencias exactas
  `@anthropic-ai/claude-agent-sdk 0.3.293`, `@agentclientprotocol/sdk 1.7.0`, `zod`, `diff`. Los antiguos
  `@zed-industries/claude-code-acp` y `@zed-industries/claude-agent-acp` están marcados «renamed ... Please migrate»
  (<https://registry.npmjs.org/@agentclientprotocol/claude-agent-acp/latest>). Repo:
  <https://github.com/agentclientprotocol/claude-agent-acp> (la ACP lo lista como «via Zed's SDK adapter»).
- «This tool implements an ACP agent by using the official Claude Agent SDK»: soporta imágenes, tool calls con petición de
  permiso, slash commands, MCP del cliente (README). **Es el Agent SDK por debajo**, con su nota de política.
- Login: `src/acp-agent.ts` anuncia métodos `claude-ai-login` («Use Claude subscription») y `console-login`
  («Use Anthropic Console (API usage billing)») lanzando `claude auth login --claudeai/--console` (líneas ~2640-2700 del
  fichero del repo leído hoy), o sea que el login lo hace el CLI de Anthropic. Y existe `--hide-claude-auth`:
  «this integration must never bill a claude.ai subscription. The flag hides the claude.ai login method from `initialize`»
  (`src/hide-claude-auth.ts`). Para la sesión pone `ANTHROPIC_API_KEY: ""` en el entorno del hijo (`acp-agent.ts`, línea
  ~10420). Conclusión: usa el login del CLI, no exige API key, pero sus propios autores dejan un interruptor para
  prohibirlo.
- Cuatro dependencias nuevas con peso (SDK de Claude + binario nativo + ACP SDK + zod) y exige Node 22+ (la app pide 24).

### 3.3 Adaptador de Codex

`@agentclientprotocol/codex-acp` (repo <https://github.com/agentclientprotocol/codex-acp>; el paquete antiguo
`@zed-industries/codex-acp` está «replaced»). README: «`codex-acp` is a stdio ACP agent server. It starts the Codex App
Server, translates ACP requests into Codex operations». Funciones: «ChatGPT, API key, and client-provided custom gateway
authentication», «Text prompts, embedded context, images, resource links, and additional workspace directories», eventos
de comando, cambios de fichero y permisos, `/skills`. Incluye `@openai/codex` como dependencia. Es un traductor fino
sobre app-server, así que hereda su estado experimental.

### 3.4 Gemini CLI

Ver §4: `gemini --acp`.

## 4. Gemini CLI (solo para no excluirlo del diseño)

- Headless: `-p/--prompt` con `--output-format` JSON o JSONL en streaming (<https://geminicli.com/docs/cli/headless/>).
- ACP: `gemini --acp`, stdio JSON-RPC 2.0, con `newSession`, `loadSession`, `prompt`, `cancel`, `setSessionMode` (aprobación
  de herramientas) y un método `unstable_setSessionModel`; la página no menciona imágenes
  (<https://geminicli.com/docs/cli/acp-mode/>).
- Login: «the simplest authentication method is logging in with your Google account», «Your credentials will be cached
  locally»; en headless «will use your existing authentication method, if an existing authentication credential is
  cached», si no, clave de API o Vertex (<https://geminicli.com/docs/get-started/authentication/>). Nada dice sobre
  software de terceros que use ese login.
- Aviso en la página de ACP (a verificar): «Gemini CLI was replaced by Antigravity CLI on June 18th, 2026» para el nivel
  gratuito y Google One. Puede cambiar qué cuentas lo pueden usar. Por eso no entra en la v1.

## 5. Tabla comparativa

«Login» = usa la sesión de suscripción del propio alumno sin API key. «Permitido» = lo que dice la doc para una app
pública de terceros.

### Claude

| | stream-json directo | Agent SDK | ACP (`claude-agent-acp`) |
|---|---|---|---|
| Login de suscripción | Sí (el `claude` del alumno; `--bare` no) | Técnicamente sí; la doc manda API key | Sí vía CLI (`claude-ai-login`) |
| Permitido (literal) | Sin texto específico. Aplica «Nor does it prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription» | «Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK» | Hereda la del SDK; con `--hide-claude-auth` prohibible |
| Streaming | `--include-partial-messages` | `includePartialMessages` | `agent_message_chunk` |
| Imágenes de entrada | Probable (bloque base64); por comprobar | Sí, documentado | Sí (README) |
| Relay de permisos al chat | Hook `PermissionRequest` http (documentado) o `--permission-prompt-tool` (sin esquema) | `canUseTool` | `session/request_permission` |
| Sesión por cuaderno y reanudar | `--session-id` / `--resume` | `resume` | `session/load`/`resume` |
| AGENTS.md y skills | Sí (CLAUDE.md; AGENTS.md si no hay CLAUDE.md); skills de `.claude/skills` | Sí con `settingSources` | Sí (usa el SDK) |
| Estado | Estable y documentado (flags con versión) | Estable, versión 0.x | ACP v1; adaptador 0.88 |
| Dependencias nuevas | 0 | 1 + 3 peer + binario nativo, ESM | ACP SDK + adaptador + SDK de Claude, Node ≥22 |
| Riesgo principal | Política sin texto expreso; formato de stdin no documentado | Política explícita contra | Política (vía SDK) y mucho peso |

### Codex

| | app-server | Codex SDK | `codex mcp-server` | ACP (`codex-acp`) |
|---|---|---|---|---|
| Login de suscripción | Sí (`chatgpt` / `codex login`) | No documentado | n/a | Sí («ChatGPT login») |
| Permitido (literal) | «If you've built a local or open-source application using Codex app-server authentication, you can continue using it»; «never been permitted for commercial or hosted services» | Sin texto | n/a | Hereda app-server |
| Streaming | `item/agentMessage/delta` | no documentado | n/a | `agent_message_chunk` |
| Imágenes | `localImage` / `image` | no documentado | n/a | Sí (README) |
| Relay de permisos | `requestApproval` → `accept`/`acceptForSession`/`decline`/`cancel` | no documentado | n/a | `session/request_permission` |
| Sesión y reanudar | `thread/start`, `thread/resume` | `resumeThread` | n/a | `session/load` |
| AGENTS.md y skills | AGENTS.md sí (cadena al inicio, 32 KiB); skills `.agents/skills` (no `.claude`) | igual | n/a | igual; `/skills` |
| Estado | «experimental and aren't supported for production workloads» | 0.161 | **Eliminado** | Adaptador sobre app-server |
| Dependencias nuevas | 0 (hablar JSONL a mano; esquema generable) | `@openai/codex-sdk` + `@openai/codex` | n/a | ACP SDK + adaptador + `@openai/codex` |
| Riesgo principal | Protocolo experimental que puede cambiar | Esconde aprobaciones e imágenes | n/a | Doble capa sobre algo experimental |

## 6. Recomendación

**Puente por proveedor (mi propuesta, razonada con lo anterior):**

- **Claude: `claude -p` con `stream-json` directo**, usando el `claude` del alumno, con el login que ya tenga. Cero
  dependencias, la superficie está en la CLI oficial con versión por flag, y es la que menos se parece a lo que la nota de
  política nombra («agents built on the Claude Agent SDK»). Permisos: `--permission-mode acceptEdits` para crear carpetas y
  ficheros dentro del cuaderno sin diálogo, y hook `PermissionRequest` http hacia nuestro servidor para el resto.
- **Codex: `codex app-server` directo por stdio**, cliente JSONL propio con esquemas generados con `generate-json-schema`
  como referencia. Es el único camino documentado con imágenes, aprobaciones y reanudar; el SDK no documenta nada de eso y
  `mcp-server` ya no existe.
- **Antes de publicar:** pedir por escrito a Anthropic (<https://www.anthropic.com/contact-sales>) confirmación del caso, y
  a OpenAI lo equivalente, porque ninguna de las dos páginas nombra «app local de código abierto que lanza el CLI del
  usuario» para Claude y la de OpenAI deja ambiguo «Sign in with ChatGPT».

**¿Capa común?** Un adaptador propio con interfaz mínima (`enviar(texto, imágenes, página)`, eventos
`token`/`herramienta`/`permiso`, `responderPermiso`, `sesión`) y no ACP. Por qué, en tres líneas: (1) ACP obliga a meter
dos adaptadores que arrastran el SDK de Claude y la política de la nota, más un SDK y Node 22+, para traducir dos
protocolos que ya son JSONL por stdio con la misma forma de eventos; (2) el valor de ACP es que un solo cliente sirva a
muchos agentes, y aquí son dos, con diferencias que ACP no resuelve (página abierta, skills en `.claude` o `.agents`,
política de login); (3) la interfaz propia es pequeña y deja a Gemini (`gemini --acp`) como tercer adaptador futuro, o el
día que ACP compense, como un adaptador más detrás de la misma interfaz. Revisar si se añade un tercer proveedor.

## 7. Por comprobar

1. **Formato de la línea de entrada de `claude -p --input-format stream-json`** y si acepta el bloque `image` base64:
   la doc de la CLI no lo describe; la del SDK sí lo muestra para su propio `SDKUserMessage`. Prueba de 5 líneas con
   un cuaderno de `ejemplos/`.
2. **Que el hook `PermissionRequest` de tipo `http` inyectado con `--settings` en línea se dispare en `-p` con
   `--input-format stream-json` y espere hasta 600 s** a que el alumno responda (la doc dice que se ejecuta en `-p` y que
   el timeout por defecto es 600, pero no he ejecutado nada). Cómo llega `AskUserQuestion` por stream-json.
3. **Esquema de `--permission-prompt-tool`** (sin documentar en las páginas oficiales leídas).
4. **Política:** ninguna página de Anthropic ni de OpenAI cubre expresamente «app local, de código abierto, que lanza el
   CLI ya logueado del usuario». Qué significa exactamente «Sign in with ChatGPT» como alternativa recomendada en OpenAI
   y si «app-server authentication» incluye usar el login ya hecho con `codex login`.
5. **Codex app-server:** lista completa de valores de `approvalPolicy` y `sandbox`; si reconstruye AGENTS.md por hilo o
   por proceso; si carga skills de `.claude/skills` (la doc de skills no lo menciona); lectura completa del README del
   protocolo (solo leí un fragmento de <https://github.com/openai/codex/tree/main/codex-rs/app-server>).
6. **Codex SDK TS:** si por debajo usa app-server; imágenes, auth y aprobaciones no están documentados en su página.
7. **Qué tiene cada cuaderno del kit en la raíz** (`CLAUDE.md` que importe `AGENTS.md`, o solo `AGENTS.md`) y dónde deja
   `profesor-kit` las skills (`.claude/skills` y/o `.agents/skills`). No he tocado `profesor-kit`.
8. **Gemini:** soporte de imágenes en `--acp`, y el efecto del aviso de Antigravity sobre el login de Google.
9. **Versiones mínimas de Claude Code:** el aviso de `AGENTS.md` (2.1.277) y `--permission-prompts` (2.1.259) implican
   comprobar `claude --version` y degradar con un mensaje claro.
10. **Adaptador ACP de Claude con suscripción:** lo leí en código, no lo ejecuté; no sé si el SDK que lleva dentro respeta la
    suscripción en todos los casos.

## Fuentes

- Claude Code: <https://code.claude.com/docs/en/legal-and-compliance> · <https://code.claude.com/docs/en/headless> ·
  <https://code.claude.com/docs/en/cli-reference> · <https://code.claude.com/docs/en/sessions> ·
  <https://code.claude.com/docs/en/hooks> · <https://code.claude.com/docs/en/authentication> ·
  <https://code.claude.com/docs/en/memory>
- Agent SDK: <https://code.claude.com/docs/en/agent-sdk/overview> · <https://code.claude.com/docs/en/agent-sdk/quickstart> ·
  <https://code.claude.com/docs/en/agent-sdk/typescript> · <https://code.claude.com/docs/en/agent-sdk/permissions> ·
  <https://code.claude.com/docs/en/agent-sdk/user-input> · <https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode> ·
  <https://code.claude.com/docs/en/agent-sdk/claude-code-features>
- Codex: <https://learn.chatgpt.com/docs/app-server> · <https://learn.chatgpt.com/docs/codex-sdk> ·
  <https://learn.chatgpt.com/docs/auth> · <https://learn.chatgpt.com/docs/non-interactive-mode> ·
  <https://learn.chatgpt.com/docs/agent-configuration/agents-md> · <https://learn.chatgpt.com/docs/build-skills> ·
  <https://github.com/openai/codex/tree/main/codex-rs/app-server>
- ACP: <https://agentclientprotocol.com/overview/introduction> · <https://agentclientprotocol.com/overview/agents> ·
  <https://agentclientprotocol.com/protocol/overview> · <https://agentclientprotocol.com/protocol/initialization> ·
  <https://agentclientprotocol.com/protocol/session-setup> · <https://agentclientprotocol.com/protocol/prompt-turn> ·
  <https://agentclientprotocol.com/protocol/content> · <https://agentclientprotocol.com/protocol/tool-calls> ·
  <https://github.com/agentclientprotocol/claude-agent-acp> · <https://github.com/agentclientprotocol/codex-acp>
- npm (versiones y dependencias): <https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/latest> ·
  <https://registry.npmjs.org/@openai/codex-sdk/latest> · <https://registry.npmjs.org/@agentclientprotocol/sdk/latest> ·
  <https://registry.npmjs.org/@agentclientprotocol/claude-agent-acp/latest>
- Gemini CLI: <https://geminicli.com/docs/cli/headless/> · <https://geminicli.com/docs/cli/acp-mode/> ·
  <https://geminicli.com/docs/get-started/authentication/>
