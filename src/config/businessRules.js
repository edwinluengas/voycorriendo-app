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

// ─── Comisión plataforma al restaurante (flat, no porcentaje) ─────────
export const FEE_PLATAFORMA = 35;

// ─── Pedido mínimo en productos (sin contar envío) ──────────────────
export const PEDIDO_MINIMO = 150;

// ─── Efectivo: subtotal máximo (el fee de envío se suma encima) ──────
export const LIMITE_EFECTIVO = 500;

// ─── Radio máximo de entrega desde el restaurante ────────────────────
export const RADIO_MAXIMO_KM = 5;

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
];
