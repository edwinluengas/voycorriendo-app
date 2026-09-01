# Ficha de Google Play — VoyCorriendo

> **LA TARJETA ESTÁ APAGADA** (`METODOS_PAGO_ACTIVOS=efectivo` en Railway,
> verificado hoy). La descripción de abajo ya NO promete pago con tarjeta:
> anunciarlo y que no funcione trae reseñas de una estrella —de lo más difícil
> de revertir— y Google puede rechazar la ficha por descripción engañosa.
>
> Cuando reactives la tarjeta, cambia la sección "CÓMO PAGAS" por el texto que
> está comentado justo debajo de ella. Reactivar es una variable, sin build:
> `railway variables --service voycorriendo-backend --set "METODOS_PAGO_ACTIVOS=efectivo,tarjeta"`
>
> OJO: el pago con tarjeta está probado y funcionando (hay una transacción real
> exitosa), pero se apagó a propósito para la fase de prueba. Reactivar es una
> decisión de negocio, no técnica.

## Nombre (máx. 30 caracteres)

VoyCorriendo: Entregas

## Descripción corta (máx. 80)

Comida y mandados a domicilio en Puerto Escondido, Putla, Zacatepec y Pinotepa.

## Categoría

Comida y bebida (NO "Compras" — es donde la gente busca delivery)

## Descripción larga

Pide de los negocios de tu pueblo y recíbelo en tu puerta.

VoyCorriendo conecta a los restaurantes, tiendas y farmacias de Puerto Escondido, Putla Villa de Guerrero, Santa María Zacatepec y Santiago Pinotepa Nacional con quienes viven ahí. Sin cadenas nacionales, sin comisiones escondidas.

CÓMO FUNCIONA

1. Elige un negocio de tu localidad
2. Arma tu pedido y confirma tu dirección
3. Sigue a tu repartidor en el mapa, en vivo
4. Recibe tu pedido y paga como prefieras

CÓMO PAGAS

Por ahora, en efectivo al recibir tu pedido.

<!-- CAMBIAR POR ESTO cuando la tarjeta se reactive en Railway:

CÓMO PAGAS

Con tarjeta desde la app, sin salir de ella y sin necesitar cuenta de nada más. Guardas tu tarjeta una vez y las siguientes veces solo confirmas. Tus datos los procesa Mercado Pago: el número de tu tarjeta nunca se guarda en nuestros servidores.

O en efectivo al recibir, si lo prefieres así.
-->

QUÉ CUESTA

El envío es de $40 y no cambia con la distancia: cuesta lo mismo si vives a tres cuadras o al otro lado del pueblo. Si tienes prisa, el envío Express llega primero por $60.

¿Prefieres pasar tú? Elige "Recoger en tienda" y no pagas envío.

El precio que ves al confirmar es el que pagas. No cobramos cargos por servicio ni tarifas dinámicas en horas pico.

PARA QUIEN TIENE UN NEGOCIO

Da de alta tu restaurante, tienda o farmacia y recibe pedidos sin instalar nada más. Administras tu menú, tus horarios y tus pedidos desde la misma app. La comisión es una cantidad fija por pedido, no un porcentaje de tu venta.

PARA QUIEN QUIERE REPARTIR

Si tienes moto y licencia vigente, puedes trabajar con nosotros. Tú decides cuándo conectarte. La tarifa de envío es tuya, y las propinas también, completas. Puedes cobrar el viernes sin costo o pedir tu dinero cualquier otro día.

UNA SOLA CUENTA

Con el mismo número puedes ser cliente, repartidor y negocio. Cambias de modo desde tu perfil, sin cerrar sesión.

TU PEDIDO, SEGURO

Cada entrega tiene un código de 4 dígitos que solo tú ves. El repartidor te lo pide al entregarte, así nadie más puede recibir lo que pediste. Verás su nombre, su foto y las placas de su moto desde que acepta tu pedido.

Los productos con restricción de edad requieren identificación al comprarlos.

DÓNDE ESTAMOS

Puerto Escondido, Putla Villa de Guerrero, Santa María Zacatepec y Santiago Pinotepa Nacional, Oaxaca. Vamos pueblo por pueblo, con los negocios de cada lugar.

La app te muestra los negocios de TU localidad: no verás restaurantes a los que nadie puede llevarte.

¿Tu negocio quiere estar aquí? Escríbenos a voycorriendoadmin@gmail.com

## Notas de la versión (máx. 500)

Primera versión de VoyCorriendo.

Pide de los negocios de tu localidad y sigue a tu repartidor en el mapa, en vivo. Con una sola cuenta puedes ser cliente, repartidor o negocio.

## URLs para la ficha

- Política de privacidad: https://voycorriendo-backend-production.up.railway.app/privacidad
- Términos: https://voycorriendo-backend-production.up.railway.app/terminos
- Eliminación de cuenta (OBLIGATORIA desde 2024): https://voycorriendo-backend-production.up.railway.app/eliminar-cuenta
- Correo de contacto: voycorriendoadmin@gmail.com

## Assets pendientes

- Icono 512×512 px
- Gráfico de portada 1024×500 px
- Capturas: catálogo, seguimiento con mapa, ganancias, alta de negocio (mín. 2, ideal 4-8)

## Acceso para los revisores de Google

