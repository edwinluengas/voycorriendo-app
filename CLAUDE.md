# VoyCorriendo App — Claude Instructions

## Memoria del proyecto
Toda la memoria persistente vive en:
`C:\Users\edwin\.claude\projects\C--Users-edwin\memory\`
El índice es `MEMORY.md`. Leer `project_voycorriendo.md` al inicio de cada sesión.

---

## Stack técnico
- **React Native** 0.81.5 · **Expo SDK** 54
- `newArchEnabled: true` · `edgeToEdgeEnabled: true` (Android)
- **Navegación:** React Navigation v7 (Stack)
- **API:** Axios (`src/api/client.js`) — base URL desde `API_URL` en `app.json` extras

## Ramas y repos
- **Rama activa app:** `claude/voy-corriendo-app-updates-MQIyw`
- **Backend local:** `C:\Users\edwin\voycorriendo-backend` (rama `master`)
- **EAS project:** `voycorriendo-v2` (owner: `edwinluengas`)

---

## Reglas de trabajo
- Siempre trabajar en la rama `claude/voy-corriendo-app-updates-MQIyw`
- Hacer bump de versión en `app.json` antes de cada build
- Para builds: `NODE_TLS_REJECT_UNAUTHORIZED=0 eas build --platform android --profile preview --non-interactive`
- No pedir autorización para ejecutar comandos — actuar como ingeniero de sistemas
- Al terminar trabajo significativo: actualizar `project_voycorriendo.md` en memoria

---

## Arquitectura de navegación (`src/navigation/RootNavigator.js`)
El stack raíz cambia según `usuario.modo_activo`:
- `cliente` → `ClienteStack` (InicioClienteScreen, CarritoScreen, SeguimientoScreen, …)
- `repartidor` → `RepartidorStack` (InicioRepartidorScreen, PedidoActivoScreen, GananciasRepartidorScreen, …)
- `negocio` → `NegocioStack` (DashboardNegocioScreen, ProductosNegocioScreen, GananciasNegocioScreen, …)
- `admin` → `AdminStack`

---

## Archivos clave
| Archivo | Propósito |
|---------|-----------|
| `src/api/client.js` | Todos los llamados API (pedidosAPI, repartidoresAPI, negocioOnboardingAPI, …) |
| `src/theme/colors.js` | Paleta: `primario #FF5C00`, `secundario #00B341`, `fondo #F8F9FA` |
| `src/navigation/RootNavigator.js` | Toda la navegación — agregar pantallas aquí |
| `src/components/Campo.js` | TextInput reutilizable — NO usar `elevation` en `inputFoco` (bug Android New Arch) |
| `app.json` | version string + API_URL |

---

## Gotchas Android New Architecture (Fabric + edge-to-edge)

### TextInput / teclado
- **NUNCA** cambiar `elevation` en un View que envuelve TextInput al hacer focus — provoca flash del teclado en Fabric
- `KeyboardAvoidingView` dentro de Modal: `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`, `keyboardVerticalOffset={0}`
- En ScrollView con inputs: `automaticallyAdjustKeyboardInsets={true}`, `keyboardShouldPersistTaps="always"`

---

## Reglas de negocio (CRÍTICAS — no romper)
1. **La plataforma NUNCA custodia dinero de comida.** No hay wallet ni escrow para fondos de negocios/clientes.
2. **La tarifa de envío la paga el CLIENTE** y es ingreso del REPARTIDOR, sujeto a comisión de plataforma.
3. **EXPRESS siempre viaja solo** — exclusivo, sin batch con otros pedidos.
4. **Propina** va 100% al repartidor, sin comisión de plataforma.
5. **Pedido mínimo:** $500 MXN en productos (sin incluir envío).
6. **Efectivo:** máximo $500 MXN total (productos + envío).

---

## Seguridad frontend (no revertir)
- `SeguimientoScreen.calificar()`: validar `propina <= 1000` antes de enviar
- `keyboardType="numeric"` + `maxLength` en todos los inputs numéricos
- No mostrar `codigo_entrega` al repartidor (solo al cliente)
