# Inventario técnico de datos personales — VoyCorriendo

**Preparado por:** asistencia de IA (Claude, Anthropic) a partir de una revisión directa del código fuente de los repositorios `voycorriendo-backend` y `voycorriendo-app`, el 2026-07-21.
**Propósito:** insumo técnico para que un abogado especializado en protección de datos redacte o revise el Aviso de Privacidad conforme a la LFPDPPP. Este documento describe **qué hace el sistema realmente**, verificado en el código — no es en sí mismo un documento legal ni sustituye asesoría jurídica.

---

## 1. Identidad del responsable (a completar por el negocio)

| Campo | Valor |
|---|---|
| Nombre comercial | VoyCorriendo |
| Correo de contacto | voycorriendoadmin@gmail.com |
| Domicilio fiscal | **PENDIENTE — completar con el domicilio legal registrado ante el SAT** |
| Razón social / RFC | **PENDIENTE — depende de si se opera como persona física con actividad empresarial o persona moral** |
| Ciudad de operación | Puerto Escondido, Oaxaca, México |

---

## 2. Categorías de titulares de datos

1. **Clientes** — usuarios que piden comida/productos.
2. **Repartidores** — trabajadores independientes que hacen las entregas.
3. **Negocios** — restaurantes/tiendas que venden a través de la plataforma (dueño/representante).
4. **Administradores** — personal interno de VoyCorriendo.

---

## 3. Datos recolectados por categoría

### 3.1 Todos los usuarios (tabla `usuarios`)
| Dato | Obligatorio | Fuente | Notas |
|---|---|---|---|
| Nombre, apellido | Sí | Registro | |
| Teléfono | Sí | Registro | Usado también como identificador de login y para OTP por SMS |
| Correo electrónico | No | Registro | |
| Contraseña | Condicional | Registro | Cifrada con bcrypt (hash irreversible), nunca en texto plano |
| Foto de perfil | No (Sí para repartidor) | Selfie en onboarding | |
| Token de notificaciones push | Automático | Dispositivo (Expo) | |
| Chat ID de Telegram | No | Vinculación opcional | Solo si el negocio/repartidor decide vincular Telegram para alertas |
| Consentimiento de términos y marketing | Sí | Registro | Columnas `acepto_terminos`, `terminos_aceptados_en`, `acepta_marketing` |

### 3.2 Clientes específicamente
| Dato | Notas |
|---|---|
| Direcciones guardadas | Texto libre + coordenadas GPS |
| Ubicación GPS en tiempo real | Al hacer un pedido, para calcular distancia/costo de envío |
| Historial de pedidos | Productos, montos, fechas |
| Calificaciones dadas a negocios/repartidores | Incluye comentario de texto libre opcional |
| Foto de INE | **Solo si el pedido incluye productos con restricción de edad** (alcohol/tabaco) — se sube al confirmar el pedido, la ve el repartidor al entregar |
| Tarjetas de pago (metadata) | **NUNCA se guarda el número completo ni el CVV** — solo: últimos 4 dígitos, marca, mes/año de vencimiento, un identificador de token de Mercado Pago (`mp_card_id`). El número y CVV viajan únicamente entre el dispositivo del cliente y los servidores de Mercado Pago. |

### 3.3 Repartidores específicamente (tabla `repartidores`)
| Dato | Notas |
|---|---|
| Foto de INE (frente y reverso) | Verificación de identidad, revisión manual por admin |
| Foto de licencia de conducir | |
| Foto de tarjeta de circulación | |
| Selfie de perfil | Para que el negocio/cliente identifique visualmente a quien entrega |
| Datos del vehículo | Tipo, marca, modelo, año, color, **placa** |
| CLABE bancaria | **Cifrada con AES-256-GCM** en la base de datos (no en texto plano) |
| Ubicación GPS en tiempo real | Mientras está "conectado", para asignación de pedidos y ruta |
| Calificación promedio | Calculada de las calificaciones de clientes |

### 3.4 Negocios específicamente (tabla `negocios`)
| Dato | Notas |
|---|---|
| Foto de INE del dueño/representante | |
| Comprobante de domicilio | |
| RFC | Opcional |
| CLABE bancaria | Cifrada con AES-256-GCM |
| Dirección + coordenadas GPS | **Obligatorio y verificado por GPS** — el dueño debe confirmarlo parado en el local |
| Fotos del local, portada, productos | |
| Datos financieros internos | Ventas, comisiones, deuda con la plataforma |

### 3.5 Registro de entregas — dato nuevo (2026-07-20)
Cada pedido guarda, al momento en que un repartidor lo acepta, una **copia inmutable** de: foto de perfil del repartidor, placa del vehículo y nombre — para trazabilidad de seguridad ("quién entregó cada pedido"), aunque el repartidor cambie después su foto o vehículo. Esto es un dato nuevo que **debe reflejarse explícitamente en el Aviso de Privacidad** como finalidad de seguridad/prevención de fraude.

---

## 4. Finalidades del tratamiento (identificadas en el código)

**Primarias (necesarias para operar el servicio):**
- Crear y gestionar la cuenta de usuario.
- Procesar, entregar y dar seguimiento a pedidos.
- Procesar pagos (efectivo, tarjeta, transferencia SPEI).
- Verificar identidad de repartidores y negocios antes de aprobarlos.
- Verificar edad del comprador en productos restringidos (alcohol/tabaco).
- Asignar repartidores por proximidad geográfica.
- Comunicar el estado del pedido (push, SMS, Telegram).
- Prevención de fraude y seguridad: detectar cuentas duplicadas (misma placa/dirección), mantener registro de quién realizó cada entrega, calcular reputación (calificaciones) para suspender cuentas con desempeño reprobatorio.
- Liquidación de pagos entre la plataforma, negocios y repartidores.