Sin esto Play rechaza la app: el login es por teléfono y un revisor no puede
registrarse solo. **No se usa la cuenta del dueño (5545074460): es una cuenta
real con su negocio y su historial**; un revisor tocando ahí puede alterar
datos de operación.

Las cuentas de abajo están ancladas a Puerto Escondido con `ciudad_fija`, así
que ven el catálogo desde cualquier parte del mundo. Sin eso, un revisor en
Estados Unidos vería "Sin cobertura en este lugar" y reportaría que la app no
funciona. Verificado simulando una sesión desde California.

Pegar TAL CUAL en "Instrucciones para el acceso":

```
Usuario: 0000000002    Contraseña: VoyTest2026!

La app muestra los negocios de la localidad del usuario según su GPS.
Esta cuenta está configurada para mostrar el catálogo de Puerto Escondido,
Oaxaca, desde cualquier ubicación.

Para probar el reparto, inicie sesión con 0000000004 / VoyTest2026!,
cambie a modo Repartidor en Perfil y active "Conectarme".
```

**Al terminar la revisión**, quitar el anclaje:
`node src/scripts/preparar-revision.js --revertir`


## Formulario de Data safety

Se llena en la consola. Declarar de MENOS y que Google lo detecte después es
peor que un rechazo: es suspensión. Esto es lo que la app recolecta de verdad
(sale de `legal/inventario-tecnico-datos.md`, verificado contra el código):

| Dato | Se recolecta | Se comparte | Para qué |
|---|---|---|---|
| Ubicación aproximada y precisa | Sí | No | Mostrar los negocios de la localidad y calcular la entrega |
| Nombre | Sí | Sí (al negocio y repartidor del pedido) | Identificar el pedido |
| Teléfono | Sí | Sí (al repartidor asignado) | Contacto durante la entrega |
| Correo | Sí | No | Recuperar la contraseña y avisos de cuenta |
| Dirección | Sí | Sí (al repartidor asignado) | Entregar el pedido |
| Fotos | Sí | No | Fotos de producto y documentos de verificación |
| Documentos de identidad | Sí | No | Verificar a negocios y repartidores (bucket privado) |
| Información de pago | Sí | Sí (Mercado Pago) | Cobrar. **El número de tarjeta nunca toca nuestros servidores** |
| Historial de pedidos | Sí | No | Mostrar "Mis pedidos" y la contabilidad |

Responder también:
- **¿Se cifra en tránsito?** Sí (HTTPS en todo).
- **¿El usuario puede pedir que se borren sus datos?** Sí — dentro de la app
  (Perfil → Eliminar mi cuenta) y en la URL pública de arriba.
- **¿Datos de menores?** La app no está dirigida a menores de 18.

## Permiso de ubicación — declaración aparte

Google pide justificar el permiso. Es SOLO en primer plano
(`ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`, sin `BACKGROUND`):

> La ubicación se usa mientras la app está abierta para mostrar los negocios
> de la localidad del usuario, calcular la distancia y el costo de entrega, y
> —en modo repartidor— compartir la posición con el cliente durante una
> entrega en curso.

## Play App Signing

Al subir el primer AAB, Google pregunta si usar Play App Signing. **Es
irreversible.** Lo recomendable es aceptar: Google guarda la llave de firma,
y si se pierde la propia no se pierde la app.


## Reactivar el pago con tarjeta más adelante

**No hace falta compilar ni volver a subir la app.** Verificado el 2026-08-07
levantando el servidor con la tarjeta encendida y probando contra el mismo
binario que ya está compilado (v1.2.52):

- La llave pública de Mercado Pago **ya viaja dentro del APK/AAB**
  (`app.json → extra.mpPublicKey`, la de producción). Es lo único que
  habría obligado a recompilar, y ya está ahí.
- La app pregunta al servidor qué métodos aceptar (`/api/config-publica`) al
  abrir el checkout, y pinta el selector con lo que venga. No trae la lista
  escrita en el código.
- El formulario de tarjeta, las tarjetas guardadas y los endpoints de cobro
  están compilados y vivos — solo los tapa el interruptor.

### Los tres pasos

**1. Encender el interruptor** (efecto inmediato, sin desplegar):
```
railway variables --service voycorriendo-backend --set "METODOS_PAGO_ACTIVOS=efectivo,tarjeta"
```

**2. Probar con una tarjeta real por un monto chico.** No hay entorno de
pruebas: las credenciales de Mercado Pago son de producción, así que la única
forma de verificar el cobro de punta a punta es una compra real. Ya hubo una
transacción exitosa (pedido MND-697030, $185), pero conviene repetirla antes
de anunciarlo.

**3. Actualizar la descripción de la ficha** en Play Console: cambiar la
sección "CÓMO PAGAS" por el texto comentado que está justo debajo de ella en
este archivo. Editar la descripción pasa por revisión de Google (suele tardar
horas), **pero la app publicada sigue funcionando mientras tanto** — no se
cae nada.

### Lo que NO cambia

- **Data safety**: ya está declarado "Información de pago — se comparte con
  Mercado Pago". No hay que tocar el formulario.
- **La versión de la app**: no sube, no hay binario nuevo.
- **Los permisos**: los mismos.

### El orden importa

Encender la tarjeta **antes** de anunciarla en la ficha. Al revés —anunciarla
y que no funcione— trae reseñas de una estrella, que son de lo más difícil de
revertir, y Google puede rechazar la ficha por descripción engañosa.
