'use strict';
// La configuración de electron-builder (plan de Electron, §2 fila Empaquetado y T6). Va en JS (CommonJS, como todo
// el repo) y no en YAML porque así lleva comentarios con el porqué de cada decisión y tests/empaquetado.test.js la lee
// con `require`, sin un parser de YAML. electron-builder la encuentra sola (electron-builder.{yml,json,js,...}).
//   npm run empaquetar                 → dist-app/<sistema>-unpacked/: la app sin instalador, para probarla en local
//   npm run empaquetar:instaladores    → .dmg (arm64 y x64) en un Mac; .exe (NSIS) en Windows
// FUSES SIN TOCAR: runAsNode y nodeCliInspect quedan como vienen (habilitados). El kit y el corrector corren con el
// binario de Electron y ELECTRON_RUN_AS_NODE=1 (necesita runAsNode) y el recorrido de Playwright `_electron.launch`
// necesita nodeCliInspect. No se configura `electronFuses` (plan §2 fila Node para el kit, R11, §9 objeción 5).
const files = [
  // Lo que la app necesita en el paquete, y nada más (R6): el proceso principal y el hijo (electron/), la pantalla
  // (public/) y los módulos de la raíz de los que depende el servidor. La lista de la raíz es explícita (un `*.js`
  // metería server.js, este fichero y lo que venga); tests/empaquetado.test.js comprueba que cada módulo que requieren
  // electron/main.js y electron/servidor-hijo.js está aquí.
  'electron/**',
  '!electron/icono/**',           // el PNG es para construir el .icns y el .ico, no para la app
  'public/**',
  'package.json',
  'servidor.js', 'cuaderno.js', 'kit.js', 'guardar.js', 'formulario.js', 'config.js', 'sistema.js', 'markdown.js', 'tarjetas.js', 'ignorar.js',
  // node_modules: electron-builder mete solo las dependencias de producción (package.json `dependencies`); se excluye
  // además, por si acaso, lo de desarrollo y lo que un paquete arrastra sin que haga falta en la app.
  '!node_modules/electron/**',
  '!node_modules/electron-builder/**',
  '!node_modules/playwright/**',
  '!node_modules/playwright-core/**',
  '!node_modules/**/*.{md,markdown,ts,map,d.ts}',
  '!node_modules/**/{test,tests,__tests__,example,examples,docs,doc,.github}/**',
  '!node_modules/node-pty/{src,deps,binding.gyp}/**',   // las fuentes nativas no hacen falta: el .node ya está compilado
  // Lo que no es de la app: tests, documentación, el cuaderno de ejemplo, las sondas, copias de prueba, la CI.
  '!tests/**', '!docs/**', '!ejemplos/**', '!pruebas/**', '!cuadernos-prueba/**', '!.github/**',
  '!dist-app/**', '!server.js', '!electron-builder.js', '!*.md', '!.cobertura-pantalla/**',
];

module.exports = {
  appId: 'es.cuaderno.app',          // un identificador, sin dominio real detrás (principio 5)
  productName: 'Cuaderno',
  copyright: 'MIT',
  // Sin asar en la primera versión (plan §2, §9 objeción 11): no por el fs (Electron lo parchea) sino porque para dos
  // usuarios compensa poder abrir y parchear public/app.js dentro del bundle y que la señal «desactualizada» por mtime
  // siga valiendo. Coste: miles de ficheros, primera apertura e instalación NSIS más lentas (medido en T6; cifras en
  // el plan). Ruta de vuelta: asar: true con asarUnpack: ['node_modules/node-pty/**'] (sus ejecutables tienen que
  // estar en disco; node-pty ya sabe buscarlos en app.asar.unpacked).
  asar: false,
  // node-pty trae prebuilds N-API para Mac y Windows que valen tal cual en Electron 44: no se recompila nada (R3).
  // En Linux no hay prebuild: lo compila `npm ci` con el Node del sistema y, siendo N-API, Electron lo carga igual.
  npmRebuild: false,
  files,
  directories: { output: 'dist-app' },
  mac: {
    // Firma AD HOC (plan §9 objeción 1): sin `identity`, electron-builder NO firma (no hay caída automática a ad hoc) y
    // con `identity: null` tampoco; un .dmg sin firma descargado en un Mac arm64 sale «dañado», sin el botón «Abrir de
    // todos modos». Con "-" queda firmado ad hoc, que es lo que Gatekeeper admite tras Privacidad y seguridad → «Abrir
    // de todos modos» (INSTALAR.md). Criterio (§5 bis): `codesign -dv --verbose=2 Cuaderno.app` dice Signature=adhoc e
    // Identifier=es.cuaderno.app. Ad hoc no admite hardened runtime ni notarización.
    identity: '-',
    hardenedRuntime: false,
    notarize: false,
    gatekeeperAssess: false,
    category: 'public.app-category.education',
    icon: 'electron/icono/icono.png',   // electron-builder genera el .icns (npm run icono rehace el PNG desde el SVG)
    target: [{ target: 'dmg', arch: ['arm64', 'x64'] }],   // uno por arquitectura; sin universal (dobla el tamaño sin ganar nada)
    darkModeSupport: true,
  },
  dmg: { writeUpdateInfo: false },
  win: {
    icon: 'electron/icono/icono.png',   // electron-builder genera el .ico
    target: [{ target: 'nsis', arch: ['x64'] }],
  },
  nsis: {
    oneClick: false,                            // un instalador normal, con sus pasos
    perMachine: false,                          // instalación por usuario: sin pedir administrador
    allowToChangeInstallationDirectory: false,  // sin preguntar dónde (plan T6: «por usuario sin preguntar»)
    language: '3082',                           // castellano (LCID de es-ES); el instalador no pregunta el idioma
    installerLanguages: ['es_ES', 'en_US'],
    shortcutName: 'Cuaderno',
    differentialPackage: false,                 // sin actualizador: el paquete diferencial (blockmap) no sirve de nada
  },
  linux: {
    // No es objetivo (plan §2): queda por si alguien lo quiere. Aquí node-pty no tiene prebuild: lo compila `npm ci`.
    icon: 'electron/icono/icono.png',
    category: 'Education',
    target: ['AppImage'],
  },
  publish: null,   // nada se publica desde aquí: los instaladores los sube la CI como artefactos (T7)
};