**Secundarias (requieren consentimiento explícito, ya distinguido en el registro vía `acepta_marketing`):**
- Envío de promociones o comunicación de marketing.

---

## 5. Terceros que reciben o procesan datos personales

| Tercero | Qué datos | Para qué | ¿Transferencia internacional? |
|---|---|---|---|
| **Mercado Pago** (Mercado Libre Inc./MercadoPago S.A.) | Nombre, correo, teléfono del pagador; token de tarjeta (nunca el número completo/CVV) | Procesar pagos con tarjeta, custodiar tarjetas guardadas | Sí — Mercado Pago opera desde Argentina/regionalmente |
| **Supabase** (Supabase Inc.) | Toda la base de datos y todos los documentos/fotos subidos (INE, selfies, comprobantes) | Almacenamiento de base de datos y archivos | Sí — infraestructura en la nube, típicamente fuera de México |
| **Railway** (Railway Corp.) | Todo el tráfico que pasa por el backend | Hosting del servidor | Sí — infraestructura en EE.UU. |
| **Twilio Inc.** | Número de teléfono | Envío de SMS con código OTP de verificación | Sí — EE.UU. |
| **Google (Google Maps Platform)** | Coordenadas GPS, direcciones | Cálculo de distancias y rutas | Sí — EE.UU. |
| **Expo (650 Industries Inc.)** | Token de dispositivo | Notificaciones push | Sí — EE.UU. |
| **Telegram** | Chat ID (solo si el usuario vincula voluntariamente) | Alertas operativas a negocios/repartidores | Sí — fuera de México (opcional/voluntario) |

**Nota para el abogado:** la LFPDPPP exige informar expresamente en el Aviso de Privacidad si hay transferencias de datos a terceros y, en su caso, si son nacionales o internacionales, y obtener el consentimiento correspondiente cuando la ley lo requiera. La lista de arriba son TODOS los terceros con acceso a datos personales identificados en el código a la fecha de este documento.

---

## 6. Medidas de seguridad implementadas (verificadas en código)

- Contraseñas: hash con bcrypt (costo 12), nunca almacenadas ni transmitidas en texto plano.
- CLABE bancaria (repartidores y negocios): cifrada con AES-256-GCM en la base de datos.
- Datos de tarjeta de pago: **arquitectura "nunca toca el servidor"** — el número de tarjeta y CVV se tokenizan directo entre la app y Mercado Pago; el backend de VoyCorriendo nunca los recibe ni los almacena, ni cifrados ni en texto plano.
- Sesiones: JWT con mecanismo de revocación (`token_version`) — cerrar sesión invalida el token de inmediato.
- OTP (código de un solo uso por SMS): hash con bcrypt, máximo 5 intentos, expira.
- Comunicación: HTTPS en todos los endpoints.
- Webhooks de Mercado Pago: verificados con firma HMAC-SHA256 para evitar suplantación.
- Bitácora de auditoría (`audit_logs`): registra acciones de administradores (aprobar, rechazar, bloquear cuentas) con quién, cuándo y qué cambió.
- Enmascaramiento de teléfonos en logs del sistema.

---

## 7. Retención y eliminación de datos — ⚠️ hallazgos que requieren decisión

1. **La pantalla actual de Política de Privacidad de la app afirma que la foto de INE (verificación de edad) "se elimina automáticamente 30 días después".** Se revisó el código del backend y **este borrado automático NO existe** — no hay ningún proceso programado (cron job) que elimine estas fotos. Esto es una afirmación que la app le hace al usuario y que hoy **no se cumple técnicamente**. Antes de publicar cualquier Aviso de Privacidad que repita esta afirmación, hay que decidir entre: (a) implementar el borrado automático real, o (b) corregir el texto para no prometer algo que no sucede. Bajo la LFPDPPP, decirle al usuario algo falso sobre el tratamiento de sus datos es en sí mismo un incumplimiento del principio de "información".
2. **No existe un mecanismo automatizado de eliminación de cuenta.** El proceso actual es: el usuario escribe un correo, un operador lo procesa manualmente en un máximo declarado de 15 días hábiles. Esto PUEDE ser válido para ejercer derechos ARCO si efectivamente se cumple de forma consistente, pero no hay manera técnica de auditar que siempre se cumpla el plazo.
3. **No hay política de retención definida para el resto de los datos** (fotos de documentos de repartidores/negocios, historial de pedidos, ubicaciones). LFPDPPP exige conservar los datos personales solo el tiempo necesario para cumplir la finalidad — esto debe definirse explícitamente (ej. "documentos de verificación se conservan mientras la cuenta esté activa + X años tras el cierre por obligaciones fiscales/contables").

---

## 8. Datos sensibles / de especial protección

- **Ninguno de tipo biométrico se procesa hoy de forma automatizada.** Las fotos de INE y selfie se almacenan como imágenes para revisión humana (un administrador las mira y aprueba manualmente) — no hay reconocimiento facial ni comparación biométrica automatizada implementada. Si en el futuro se agrega verificación facial automática, ese sí sería un dato biométrico sujeto a las reglas reforzadas de consentimiento de la LFPDPPP para datos sensibles, y este documento tendría que actualizarse.
- La combinación de fotografía de INE + domicilio + datos financieros (CLABE) sí amerita el más alto estándar de cuidado aunque no sea técnicamente "dato sensible" bajo la definición estricta de la ley.

---

*Fin del inventario técnico. Este documento debe entregarse junto con el borrador de Aviso de Privacidad al abogado que realice la revisión legal.*
