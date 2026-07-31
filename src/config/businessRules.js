/**
 * Reglas de negocio de VoyCorriendo — fuente única de verdad.
 * Cambia aquí y se propaga a toda la app automáticamente.
 */

// ─── Tarifas de envío (pagadas por el cliente, 100% para el repartidor) ─
// PLANAS: no dependen de la distancia. $40 estándar desde 2026-07-26 — con
// $35 y cobertura de 5 km, la utilidad del repartidor en una entrega larga
// quedaba por debajo del salario mínimo por hora ya descontados gasolina,
// mantenimiento y depreciación de la moto.
export const FEE_ENVIO = {
  standard: 40,
  express:  60,
};

// ─── Pedidos que caben en una misma ruta del repartidor ──────────────
// Hasta 3 en el mismo viaje, y SOLO si van por el mismo rumbo: el backend
// verifica que la recogida y la entrega queden cerca de las que ya trae
// (services/ruta.service.js). Los Express siempre viajan solos.
export const MAX_PEDIDOS_RUTA = 3;

// ─── Comisión plataforma al restaurante (flat, no porcentaje) ─────────
export const FEE_PLATAFORMA = 35;

// ─── Pedido mínimo en productos (sin contar envío) ──────────────────
export const PEDIDO_MINIMO = 150;

// ─── Efectivo: subtotal máximo (el fee de envío se suma encima) ──────
// $700 desde 2026-07-29 (fase de prueba real).
export const LIMITE_EFECTIVO = 700;

// ─── Métodos de pago habilitados ─────────────────────────────────────
// FASE DE PRUEBA REAL: solo efectivo. El pago con tarjeta NO se borró —
// queda completo y probado, solo apagado. El backend manda la verdad en
// /api/config-publica (métodos activos), así que se puede reactivar sin
// compilar un APK nuevo; esto es el valor por defecto mientras responde.
export const METODOS_PAGO_ACTIVOS_DEFAULT = ['efectivo'];

// ─── Canales que pueden entregar un código de recuperación ───────────
// El SMS está apagado mientras Twilio siga en cuenta de prueba (solo
// entrega a números verificados a mano, así que a un cliente real nunca le
// llegaba). El backend manda la verdad en /api/config-publica, así que se
// reactiva sin compilar un APK nuevo; esto es el valor por defecto mientras
// responde — y el fallback si el servidor no contesta.
export const CANALES_RECUPERACION_DEFAULT = ['email', 'telegram'];

// ─── Radio máximo de entrega desde el restaurante ────────────────────
// 6.5 km desde 2026-07-31. NO es que se haya ampliado la zona: la
// distancia dejo de medirse en linea recta y ahora se corrige por la
// traza urbana (x1.3), asi que los 5 km "rectos" de antes son ~6.5 km
// de recorrido real. El area atendida es la misma; el numero es honesto.
// El valor real lo manda el backend en /api/config-publica.
export const RADIO_MAXIMO_KM = 6.5;

// ─── Tope de deuda de restaurante (bloqueo automático) ───────────────
// Ya no es por monto acumulado — es por CANTIDAD de pedidos en efectivo
// sin liquidar. Al llegar a este número se bloquea, sea cual sea el monto.
export const LIMITE_PEDIDOS_DEUDA = 15;
export const AVISO_PEDIDOS_DEUDA = 12;

// ─── Fee de retiro diario del repartidor (viernes es gratis) ─────────
// Pago diario anticipado: 5% de descuento sobre el saldo (modelo 2026-07-23,
// reemplaza el fee fijo de $10). El corte del viernes sigue siendo gratis.
export const PCT_DESCUENTO_PAGO_DIARIO = 0.05;

// ─── Tipos de envío con etiquetas y precios ───────────────────────────
// `pickup` = el cliente pasa por su pedido al negocio: no paga envío. Si no
// hay ningún repartidor en línea con cupo, el backend
// (/api/pedidos/disponibilidad) responde que solo se ofrezca pickup.
export const TIPOS_ENVIO = [
  {
    id:     'standard',
    label:  'Estándar',
    emoji:  '🚚',
    sub:    'Mismo día',
    precio: FEE_ENVIO.standard,
  },
  {
    id:     'express',
    label:  'Express',
    emoji:  '⚡',
    sub:    'Prioritario — llega primero',
    precio: FEE_ENVIO.express,
  },
  {
    id:     'pickup',
    label:  'Recoger en tienda',
    emoji:  '🛍️',
    sub:    'Sin costo de envío',
    precio: 0,
  },
];
