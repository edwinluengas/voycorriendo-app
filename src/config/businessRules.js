/**
 * Reglas de negocio de VoyCorriendo — fuente única de verdad.
 * Cambia aquí y se propaga a toda la app automáticamente.
 */

// ─── Tarifas de envío (pagadas por el cliente, 100% para el repartidor) ─
export const FEE_ENVIO = {
  standard: 35,
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
export const TOPE_DEUDA_RESTAURANTE = 1000;
export const AVISO_DEUDA_RESTAURANTE = 700;

// ─── Fee de retiro diario del repartidor (viernes es gratis) ─────────
export const FEE_RETIRO_DIARIO = 10;

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
