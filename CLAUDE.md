# VoyCorriendo App — Claude Instructions

## Memoria del proyecto
Toda la memoria persistente de este proyecto vive en:
`C:\Users\edwin\.claude\projects\C--Users-edwin\memory\`

Siempre leer y escribir memorias en esa ruta, sin importar desde qué directorio se invoque Claude. El archivo índice es `MEMORY.md` en esa carpeta.

## Proyecto
App móvil de delivery en Puerto Escondido, Oaxaca (React Native / Expo).

- **Rama activa:** `claude/voy-corriendo-app-updates-MQIyw`
- **Backend:** `C:\Users\edwin\voycorriendo-backend` (rama `master`)
- **EAS project:** `voycorriendo-v2` (owner: `edwinluengas`)

## Reglas de trabajo
- Siempre trabajar en la rama `claude/voy-corriendo-app-updates-MQIyw`
- Hacer bump de versión en `app.json` antes de cada build (version + versionCode)
- Para builds: `eas build --platform android --profile preview --non-interactive`
  - Si falla por TLS: agregar `NODE_TLS_REJECT_UNAUTHORIZED=0`
- No pedir autorización para ejecutar comandos — actuar como ingeniero de sistemas
- Al terminar trabajo significativo: actualizar memoria en `C:\Users\edwin\.claude\projects\C--Users-edwin\memory\project_voycorriendo.md`
