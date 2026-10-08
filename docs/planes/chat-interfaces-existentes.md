# ¿Ya existe una interfaz de chat visual sobre los CLIs? (investigación)

**2026-10-08.** Pregunta de Roberto: «realmente lo que estamos haciendo es poner bonita una terminal; ¿hay algo así que
nos sirva? Te instalas el CLI y tienes todo, más visual, para mi padre, en Windows; que no sea "terminal"».
Caso: persona mayor, no técnica, **Windows nativo**, carpeta de curso (Markdown) con AGENTS.md y skills, suscripción
(nunca API key). Todo dato lleva su enlace, leído hoy; lo no confirmado va como «por comprobar» y se repite en §4.

## Resumen (lectura corta)

- **Sí existe, y es oficial: la app de escritorio de Claude (pestaña Code) y la app de escritorio de ChatGPT/Codex.**
  Las dos tienen Windows nativo, login con la suscripción, abren una carpeta, enseñan permisos con botones y admiten
  imágenes. Cubren el caso «padre en Windows» mucho mejor de lo que esperábamos.
- **Tres puntos sin cerrar** que decidirán si bastan: que parezca un chat y no una herramienta de programador
  (por comprobar con ojos de él), que Windows nativo no pida Git (por comprobar) y que el proveedor sea uno solo
  por persona (él elige Claude **o** ChatGPT, no ambos con los mismos ajustes que la app).
- **Las interfaces de código abierto no son la vía:** o no tienen instalador de Windows verificado, o van sobre el
  Agent SDK / un puente que la política de Anthropic no deja ofrecer con login de suscripción, o están abandonadas.
- Lo que **perderíamos** frente a un chat dentro de cuaderno-app: ver §3.

## 1. Tabla comparativa

Leyenda: «cita» = frase de la doc; «PC» = por comprobar.

### 1a. Oficiales de Anthropic

| | Claude Desktop, pestaña Code | Extensión VS Code (y JetBrains) | claude.ai/code (web) |
|---|---|---|---|
| Qué es / quién | App de Anthropic con Claude Code dentro: [desktop](https://code.claude.com/docs/en/desktop) | Extensión de Anthropic con «interfaz gráfica nativa» en VS Code: [vs-code](https://code.claude.com/docs/en/vs-code). JetBrains: plugin «beta» que **exige el CLI instalado aparte**: [overview](https://code.claude.com/docs/en/overview) | Sesiones de Claude Code en la nube de Anthropic: [claude-code-on-the-web](https://code.claude.com/docs/en/claude-code-on-the-web) |
| Windows nativo | Sí: instalador x64 y ARM64; también WSL opcional ([desktop](https://code.claude.com/docs/en/desktop), [WSL](https://code.claude.com/docs/en/desktop-wsl)). Git: «los worktrees necesitan Git»; versiones ≥1.49585.0 ya no lo piden al arrancar (PC si hace falta para una carpeta sin repo) | Sí (VS Code ≥1.94 en Windows; atajos Windows documentados) | Navegador, da igual el SO |
| Login de suscripción sin API key | Sí: «sign in with your Anthropic account»; exige plan de pago ([desktop-quickstart](https://code.claude.com/docs/en/desktop-quickstart), [overview](https://code.claude.com/docs/en/overview)) | Sí: «any paid Claude subscription … no API key is required» ([vs-code](https://code.claude.com/docs/en/vs-code)) | Sí, planes Pro/Max/Team/Enterprise |
| Se abre sobre una carpeta | Sí: «Select folder» en sesión Local | Sí (la carpeta que abre VS Code) | **No sirve:** clona un repo de GitHub o sube un bundle git (mín. 1 commit, <100 MB); no trabaja sobre la carpeta local en vivo |
| Respeta CLAUDE.md / AGENTS.md / skills / settings | Sí: «reads the same settings files as the CLI»; CLAUDE.md y skills compartidos con el CLI ([desktop](https://code.claude.com/docs/en/desktop)). AGENTS.md: Claude Code lo lee «en lugar de» un CLAUDE.md ([overview](https://code.claude.com/docs/en/overview)); este repo usa CLAUDE.md con `@AGENTS.md` (PC en un cuaderno de curso) | Sí, mismo motor | Solo lo que esté en el repo clonado |
| Permisos | Selector Manual / Accept edits / Plan / Auto; en Manual, vista de diff con **botones Aceptar/Rechazar** ([desktop-quickstart](https://code.claude.com/docs/en/desktop-quickstart)). El modo se recuerda por carpeta | Diálogo de permiso con diff en el editor ([vs-code](https://code.claude.com/docs/en/vs-code)) | Modos Accept edits / Plan / Auto |
| Imágenes | Sí: imágenes y PDF, arrastrar o botón ([desktop](https://code.claude.com/docs/en/desktop)) | Sí: pegar del portapapeles ([vs-code](https://code.claude.com/docs/en/vs-code)) | PC |
| Aspecto para no técnico | App con pestañas Chat / Cowork / Code y paneles (diff, terminal, navegador); **orientada a código** (diffs, worktrees, PRs). PC verlo con los ojos de él | Dentro de VS Code: editor, árbol, paneles. **Herramienta de programador** | Chat web sencillo, pero pensado para repos |
| Estado / licencia / versión | Producto oficial; Windows no marcado beta (Linux sí). Software propietario bajo [términos de Anthropic](https://code.claude.com/docs/en/legal-and-compliance). Versión: PC | Producto oficial; plugin JetBrains «beta» | Producto oficial |
| Lanzar desde otra app con carpeta | Enlace `claude://code/new` documentado **solo para SSH** (`ssh_host`, `ssh_folder`, `q`) ([desktop](https://code.claude.com/docs/en/desktop)). Carpeta local por enlace: PC. `claude --desktop` abre Desktop en el directorio actual (CLI ≥2.1.285; Windows x64 + suscripción) | `vscode://anthropic.claude-code/open?prompt=…` abre una pestaña; carpeta: PC. Y `claude-cli://open?cwd=…&q=…` abre el **CLI en terminal** con carpeta ([deep-links](https://code.claude.com/docs/en/deep-links)) | URL web; sin carpeta |
| Embeber (iframe) | No (app nativa) | No | Web de claude.ai: PC si permite iframe; improbable |
| Coste | Incluido en la suscripción (Pro/Max/Team/Enterprise); sin coste extra | Igual | Igual, comparte límites |

### 1b. Oficiales de OpenAI

| | App de escritorio de ChatGPT con Codex (Windows) | Extensión Codex (VS Code, Cursor, Windsurf, JetBrains, Xcode) | Codex en la nube |
|---|---|---|---|
| Qué es / quién | OpenAI. Codex va dentro de la app de escritorio de ChatGPT, con páginas propias para Windows: [docs](https://learn.chatgpt.com/docs), [windows-app](https://learn.chatgpt.com/codex/windows/windows-app) | Extensión de OpenAI: [ide](https://learn.chatgpt.com/codex/ide) | Requiere login de ChatGPT: [auth](https://learn.chatgpt.com/codex/auth) |
| Windows nativo | **Sí**: «By default … uses the Windows-native Codex agent», comandos en PowerShell; WSL opcional. Instalación por Microsoft Store o `winget`. Sandbox nativo: Windows 11 recomendado; el modo recomendado **necesita aprobación de administrador (UAC)**, con fallback «unelevated» ([windows-sandbox](https://learn.chatgpt.com/codex/windows/windows-sandbox)) | La doc consultada no dice si es nativo o WSL: PC ([ide](https://learn.chatgpt.com/codex/ide)); el sandbox nativo se describe válido para app, CLI e IDE | Navegador |
| Login de suscripción sin API key | Sí: «Sign in with ChatGPT» para suscripción; o API key ([auth](https://learn.chatgpt.com/codex/auth)). Qué planes lo incluyen: PC (remite a la página de precios) | Ídem | Solo ChatGPT, no API key |
| Se abre sobre una carpeta | Sí: «Add new project» / Ctrl+O; «create a project, or open a folder» ([windows-app](https://learn.chatgpt.com/codex/windows/windows-app), [app](https://learn.chatgpt.com/codex/app)) | Con el contexto del editor | Repos |
| AGENTS.md / skills | La doc tiene páginas de AGENTS.md y Skills y la app dice soportar skills; detalles en páginas que no he abierto: PC. (AGENTS.md es el formato nativo de Codex) | PC | PC |
| Permisos | «Ask for approval» bajo el cuadro de texto; modo «full access» fuera de la carpeta, con aviso de riesgo ([windows-app](https://learn.chatgpt.com/codex/windows/windows-app)). Cómo se ven las peticiones: PC | PC | PC |
| Imágenes | Hay página «Image inputs» enlazada ([app](https://learn.chatgpt.com/codex/app)); contenido: PC | PC | PC |
| Aspecto para no técnico | Es la app de ChatGPT (chat + proyectos), más cercana a «un chat» que la de Claude. PC verlo con los ojos de él | Herramienta de programador | Chat web |
| Estado / licencia | Producto oficial, propietario; nº de versión: PC | Oficial | Oficial |
| Lanzar con carpeta / embeber | Sin enlace documentado en lo leído: PC | PC | No |
| Coste | Incluido en el plan de ChatGPT con uso limitado (los créditos extra son opcionales) ([sign-in-with-chatgpt](https://learn.chatgpt.com/codex/sign-in-with-chatgpt)) | Ídem | Ídem |

Nota: https://openai.com/codex devolvió 403; no se ha usado.

### 1c. Editores vía ACP

| | Zed | Resto de clientes ACP |
|---|---|---|
| Qué es | Editor con «external agents» (Claude, Codex, OpenCode…), lista «curated»: [external-agents](https://zed.dev/docs/ai/external-agents) | [Lista oficial](https://agentclientprotocol.com/overview/clients): ~100 clientes (editores, apps de escritorio, web, móvil, mensajería); sin estado ni versión en la página |
| Windows nativo | Zed para Windows «is here» ([zed.dev/windows](https://zed.dev/windows)); si es estable: PC. Que **Claude Agent / Codex** funcionen en Windows: la doc no lo dice → PC | Algunos listan Windows (ACP UI, AcpAgent Client, Bellows, Braide, Codeg, tlbx…); la página no da más |
| Suscripción sin API key | Cada agente «owns its own authentication»; Codex «may support ChatGPT login». Claude: `/login` con API key o «Claude Code where supported» → ambiguo, PC. Zed no cobra | PC por cliente |
| Carpeta / CLAUDE.md | Abre carpetas; «CLAUDE.md may be read by Claude Agent directly»; AGENTS.md y skills «depend on the agent» | PC |
| Permisos / imágenes | La doc dice que dependen del agente; no describe la UI | PC |
| Aspecto | **Editor de código**: herramienta de programador | Varía; la mayoría son de programador |
| Importante | En Zed el agente de Claude se llama «Claude Agent» (no «Claude Code») y se apoya en el SDK: aplica lo de §2 (PC) | Idem |

### 1d. Código abierto (estado a 2026-10-08, datos de la API de GitHub)

| Proyecto | Qué es / mantenimiento | Windows | Puente y login | Veredicto para el caso |
|---|---|---|---|---|
| [CloudCLI / claudecodeui](https://github.com/siteboon/claudecodeui) (siteboon) | UI web (y móvil) sobre Claude Code, Cursor CLI y Codex. 14 k estrellas, AGPL-3.0, último push **hoy**. Se instala con `npx @cloudcli-ai/cloudcli` (Node 22+) | README no dice si el npm va en Windows; hay «companion» de escritorio para Windows (PC) | Depende de `@anthropic-ai/claude-agent-sdk`, `@openai/codex-sdk` y `node-pty` ([package.json](https://raw.githubusercontent.com/siteboon/claudecodeui/main/package.json)) → **mezcla SDK y pty**. README: «bring your own subscription» | Vivo y activo, pero **requiere Node + comando** (no es instalador), y va sobre el Agent SDK → ver §2 |
| [opcode](https://github.com/winfunc/opcode) (ex Claudia) | App de escritorio Tauri para Claude Code. 22 k estrellas, AGPL-3.0, **último push 2026-09-18**; última release v0.2.0 de **2025-08-31** | README dice Windows 10/11 compatible, pero la release **no trae instalador de Windows** (solo macOS y Linux) | Necesita `claude` en el PATH; cómo habla con él: el README no lo dice (PC) | **Descartado**: sin instalador de Windows, solo Claude |
| [Vibe Kanban](https://github.com/BloopAI/vibe-kanban) | Tablero kanban de agentes. 28 k estrellas, Apache-2.0. README: **«Vibe Kanban is sunsetting»** | No documentado | Agentes ya autenticados | **Descartado**: cierra, y es de programador |
| [cdesktop](https://github.com/cdesktop-ai/cdesktop) | «Alternativa a Claude Code Desktop», web local, deriva de Vibe Kanban. Apache-2.0. Marcado **beta** | Sin soporte documentado; sin versión de escritorio aún (`npx cdesktop`) | Cada CLI como proceso hijo | **Descartado** de momento |
| [Happy](https://github.com/slopus/happy) | App de escritorio (macOS, Windows, Linux) y móvil para Claude Code, Codex y Grok. MIT, 24 k estrellas, push 2026-10-07 | Escritorio: sí, según README; CLI en Windows: no dice | Envoltorio de los CLIs (`happy claude`); «Your subscription». Permisos e imágenes: no cubiertos | Candidato a mirar; **orientado a controlar sesiones desde el móvil**, no a un chat simple |
| [Nimbalyst](https://nimbalyst.com/) (ex Crystal) | «Visual editor» para Claude Code y Codex; escritorio macOS/Windows/Linux + iOS. Apps MIT, gratis para individuos. Crystal ([repo](https://github.com/stravu/crystal)) está **sustituido** por Nimbalyst, último push 2026-02 | Sí (según la web) | «Works with your existing Claude Code or Codex subscription»; el proveedor gestiona auth | Candidato a mirar; es un **espacio de trabajo de programador** (worktrees, diffs) |
| [ccgui / desktop-cc-gui](https://github.com/zhukunpenglinyutong/desktop-cc-gui) | Cliente Tauri multimotor (Claude Code, Codex, Gemini…). MIT. Instalador `.exe` NSIS en Releases | Sí (instalador) | «Adaptadores de protocolo» en Rust, sin decir CLI/SDK (PC); credenciales en la config de cada CLI. Modos de permiso por motor, preguntas, **imágenes pegadas** | El más cercano en funciones, pero **UI en chino/inglés, sin español**, proyecto joven, mantenedores desconocidos. Seguridad y madurez: PC |
| [Conductor](https://www.conductor.build) | App de Melty Labs; **solo macOS** según [búsqueda](https://www.conductor.build/compare/claude-code) | **No** | — | **Descartado** (Mac) |
| Otros | Open Cowork (Windows/macOS, enfocado a Claude; PC), [Cockpit](https://github.com/Surething-io) (PC), Paseo, Superset: salen en búsquedas, **no leídos** | PC | PC | Sin evaluar |

## 2. Política de Anthropic sobre terceros (lo que choca)

Leído en [legal-and-compliance](https://code.claude.com/docs/en/legal-and-compliance), «Authentication and credential use»:

- La OAuth de suscripción es «exclusivamente» para compradores de planes y para «ordinary use of Claude Code and other
  native Anthropic applications».
- Quien construye productos, **«including those using the Agent SDK»**, debe usar API key. «Anthropic does not permit
  third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro,
  or Max plan credentials on behalf of their users», ni «collect, store, or intermediate Claude.ai credentials».
- La [nota del Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) repite: sin «claude.ai login or rate
  limits» para productos de terceros, **salvo aprobación previa**.
- Lo que sí deja: «an end user [signing] in to the unmodified Claude Code binary with their own Claude subscription,
  including where a platform hosts Claude Code». Y para integrar Claude Code en un producto: binario sin modificar,
  sin quitar métodos de login, y que **cada usuario use sus propias credenciales** (misma página, «Can customers offer
  Claude Code in their products?»).

Consecuencias, en llano:

| Puente | ¿Choca? |
|---|---|
| Apps oficiales (Desktop, VS Code, web) | No: son de Anthropic. |
| Terminal (pty) con el `claude` oficial sin modificar y el login del propio usuario | Encaja con la letra de la política (binario sin modificar, su propia suscripción). Es lo que ya hace la terminal de cuaderno-app. |
| `claude -p` / Agent SDK pilotado por una app de terceros con la suscripción del usuario | **Zona gris, probablemente no permitido** para quien distribuye la app: la política nombra el SDK. Un uso estrictamente personal con el binario del propio usuario no lo he visto resuelto por escrito: **por comprobar** (consulta a Anthropic). |
| CloudCLI (SDK) y clientes ACP de Claude (SDK) | Entran en la zona gris anterior. No se les ha visto aprobación previa: PC. |

Para OpenAI: la doc de Codex ofrece «Sign in with ChatGPT» como método propio del CLI/app ([auth](https://learn.chatgpt.com/codex/auth)); no he encontrado (ni buscado a fondo) una cláusula equivalente sobre terceros: **por comprobar**.

## 3. Lectura honesta: ¿alguna cubre «mi padre, Windows, carpeta del curso, sin miedo» tal cual?

**Esto sí (a probar, no a dar por hecho): la app de escritorio de Claude (pestaña Code) y la de ChatGPT con Codex.**
Cubren en papel todo lo duro: Windows nativo con instalador, login con la suscripción, abrir carpeta, permisos con
botones, imágenes, mismo CLAUDE.md/AGENTS.md y skills que la terminal. No hay que construir nada para eso.

**Esto hay que revisarlo antes de decir que valen:**
1. **«Sin miedo».** La de Claude es una app de programador (diffs, worktrees, PRs, terminal integrada, paneles); la de
   ChatGPT es más un chat, pero Codex dentro sigue hablando de proyectos, sandbox y PowerShell. Solo se sabe
   poniéndola delante de él. Una prueba de 20 minutos con la app instalada decide más que cualquier doc.
2. **Elevación en Windows (Codex).** El sandbox recomendado pide permisos de administrador; el fallback es más débil.
   Para un mayor sin soporte técnico puede ser un muro.
3. **Un solo proveedor por persona** en la práctica: no hay ajustes comunes Claude/Codex como los queremos en la app.
4. **Lanzarlas con la carpeta del curso desde otra app:** no está documentado para Desktop local (el enlace
   `claude://` solo documenta SSH). Lo único documentado con carpeta es abrir el **CLI en terminal**
   (`claude-cli://open?cwd=`), que es justo lo que queremos evitar. Habría que dejar que él abra la carpeta a mano
   la primera vez (el selector recuerda la última).

**Ya está (descartado):** extensiones de editor (VS Code, JetBrains, Zed) y editores ACP: son herramientas de
programador. claude.ai/code: no trabaja sobre la carpeta local. Interfaces de código abierto: ninguna tiene instalador
de Windows verificado y sin Node, con español, mantenimiento fiable y política limpia a la vez (opcode sin Windows;
Vibe Kanban cerrando; cdesktop beta; CloudCLI/ccgui con las pegas de arriba).

## 4. Qué perderíamos frente a un chat dentro de cuaderno-app

Esto no depende de ninguna candidata: ninguna conoce la app.

- **Saber qué página está abierta.** El chat oficial no sabe que él está mirando la nota X de su curso; habría que
  pegarla o decirla. Dentro de la app el contexto va solo (`chat-diseno.md`, §1).
- **El cajón al lado de la nota.** Una app aparte son dos ventanas: la nota en una y el chat en otra, con
  Alt+Tab. Para una persona mayor, es el mayor coste práctico.
- **Los mismos ajustes.** Proveedor, tema, atajos y estado de la conexión viven en dos sitios.
- **Todo lo del kit como botones.** Guardar/deshacer con `guardar.js`/`deshacer.js`, progreso y corrección salen de
  la app; en la app oficial son comandos o texto.
- **Control del lenguaje y del aspecto.** Las apps oficiales traen su propio vocabulario (sesión, worktree, diff,
  permission mode) y no se pueden traducir ni esconder.
- **A cambio ganaríamos** lo que no cuesta mantener: login, permisos, imágenes, actualizaciones y seguridad los
  lleva el fabricante. Esa es la razón de peso para, como mínimo, **probar primero las oficiales** antes de
  invertir más en el chat propio.

## 5. Por comprobar

1. **Windows nativo y Git** en Claude Desktop con una carpeta que no es un repositorio. La doc dice solo que los
   worktrees necesitan Git ([desktop](https://code.claude.com/docs/en/desktop)).
2. **Enlace a Desktop con carpeta local** (`claude://code/new?...` solo documenta `ssh_*` y `q`) y si `claude --desktop`
   sirve desde una app (Windows x64, CLI ≥2.1.285).
3. **Política con terceros y el SDK/`claude -p`:** consulta a Anthropic (contacto de ventas) si una app local que
   lanza el `claude` del propio usuario cuenta como «ofrecer login de Claude.ai». Hasta entonces, terminal (pty) o apps oficiales.
4. **Codex:** planes que lo incluyen, contenido de las páginas de AGENTS.md, Skills, permisos e imágenes
   ([learn.chatgpt.com/codex](https://learn.chatgpt.com/docs)); si la extensión de IDE va nativa en Windows;
   si hay URL o protocolo para abrir un proyecto; versión actual. https://openai.com/codex dio 403.
5. **Zed:** si Claude Agent y Codex funcionan en Windows y con login de suscripción.
6. **Aspecto real para una persona no técnica** de las dos apps oficiales: prueba con él o con capturas.
7. **Versiones y licencias exactas** de Claude Desktop y de la app de ChatGPT (no figuran en las docs leídas).
8. **CloudCLI en Windows** (¿npm nativo o solo companion?) y **cómo habla opcode con `claude`** (README no lo dice).
9. **ccgui:** puente real (CLI/SDK), seguridad y mantenedores; no se ha leído el código.
10. **Open Cowork, Cockpit, Paseo, Superset y los ~100 clientes ACP** no leídos.
11. **Embeber** apps oficiales: ninguna ofrece web local en iframe; claude.ai y chatgpt.com no confirmados.

## Fuentes principales (leídas 2026-10-08)

[Claude Desktop](https://code.claude.com/docs/en/desktop) · [Desktop quickstart](https://code.claude.com/docs/en/desktop-quickstart) ·
[Desktop en WSL](https://code.claude.com/docs/en/desktop-wsl) · [VS Code](https://code.claude.com/docs/en/vs-code) ·
[Web](https://code.claude.com/docs/en/claude-code-on-the-web) · [Overview](https://code.claude.com/docs/en/overview) ·
[Deep links](https://code.claude.com/docs/en/deep-links) · [Legal](https://code.claude.com/docs/en/legal-and-compliance) ·
[Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) · [Codex docs](https://learn.chatgpt.com/docs) ·
[Codex en Windows](https://learn.chatgpt.com/codex/windows/windows-app) · [Sandbox Windows](https://learn.chatgpt.com/codex/windows/windows-sandbox) ·
[Codex IDE](https://learn.chatgpt.com/codex/ide) · [Auth Codex](https://learn.chatgpt.com/codex/auth) ·
[Zed externos](https://zed.dev/docs/ai/external-agents) · [Zed Windows](https://zed.dev/windows) ·
[Clientes ACP](https://agentclientprotocol.com/overview/clients) · repos de GitHub enlazados en la tabla 1d.
